"""
Golden Gym Desktop — Database Module
"""
import sqlite3
import hashlib
import hmac
import os
import secrets
from datetime import datetime, date, timedelta
import json
import csv
from io import StringIO
import sys
from app_paths import DATABASE_PATH, initialise_user_data

if sys.platform == 'win32':
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except:
        pass

DB_PATH = DATABASE_PATH

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.text_factory = str
    return conn

def hash_pw(password):
    return hashlib.sha256(password.encode()).hexdigest()

RECOVERY_KEY_ITERATIONS = 200_000
RECOVERY_MAX_ATTEMPTS = 5
RECOVERY_LOCK_MINUTES = 15

def _normalise_recovery_key(value):
    return ''.join(str(value or '').upper().split()).replace('-', '')

def _recovery_key_hash(recovery_key, salt):
    return hashlib.pbkdf2_hmac(
        'sha256', _normalise_recovery_key(recovery_key).encode('utf-8'), salt, RECOVERY_KEY_ITERATIONS
    ).hex()

def _new_recovery_key():
    raw = secrets.token_hex(16).upper()
    return '-'.join(raw[index:index + 4] for index in range(0, len(raw), 4))

def init_db():
    initialise_user_data()
    conn = get_conn()
    c = conn.cursor()
    
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'staff',
        language TEXT DEFAULT 'fa',
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS password_recovery (
        user_id INTEGER PRIMARY KEY,
        key_salt BLOB NOT NULL,
        key_hash TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS membership_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_name TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        father_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        gender TEXT DEFAULT 'Male',
        blood_group TEXT,
        date_of_birth TEXT,
        join_date TEXT DEFAULT (date('now')),
        expiry_date TEXT,
        membership_type TEXT DEFAULT 'ماهانه',
        status TEXT DEFAULT 'Active',
        photo_path TEXT,
        emergency_contact TEXT,
        notes TEXT,
        qr_code_data TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        father_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        gender TEXT DEFAULT 'Male',
        blood_group TEXT,
        date_of_birth TEXT,
        hire_date TEXT DEFAULT (date('now')),
        position TEXT,
        salary REAL DEFAULT 0,
        status TEXT DEFAULT 'Active',
        photo_path TEXT,
        notes TEXT,
        qr_code_data TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        father_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        gender TEXT DEFAULT 'Male',
        blood_group TEXT,
        date_of_birth TEXT,
        hire_date TEXT DEFAULT (date('now')),
        specialization TEXT,
        salary REAL DEFAULT 0,
        status TEXT DEFAULT 'Active',
        photo_path TEXT,
        notes TEXT,
        qr_code_data TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        trainer_id INTEGER REFERENCES trainers(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        payment_date TEXT DEFAULT (date('now')),
        payment_method TEXT DEFAULT 'Cash',
        plan_id INTEGER REFERENCES membership_plans(id),
        receipt_number TEXT,
        payment_type TEXT DEFAULT 'member',
        visitor_name TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT DEFAULT (date('now')),
        payment_method TEXT DEFAULT 'نقدی',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_type TEXT DEFAULT 'member',
        user_id INTEGER NOT NULL,
        check_in TEXT DEFAULT (datetime('now')),
        check_out TEXT,
        notes TEXT
    );
    
    CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        quantity INTEGER DEFAULT 1,
        purchase_date TEXT,
        purchase_price REAL DEFAULT 0,
        condition TEXT DEFAULT 'Good',
        status TEXT DEFAULT 'Active',
        location TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        details TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_members_code ON members(member_code);
    CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
    CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id, user_type);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(check_in);
    CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
    """)

    # Existing installations already have the payments table, so add the
    # walk-in visitor field without requiring a database reset.
    payment_columns = {row[1] for row in c.execute("PRAGMA table_info(payments)").fetchall()}
    if 'visitor_name' not in payment_columns:
        c.execute("ALTER TABLE payments ADD COLUMN visitor_name TEXT")
    
    # Admin user
    c.execute("SELECT id FROM users WHERE username='admin'")
    if not c.fetchone():
        c.execute("INSERT INTO users (username, password_hash, full_name, role, language) VALUES (?, ?, ?, ?, ?)",
            ('admin', hash_pw('admin123'), 'مدیر سیستم', 'admin', 'fa'))
        print("[Database] Admin user created")
    
    # Plans
    c.execute("SELECT COUNT(*) FROM membership_plans")
    if c.fetchone()[0] == 0:
        plans = [
            ('روزانه', 1, 200, 'دسترسی یک روزه'),
            ('هفتگی', 7, 900, 'دسترسی هفت روزه'),
            ('ماهانه', 30, 2800, 'دسترسی کامل یک ماهه'),
            ('سه ماهه', 90, 7500, 'دسترسی سه ماهه'),
            ('شش ماهه', 180, 13000, 'دسترسی شش ماهه'),
            ('سالانه', 365, 22000, 'دسترسی کامل یک ساله'),
            ('VIP سالانه', 365, 40000, 'دسترسی VIP با مربی'),
        ]
        c.executemany("INSERT INTO membership_plans (plan_name, duration_days, price, description) VALUES (?, ?, ?, ?)", plans)
        print("[Database] Membership plans created")
    
    # Settings
    default_settings = [
        ('gym_name', 'باشگاه شما'),
        ('gym_address', 'کابل، افغانستان'),
        ('gym_phone', '+93 700 000 000'),
        ('gym_email', 'info@goldengym.com'),
        ('currency', 'AFN'),
        ('language', 'fa'),
        ('theme', 'dark_gold'),
        ('backup_schedule_enabled', 'true'),
        ('backup_schedule_time', '21:00'),
        ('backup_directory', ''),
        ('backup_last_run_date', ''),
        ('backup_last_reminder_date', ''),
        ('backup_last_event', ''),
    ]
    for key, value in default_settings:
        c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, value))

    default_expense_categories = ['اجاره', 'برق و آب', 'حقوق کارکنان', 'تعمیرات', 'لوازم و مواد مصرفی', 'بازاریابی', 'سایر']
    c.executemany("INSERT OR IGNORE INTO expense_categories (name) VALUES (?)", [(name,) for name in default_expense_categories])
    
    conn.commit()
    conn.close()
    print("[Database] Initialized successfully")

# ── AUTH     ────────────
def login(username, password):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username=? AND password_hash=?", (username, hash_pw(password)))
    row = c.fetchone()
    if row:
        conn.execute("UPDATE users SET last_login=datetime('now') WHERE id=?", (row['id'],))
        conn.commit()
        result = dict(row)
        if 'password_hash' in result:
            del result['password_hash']
        conn.close()
        return result
    conn.close()
    return None

def change_password(username, new_password):
    conn = get_conn()
    conn.execute("UPDATE users SET password_hash=? WHERE username=?", (hash_pw(new_password), username))
    conn.commit()
    conn.close()
    return True

def create_password_recovery_key(username):
    """Create one offline recovery key, replacing any earlier unused key."""
    conn = get_conn()
    user = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
    if not user:
        conn.close()
        return None
    recovery_key = _new_recovery_key()
    salt = secrets.token_bytes(16)
    conn.execute("DELETE FROM password_recovery WHERE user_id=?", (user['id'],))
    conn.execute(
        "INSERT INTO password_recovery (user_id, key_salt, key_hash) VALUES (?, ?, ?)",
        (user['id'], salt, _recovery_key_hash(recovery_key, salt))
    )
    conn.commit()
    conn.close()
    return recovery_key

def reset_password_with_recovery_key(username, recovery_key, new_password):
    """Reset a password using a one-time key; lock after repeated failures."""
    if not isinstance(new_password, str) or len(new_password) < 8:
        return {'success': False, 'message': 'رمز جدید باید حداقل ۸ کاراکتر باشد.'}
    conn = get_conn()
    row = conn.execute("""
        SELECT u.id, r.key_salt, r.key_hash, r.failed_attempts, r.locked_until
        FROM users u LEFT JOIN password_recovery r ON r.user_id = u.id
        WHERE u.username=?
    """, (username,)).fetchone()
    generic_error = 'اطلاعات بازیابی درست نیست.'
    if not row or row['key_hash'] is None:
        conn.close()
        return {'success': False, 'message': generic_error}

    now = datetime.now()
    locked_until = datetime.fromisoformat(row['locked_until']) if row['locked_until'] else None
    if locked_until and now < locked_until:
        remaining = max(1, int((locked_until - now).total_seconds() // 60) + 1)
        conn.close()
        return {'success': False, 'message': 'تلاش‌های بازیابی موقتاً قفل شده است. حدود {0} دقیقه دیگر دوباره امتحان کنید.'.format(remaining)}
    if locked_until:
        conn.execute("UPDATE password_recovery SET failed_attempts=0, locked_until=NULL WHERE user_id=?", (row['id'],))
        attempts = 0
    else:
        attempts = row['failed_attempts']

    valid = hmac.compare_digest(_recovery_key_hash(recovery_key, row['key_salt']), row['key_hash'])
    if not valid:
        attempts += 1
        if attempts >= RECOVERY_MAX_ATTEMPTS:
            lock_until = (now + timedelta(minutes=RECOVERY_LOCK_MINUTES)).isoformat(timespec='seconds')
            conn.execute("UPDATE password_recovery SET failed_attempts=0, locked_until=? WHERE user_id=?", (lock_until, row['id']))
            message = 'تلاش‌های بازیابی موقتاً قفل شد. ۱۵ دقیقه دیگر دوباره امتحان کنید.'
        else:
            conn.execute("UPDATE password_recovery SET failed_attempts=? WHERE user_id=?", (attempts, row['id']))
            message = generic_error + ' {0} تلاش دیگر باقی مانده است.'.format(RECOVERY_MAX_ATTEMPTS - attempts)
        conn.commit()
        conn.close()
        add_activity('password_recovery_failed', 'تلاش ناموفق بازیابی رمز', 'حساب: ' + str(username))
        return {'success': False, 'message': message}

    conn.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_pw(new_password), row['id']))
    conn.execute("DELETE FROM password_recovery WHERE user_id=?", (row['id'],))
    conn.commit()
    conn.close()
    add_activity('password_recovery_reset', 'رمز عبور با کلید بازیابی تنظیم شد', 'حساب: ' + str(username))
    return {'success': True, 'message': 'رمز عبور تغییر کرد. کلید بازیابی مصرف شد.'}

# ── SETTINGS     ────────
def get_all_settings():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT key, value FROM settings")
    rows = c.fetchall()
    conn.close()
    return {row[0]: row[1] for row in rows}

def set_setting(key, value):
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

# ── MEMBERS     ────────
def get_members(search="", status="All", limit=500):
    conn = get_conn()
    c = conn.cursor()
    q = "SELECT * FROM members WHERE 1=1"
    params = []
    if search:
        q += " AND (full_name LIKE ? OR father_name LIKE ? OR member_code LIKE ? OR phone LIKE ? OR CAST(id AS TEXT) LIKE ?)"
        params.extend([f"%{search}%"] * 5)
    if status != "All":
        q += " AND status=?"
        params.append(status)
    q += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_members_page(search="", status="All", page=1, per_page=20):
    """Return one member directory page along with the filtered result count."""
    conn = get_conn()
    c = conn.cursor()
    where = " WHERE 1=1"
    params = []
    if search:
        where += " AND (full_name LIKE ? OR father_name LIKE ? OR member_code LIKE ? OR phone LIKE ? OR CAST(id AS TEXT) LIKE ?)"
        params.extend([f"%{search}%"] * 5)
    if status != "All":
        where += " AND status=?"
        params.append(status)

    c.execute("SELECT COUNT(*) FROM members" + where, params)
    total = c.fetchone()[0]
    page = max(1, int(page or 1))
    per_page = max(1, min(int(per_page or 20), 100))
    offset = (page - 1) * per_page
    c.execute("SELECT * FROM members" + where + " ORDER BY id DESC LIMIT ? OFFSET ?", params + [per_page, offset])
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return {'members': rows, 'total': total, 'page': page, 'per_page': per_page}

def get_member(mid):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM members WHERE id=?", (mid,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_member_by_code(code):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM members WHERE member_code=?", (code,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def add_member(data):
    conn = get_conn()
    c = conn.cursor()
    qr = f"GGYM|{data['member_code']}|{data['full_name']}|{data.get('status', 'Active')}|{data.get('expiry_date', '')}"
    c.execute("""INSERT INTO members 
        (member_code, full_name, father_name, phone, email, address, gender, 
         blood_group, date_of_birth, join_date, expiry_date, membership_type, 
         status, photo_path, emergency_contact, notes, qr_code_data)
        VALUES (:member_code, :full_name, :father_name, :phone, :email, :address, :gender,
         :blood_group, :date_of_birth, :join_date, :expiry_date, :membership_type,
         :status, :photo_path, :emergency_contact, :notes, :qr)""",
        {**data, 'qr': qr})
    conn.commit()
    lid = c.lastrowid
    conn.close()
    return lid

def update_member(mid, data):
    conn = get_conn()
    # member_code isn't part of the edit form payload — fall back to the
    # existing record instead of assuming it's present (was a KeyError bug).
    existing = get_member(mid) or {}
    member_code = data.get('member_code', existing.get('member_code', ''))
    full_name = data.get('full_name', existing.get('full_name', ''))
    status = data.get('status', existing.get('status', 'Active'))
    expiry_date = data.get('expiry_date', existing.get('expiry_date', ''))
    qr = f"GGYM|{member_code}|{full_name}|{status}|{expiry_date}"
    params = {**existing, **data, 'id': mid, 'qr': qr}
    conn.execute("""UPDATE members SET 
        full_name=:full_name, father_name=:father_name, phone=:phone, email=:email, 
        address=:address, gender=:gender, blood_group=:blood_group, 
        date_of_birth=:date_of_birth, expiry_date=:expiry_date,
        membership_type=:membership_type, status=:status, photo_path=:photo_path,
        emergency_contact=:emergency_contact, notes=:notes, qr_code_data=:qr 
        WHERE id=:id""",
        params)
    conn.commit()
    conn.close()

def delete_member(mid):
    conn = get_conn()
    conn.execute("DELETE FROM members WHERE id=?", (mid,))
    conn.commit()
    conn.close()

def next_member_code():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT member_code FROM members ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    if row:
        try:
            return f"MBR{int(row[0].replace('MBR', '')) + 1:03d}"
        except:
            pass
    return "MBR001"

def member_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM members")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE status='Active'")
    active = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE status='Expired'")
    expired = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE status='Inactive'")
    inactive = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE gender='Male'")
    male = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE gender='Female'")
    female = c.fetchone()[0]
    conn.close()
    return {'total': total, 'active': active, 'expired': expired, 'inactive': inactive, 'male': male, 'female': female}

# ── STAFF     ──────────
def get_staff(search="", status="All"):
    conn = get_conn()
    c = conn.cursor()
    q = "SELECT * FROM staff WHERE 1=1"
    params = []
    if search:
        q += " AND (full_name LIKE ? OR father_name LIKE ? OR staff_code LIKE ? OR phone LIKE ?)"
        params.extend([f"%{search}%"] * 4)
    if status != "All":
        q += " AND status=?"
        params.append(status)
    q += " ORDER BY full_name"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_staff_by_code(code):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM staff WHERE staff_code=?", (code,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_staff_by_id(sid):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM staff WHERE id=?", (sid,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def add_staff(data):
    conn = get_conn()
    c = conn.cursor()
    qr = f"GGYM-STF|{data['staff_code']}|{data['full_name']}|{data.get('status', 'Active')}|"
    c.execute("""INSERT INTO staff 
        (staff_code, full_name, father_name, phone, email, address, gender,
         blood_group, date_of_birth, hire_date, position, salary, status, photo_path, notes, qr_code_data)
        VALUES (:staff_code, :full_name, :father_name, :phone, :email, :address, :gender,
         :blood_group, :date_of_birth, :hire_date, :position, :salary, :status, :photo_path, :notes, :qr)""",
        {**data, 'qr': qr})
    conn.commit()
    lid = c.lastrowid
    conn.close()
    return lid

def update_staff(sid, data):
    conn = get_conn()
    # staff_code isn't part of the edit form payload — fall back to the
    # existing record instead of assuming it's present (was a KeyError bug).
    existing = get_staff_by_id(sid) or {}
    staff_code = data.get('staff_code', existing.get('staff_code', ''))
    full_name = data.get('full_name', existing.get('full_name', ''))
    status = data.get('status', existing.get('status', 'Active'))
    qr = f"GGYM-STF|{staff_code}|{full_name}|{status}|"
    params = {**existing, **data, 'id': sid, 'qr': qr}
    conn.execute("""UPDATE staff SET 
        full_name=:full_name, father_name=:father_name, phone=:phone, email=:email,
        address=:address, gender=:gender, blood_group=:blood_group,
        date_of_birth=:date_of_birth, position=:position, salary=:salary,
        status=:status, photo_path=:photo_path, notes=:notes, qr_code_data=:qr
        WHERE id=:id""",
        params)
    conn.commit()
    conn.close()

def delete_staff(sid):
    conn = get_conn()
    conn.execute("DELETE FROM staff WHERE id=?", (sid,))
    conn.commit()
    conn.close()

def next_staff_code():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT staff_code FROM staff ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    if row:
        try:
            return f"STF{int(row[0].replace('STF', '')) + 1:03d}"
        except:
            pass
    return "STF001"

def staff_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM staff")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM staff WHERE status='Active'")
    active = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM staff WHERE status='Inactive'")
    inactive = c.fetchone()[0]
    conn.close()
    return {'total': total, 'active': active, 'inactive': inactive}

# ── TRAINERS     ────────
def get_trainers(search="", status="All"):
    conn = get_conn()
    c = conn.cursor()
    q = "SELECT * FROM trainers WHERE 1=1"
    params = []
    if search:
        q += " AND (full_name LIKE ? OR father_name LIKE ? OR trainer_code LIKE ? OR phone LIKE ? OR specialization LIKE ?)"
        params.extend([f"%{search}%"] * 5)
    if status != "All":
        q += " AND status=?"
        params.append(status)
    q += " ORDER BY full_name"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_trainer_by_code(code):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM trainers WHERE trainer_code=?", (code,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_trainer_by_id(tid):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM trainers WHERE id=?", (tid,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def add_trainer(data):
    conn = get_conn()
    c = conn.cursor()
    qr = f"GGYM-TRN|{data['trainer_code']}|{data['full_name']}|{data.get('status', 'Active')}|"
    c.execute("""INSERT INTO trainers 
        (trainer_code, full_name, father_name, phone, email, address, gender,
         blood_group, date_of_birth, hire_date, specialization, salary, status, photo_path, notes, qr_code_data)
        VALUES (:trainer_code, :full_name, :father_name, :phone, :email, :address, :gender,
         :blood_group, :date_of_birth, :hire_date, :specialization, :salary, :status, :photo_path, :notes, :qr)""",
        {**data, 'qr': qr})
    conn.commit()
    lid = c.lastrowid
    conn.close()
    return lid

def update_trainer(tid, data):
    conn = get_conn()
    # trainer_code isn't part of the edit form payload — fall back to the
    # existing record instead of assuming it's present (was a KeyError bug).
    existing = get_trainer_by_id(tid) or {}
    trainer_code = data.get('trainer_code', existing.get('trainer_code', ''))
    full_name = data.get('full_name', existing.get('full_name', ''))
    status = data.get('status', existing.get('status', 'Active'))
    qr = f"GGYM-TRN|{trainer_code}|{full_name}|{status}|"
    params = {**existing, **data, 'id': tid, 'qr': qr}
    conn.execute("""UPDATE trainers SET 
        full_name=:full_name, father_name=:father_name, phone=:phone, email=:email,
        address=:address, gender=:gender, blood_group=:blood_group,
        date_of_birth=:date_of_birth, specialization=:specialization,
        salary=:salary, status=:status, photo_path=:photo_path, notes=:notes, qr_code_data=:qr
        WHERE id=:id""",
        params)
    conn.commit()
    conn.close()

def delete_trainer(tid):
    conn = get_conn()
    conn.execute("DELETE FROM trainers WHERE id=?", (tid,))
    conn.commit()
    conn.close()

def next_trainer_code():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT trainer_code FROM trainers ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    if row and row[0]:
        try:
            return f"TRN{int(row[0].replace('TRN', '')) + 1:03d}"
        except:
            pass
    return "TRN001"

def trainer_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM trainers")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM trainers WHERE status='Active'")
    active = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM trainers WHERE status='Inactive'")
    inactive = c.fetchone()[0]
    conn.close()
    return {'total': total, 'active': active, 'inactive': inactive}

# ── PAYMENTS     ────────
def get_payments(search="", date_from="", date_to=""):
    conn = get_conn()
    c = conn.cursor()
    q = """SELECT p.*, 
           m.full_name as member_name, m.member_code,
           s.full_name as staff_name, s.staff_code,
           t.full_name as trainer_name, t.trainer_code
           FROM payments p
           LEFT JOIN members m ON p.member_id = m.id
           LEFT JOIN staff s ON p.staff_id = s.id
           LEFT JOIN trainers t ON p.trainer_id = t.id
           WHERE 1=1"""
    params = []
    if search:
        q += " AND (m.full_name LIKE ? OR m.member_code LIKE ? OR s.full_name LIKE ? OR s.staff_code LIKE ? OR t.full_name LIKE ? OR t.trainer_code LIKE ? OR p.visitor_name LIKE ? OR p.receipt_number LIKE ?)"
        params.extend([f"%{search}%"] * 8)
    if date_from:
        q += " AND date(p.payment_date) >= ?"
        params.append(date_from)
    if date_to:
        q += " AND date(p.payment_date) <= ?"
        params.append(date_to)
    q += " ORDER BY p.payment_date DESC"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_payments_page(search="", date_from="", date_to="", page=1, per_page=20):
    """Return one newest-first payment page and the count matching its filters."""
    conn = get_conn()
    c = conn.cursor()
    from_clause = """ FROM payments p
        LEFT JOIN members m ON p.member_id = m.id
        LEFT JOIN staff s ON p.staff_id = s.id
        LEFT JOIN trainers t ON p.trainer_id = t.id"""
    where = " WHERE 1=1"
    params = []
    if search:
        where += " AND (m.full_name LIKE ? OR m.member_code LIKE ? OR s.full_name LIKE ? OR s.staff_code LIKE ? OR t.full_name LIKE ? OR t.trainer_code LIKE ? OR p.visitor_name LIKE ? OR p.receipt_number LIKE ?)"
        params.extend([f"%{search}%"] * 8)
    if date_from:
        where += " AND date(p.payment_date) >= ?"
        params.append(date_from)
    if date_to:
        where += " AND date(p.payment_date) <= ?"
        params.append(date_to)

    c.execute("SELECT COUNT(*)" + from_clause + where, params)
    total = c.fetchone()[0]
    page = max(1, int(page or 1))
    per_page = max(1, min(int(per_page or 20), 100))
    offset = (page - 1) * per_page
    c.execute("""SELECT p.*, m.full_name as member_name, m.member_code,
        s.full_name as staff_name, s.staff_code, t.full_name as trainer_name, t.trainer_code""" + from_clause + where + " ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?", params + [per_page, offset])
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return {'payments': rows, 'total': total, 'page': page, 'per_page': per_page}

def get_payment(pid):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM payments WHERE id=?", (pid,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def add_payment(data):
    conn = get_conn()
    c = conn.cursor()
    payment_data = {
        'member_id': data.get('member_id') if data.get('member_id') else None,
        'staff_id': data.get('staff_id') if data.get('staff_id') else None,
        'trainer_id': data.get('trainer_id') if data.get('trainer_id') else None,
        'amount': float(data.get('amount', 0)),
        'payment_date': data.get('payment_date', date.today().isoformat()),
        'payment_method': data.get('payment_method', 'نقدی'),
        'plan_id': data.get('plan_id') if data.get('plan_id') else None,
        'receipt_number': data.get('receipt_number', 'PAY' + str(int(datetime.now().timestamp()))[-6:]),
        'payment_type': data.get('payment_type', 'member'),
        'visitor_name': data.get('visitor_name', ''),
        'notes': data.get('notes', '')
    }
    c.execute("""INSERT INTO payments 
        (member_id, staff_id, trainer_id, amount, payment_date, payment_method, 
         plan_id, receipt_number, payment_type, visitor_name, notes)
        VALUES (:member_id, :staff_id, :trainer_id, :amount, :payment_date, :payment_method,
         :plan_id, :receipt_number, :payment_type, :visitor_name, :notes)""", payment_data)
    conn.commit()
    lid = c.lastrowid
    conn.close()
    return lid

def update_payment(pid, data):
    conn = get_conn()
    conn.execute("""UPDATE payments SET 
        member_id=:member_id, amount=:amount, payment_date=:payment_date,
        payment_method=:payment_method, payment_type=:payment_type,
        visitor_name=:visitor_name, notes=:notes WHERE id=:id""",
        {**data, 'id': pid})
    conn.commit()
    conn.close()

def delete_payment(pid):
    conn = get_conn()
    conn.execute("DELETE FROM payments WHERE id=?", (pid,))
    conn.commit()
    conn.close()

def payment_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE date(payment_date) = date('now')")
    daily = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')")
    monthly = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE strftime('%Y', payment_date) = strftime('%Y', 'now')")
    yearly = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments")
    total = c.fetchone()[0]
    conn.close()
    return {'daily': daily, 'monthly': monthly, 'yearly': yearly, 'total': total}

def get_payment_chart_data(period="monthly"):
    conn = get_conn()
    c = conn.cursor()
    data = []
    if period == "monthly":
        c.execute("""SELECT strftime('%Y-%m', payment_date) as label, COALESCE(SUM(amount), 0) as value
            FROM payments WHERE date(payment_date) >= date('now', '-365 days')
            GROUP BY strftime('%Y-%m', payment_date) ORDER BY date(payment_date)""")
    elif period == "daily":
        c.execute("""SELECT date(payment_date) as label, COALESCE(SUM(amount), 0) as value
            FROM payments WHERE date(payment_date) >= date('now', '-30 days')
            GROUP BY date(payment_date) ORDER BY date(payment_date)""")
    elif period == "yearly":
        c.execute("""SELECT strftime('%Y', payment_date) as label, COALESCE(SUM(amount), 0) as value
            FROM payments GROUP BY strftime('%Y', payment_date) ORDER BY date(payment_date)""")
    rows = c.fetchall()
    conn.close()
    return [{'label': r[0], 'value': r[1]} for r in rows]

# ── EXPENSES     ────────
def get_expense_categories():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM expense_categories ORDER BY name").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_expense_category(name):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO expense_categories (name) VALUES (?)", (name.strip(),))
    conn.commit()
    category_id = cursor.lastrowid
    conn.close()
    return category_id

def delete_expense_category(category_id):
    conn = get_conn()
    conn.execute("DELETE FROM expense_categories WHERE id=?", (category_id,))
    conn.commit()
    conn.close()

def get_expenses(search=""):
    conn = get_conn()
    query = """SELECT e.*, c.name AS category_name FROM expenses e
               LEFT JOIN expense_categories c ON e.category_id = c.id WHERE 1=1"""
    params = []
    if search:
        query += " AND (e.title LIKE ? OR e.notes LIKE ? OR c.name LIKE ?)"
        params.extend([f"%{search}%"] * 3)
    query += " ORDER BY e.expense_date DESC, e.id DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_expense(data):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""INSERT INTO expenses (category_id, title, amount, expense_date, payment_method, notes)
                   VALUES (:category_id, :title, :amount, :expense_date, :payment_method, :notes)""", {
        'category_id': data.get('category_id') or None, 'title': data.get('title', '').strip(),
        'amount': float(data.get('amount', 0)), 'expense_date': data.get('expense_date', date.today().isoformat()),
        'payment_method': data.get('payment_method', 'نقدی'), 'notes': data.get('notes', '')
    })
    conn.commit()
    expense_id = cursor.lastrowid
    conn.close()
    return expense_id

