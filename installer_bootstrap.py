"""Single-file Windows installer for the Golden Gym application bundle."""
import ctypes
import os
import shutil
import subprocess
import sys
from pathlib import Path


APP_NAME = "Golden Gym"
EXE_NAME = "Golden Gym.exe"


def message(text, title=APP_NAME, flags=0):
    ctypes.windll.user32.MessageBoxW(None, text, title, flags)


def create_shortcut(path, target, working_directory):
    from win32com.client import Dispatch

    shell = Dispatch("WScript.Shell")
    shortcut = shell.CreateShortcut(str(path))
    shortcut.TargetPath = str(target)
    shortcut.WorkingDirectory = str(working_directory)
    shortcut.IconLocation = str(target)
    shortcut.Save()


def main():
    try:
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            raise RuntimeError("Windows Local AppData folder could not be found.")

        install_dir = Path(local_app_data) / "Programs" / APP_NAME
        payload_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "app"
        source_exe = payload_dir / EXE_NAME
        if not source_exe.is_file():
            raise RuntimeError("The installer package is incomplete.")

        # Copy rather than move so a failed update cannot corrupt the embedded
        # installer payload. Client database and uploads live elsewhere.
        install_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(payload_dir, install_dir, dirs_exist_ok=True)
        target = install_dir / EXE_NAME

        from win32com.client import Dispatch
        shell = Dispatch("WScript.Shell")
        desktop = Path(shell.SpecialFolders("Desktop"))
        programs = Path(shell.SpecialFolders("Programs")) / APP_NAME
        programs.mkdir(parents=True, exist_ok=True)
        create_shortcut(desktop / f"{APP_NAME}.lnk", target, install_dir)
        create_shortcut(programs / f"{APP_NAME}.lnk", target, install_dir)

        message(
            "Golden Gym has been installed. Desktop and Start-menu shortcuts are ready.",
            "Golden Gym installed",
            0x40,
        )
        subprocess.Popen([str(target)], cwd=str(install_dir))
    except Exception as exc:
        message(f"Installation could not be completed.\n\n{exc}", "Golden Gym setup", 0x10)
        raise


if __name__ == "__main__":
    main()
