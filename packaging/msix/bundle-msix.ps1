<#
  Combines the per-CPU .msix files into one .msixbundle (the Microsoft Store picks the right one for each PC), and makes the
  .msixupload the Store's submission API takes (a zip holding the bundle).

    pwsh packaging/msix/bundle-msix.ps1 -Dir staged-msix -Out staged

  -Dir  folder holding OpenTick_<version>_<arch>.msix files (at least one)
  -Out  folder for OpenTick_<version>.msixbundle and OpenTick_<version>.msixupload
#>
param(
  [Parameter(Mandatory)][string]$Dir,
  [string]$Version,
  [string]$Out = 'staged'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
if (-not $Version) { $Version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version }
if ($Version -notmatch '^(\d+\.\d+\.\d+)') { throw "Expected a version like 1.2.3, found '$Version'." }
$four = "$($Matches[1]).0"

$msix = @(Get-ChildItem $Dir -Filter '*.msix' -Recurse)
if ($msix.Count -eq 0) { throw "No .msix files in $Dir." }
$stage = Join-Path $root '.build/msixbundle'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage, $Out | Out-Null
$msix | ForEach-Object { Copy-Item $_.FullName $stage }

$mk = (Get-Command makeappx.exe -ErrorAction SilentlyContinue).Source
if (-not $mk) {
  $mk = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Directory | Where-Object { $_.Name -match '^10\.' } |
    Sort-Object { [version]$_.Name } -Descending | ForEach-Object { Join-Path $_.FullName 'x64\makeappx.exe' } |
    Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $mk) { throw 'makeappx.exe was not found.' }

$outDir = (Resolve-Path $Out).Path
$bundle = Join-Path $outDir "OpenTick_$Version.msixbundle"
& $mk bundle /d $stage /bv $four /p $bundle /o
if ($LASTEXITCODE -ne 0) { throw "makeappx bundle failed ($LASTEXITCODE)." }

# .msixupload = a zip with the bundle in it
$zip = Join-Path $outDir "OpenTick_$Version.zip"
Compress-Archive -Path $bundle -DestinationPath $zip -Force
Move-Item $zip (Join-Path $outDir "OpenTick_$Version.msixupload") -Force
Write-Host "Created $bundle from $($msix.Count) package(s), and the .msixupload."
