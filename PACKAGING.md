# Golden Gym Windows delivery

Clients receive only `release\GoldenGym-Setup.exe`.  After installing it, Golden Gym is available from the Start menu and, when selected during setup, a desktop shortcut. Python, pip, a terminal, and the project folder are not needed on the client computer.

## Build the installer

On the developer/build computer, install the project requirements, PyInstaller, and [Inno Setup 6](https://jrsoftware.org/isinfo.php). Then run:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pyinstaller
.\build_windows.ps1 -Installer
```

The installer is written to `release\GoldenGym-Setup.exe`.

## Client data and upgrades

The installed program files go to the current user's Windows application folder, while client data is deliberately kept separately in `%LOCALAPPDATA%\Golden Gym`: database, uploaded photos, cards, reports, licence, custom logo/signature, and backups. This keeps the app usable without administrator rights and preserves client data across upgrades or uninstall. The uninstaller intentionally does not remove that folder.