def update_expense(expense_id, data):
    conn = get_conn()
    conn.execute("""UPDATE expenses SET category_id=:category_id, title=:title, amount=:amount,
                  expense_date=:expense_date, payment_method=:payment_method, notes=:notes WHERE id=:id""", {
        'id': expense_id, 'category_id': data.get('category_id') or None,
        'title': data.get('title', '').strip(), 'amount': float(data.get('amount', 0)),
        'expense_date': data.get('expense_date', date.today().isoformat()),
        'payment_method': data.get('payment_method', 'نقدی'), 'notes': data.get('notes', '')
    })
    conn.commit()
    conn.close()

def delete_expense(expense_id):
    conn = get_conn()
    conn.execute("DELETE FROM expenses WHERE id=?", (expense_id,))
    conn.commit()
    conn.close()

def expense_stats():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date(expense_date) = date('now')")
    daily = cursor.fetchone()[0]
    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')")
    monthly = cursor.fetchone()[0]
    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM expenses")
    total = cursor.fetchone()[0]
    conn.close()
    return {'daily': daily, 'monthly': monthly, 'total': total}

# ── ATTENDANCE     ──────
def checkin(user_id, user_type="member"):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id FROM attendance WHERE user_id=? AND user_type=? AND date(check_in) = date('now') AND check_out IS NULL",
              (user_id, user_type))
    if c.fetchone():
        conn.close()
        return None, "قبلاً ثبت ورود شده"
    c.execute("INSERT INTO attendance (user_id, user_type) VALUES (?, ?)", (user_id, user_type))
    conn.commit()
    lid = c.lastrowid
    conn.close()
    return lid, "ورود با موفقیت ثبت شد"

