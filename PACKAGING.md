# Golden Gym Windows delivery

Clients receive only `release\GoldenGym-Setup.exe`. After installing it, Golden Gym is available from the Start menu and desktop. Python, pip, a terminal, and the project folder are not needed on the client computer.

## Build the installer

On the developer/build computer, install the project requirements and PyInstaller. Then run:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pyinstaller
.\build_windows.ps1 -Installer
```

The installer is written to `release\GoldenGym-Setup.exe`. It is self-contained and does not require Inno Setup or administrator rights.

## Client data and upgrades

The installed program files go to `%LOCALAPPDATA%\Programs\Golden Gym`, while client data is deliberately kept separately in `%LOCALAPPDATA%\Gym Management System`: database, uploaded photos, cards, reports, licence, custom logo/signature, and backups. This keeps the app usable without administrator rights and preserves client data across upgrades.
