$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$ConfigPath = Join-Path $RepoRoot "src-tauri\tauri.conf.json"
$ManifestPath = Join-Path $RepoRoot "Package.appxmanifest"
$AssetsPath = Join-Path $RepoRoot "Assets"
$ExePath = Join-Path $RepoRoot "src-tauri\target\release\opentick.exe"

$WorkRoot = Join-Path $RepoRoot ".build\msix"
$LayoutPath = Join-Path $WorkRoot "layout"
$OutputPath = Join-Path $WorkRoot "OpenTick.msix"

Write-Host "Checking prerequisites..."

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js and reopen PowerShell."
}

if (-not (Get-Command winapp -ErrorAction SilentlyContinue)) {
    throw "winapp was not found. Install Microsoft WinApp CLI and reopen PowerShell."
}

if (-not (Test-Path $ManifestPath)) {
    throw "Missing Package.appxmanifest at repository root."
}

if (-not (Test-Path $AssetsPath)) {
    throw "Missing Assets directory."
}

Write-Host "Building OpenTick with Tauri..."
& npm run tauri -- build
if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path $ExePath)) {
    throw "Expected executable not found: $ExePath"
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$version = [string]$config.version

if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Expected a three-part version in tauri.conf.json; found '$version'."
}

$packageVersion = "$version.0"

Write-Host "Preparing clean MSIX layout..."
if (Test-Path $WorkRoot) {
    Remove-Item $WorkRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $LayoutPath | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $LayoutPath "Assets") | Out-Null

Copy-Item $ExePath (Join-Path $LayoutPath "opentick.exe")
Copy-Item $ManifestPath (Join-Path $LayoutPath "Package.appxmanifest")
Copy-Item (Join-Path $AssetsPath "*") (Join-Path $LayoutPath "Assets") -Recurse -Force

# Keep the checked-in manifest portable and synchronize the staged version.
$stagedManifest = Join-Path $LayoutPath "Package.appxmanifest"
$xml = New-Object System.Xml.XmlDocument
$xml.PreserveWhitespace = $true
$xml.Load($stagedManifest)

$identity = $xml.SelectSingleNode("/*[local-name()='Package']/*[local-name()='Identity']")
if ($null -eq $identity) {
    throw "Could not find Package/Identity in the manifest."
}

if ($identity.GetAttribute("Name") -ne "Jebby.OpenTick") {
    throw "Unexpected package identity name: $($identity.GetAttribute('Name'))"
}

if ($identity.GetAttribute("Publisher") -ne "CN=15641029-37C5-42A0-8297-2EAC5C6A0BD5") {
    throw "The manifest publisher does not match the Store identity."
}

$identity.SetAttribute("Version", $packageVersion)
$xml.Save($stagedManifest)

# Verify every image referenced by the staged manifest exists.
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("uap", "http://schemas.microsoft.com/appx/manifest/uap/windows10")
$visualElements = $xml.SelectSingleNode("//uap:VisualElements", $ns)

if ($null -eq $visualElements) {
    throw "Could not find uap:VisualElements in the manifest."
}

$imagePaths = @(
    $visualElements.GetAttribute("Square150x150Logo")
    $visualElements.GetAttribute("Square44x44Logo")
)

$defaultTile = $xml.SelectSingleNode("//uap:DefaultTile", $ns)
if ($null -ne $defaultTile) {
    $imagePaths += $defaultTile.GetAttribute("Wide310x150Logo")
}

foreach ($relativePath in ($imagePaths | Where-Object { $_ } | Select-Object -Unique)) {
    $fullPath = Join-Path $LayoutPath ($relativePath -replace '/', '\')
    if (-not (Test-Path $fullPath -PathType Leaf)) {
        throw "Manifest asset is missing: $relativePath"
    }
}

Write-Host "Packaging unsigned MSIX for Microsoft Store submission..."
& winapp package $LayoutPath `
    --manifest (Join-Path $LayoutPath "Package.appxmanifest") `
    --executable "opentick.exe" `
    --skip-pri `
    --no-sign `
    --output $OutputPath

if ($LASTEXITCODE -ne 0) {
    throw "MSIX packaging failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path $OutputPath -PathType Leaf)) {
    throw "Packaging command completed but the expected MSIX was not created."
}

Write-Host ""
Write-Host "MSIX created successfully:"
Write-Host $OutputPath
Get-Item $OutputPath | Select-Object FullName, Length
