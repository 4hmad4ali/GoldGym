"""
Golden Gym Desktop — Python-JS Bridge
"""
import json
import base64
import io
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont
import database as db
from datetime import date, datetime
import uuid
import sys

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

class GoldenGymBridge:
    def __init__(self):
        self.current_user = None
        self.user_data_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "user_data"
        )
        self.assets_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "assets"
        )
        self.templates_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "frontend", "templates"
        )
        for folder in ['members', 'staff', 'coaches']:
            os.makedirs(os.path.join(self.user_data_path, folder), exist_ok=True)
        os.makedirs(self.assets_path, exist_ok=True)
    
    # ── AUTH ──────────────────────────────────────────────
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
    
    def logout(self):
        self.current_user = None
        return {'success': True}

    # ── FRONTEND TEMPLATES ─────────────────────────────────
    def get_page_template(self, page_name):
        """Return a vetted page template for the single-window desktop shell."""
        allowed_pages = {
            'dashboard', 'members', 'payments', 'attendance', 'coaches',
            'equipment', 'cards', 'reports', 'notifications', 'settings', 'about',
            'member-form', 'trainer-form', 'staff-form'
        }
        if page_name not in allowed_pages:
            return ''

        template_path = os.path.join(self.templates_path, page_name + '.html')
        if not os.path.isfile(template_path):
            return ''

        with open(template_path, 'r', encoding='utf-8') as template_file:
            return template_file.read()
    
    # ── SETTINGS ──────────────────────────────────────────
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
    
    # ── MEMBERS ───────────────────────────────────────────
    def get_members(self, search="", status="All"):
        return db.get_members(search, status)
    
    def get_member(self, mid):
        return db.get_member(mid)
    
    def get_member_by_code(self, code):
        return db.get_member_by_code(code)
    
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
    
    # ── PAYMENTS ──────────────────────────────────────────
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
                'notes': data.get('notes', '')
            }
            payment_id = db.add_payment(payment_data)
            member = db.get_member(data.get('member_id'))
            if member:
                db.add_activity("payment_add", f"پرداخت: AFN {data.get('amount', 0):,.0f} از {member.get('full_name', '')}", json.dumps(data, ensure_ascii=False))
                db.add_notification(f"پرداخت: AFN {data.get('amount', 0):,.0f}", f"از {member.get('full_name', '')}", "success")
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
    
    # ── TRAINERS ──────────────────────────────────────────
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
                'notes': data.get('notes', '')
            }
            trainer_id = db.add_trainer(trainer_data)
            db.add_activity("trainer_add", f"مربی جدید: {trainer_data.get('full_name', '')}", json.dumps(trainer_data, ensure_ascii=False))
            return {'success': True, 'id': trainer_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_trainer(self, tid, data):
        try:
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
    
    # ── STAFF ─────────────────────────────────────────────
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
                'notes': data.get('notes', '')
            }
            staff_id = db.add_staff(staff_data)
            db.add_activity("staff_add", f"کارمند جدید: {staff_data.get('full_name', '')}", json.dumps(staff_data, ensure_ascii=False))
            return {'success': True, 'id': staff_id}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def update_staff(self, sid, data):
        try:
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
    
    # ── PLANS ─────────────────────────────────────────────
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
            qr = qrcode.QRCode(version=3, box_size=5, border=2, error_correction=qrcode.constants.ERROR_CORRECT_H)
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
            return {'success': True, 'filename': filename, 'path': os.path.basename(filename)}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def _create_card_template(self, data):
        width = 550
        height = 780
        
        img = Image.new('RGB', (width, height), color='#1A1A2E')
        draw = ImageDraw.Draw(img)
        
        # Card Border
        draw.rectangle([5, 5, width-5, height-5], outline='#FFB900', width=3)
        draw.rectangle([10, 10, width-10, height-10], outline='rgba(255,185,0,0.3)', width=1)
        
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
        
        gym_name = data.get('gym_name', 'جیم گلدن')
        draw.text((95, 25), gym_name, fill='#1A1A2E', font=None)
        draw.text((95, 50), "Golden Gym", fill='#1A1A2E', font=None)
        
        type_label = data.get('type_label', 'عضو')
        type_colors = {'عضو': '#2ecc71', 'مربی': '#3498db', 'کارمند': '#e67e22'}
        type_color = type_colors.get(type_label, '#2ecc71')
        draw.rectangle([width-110, 20, width-25, 50], fill=type_color, outline='white', width=1)
        draw.text((width-75, 28), type_label, fill='white', font=None)
        
        # Photo
        photo_x = (width - 100) // 2
        draw.ellipse([photo_x, 100, photo_x + 100, 200], fill='#2A2A4A', outline='#FFB900', width=3)
        full_name = data.get('full_name', '')
        initial = full_name[0] if full_name else '?'
        draw.text((photo_x + 35, 130), initial, fill='#FFB900', font=None)
        
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
    
    # ── REPORTS ───────────────────────────────────────────
    def get_report_data(self, report_type, filters=None):
        return db.get_report_data(report_type, filters)
    
    def export_report(self, report_type, format="csv"):
        return db.export_report(report_type, format)
    
    # ── UTILITY ───────────────────────────────────────────
    def get_current_date(self):
        return date.today().isoformat()
    
    def get_current_datetime(self):
        return datetime.now().isoformat()
