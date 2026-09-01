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
    New-Item -ItemType Directory -Force -Path "$projectRoot\release" | Out-Null
    & $python -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --windowed `
        --name 'GoldenGym-Setup' `
        --add-data "$projectRoot\dist\Golden Gym;app" `
        --hidden-import win32com.client `
        --collect-all win32com `
        --distpath "$projectRoot\release" `
        --workpath "$projectRoot\build-installer" `
        "$projectRoot\installer_bootstrap.py"
    if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
    Write-Host "Installer: $projectRoot\release\GoldenGym-Setup.exe"
}
