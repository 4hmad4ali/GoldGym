[CmdletBinding()]
param(
    [switch]$Installer
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    throw "Build environment not found: $python. Create it and install requirements first."
}

& $python -m PyInstaller --version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is missing from .venv. Run: .venv\\Scripts\\python.exe -m pip install pyinstaller"
}

& $python -m PyInstaller `
    --noconfirm `
    --clean `
    --windowed `
    --name 'Golden Gym' `
    --add-data "$projectRoot\frontend;frontend" `
    --add-data "$projectRoot\assets;assets" `
    --collect-all webview `
    --hidden-import webview.platforms.edgechromium `
    --hidden-import webview.platforms.qt `
    --paths $projectRoot `
    --distpath "$projectRoot\dist" `
    --workpath "$projectRoot\build" `
    "$projectRoot\main.py"

if ($LASTEXITCODE -ne 0) { throw 'Executable build failed.' }

Write-Host "Built: $projectRoot\dist\Golden Gym\Golden Gym.exe"

if ($Installer) {
    $iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if (-not $iscc) {
        throw 'Inno Setup 6 is required to create the installer. Install it, then run: .\\build_windows.ps1 -Installer'
    }
    & $iscc.Source "$projectRoot\installer\GoldenGym.iss"
    if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
    Write-Host "Installer: $projectRoot\release\GoldenGym-Setup.exe"
}
