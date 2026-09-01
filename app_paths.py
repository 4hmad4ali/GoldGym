"""Locations for bundled application resources and writable client data."""
import os
import shutil
import sys


APP_FOLDER_NAME = "Gym Management System"
SOURCE_ROOT = os.path.dirname(os.path.abspath(__file__))
RESOURCE_ROOT = getattr(sys, "_MEIPASS", SOURCE_ROOT)


def resource_path(*parts):
    """Return a read-only file bundled with the application."""
    return os.path.join(RESOURCE_ROOT, *parts)


def user_data_path(*parts):
    """Return a per-user writable path, never the installation directory."""
    if sys.platform == "win32":
        root = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~\\AppData\\Local")
    elif sys.platform == "darwin":
        root = os.path.expanduser("~/Library/Application Support")
    else:
        root = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    path = os.path.join(root, APP_FOLDER_NAME, *parts)
    return path


DATA_DIR = user_data_path()
DATABASE_PATH = user_data_path("data", "golden_gym.db")
USER_FILES_DIR = user_data_path("user_data")
ASSETS_DIR = user_data_path("assets")


def initialise_user_data():
    """Create writable folders and seed replaceable branding assets once."""
    for directory in (
        os.path.dirname(DATABASE_PATH), USER_FILES_DIR, ASSETS_DIR,
        user_data_path("Backups"), user_data_path("user_data", "temp"),
    ):
        os.makedirs(directory, exist_ok=True)


    # upgrade; only supply the bundled defaults when no local copy exists.
    for filename in ("logo.png", "signature.png"):
        source = resource_path("assets", filename)
        destination = os.path.join(ASSETS_DIR, filename)
        if os.path.isfile(source) and not os.path.exists(destination):
            shutil.copy2(source, destination)