def checkout(att_id):
    conn = get_conn()
    conn.execute("UPDATE attendance SET check_out = datetime('now') WHERE id=?", (att_id,))
    conn.commit()
    conn.close()

def delete_attendance(att_id):
    conn = get_conn()
    conn.execute("DELETE FROM attendance WHERE id=?", (att_id,))
    conn.commit()
    conn.close()

def today_attendance():
    conn = get_conn()
    c = conn.cursor()
    c.execute("""SELECT a.*, 
        m.full_name as member_name, m.member_code,
        s.full_name as staff_name, s.staff_code,
        t.full_name as trainer_name, t.trainer_code
        FROM attendance a
        LEFT JOIN members m ON a.user_id = m.id AND a.user_type = 'member'
        LEFT JOIN staff s ON a.user_id = s.id AND a.user_type = 'staff'
        LEFT JOIN trainers t ON a.user_id = t.id AND a.user_type = 'trainer'
        WHERE date(a.check_in) = date('now') ORDER BY a.check_in DESC""")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def attendance_history(search="", date_from="", date_to=""):
    conn = get_conn()
    c = conn.cursor()
    q = """SELECT a.*, 
        m.full_name as member_name, m.member_code,
        s.full_name as staff_name, s.staff_code,
        t.full_name as trainer_name, t.trainer_code
        FROM attendance a
        LEFT JOIN members m ON a.user_id = m.id AND a.user_type = 'member'
        LEFT JOIN staff s ON a.user_id = s.id AND a.user_type = 'staff'
        LEFT JOIN trainers t ON a.user_id = t.id AND a.user_type = 'trainer'
        WHERE 1=1"""
    params = []
    if search:
        q += " AND (m.full_name LIKE ? OR m.member_code LIKE ? OR s.full_name LIKE ? OR s.staff_code LIKE ? OR t.full_name LIKE ? OR t.trainer_code LIKE ?)"
        params.extend([f"%{search}%"] * 6)
    if date_from:
        q += " AND date(a.check_in) >= ?"
        params.append(date_from)
    if date_to:
        q += " AND date(a.check_in) <= ?"
        params.append(date_to)
    q += " ORDER BY a.check_in DESC LIMIT 500"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def attendance_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM attendance WHERE date(check_in) = date('now')")
    today = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM attendance WHERE date(check_in) >= date('now', '-7 days')")
    week = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM attendance WHERE date(check_in) >= date('now', '-30 days')")
    month = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM attendance WHERE date(check_in) >= date('now', '-365 days')")
    year = c.fetchone()[0]
    conn.close()
    return {'today': today, 'week': week, 'month': month, 'year': year}

