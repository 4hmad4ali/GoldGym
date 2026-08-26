"""Offline, device-bound licence verification for the desktop application.

The public key is safe to ship with customers.  The matching private key is
kept only in ``owner_tools/license_generator.py`` and must never be packaged
with a customer copy of the application.
"""
import base64
import binascii
import hashlib
import json
import os
import platform
import secrets
import sys
from datetime import date, datetime


PRODUCT_ID = 'goldgym-desktop'
PUBLIC_MODULUS = 129595685214518469558299037394441427444412646401003938001550195037211379521811011154734724465478615191746387195841141275467588585954066204969508456415765703183781481712715820380789036477755324469060378331570930748723758761638503291698202815371489837420095721908175671119178468876078828163560631785478442100499
PUBLIC_EXPONENT = 65537
_KEY_BYTES = (PUBLIC_MODULUS.bit_length() + 7) // 8
_LICENSE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_data', 'license.json')
_DEVICE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_data', 'device-id.txt')


def _urlsafe_encode(value):
    return base64.urlsafe_b64encode(value).decode('ascii').rstrip('=')


def _urlsafe_decode(value):
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def _machine_material():
    """Use a stable OS machine identifier when possible, with a local fallback."""
    values = [platform.system(), platform.machine(), hex(getattr(__import__('uuid'), 'getnode')())]
    if sys.platform == 'win32':
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography') as key:
                values.append(winreg.QueryValueEx(key, 'MachineGuid')[0])
        except OSError:
            pass
    return '|'.join(str(item) for item in values)


def get_device_id():
    """Return a privacy-preserving stable ID for the current installation."""
    try:
        with open(_DEVICE_FILE, 'r', encoding='ascii') as source:
            saved = source.read().strip()
            if saved:
                return saved
    except OSError:
        pass
    digest = hashlib.sha256(_machine_material().encode('utf-8')).hexdigest().upper()
    device_id = 'GG-' + digest[:8] + '-' + digest[8:16] + '-' + digest[16:24]
    os.makedirs(os.path.dirname(_DEVICE_FILE), exist_ok=True)
    with open(_DEVICE_FILE, 'w', encoding='ascii') as destination:
        destination.write(device_id)
    return device_id


def _verify_signature(payload, signature):
    """Verify an RSA PKCS#1 v1.5 SHA-256 signature using the embedded public key."""
    if len(signature) != _KEY_BYTES:
        return False
    encoded_digest = bytes.fromhex('3031300d060960864801650304020105000420') + hashlib.sha256(payload).digest()
    padding_size = _KEY_BYTES - len(encoded_digest) - 3
    if padding_size < 8:
        return False
    expected = b'\x00\x01' + b'\xff' * padding_size + b'\x00' + encoded_digest
    decoded = pow(int.from_bytes(signature, 'big'), PUBLIC_EXPONENT, PUBLIC_MODULUS).to_bytes(_KEY_BYTES, 'big')
    return secrets.compare_digest(decoded, expected)


def _decode_license(license_code):
    try:
        payload_b64, signature_b64 = str(license_code).strip().split('.', 1)
        payload = _urlsafe_decode(payload_b64)
        signature = _urlsafe_decode(signature_b64)
        if not _verify_signature(payload, signature):
            return None, 'امضای کد لایسنس معتبر نیست.'
        data = json.loads(payload.decode('utf-8'))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError, binascii.Error):
        return None, 'فرمت کد لایسنس درست نیست.'
    if not isinstance(data, dict):
        return None, 'فرمت کد لایسنس درست نیست.'
    if data.get('product') != PRODUCT_ID or data.get('version') != 1:
        return None, 'این کد برای این نرم‌افزار صادر نشده است.'
    if data.get('device_id') != get_device_id():
        return None, 'این لایسنس برای دستگاه دیگری صادر شده است.'
    if data.get('license_type') not in ('time_based', 'lifetime'):
        return None, 'نوع لایسنس نامعتبر است.'
    return data, None


def _status_from_data(data):
    if data['license_type'] == 'lifetime':
        return {'valid': True, 'license_type': 'lifetime', 'expiry_date': None,
                'message': 'لایسنس دائمی فعال است.', 'licensee': data.get('licensee', '')}
    try:
        expiry = datetime.strptime(data.get('expiry_date', ''), '%Y-%m-%d').date()
    except ValueError:
        return {'valid': False, 'reason': 'invalid', 'message': 'تاریخ لایسنس نامعتبر است.'}
    if date.today() > expiry:
        return {'valid': False, 'reason': 'expired', 'expiry_date': expiry.isoformat(),
                'message': 'اعتبار لایسنس در {0} پایان یافته است.'.format(expiry.isoformat())}
    return {'valid': True, 'license_type': 'time_based', 'expiry_date': expiry.isoformat(),
            'message': 'لایسنس تا {0} فعال است.'.format(expiry.isoformat()), 'licensee': data.get('licensee', '')}


def get_license_status():
    try:
        with open(_LICENSE_FILE, 'r', encoding='utf-8') as source:
            stored = json.load(source)
        code = stored.get('license_code', '')
    except (OSError, json.JSONDecodeError):
        return {'valid': False, 'reason': 'not_activated', 'message': 'نرم‌افزار هنوز فعال نشده است.'}
    data, error = _decode_license(code)
    if error:
        return {'valid': False, 'reason': 'invalid', 'message': error}
    return _status_from_data(data)


def activate_license(license_code):
    data, error = _decode_license(license_code)
    if error:
        return {'success': False, 'message': error}
    status = _status_from_data(data)
    if not status.get('valid'):
        return {'success': False, 'message': status['message']}
    os.makedirs(os.path.dirname(_LICENSE_FILE), exist_ok=True)
    temp_file = _LICENSE_FILE + '.tmp'
    with open(temp_file, 'w', encoding='utf-8') as destination:
        json.dump({'license_code': str(license_code).strip(), 'activated_at': datetime.now().isoformat(timespec='seconds')}, destination)
    os.replace(temp_file, _LICENSE_FILE)
    return {'success': True, 'message': 'فعال‌سازی با موفقیت انجام شد.', 'license': status}
