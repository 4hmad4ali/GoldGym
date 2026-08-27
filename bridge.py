"""
Golden Gym Desktop — Python-JS Bridge
"""
import json
import base64
import io
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageOps
import database as db
from datetime import date, datetime
import uuid
import sys
import shutil
import sqlite3
import tempfile
import zipfile
import threading
import time
import licensing
from app_paths import ASSETS_DIR, USER_FILES_DIR, resource_path, user_data_path

# ── For QR detection from images ──
try:
    from pyzbar.pyzbar import decode as qr_decode
    QR_AVAILABLE = True
except Exception:
    QR_AVAILABLE = False
    pass

if sys.platform == 'win32':
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except:
        pass

def default_backup_directory():
    """Return a writable, per-user backup location outside the app install."""
    return user_data_path('Backups')

class GoldenGymBridge:
    def __init__(self):
        self.current_user = None
        self.user_data_path = USER_FILES_DIR
        self.assets_path = ASSETS_DIR
        self.templates_path = resource_path("frontend", "templates")
        for folder in ['members', 'staff', 'coaches']:
            os.makedirs(os.path.join(self.user_data_path, folder), exist_ok=True)
        os.makedirs(self.assets_path, exist_ok=True)
        self.default_backups_path = default_backup_directory()
        self._backup_lock = threading.Lock()
    
    # ── AUTH     ────
    # ── OFFLINE LICENSING ─────────────────────────────────
    def get_device_id(self):
        return {'device_id': licensing.get_device_id()}

    def get_license_status(self):
        return licensing.get_license_status()

    def activate_license(self, license_code):
        return licensing.activate_license(license_code)

    def login(self, username, password):
        user = db.login(username, password)
        if user:
            self.current_user = user
            return {'success': True, 'user': user}
        return {'success': False, 'message': 'نام کاربری یا رمز عبور اشتباه است'}
    
    def get_current_user(self):
        return self.current_user
    
    def change_password(self, username, new_password):
        return {'success': db.change_password(username, new_password)}

    def create_password_recovery_key(self):
        if not self.current_user or self.current_user.get('role') != 'admin':
            return {'success': False, 'message': 'فقط مدیر سیستم می‌تواند کلید بازیابی ایجاد کند.'}
        recovery_key = db.create_password_recovery_key(self.current_user['username'])
        if not recovery_key:
            return {'success': False, 'message': 'ایجاد کلید بازیابی انجام نشد.'}
        db.add_activity('password_recovery_key_created', 'کلید بازیابی جدید ایجاد شد', 'حساب: ' + self.current_user['username'])
        return {'success': True, 'recovery_key': recovery_key}

    def reset_password_with_recovery_key(self, username, recovery_key, new_password):
        return db.reset_password_with_recovery_key(username, recovery_key, new_password)
    
    def logout(self):
        self.current_user = None
        return {'success': True}

    # ── FRONTEND TEMPLATES ─────────────────────────────────
    def get_page_template(self, page_name):
        """Return a vetted page template for the single-window desktop shell."""
        allowed_pages = {
            'dashboard', 'members', 'payments', 'expenses', 'attendance', 'coaches',
            'equipment', 'cards', 'reports', 'notifications', 'settings', 'about',
            'member-form', 'trainer-form', 'staff-form', 'payment-form', 'equipment-form'
        }
        if page_name not in allowed_pages:
            return ''

        template_path = os.path.join(self.templates_path, page_name + '.html')
        if not os.path.isfile(template_path):
            return ''

        with open(template_path, 'r', encoding='utf-8') as template_file:
            return template_file.read()
    
    # ── SETTINGS     
    def get_settings(self):
        return db.get_all_settings()
    
    def save_settings(self, settings_dict):
        for key, value in settings_dict.items():
            db.set_setting(key, value)
        return {'success': True}
    
    def get_gym_logo(self):
        logo_path = os.path.join(self.assets_path, 'logo.png')
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as f:
                return base64.b64encode(f.read()).decode()
        return None
    
    def get_gym_signature(self):
        sig_path = os.path.join(self.assets_path, 'signature.png')
        if os.path.exists(sig_path):
            with open(sig_path, 'rb') as f:
                return base64.b64encode(f.read()).decode()
        return None
    
    def upload_gym_logo(self, base64_data):
        try:
            logo_path = os.path.join(self.assets_path, 'logo.png')
            img_data = base64.b64decode(base64_data)
            with open(logo_path, 'wb') as f:
                f.write(img_data)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def upload_gym_signature(self, base64_data):
        try:
            sig_path = os.path.join(self.assets_path, 'signature.png')
            img_data = base64.b64decode(base64_data)
            with open(sig_path, 'wb') as f:
                f.write(img_data)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    # ── DASHBOARD ─────────────────────────────────────────
    def get_dashboard_stats(self):
        return db.dashboard_stats()
    
    def get_recent_activities(self, limit=20):
        return db.get_recent_activities(limit)
    
    # ── MEMBERS     ─
    def get_members(self, search="", status="All"):
        return db.get_members(search, status)
    
    def get_member(self, mid):
        return db.get_member(mid)
    
    def get_member_by_code(self, code):
        return db.get_member_by_code(code)

    def _store_person_photo(self, base64_data, folder, code):
        """Normalize a submitted portrait to a print-friendly square PNG."""
        if not base64_data:
            return ''
        encoded = base64_data.split(',', 1)[-1]
        image = Image.open(io.BytesIO(base64.b64decode(encoded))).convert('RGB')
        image = ImageOps.fit(image, (900, 900), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        safe_code = ''.join(char for char in str(code) if char.isalnum() or char in ('-', '_')) or uuid.uuid4().hex
        photo_path = os.path.join(self.user_data_path, folder, safe_code + '.png')
        image.save(photo_path, 'PNG', optimize=True)
        return photo_path

    def get_person_photo(self, code, person_type='member'):
        lookup = {
            'member': db.get_member_by_code,
            'trainer': db.get_trainer_by_code,
            'staff': db.get_staff_by_code
        }.get(person_type)
        person = lookup(code) if lookup else None
        photo_path = (person or {}).get('photo_path', '')
        if photo_path and os.path.isfile(photo_path):
            with open(photo_path, 'rb') as photo_file:
                return base64.b64encode(photo_file.read()).decode()
        return None
    
    def add_member(self, data):
        try:
            member_data = {
                'member_code': data.get('member_code', ''),
                'full_name': data.get('full_name', ''),
                'father_name': data.get('father_name', ''),
                'phone': data.get('phone', ''),
                'email': data.get('email', ''),
                'address': data.get('address', ''),
                'gender': data.get('gender', 'Male'),
                'blood_group': data.get('blood_group', ''),
                'date_of_birth': data.get('date_of_birth', ''),
                'join_date': data.get('join_date', date.today().isoformat()),
                'expiry_date': data.get('expiry_date', ''),
                'membership_type': data.get('membership_type', 'ماهانه'),
                'status': data.get('status', 'Active'),
                'photo_path': self._store_person_photo(data.get('photo_base64', ''), 'members', data.get('member_code', '')),
                'emergency_contact': data.get('emergency_contact', ''),
                'notes': data.get('notes', '')
            }
            member_id = db.add_member(member_data)
            db.add_activity("member_add", f"عضو جدید: {member_data.get('full_name', '')}", json.dumps(member_data, ensure_ascii=False))
            db.add_notification(f"عضو جدید: {member_data.get('full_name', '')}", f"کد {member_data.get('member_code', '')}", "success")
            return {'success': True, 'id': member_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_member(self, mid, data):
        try:
            member = db.get_member(mid) or {}
            if data.get('photo_base64'):
                data['photo_path'] = self._store_person_photo(data['photo_base64'], 'members', member.get('member_code', data.get('member_code', '')))
            db.update_member(mid, data)
            db.add_activity("member_edit", f"ویرایش عضو: {data.get('full_name', '')}", json.dumps(data, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def delete_member(self, mid):
        try:
            member = db.get_member(mid)
            db.delete_member(mid)
            db.add_activity("member_delete", f"حذف عضو: {member.get('full_name', '')}", json.dumps(member, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_member_stats(self):
        return db.member_stats()
    
    def get_next_member_code(self):
        return {'code': db.next_member_code()}
    
    # ── PAYMENTS     
    def get_payments(self, search="", date_from="", date_to=""):
        return db.get_payments(search, date_from, date_to)
    
    def add_payment(self, data):
        try:
            payment_data = {
                'member_id': data.get('member_id'),
                'staff_id': data.get('staff_id') if data.get('staff_id') else None,
                'trainer_id': data.get('trainer_id') if data.get('trainer_id') else None,
                'amount': data.get('amount', 0),
                'payment_date': data.get('payment_date', date.today().isoformat()),
                'payment_method': data.get('payment_method', 'نقدی'),
                'plan_id': data.get('plan_id'),
                'receipt_number': data.get('receipt_number', 'PAY' + str(int(datetime.now().timestamp()))[-6:]),
                'payment_type': data.get('payment_type', 'member'),
                'visitor_name': data.get('visitor_name', ''),
                'notes': data.get('notes', '')
            }
            payment_id = db.add_payment(payment_data)
            member = db.get_member(data.get('member_id'))
            if member:
                db.add_activity("payment_add", f"پرداخت: AFN {data.get('amount', 0):,.0f} از {member.get('full_name', '')}", json.dumps(data, ensure_ascii=False))
                db.add_notification(f"پرداخت: AFN {data.get('amount', 0):,.0f}", f"از {member.get('full_name', '')}", "success")
            elif data.get('payment_type') == 'daily':
                visitor = data.get('visitor_name') or 'عضو روزانه'
                db.add_activity("daily_payment_add", f"پرداخت روزانه: AFN {data.get('amount', 0):,.0f} از {visitor}", json.dumps(data, ensure_ascii=False))
            return {'success': True, 'id': payment_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_payment(self, pid, data):
        try:
            db.update_payment(pid, data)
            db.add_activity("payment_edit", f"ویرایش پرداخت: #{pid}", json.dumps(data, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def delete_payment(self, pid):
        try:
            payment = db.get_payment(pid)
            db.delete_payment(pid)
            db.add_activity("payment_delete", f"حذف پرداخت: #{pid}", json.dumps(payment, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_payment_stats(self):
        return db.payment_stats()
    
    def get_payment_chart_data(self, period="monthly"):
        return db.get_payment_chart_data(period)

    # ── EXPENSES     
    def get_expenses(self, search=""):
        return db.get_expenses(search)

    def add_expense(self, data):
        try:
            expense_id = db.add_expense(data)
            db.add_activity("expense_add", f"هزینه ثبت شد: {data.get('title', '')}", json.dumps(data, ensure_ascii=False))
            return {'success': True, 'id': expense_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    # -- BACKUPS    
    def _backup_directory(self):
        configured_path = (db.get_all_settings().get('backup_directory') or '').strip()
        if configured_path and os.path.isabs(configured_path):
            return os.path.normpath(configured_path)
        return self.default_backups_path

    def choose_backup_directory(self):
        """Let the user pick a permanent location for scheduled backups."""
        try:
            import webview
            if not webview.windows:
                raise RuntimeError('The desktop window is not available')
            dialog_type = getattr(getattr(webview, 'FileDialog', None), 'FOLDER', None)
            if dialog_type is None:
                dialog_type = getattr(webview, 'FOLDER_DIALOG', None)
            if dialog_type is None:
                raise RuntimeError('Folder selection is not supported by this desktop runtime')
            selected_path = webview.windows[0].create_file_dialog(dialog_type, directory=self._backup_directory())
            if not selected_path:
                return {'success': False, 'cancelled': True}
            if isinstance(selected_path, (list, tuple)):
                selected_path = selected_path[0]
            selected_path = os.path.abspath(str(selected_path))
            os.makedirs(selected_path, exist_ok=True)
            db.set_setting('backup_directory', selected_path)
            return {'success': True, 'folder': selected_path}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def _backup_bytes(self):
        """Build a consistent ZIP archive from a SQLite snapshot and app files."""
        source = sqlite3.connect(db.DB_PATH)
        destination = sqlite3.connect(':memory:')
        try:
            source.backup(destination)
            database_bytes = destination.serialize()
        finally:
            destination.close()
            source.close()

        archive_buffer = io.BytesIO()
        with zipfile.ZipFile(archive_buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('manifest.json', json.dumps({
                'format': 'golden_gym_backup',
                'version': 1,
                'created_at': datetime.now().isoformat()
            }, ensure_ascii=False, indent=2))
            archive.writestr('database/golden_gym.db', database_bytes)
            for relative_path in ('logo.png', 'signature.png'):
                asset_path = os.path.join(self.assets_path, relative_path)
                if os.path.isfile(asset_path):
                    archive.write(asset_path, 'assets/' + relative_path)
            for folder in ('members', 'staff', 'coaches'):
                folder_path = os.path.join(self.user_data_path, folder)
                if os.path.isdir(folder_path):
                    for root, _, files in os.walk(folder_path):
                        for filename in files:
                            path = os.path.join(root, filename)
                            archive.write(path, os.path.join('user_data', os.path.relpath(path, self.user_data_path)))
        return archive_buffer.getvalue()

    def create_backup(self):
        """Create a portable ZIP backup and return it as base64 for download."""
        try:
            with self._backup_lock:
                archive_bytes = self._backup_bytes()

            return {
                'success': True,
                'filename': 'golden_gym_backup_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.zip',
                'data': base64.b64encode(archive_bytes).decode('ascii')
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def run_scheduled_backup(self):
        """Create the nightly backup without requiring a save-file dialog."""
        today = date.today().isoformat()
        if db.get_all_settings().get('backup_last_run_date') == today:
            return {'success': True, 'skipped': True}
        try:
            backup_directory = self._backup_directory()
            os.makedirs(backup_directory, exist_ok=True)
            filename = 'golden_gym_backup_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.zip'
            output_path = os.path.join(backup_directory, filename)
            with self._backup_lock:
                archive_bytes = self._backup_bytes()
                with open(output_path, 'wb') as backup_file:
                    backup_file.write(archive_bytes)
                with zipfile.ZipFile(output_path, 'r') as archive:
                    if 'database/golden_gym.db' not in archive.namelist():
                        raise ValueError('Invalid backup archive')
            db.set_setting('backup_last_run_date', today)
            db.set_setting('backup_last_event', json.dumps({
                'status': 'success', 'timestamp': datetime.now().isoformat(), 'filename': filename
            }))
            db.add_notification('پشتیبان‌گیری انجام شد', 'نسخه خودکار در ' + output_path + ' ذخیره شد.', 'success')
            return {'success': True, 'path': output_path, 'filename': filename}
        except Exception as e:
            message = str(e)
            db.set_setting('backup_last_event', json.dumps({
                'status': 'error', 'timestamp': datetime.now().isoformat(), 'message': message
            }))
            db.add_notification('پشتیبان‌گیری ناموفق بود', 'لطفاً از بخش تنظیمات یک نسخه پشتیبان دستی تهیه کنید. ' + message, 'error')
            return {'success': False, 'message': message}

    def get_backup_schedule_status(self):
        settings = db.get_all_settings()
        try:
            last_event = json.loads(settings.get('backup_last_event') or '{}')
        except (TypeError, ValueError):
            last_event = {}
        return {
            'enabled': settings.get('backup_schedule_enabled', 'true') == 'true',
            'time': settings.get('backup_schedule_time', '21:00'),
            'folder': self._backup_directory(),
            'last_run_date': settings.get('backup_last_run_date', ''),
            'last_event': last_event
        }

    def start_backup_scheduler(self):
        """Run one lightweight scheduler while the desktop app is open."""
        def scheduler():
            while True:
                settings = db.get_all_settings()
                now = datetime.now()
                if now.strftime('%H:%M') == settings.get('backup_schedule_time', '21:00'):
                    if settings.get('backup_schedule_enabled', 'true') == 'true':
                        self.run_scheduled_backup()
                    elif settings.get('backup_last_reminder_date') != now.date().isoformat():
                        db.set_setting('backup_last_reminder_date', now.date().isoformat())
                        db.set_setting('backup_last_event', json.dumps({
                            'status': 'reminder', 'timestamp': now.isoformat()
                        }))
                        db.add_notification('یادآوری پشتیبان‌گیری', 'لطفاً از بخش تنظیمات یک نسخه پشتیبان دستی تهیه کنید.', 'info')
                time.sleep(20)
        threading.Thread(target=scheduler, name='nightly-backup', daemon=True).start()

    def save_backup(self):
        """Save a verified backup with the native desktop file-save dialog."""
        result = self.create_backup()
        if not result.get('success'):
            return result
        try:
            import webview
            if not webview.windows:
                raise RuntimeError('The desktop window is not available')
            dialog_type = getattr(getattr(webview, 'FileDialog', None), 'SAVE', webview.SAVE_DIALOG)
            selected_path = webview.windows[0].create_file_dialog(
                dialog_type,
                save_filename=result['filename'],
                file_types=('Golden Gym backups (*.zip)', 'All files (*.*)')
            )
            if not selected_path:
                return {'success': False, 'cancelled': True}
            if isinstance(selected_path, (list, tuple)):
                selected_path = selected_path[0]
            if not str(selected_path).lower().endswith('.zip'):
                selected_path += '.zip'
            archive_bytes = base64.b64decode(result['data'])
            with open(selected_path, 'wb') as backup_file:
                backup_file.write(archive_bytes)
            with zipfile.ZipFile(selected_path, 'r') as archive:
                if 'database/golden_gym.db' not in archive.namelist():
                    raise ValueError('Invalid backup archive')
            return {
                'success': True,
                'path': selected_path,
                'filename': os.path.basename(selected_path),
                'size': len(archive_bytes)
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def restore_backup(self, base64_data):
        """Validate and restore a backup ZIP uploaded by the user."""
        temp_root = os.path.join(self.user_data_path, 'temp')
        os.makedirs(temp_root, exist_ok=True)
        temp_db = os.path.join(temp_root, 'restore_' + uuid.uuid4().hex + '.db')
        try:
            encoded = base64_data.split(',', 1)[-1]
            archive_buffer = io.BytesIO(base64.b64decode(encoded, validate=True))
            with zipfile.ZipFile(archive_buffer, 'r') as archive:
                for member in archive.infolist():
                    if member.filename.startswith('/') or '..' in member.filename.split('/'):
                        raise ValueError('Invalid backup archive')
                names = set(archive.namelist())
                if 'manifest.json' not in names or 'database/golden_gym.db' not in names:
                    raise ValueError('This file is not a Golden Gym backup')
                manifest = json.loads(archive.read('manifest.json').decode('utf-8'))
                database_bytes = archive.read('database/golden_gym.db')
            if manifest.get('format') != 'golden_gym_backup' or manifest.get('version') != 1:
                raise ValueError('Unsupported backup format')

            check = sqlite3.connect(':memory:')
            try:
                check.deserialize(database_bytes)
                integrity = check.execute('PRAGMA integrity_check').fetchone()[0]
            finally:
                check.close()
            if integrity != 'ok':
                raise ValueError('The backup database failed its integrity check')

            with open(temp_db, 'wb') as database_file:
                database_file.write(database_bytes)
            os.replace(temp_db, db.DB_PATH)
            os.makedirs(self.assets_path, exist_ok=True)
            for filename in ('logo.png', 'signature.png'):
                target = os.path.join(self.assets_path, filename)
                asset_name = 'assets/' + filename
                if asset_name in names:
                    with open(target, 'wb') as asset_file:
                        asset_file.write(archive_buffer.getvalue() and zipfile.ZipFile(io.BytesIO(archive_buffer.getvalue())).read(asset_name))
                elif os.path.isfile(target):
                    os.remove(target)
            for folder in ('members', 'staff', 'coaches'):
                target = os.path.join(self.user_data_path, folder)
                if os.path.isdir(target):
                    shutil.rmtree(target)
                os.makedirs(target, exist_ok=True)
                for member_name in names:
                    prefix = 'user_data/' + folder + '/'
                    if member_name.startswith(prefix) and not member_name.endswith('/'):
                        relative = member_name[len(prefix):]
                        output = os.path.join(target, relative)
                        os.makedirs(os.path.dirname(output), exist_ok=True)
                        with open(output, 'wb') as photo_file:
                            photo_file.write(zipfile.ZipFile(io.BytesIO(archive_buffer.getvalue())).read(member_name))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
        finally:
            if os.path.isfile(temp_db):
                os.remove(temp_db)

    def update_expense(self, expense_id, data):
        try:
            db.update_expense(expense_id, data)
            db.add_activity("expense_edit", f"هزینه ویرایش شد: {data.get('title', '')}", json.dumps(data, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def delete_expense(self, expense_id):
        try:
            db.delete_expense(expense_id)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def get_expense_categories(self):
        return db.get_expense_categories()

    def add_expense_category(self, name):
        try:
            if not str(name or '').strip():
                return {'success': False, 'message': 'نام دسته‌بندی الزامی است'}
            return {'success': True, 'id': db.add_expense_category(name)}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def delete_expense_category(self, category_id):
        try:
            db.delete_expense_category(category_id)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def get_expense_stats(self):
        return db.expense_stats()
    
    # ── ATTENDANCE ────────────────────────────────────────
    def get_today_attendance(self):
        return db.today_attendance()
    
    def get_attendance_history(self, search="", date_from="", date_to=""):
        return db.attendance_history(search, date_from, date_to)
    
    def checkin(self, user_id, user_type="member"):
        # Enforce the same access rule used by card verification. Do not allow
        # inactive or expired members to enter through the attendance screen.
        if user_type == 'member':
            person = db.get_member(user_id)
            if not person:
                return {'att_id': None, 'message': 'عضو یافت نشد'}
            if person.get('status') != 'Active':
                return {'att_id': None, 'message': 'ورود مجاز نیست: عضویت فعال نیست'}
            expiry = person.get('expiry_date') or ''
            if not expiry or expiry < date.today().isoformat():
                return {'att_id': None, 'message': 'ورود مجاز نیست: عضویت منقضی شده است'}
        else:
            person = db.get_trainer_by_id(user_id) if user_type == 'trainer' else db.get_staff_by_id(user_id)
            if not person:
                return {'att_id': None, 'message': 'شخص یافت نشد'}
            if person.get('status') != 'Active':
                return {'att_id': None, 'message': 'ورود مجاز نیست: وضعیت فعال نیست'}

        att_id, msg = db.checkin(user_id, user_type)
        if att_id:
            type_label = 'عضو' if user_type == 'member' else 'مربی' if user_type == 'trainer' else 'کارمند'
            db.add_activity("attendance_checkin", f"{type_label} با شناسه {user_id} وارد شد", f"نوع: {user_type}")
        return {'att_id': att_id, 'message': msg}
    
    def checkout(self, att_id):
        db.checkout(att_id)
        db.add_activity("attendance_checkout", f"خروج ثبت شد (شناسه: {att_id})", "")
        return {'success': True}
    
    def delete_attendance(self, att_id):
        db.delete_attendance(att_id)
        return {'success': True}
    
    def get_attendance_stats(self):
        return db.attendance_stats()
    
    # ── TRAINERS     
    def get_trainers(self, search=""):
        return db.get_trainers(search)
    
    def get_trainer_by_code(self, code):
        return db.get_trainer_by_code(code)
    
    def get_trainer(self, tid):
        return db.get_trainer_by_id(tid)
    
    def add_trainer(self, data):
        try:
            trainer_data = {
                'trainer_code': data.get('trainer_code', ''),
                'full_name': data.get('full_name', ''),
                'father_name': data.get('father_name', ''),
                'phone': data.get('phone', ''),
                'email': data.get('email', ''),
                'address': data.get('address', ''),
                'gender': data.get('gender', 'Male'),
                'blood_group': data.get('blood_group', ''),
                'date_of_birth': data.get('date_of_birth', ''),
                'hire_date': data.get('hire_date', date.today().isoformat()),
                'specialization': data.get('specialization', ''),
                'salary': data.get('salary', 0),
                'status': data.get('status', 'Active'),
                'photo_path': self._store_person_photo(data.get('photo_base64', ''), 'coaches', data.get('trainer_code', '')),
                'notes': data.get('notes', '')
            }
            trainer_id = db.add_trainer(trainer_data)
            db.add_activity("trainer_add", f"مربی جدید: {trainer_data.get('full_name', '')}", json.dumps(trainer_data, ensure_ascii=False))
            return {'success': True, 'id': trainer_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_trainer(self, tid, data):
        try:
            trainer = db.get_trainer_by_id(tid) or {}
            if data.get('photo_base64'):
                data['photo_path'] = self._store_person_photo(data['photo_base64'], 'coaches', trainer.get('trainer_code', data.get('trainer_code', '')))
            db.update_trainer(tid, data)
            db.add_activity("trainer_edit", f"ویرایش مربی: {data.get('full_name', '')}", json.dumps(data, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def delete_trainer(self, tid):
        try:
            trainer = db.get_trainer_by_id(tid)
            db.delete_trainer(tid)
            db.add_activity("trainer_delete", f"حذف مربی: {trainer.get('full_name', '')}", json.dumps(trainer, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_next_trainer_code(self):
        return {'code': db.next_trainer_code()}
    
    def get_trainer_stats(self):
        return db.trainer_stats()
    
    # ── STAFF     ───
    def get_staff(self, search=""):
        return db.get_staff(search)
    
    def get_staff_by_code(self, code):
        return db.get_staff_by_code(code)
    
    def get_staff_by_id(self, sid):
        return db.get_staff_by_id(sid)
    
    def add_staff(self, data):
        try:
            staff_data = {
                'staff_code': data.get('staff_code', ''),
                'full_name': data.get('full_name', ''),
                'father_name': data.get('father_name', ''),
                'phone': data.get('phone', ''),
                'email': data.get('email', ''),
                'address': data.get('address', ''),
                'gender': data.get('gender', 'Male'),
                'blood_group': data.get('blood_group', ''),
                'date_of_birth': data.get('date_of_birth', ''),
                'hire_date': data.get('hire_date', date.today().isoformat()),
                'position': data.get('position', ''),
                'salary': data.get('salary', 0),
                'status': data.get('status', 'Active'),
                'photo_path': self._store_person_photo(data.get('photo_base64', ''), 'staff', data.get('staff_code', '')),
                'notes': data.get('notes', '')
            }
            staff_id = db.add_staff(staff_data)
            db.add_activity("staff_add", f"کارمند جدید: {staff_data.get('full_name', '')}", json.dumps(staff_data, ensure_ascii=False))
            return {'success': True, 'id': staff_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_staff(self, sid, data):
        try:
            staff = db.get_staff_by_id(sid) or {}
            if data.get('photo_base64'):
                data['photo_path'] = self._store_person_photo(data['photo_base64'], 'staff', staff.get('staff_code', data.get('staff_code', '')))
            db.update_staff(sid, data)
            db.add_activity("staff_edit", f"ویرایش کارمند: {data.get('full_name', '')}", json.dumps(data, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def delete_staff(self, sid):
        try:
            staff = db.get_staff_by_id(sid)
            db.delete_staff(sid)
            db.add_activity("staff_delete", f"حذف کارمند: {staff.get('full_name', '')}", json.dumps(staff, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_next_staff_code(self):
        return {'code': db.next_staff_code()}
    
    def get_staff_stats(self):
        return db.staff_stats()
    
    # ── EQUIPMENT ─────────────────────────────────────────
    def get_equipment(self, search=""):
        return db.get_equipment(search)
    
    def get_equipment_by_id(self, eid):
        return db.get_equipment_by_id(eid)
    
    def add_equipment(self, data):
        try:
            equipment_data = {
                'name': data.get('name', ''),
                'category': data.get('category', ''),
                'quantity': int(data.get('quantity', 1)),
                'purchase_date': data.get('purchase_date', ''),
                'purchase_price': float(data.get('purchase_price', 0)),
                'condition': data.get('condition', 'Good'),
                'status': data.get('status', 'Active'),
                'location': data.get('location', ''),
                'notes': data.get('notes', '')
            }
            equip_id = db.add_equipment(equipment_data)
            db.add_activity("equipment_add", f"تجهیزات جدید: {equipment_data.get('name', '')}", json.dumps(equipment_data, ensure_ascii=False))
            return {'success': True, 'id': equip_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_equipment(self, eid, data):
        try:
            db.update_equipment(eid, data)
            db.add_activity("equipment_edit", f"ویرایش تجهیزات: {data.get('name', '')}", json.dumps(data, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def delete_equipment(self, eid):
        try:
            equip = db.get_equipment_by_id(eid)
            db.delete_equipment(eid)
            db.add_activity("equipment_delete", f"حذف تجهیزات: {equip.get('name', '')}", json.dumps(equip, ensure_ascii=False))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_equipment_stats(self):
        return db.equipment_stats()
    
    # ── PLANS     ───
    def get_plans(self):
        return db.get_plans()
    
    # ── NOTIFICATIONS ────────────────────────────────────
    def get_notifications(self, unread_only=False):
        return db.get_notifications(unread_only)
    
    def mark_read(self, nid):
        db.mark_read(nid)
        return {'success': True}
    
    def mark_all_read(self):
        db.mark_all_read()
        return {'success': True}
    
    def delete_notification(self, nid):
        db.delete_notification(nid)
        return {'success': True}
    
    # ── ACTIVITIES ────────────────────────────────────────
    def get_activities(self, limit=100, offset=0):
        return db.get_activities(limit, offset)
    
    def get_activities_count(self):
        return db.get_activities_count()
    
    def get_recent_activities(self, limit=20):
        return db.get_recent_activities(limit)
    
    # ── QR CODE GENERATION ──────────────────────────────
    def generate_qr(self, data):
        try:
            # Keep QR modules crisp when the card preview is rendered and then
            # sent to a physical CR80 printer. High correction tolerates small
            # print imperfections without making a member card unscannable.
            qr = qrcode.QRCode(version=3, box_size=12, border=4, error_correction=qrcode.constants.ERROR_CORRECT_H)
            qr.add_data(data)
            qr.make(fit=True)
            img = qr.make_image(fill_color="#0D1117", back_color="white")
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return {'success': True, 'image': img_str}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    # ── QR CODE DETECTION FROM IMAGE ─────────────────────
    def detect_qr_from_image(self, base64_image):
        try:
            if not QR_AVAILABLE:
                return {'success': False, 'message': 'کتابخانه pyzbar نصب نیست. لطفاً نصب کنید: pip install pyzbar'}
            
            img_data = base64.b64decode(base64_image)
            img = Image.open(io.BytesIO(img_data))
            
            decoded_objects = qr_decode(img)
            
            if not decoded_objects:
                return {'success': False, 'message': 'هیچ QR کدی در تصویر یافت نشد'}
            
            qr_data = decoded_objects[0].data.decode('utf-8')
            return {'success': True, 'data': qr_data}
            
        except Exception as e:
            return {'success': False, 'message': f'خطا در پردازش تصویر: {str(e)}'}
    
    # ── CARD GENERATOR ─────────────────────────────────────
    def generate_card(self, data):
        try:
            card = self._create_card_template(data)
            filename = self._save_card(card, data)
            return {'success': True, 'filename': filename, 'path': filename}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def print_card(self, data):
        """Print one CR80 card directly through the Windows printer driver."""
        try:
            import win32con
            import win32print
            import win32ui
            from PIL import ImageWin

            card = self._create_card_template(data).convert('RGB')
            printer_name = win32print.GetDefaultPrinter()
            printer_dc = win32ui.CreateDC()
            printer_dc.CreatePrinterDC(printer_name)

            dpi_x = printer_dc.GetDeviceCaps(win32con.LOGPIXELSX)
            dpi_y = printer_dc.GetDeviceCaps(win32con.LOGPIXELSY)
            printable_width = printer_dc.GetDeviceCaps(win32con.HORZRES)
            printable_height = printer_dc.GetDeviceCaps(win32con.VERTRES)
            card_width = round((85.60 / 25.4) * dpi_x)
            card_height = round((53.98 / 25.4) * dpi_y)

            # Keep the printed card at the physical CR80 aspect ratio.
            card = card.resize((card_width, card_height), Image.Resampling.LANCZOS)
            x = max(0, (printable_width - card_width) // 2)
            y = max(0, (printable_height - card_height) // 2)

            printer_dc.StartDoc('Golden Gym Card')
            printer_dc.StartPage()
            ImageWin.Dib(card).draw(printer_dc.GetHandleOutput(), (x, y, x + card_width, y + card_height))
            printer_dc.EndPage()
            printer_dc.EndDoc()
            printer_dc.DeleteDC()
            return {'success': True, 'printer': printer_name, 'size_mm': '85.60 × 53.98'}
        except Exception as e:
            return {'success': False, 'message': f'خطا در چاپ کارت: {str(e)}'}

    def save_rendered_card(self, base64_image, code, card_type='member'):
        """Save a high-resolution PNG using a user-selected destination."""
        try:
            import webview
            if not webview.windows:
                raise RuntimeError('The desktop window is not available')
            safe_code = ''.join(char for char in str(code) if char.isalnum() or char in ('-', '_')) or 'card'
            dialog_type = getattr(getattr(webview, 'FileDialog', None), 'SAVE', webview.SAVE_DIALOG)
            selected_path = webview.windows[0].create_file_dialog(
                dialog_type,
                save_filename=f"gym_card_{safe_code}.png",
                file_types=('PNG image (*.png)', 'All files (*.*)')
            )
            if not selected_path:
                return {'success': False, 'cancelled': True}
            if isinstance(selected_path, (list, tuple)):
                selected_path = selected_path[0]
            if not str(selected_path).lower().endswith('.png'):
                selected_path += '.png'
            image = Image.open(io.BytesIO(base64.b64decode(base64_image))).convert('RGB')
            image.save(selected_path, 'PNG', optimize=True)
            return {'success': True, 'path': selected_path, 'width': image.width, 'height': image.height}
        except Exception as e:
            return {'success': False, 'message': f'خطا در ذخیره تصویر کارت: {str(e)}'}

    def print_rendered_card(self, base64_image):
        """Print the UI-rendered PNG at physical CR80 dimensions, without browser UI."""
        try:
            import win32con
            import win32print
            import win32ui
            from PIL import ImageWin

            image = Image.open(io.BytesIO(base64.b64decode(base64_image))).convert('RGB')
            printer_name = win32print.GetDefaultPrinter()
            dc = win32ui.CreateDC()
            dc.CreatePrinterDC(printer_name)
            card_width = round((85.60 / 25.4) * dc.GetDeviceCaps(win32con.LOGPIXELSX))
            card_height = round((53.98 / 25.4) * dc.GetDeviceCaps(win32con.LOGPIXELSY))
            x = max(0, (dc.GetDeviceCaps(win32con.HORZRES) - card_width) // 2)
            y = max(0, (dc.GetDeviceCaps(win32con.VERTRES) - card_height) // 2)
            # Nearest-neighbour preserves the hard black/white QR module edges.
            # Smoothing can create grey modules that barcode scanners reject.
            image = image.resize((card_width, card_height), Image.Resampling.NEAREST)
            dc.StartDoc('Golden Gym CR80 Card')
            dc.StartPage()
            ImageWin.Dib(image).draw(dc.GetHandleOutput(), (x, y, x + card_width, y + card_height))
            dc.EndPage()
            dc.EndDoc()
            dc.DeleteDC()
            return {'success': True, 'printer': printer_name, 'size_mm': '85.60 × 53.98'}
        except Exception as e:
            return {'success': False, 'message': f'خطا در چاپ کارت: {str(e)}'}
    
    def _create_card_template(self, data):
        width = 550
        height = 780
        
        img = Image.new('RGB', (width, height), color='#1A1A2E')
        draw = ImageDraw.Draw(img)
        
        # Card Border
        draw.rectangle([5, 5, width-5, height-5], outline='#FFB900', width=3)
        draw.rectangle([10, 10, width-10, height-10], outline='#6D5714', width=1)
        
        # Header Section
        draw.rectangle([10, 10, width-10, 85], fill='#FFB900')
        
        logo_path = os.path.join(self.assets_path, 'logo.png')
        logo_placed = False
        if os.path.exists(logo_path):
            try:
                logo = Image.open(logo_path)
                logo = logo.resize((55, 55))
                img.paste(logo, (25, 22))
                logo_placed = True
            except:
                pass
        
        if not logo_placed:
            draw.ellipse([25, 22, 80, 77], fill='#1A1A2E')
            draw.text((42, 37), "🏋", fill='#FFB900', font=None)
        
        gym_name = data.get('gym_name', 'باشگاه شما')
        draw.text((95, 25), gym_name, fill='#1A1A2E', font=None)
        draw.text((95, 50), "FITNESS CLUB", fill='#1A1A2E', font=None)
        
        type_label = data.get('type_label', 'عضو')
        type_colors = {'عضو': '#2ecc71', 'مربی': '#3498db', 'کارمند': '#e67e22'}
        type_color = type_colors.get(type_label, '#2ecc71')
        draw.rectangle([width-110, 20, width-25, 50], fill=type_color, outline='white', width=1)
        draw.text((width-75, 28), type_label, fill='white', font=None)
        
        # Portrait area — a photo is used when it has been captured for the person.
        photo_x = (width - 100) // 2
        draw.ellipse([photo_x, 100, photo_x + 100, 200], fill='#2A2A4A', outline='#FFB900', width=3)
        photo_path = data.get('photo_path', '')
        if photo_path and os.path.isfile(photo_path):
            try:
                portrait = Image.open(photo_path).convert('RGB').resize((94, 94))
                mask = Image.new('L', (94, 94), 0)
                ImageDraw.Draw(mask).ellipse((0, 0, 94, 94), fill=255)
                img.paste(portrait, (photo_x + 3, 103), mask)
            except Exception:
                pass
        
        # Information
        y_start = 220
        line_height = 38
        x_start = 30
        
        info_fields = [
            ('ایدی عضو', data.get('code', '')),
            ('نام', data.get('full_name', '')),
            ('نام پدر', data.get('father_name', '')),
            ('گروپ خون', data.get('blood_group', '')),
            ('نوع عضویت', data.get('membership_type', '')),
            ('تاریخ عضویت', data.get('join_date', '')),
            ('تاریخ انقضاء', data.get('expiry_date', '')),
            ('تاریخ جدیدی', data.get('issue_date', ''))
        ]
        
        for i, (label, value) in enumerate(info_fields):
            y = y_start + i * line_height
            draw.text((x_start, y), f"{label}:", fill='#9BA8C0', font=None)
            draw.text((x_start + 140, y), value or '---', fill='#EEF2FF', font=None)
            draw.line([x_start, y + 30, width - 30, y + 30], fill='#2A3348', width=1)
        
        # QR Code
        qr_y = y_start + len(info_fields) * line_height + 20
        qr_data = data.get('qr_data', '')
        
        if qr_data:
            qr = qrcode.QRCode(version=3, box_size=4, border=1)
            qr.add_data(qr_data)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="#1A1A2E", back_color="white")
            qr_img = qr_img.resize((120, 120))
            img.paste(qr_img, (30, qr_y))
        
        # Signature
        sig_path = os.path.join(self.assets_path, 'signature.png')
        if os.path.exists(sig_path):
            try:
                sig = Image.open(sig_path)
                sig = sig.resize((120, 45))
                img.paste(sig, (width - 160, qr_y + 30))
            except:
                draw.text((width - 150, qr_y + 35), "امضای ریس", fill='#9BA8C0', font=None)
                draw.text((width - 150, qr_y + 55), "_________________", fill='#9BA8C0', font=None)
        else:
            draw.text((width - 150, qr_y + 35), "امضای ریس", fill='#9BA8C0', font=None)
            draw.text((width - 150, qr_y + 55), "_________________", fill='#9BA8C0', font=None)
        
        # Footer
        footer_y = height - 30
        draw.text((30, footer_y), data.get('gym_address', ''), fill='#5C6780', font=None)
        draw.text((width - 150, footer_y), data.get('gym_phone', ''), fill='#5C6780', font=None)
        
        stamp_x = width - 80
        stamp_y = height - 70
        draw.ellipse([stamp_x, stamp_y, stamp_x + 50, stamp_y + 50], outline='#FFB900', width=1)
        draw.text((stamp_x + 8, stamp_y + 12), "گلدن", fill='#FFB900', font=None)
        draw.text((stamp_x + 5, stamp_y + 28), "GYM", fill='#FFB900', font=None)
        
        return img
    
    def _save_card(self, card_image, data):
        card_type = data.get('type', 'member')
        folder_map = {'member': 'members', 'staff': 'staff', 'coach': 'coaches'}
        folder = os.path.join(self.user_data_path, folder_map.get(card_type, 'members'))
        os.makedirs(folder, exist_ok=True)
        
        code = data.get('code', str(uuid.uuid4())[:8])
        filename = f"{code}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        filepath = os.path.join(folder, filename)
        card_image.save(filepath, 'PNG', quality=95)
        
        meta_path = filepath.replace('.png', '.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath
    
    # ── CARD VERIFICATION (SCANNER) ──────────────────────
    def verify_card(self, card_data):
        try:
            code = card_data.get('code', '').strip()
            
            if not code:
                return {'valid': False, 'message': 'کد معتبر نیست'}
            
            member = db.get_member_by_code(code)
            if member:
                if member.get('status') != 'Active':
                    return {
                        'valid': False,
                        'type': 'member',
                        'type_label': 'عضو',
                        'data': member,
                        'message': 'ورود مجاز نیست: عضویت فعال نیست'
                    }
                expiry = member.get('expiry_date') or ''
                if not expiry or expiry < date.today().isoformat():
                    return {
                        'valid': False,
                        'type': 'member',
                        'type_label': 'عضو',
                        'data': member,
                        'message': 'ورود مجاز نیست: عضویت منقضی شده است'
                    }
                return {
                    'valid': True,
                    'type': 'member',
                    'type_label': 'عضو',
                    'data': member,
                    'message': 'کارت عضو معتبر است'
                }
            
            staff = db.get_staff_by_code(code)
            if staff:
                if staff.get('status') != 'Active':
                    return {
                        'valid': False,
                        'type': 'staff',
                        'type_label': 'کارمند',
                        'data': staff,
                        'message': 'ورود مجاز نیست: وضعیت کارمند فعال نیست'
                    }
                return {
                    'valid': True,
                    'type': 'staff',
                    'type_label': 'کارمند',
                    'data': staff,
                    'message': 'کارت کارمند معتبر است'
                }
            
            trainer = db.get_trainer_by_code(code)
            if trainer:
                if trainer.get('status') != 'Active':
                    return {
                        'valid': False,
                        'type': 'trainer',
                        'type_label': 'مربی',
                        'data': trainer,
                        'message': 'ورود مجاز نیست: وضعیت مربی فعال نیست'
                    }
                return {
                    'valid': True,
                    'type': 'trainer',
                    'type_label': 'مربی',
                    'data': trainer,
                    'message': 'کارت مربی معتبر است'
                }
            
            return {
                'valid': False,
                'message': f'کارت با کد {code} یافت نشد'
            }
            
        except Exception as e:
            return {'valid': False, 'message': f'خطا در تأیید کارت: {str(e)}'}
    
    def verify_card_by_data(self, qr_data):
        try:
            parts = qr_data.strip().split('|')
            if len(parts) < 2 or parts[0] not in ('GGYM', 'GGYM-STF', 'GGYM-TRN'):
                return {'valid': False, 'message': 'فرمت QR نامعتبر است'}
            
            code = parts[1]
            return self.verify_card({'code': code})
            
        except Exception as e:
            return {'valid': False, 'message': f'خطا در پردازش QR: {str(e)}'}
    
    def scan_card_image(self, base64_image):
        try:
            detect_result = self.detect_qr_from_image(base64_image)
            
            if not detect_result['success']:
                return {
                    'success': False,
                    'message': detect_result['message'],
                    'step': 'detection'
                }
            
            qr_data = detect_result['data']
            verify_result = self.verify_card_by_data(qr_data)
            
            return {
                'success': True,
                'qr_data': qr_data,
                'verification': verify_result
            }
            
        except Exception as e:
            return {'success': False, 'message': f'خطا در اسکن کارت: {str(e)}'}
    
    # ── REPORTS     ─
    def get_report_data(self, report_type, filters=None):
        return db.get_report_data(report_type, filters)
    
    def export_report(self, report_type, format="csv"):
        return db.export_report(report_type, format)

    def save_report_csv(self, report_type):
        """Save a report natively because browser downloads are not reliable in pywebview."""
        try:
            report = db.export_report(report_type, 'csv')
            if not report.get('success'):
                return report
            reports_path = os.path.join(self.user_data_path, 'reports')
            os.makedirs(reports_path, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            file_path = os.path.join(reports_path, f'report_{report_type}_{timestamp}.csv')
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as report_file:
                report_file.write(report.get('data', ''))
            return {'success': True, 'path': file_path}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def save_report_csv_data(self, csv_data, suggested_filename='gym_report_solar_hijri.csv'):
        """Save client-rendered report data at a location selected by the user."""
        try:
            import webview
            if not webview.windows:
                raise RuntimeError('The desktop window is not available')
            safe_name = os.path.basename(str(suggested_filename or 'gym_report_solar_hijri.csv'))
            if not safe_name.lower().endswith('.csv'):
                safe_name += '.csv'
            dialog_type = getattr(getattr(webview, 'FileDialog', None), 'SAVE', webview.SAVE_DIALOG)
            selected_path = webview.windows[0].create_file_dialog(
                dialog_type,
                save_filename=safe_name,
                file_types=('CSV files (*.csv)', 'All files (*.*)')
            )
            if not selected_path:
                return {'success': False, 'cancelled': True}
            if isinstance(selected_path, (list, tuple)):
                selected_path = selected_path[0]
            if not str(selected_path).lower().endswith('.csv'):
                selected_path += '.csv'
            with open(selected_path, 'w', encoding='utf-8-sig', newline='') as report_file:
                report_file.write(str(csv_data))
            return {'success': True, 'path': selected_path}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    # ── UTILITY     ─
    def get_current_date(self):
        return date.today().isoformat()
    
    def get_current_datetime(self):
        return datetime.now().isoformat()
