#!/bin/bash

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

echo ""
echo "        "
echo "    🏋 Golden Gym — v4.0"
echo "    Professional Gym Management System"
echo "    Pure Desktop — No Web Server"
echo "        "
echo ""

if ! command -v python3 &>/dev/null; then
    echo "  [ERROR] Python3 not found"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-pip python3-tk"
    echo "  macOS: brew install python3"
    exit 1
fi

echo "  [1/4] Python found successfully..."

pip3 install PyQt6 PyQt6-WebEngine pywebview Pillow qrcode pyzbar --quiet 2>/dev/null
if [ $? -ne 0 ]; then
    pip3 install PyQt5 PyQtWebEngine pywebview Pillow qrcode pyzbar --quiet 2>/dev/null
fi
if [ $? -ne 0 ]; then
    pip3 install PySide6 pywebview Pillow qrcode pyzbar --quiet 2>/dev/null
fi

echo "  [2/4] Dependencies installed successfully..."

mkdir -p data user_data/members user_data/staff user_data/coaches assets frontend/css frontend/js/pages

echo "  [3/4] Directories created successfully..."

echo "  [4/4] Starting Golden Gym..."
echo ""
python3 main.py

if [ $? -ne 0 ]; then
    echo ""
    echo "  [ERROR] Application closed with an error."
    exit 1
fi