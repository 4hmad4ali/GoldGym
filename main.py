"""
Golden Gym Desktop — Main Application
جیم گلدن — سیستم مدیریت حرفه‌ای باشگاه
"""
import sys
import os

# Keep WebView temporary files in the project workspace, where this app has
# write access, instead of an Anaconda-managed temp directory.
APP_TEMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_data", "temp")
os.makedirs(APP_TEMP, exist_ok=True)
os.environ["TEMP"] = APP_TEMP
os.environ["TMP"] = APP_TEMP

import webview
import database as db
from bridge import GoldenGymBridge
import locale

# ── Force UTF-8 for console ──
if sys.platform == 'win32':
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        os.system('chcp 65001 >nul 2>&1')
    except:
        pass

sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
sys.stderr.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stderr, 'reconfigure') else None

try:
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
except:
    try:
        locale.setlocale(locale.LC_ALL, 'C.UTF-8')
    except:
        pass

# Keep the executable neutral.  The client-selected gym name is displayed by
# the UI after its settings are loaded.
APP_NAME = "🏋 Gym Management System"
APP_WIDTH = 1400
APP_HEIGHT = 900
MIN_WIDTH = 1100
MIN_HEIGHT = 750

class GoldenGymApp:
    def __init__(self):
        db.init_db()
        self.bridge = GoldenGymBridge()
        self.bridge.start_backup_scheduler()
        self.frontend_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 
            "frontend", 
            "index.html"
        )
        if not os.path.exists(self.frontend_path):
            print(f"[ERROR] Frontend not found at: {self.frontend_path}")
            sys.exit(1)
    
    def run(self):
        print("")
        print("  ╔══════════════════════════════════════════════════════════════════╗")
        print("  ║   🏋 Gym Management System — v4.0                                ║")
        print("  ║   Professional Gym Management System — Desktop Application       ║")
        print("  ╚══════════════════════════════════════════════════════════════════╝")
        print("")
        print(f"  [Database] {db.DB_PATH}")
        print(f"  [Frontend] {self.frontend_path}")
        print("  [Status] Starting application...")
        print("")
        
        try:
            # MSHTML is deprecated and can remain stuck on Windows. Prefer the
            # installed Chromium-based WebView2 runtime instead.
            gui_backends = ['edgechromium', 'qt', 'gtk', 'cef']
            for gui in gui_backends:
                try:
                    print(f"  [Backend] Trying: {gui}")
                    webview.create_window(
                        APP_NAME,
                        url=self.frontend_path,
                        width=APP_WIDTH,
                        height=APP_HEIGHT,
                        resizable=True,
                        fullscreen=False,
                        min_size=(MIN_WIDTH, MIN_HEIGHT),
                        confirm_close=True,
                        text_select=True,
                        js_api=self.bridge,
                    )
                    webview.start(debug=False, gui=gui)
                    print(f"  [Success] Application started with {gui} backend")
                    return
                except Exception as e:
                    print(f"  [Warning] Failed with {gui}: {e}")
                    continue
            
            print("  [Backend] Trying default...")
            webview.create_window(
                APP_NAME,
                url=self.frontend_path,
                width=APP_WIDTH,
                height=APP_HEIGHT,
                resizable=True,
                fullscreen=False,
                min_size=(MIN_WIDTH, MIN_HEIGHT),
                confirm_close=True,
                text_select=True,
                js_api=self.bridge,
            )
            webview.start(debug=False)
            
        except Exception as e:
            print(f"  [Error] Failed to start application: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

def main():
    try:
        app = GoldenGymApp()
        app.run()
    except KeyboardInterrupt:
        print("\n  [Stopped] Application stopped by user")
    except Exception as e:
        print(f"  [Fatal] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