# ── EQUIPMENT     ────────
def get_equipment(search=""):
    conn = get_conn()
    c = conn.cursor()
    q = "SELECT * FROM equipment WHERE 1=1"
    params = []
    if search:
        q += " AND (name LIKE ? OR category LIKE ? OR location LIKE ?)"
        params.extend([f"%{search}%"] * 3)
    q += " ORDER BY name"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_equipment_by_id(eid):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM equipment WHERE id=?", (eid,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def add_equipment(data):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""INSERT INTO equipment 
        (name, category, quantity, purchase_date, purchase_price, condition, status, location, notes)
        VALUES (:name, :category, :quantity, :purchase_date, :purchase_price, :condition, :status, :location, :notes)""", data)
    conn.commit()
    lid = c.lastrowid
    conn.close()
    return lid

def update_equipment(eid, data):
    conn = get_conn()
    # The edit form doesn't send purchase_date/purchase_price/condition —
    # merge onto the existing row so missing keys don't crash the query.
    existing = get_equipment_by_id(eid) or {}
    params = {**existing, **data, 'id': eid}
    conn.execute("""UPDATE equipment SET 
        name=:name, category=:category, quantity=:quantity,
        condition=:condition, status=:status, location=:location, notes=:notes 
        WHERE id=:id""", params)
    conn.commit()
    conn.close()

def delete_equipment(eid):
    conn = get_conn()
    conn.execute("DELETE FROM equipment WHERE id=?", (eid,))
    conn.commit()
    conn.close()

def equipment_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM equipment")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM equipment WHERE status='Active'")
    active = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM equipment WHERE status='Broken'")
    broken = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM equipment WHERE status='Inactive'")
    inactive = c.fetchone()[0]
    conn.close()
    return {'total': total, 'active': active, 'broken': broken, 'inactive': inactive}

# ── PLANS     ────────────
def get_plans():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM membership_plans WHERE is_active=1 ORDER BY duration_days")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

# ── NOTIFICATIONS     ───
def get_notifications(unread_only=False):
    conn = get_conn()
    c = conn.cursor()
    if unread_only:
        c.execute("SELECT * FROM notifications WHERE is_read=0 ORDER BY created_at DESC")
    else:
        c.execute("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def mark_read(nid):
    conn = get_conn()
    conn.execute("UPDATE notifications SET is_read=1 WHERE id=?", (nid,))
    conn.commit()
    conn.close()

def mark_all_read():
    conn = get_conn()
    conn.execute("UPDATE notifications SET is_read=1")
    conn.commit()
    conn.close()

def delete_notification(nid):
    conn = get_conn()
    conn.execute("DELETE FROM notifications WHERE id=?", (nid,))
    conn.commit()
    conn.close()

def add_notification(title, message, ntype="info"):
    conn = get_conn()
    conn.execute("INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)", (title, message, ntype))
    conn.commit()
    conn.close()

# ── ACTIVITIES     ──────
def add_activity(action_type, title, description="", details=""):
    conn = get_conn()
    conn.execute("INSERT INTO activities (action_type, title, description, details) VALUES (?, ?, ?, ?)",
                 (action_type, title, description, details))
    conn.commit()
    conn.close()

def get_recent_activities(limit=20):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM activities ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_activities(limit=100, offset=0):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM activities ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_activities_count():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM activities")
    count = c.fetchone()[0]
    conn.close()
    return count

# ── DASHBOARD     ────────
def dashboard_stats():
    conn = get_conn()
    c = conn.cursor()
    
    c.execute("SELECT COUNT(*) FROM members")
    total_members = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE status='Active'")
    active_members = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE status='Expired'")
    expired_members = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM members WHERE status='Inactive'")
    inactive_members = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM staff")
    total_staff = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM staff WHERE status='Active'")
    active_staff = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM staff WHERE status='Inactive'")
    inactive_staff = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM trainers")
    total_trainers = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM trainers WHERE status='Active'")
    active_trainers = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM trainers WHERE status='Inactive'")
    inactive_trainers = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM equipment")
    total_equipment = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM equipment WHERE status='Active'")
    active_equipment = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM equipment WHERE status='Broken'")
    broken_equipment = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM equipment WHERE status='Inactive'")
    inactive_equipment = c.fetchone()[0]
    
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE date(payment_date) = date('now')")
    daily_income = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')")
    monthly_income = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE strftime('%Y', payment_date) = strftime('%Y', 'now')")
    yearly_income = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM attendance WHERE date(check_in) = date('now')")
    today_attendance = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM notifications WHERE is_read=0")
    unread_notifs = c.fetchone()[0]
    
    c.execute("SELECT * FROM members WHERE date(expiry_date) BETWEEN date('now') AND date('now', '+7 days') AND status='Active'")
    expiring_soon = [dict(r) for r in c.fetchall()]
    
    conn.close()
    return {
        'total_members': total_members, 'active_members': active_members,
        'expired_members': expired_members, 'inactive_members': inactive_members,
        'total_staff': total_staff, 'active_staff': active_staff, 'inactive_staff': inactive_staff,
        'total_trainers': total_trainers, 'active_trainers': active_trainers, 'inactive_trainers': inactive_trainers,
        'total_equipment': total_equipment, 'active_equipment': active_equipment,
        'broken_equipment': broken_equipment, 'inactive_equipment': inactive_equipment,
        'daily_income': daily_income, 'monthly_income': monthly_income, 'yearly_income': yearly_income,
        'today_attendance': today_attendance, 'unread_notifs': unread_notifs,
        'expiring_soon': expiring_soon
    }

# ── REPORTS     ──────────
def get_report_data(report_type, filters=None):
    conn = get_conn()
    c = conn.cursor()
    if report_type == 'members':
        c.execute("""SELECT m.member_code, m.full_name, m.father_name, m.phone, m.email, m.gender,
                     m.blood_group, m.membership_type, m.status, m.join_date, m.expiry_date,
                     COALESCE(SUM(p.amount), 0) AS total_paid
                     FROM members m LEFT JOIN payments p ON p.member_id = m.id
                     GROUP BY m.id ORDER BY m.full_name""")
    elif report_type == 'staff':
        c.execute("SELECT staff_code, full_name, father_name, phone, email, position, salary, status, hire_date FROM staff")
    elif report_type == 'trainers':
        c.execute("SELECT trainer_code, full_name, father_name, phone, email, specialization, salary, status, hire_date FROM trainers")
    elif report_type == 'payments':
        c.execute("SELECT receipt_number, payment_date, amount, payment_method, payment_type FROM payments ORDER BY payment_date DESC LIMIT 500")
    elif report_type == 'expenses':
        c.execute("""SELECT e.title, c.name AS category, e.amount, e.payment_method, e.expense_date, e.notes
                  FROM expenses e LEFT JOIN expense_categories c ON e.category_id = c.id
                  ORDER BY e.expense_date DESC, e.id DESC LIMIT 500""")
    elif report_type == 'attendance':
        c.execute("SELECT user_type, check_in, check_out FROM attendance ORDER BY check_in DESC LIMIT 500")
    elif report_type == 'equipment':
        c.execute("SELECT name, category, quantity, condition, status, location FROM equipment")
    elif report_type == 'expiring':
        c.execute("SELECT member_code, full_name, father_name, phone, membership_type, expiry_date FROM members WHERE date(expiry_date) BETWEEN date('now') AND date('now', '+30 days') AND status='Active' ORDER BY expiry_date")
    elif report_type == 'activities':
        c.execute("SELECT action_type, title, description, created_at FROM activities ORDER BY created_at DESC LIMIT 500")
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def export_report(report_type, format="csv"):
    data = get_report_data(report_type)
    if not data:
        return {'success': False, 'message': 'داده‌ای برای خروجی وجود ندارد'}
    if format == "csv":
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
        return {'success': True, 'data': output.getvalue(), 'format': 'csv'}
    return {'success': False, 'message': 'فرمت غیرمعتبر'}
