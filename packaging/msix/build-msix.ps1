<#
  Packs one OpenTick .msix (unsigned: the Microsoft Store signs it) with makeappx, from an already-built opentick.exe.

    pwsh packaging/msix/build-msix.ps1 -Exe src-tauri/target/release/opentick.exe -Arch x64 -Out staged

  -Arch    x64 | x86 | arm64   which CPU the exe was built for
  -Version defaults to package.json's version; the manifest gets "x.y.z.0" (the Store wants four numbers and reserves the fourth)
  -Out     folder for OpenTick_<version>_<arch>.msix

  Needs makeappx.exe, which is in the Windows SDK (already on GitHub's windows runners).
#>
param(
  [Parameter(Mandatory)][string]$Exe,
  [Parameter(Mandatory)][ValidateSet('x64', 'x86', 'arm64')][string]$Arch,
  [string]$Version,
  [string]$Out = 'staged'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
if (-not $Version) { $Version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version }
if ($Version -notmatch '^(\d+\.\d+\.\d+)') { throw "Expected a version like 1.2.3, found '$Version'." }
$four = "$($Matches[1]).0"

function Find-MakeAppx {
  $c = Get-Command makeappx.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $hostArch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $found = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^10\.' } | Sort-Object { [version]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName "$hostArch\makeappx.exe" } | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $found) { throw 'makeappx.exe was not found. Install the Windows 10/11 SDK.' }
  $found
}

$exePath = (Resolve-Path $Exe).Path
$manifestSrc = Join-Path $PSScriptRoot 'Package.appxmanifest'
$assets = Join-Path $PSScriptRoot 'Assets'
$layout = Join-Path $root ".build/msix/$Arch"
if (Test-Path $layout) { Remove-Item $layout -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $layout 'Assets') | Out-Null
New-Item -ItemType Directory -Force -Path $Out | Out-Null

Copy-Item $exePath (Join-Path $layout 'opentick.exe')
Copy-Item (Join-Path $assets '*') (Join-Path $layout 'Assets') -Recurse -Force

# the checked-in manifest is a template: it gets the real exe name, version and CPU here
$xml = New-Object System.Xml.XmlDocument
$xml.PreserveWhitespace = $true
$xml.Load($manifestSrc)
$identity = $xml.SelectSingleNode("/*[local-name()='Package']/*[local-name()='Identity']")
if (-not $identity) { throw 'Package/Identity is missing from the manifest.' }
if ($identity.GetAttribute('Name') -ne 'Jebby.OpenTick') { throw "Unexpected package identity: $($identity.GetAttribute('Name'))" }
if ($identity.GetAttribute('Publisher') -ne 'CN=15641029-37C5-42A0-8297-2EAC5C6A0BD5') { throw 'The manifest publisher does not match the Store identity.' }
$identity.SetAttribute('Version', $four)
$identity.SetAttribute('ProcessorArchitecture', $Arch)
$app = $xml.SelectSingleNode("//*[local-name()='Application']")
$app.SetAttribute('Executable', 'opentick.exe')
$utf8 = New-Object System.Text.UTF8Encoding($false)
$manifest = Join-Path $layout 'AppxManifest.xml'
$xml.Save($manifest)
[IO.File]::WriteAllText($manifest, [IO.File]::ReadAllText($manifest), $utf8)

# every image the manifest names must be in the package, or the Store rejects it
$names = [regex]::Matches((Get-Content $manifest -Raw), '(?:Logo|Square\d+x\d+Logo|Wide\d+x\d+Logo)(?:=|>)"?([^"<]*\.png)') | ForEach-Object { $_.Groups[1].Value }
foreach ($rel in ($names | Select-Object -Unique)) {
  if (-not (Test-Path (Join-Path $layout ($rel -replace '/', '\')) -PathType Leaf)) { throw "Manifest image is missing: $rel" }
}

$msix = Join-Path (Resolve-Path $Out) "OpenTick_${Version}_$Arch.msix"
& (Find-MakeAppx) pack /d $layout /p $msix /o
if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed ($LASTEXITCODE)." }
if (-not (Test-Path $msix)) { throw 'makeappx finished but the .msix is missing.' }
Write-Host "Created $msix ($([math]::Round((Get-Item $msix).Length / 1MB, 1)) MB)"
