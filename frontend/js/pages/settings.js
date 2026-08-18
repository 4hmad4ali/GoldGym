/**
 * Settings Page
 * تنظیمات
 */

function changePassword() {
    var current = document.getElementById('currentPassword').value;
    var newPass = document.getElementById('newPassword').value;
    var confirm = document.getElementById('confirmPassword').value;
    
    if (current !== 'admin123') {
        showToast('خطا', 'رمز فعلی اشتباه است', 'error');
        return;
    }
    if (newPass.length < 6) {
        showToast('خطا', 'رمز جدید باید حداقل ۶ کاراکتر باشد', 'error');
        return;
    }
    if (newPass !== confirm) {
        showToast('خطا', 'رمزهای جدید مطابقت ندارند', 'error');
        return;
    }
    
    var bridge = getBridge();
    bridge.change_password('admin', newPass).then(function(result) {
        if (result.success) {
            showToast('موفق', 'رمز عبور با موفقیت تغییر کرد');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showToast('خطا', result.message || 'خطا در تغییر رمز', 'error');
        }
    });
}

function saveSettings() {
    var settings = {
        gym_name: document.getElementById('settingsGymName').value,
        gym_address: document.getElementById('settingsAddress').value,
        gym_phone: document.getElementById('settingsPhone').value,
        gym_email: document.getElementById('settingsEmail').value,
        currency: document.getElementById('settingsCurrency').value
    };
    
    var bridge = getBridge();
    bridge.save_settings(settings).then(function(result) {
        if (result.success) {
            showToast('موفق', 'تنظیمات با موفقیت ذخیره شد');
        } else {
            showToast('خطا', result.message || 'خطا در ذخیره تنظیمات', 'error');
        }
    });
}

function uploadLogo() {
    var fileInput = document.getElementById('logoUpload');
    var file = fileInput.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var base64 = e.target.result.split(',')[1];
        var bridge = getBridge();
        bridge.upload_gym_logo(base64).then(function(result) {
            if (result.success) {
                showToast('موفق', 'لوگو با موفقیت آپلود شد');
                loadLogoSignaturePreviews();
            } else {
                showToast('خطا', result.message || 'خطا در آپلود لوگو', 'error');
            }
        });
    };
    reader.readAsDataURL(file);
}

function uploadSignature() {
    var fileInput = document.getElementById('signatureUpload');
    var file = fileInput.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var base64 = e.target.result.split(',')[1];
        var bridge = getBridge();
        bridge.upload_gym_signature(base64).then(function(result) {
            if (result.success) {
                showToast('موفق', 'امضا با موفقیت آپلود شد');
                loadLogoSignaturePreviews();
            } else {
                showToast('خطا', result.message || 'خطا در آپلود امضا', 'error');
            }
        });
    };
    reader.readAsDataURL(file);
}

function loadLogoSignaturePreviews() {
    var bridge = getBridge();
    bridge.get_gym_logo().then(function(logoBase64) {
        var wrap = document.getElementById('logoPreviewWrap');
        var img = document.getElementById('logoPreview');
        if (logoBase64 && wrap && img) {
            img.src = 'data:image/png;base64,' + logoBase64;
            wrap.style.display = 'block';
        } else if (wrap) {
            wrap.style.display = 'none';
        }
    })['catch'](function(e) { console.error(e); });
    
    bridge.get_gym_signature().then(function(sigBase64) {
        var wrap = document.getElementById('signaturePreviewWrap');
        var img = document.getElementById('signaturePreview');
        if (sigBase64 && wrap && img) {
            img.src = 'data:image/png;base64,' + sigBase64;
            wrap.style.display = 'block';
        } else if (wrap) {
            wrap.style.display = 'none';
        }
    })['catch'](function(e) { console.error(e); });
}

function loadSettings() {
    var bridge = getBridge();
    bridge.get_settings().then(function(settings) {
        document.getElementById('settingsGymName').value = settings.gym_name || 'جیم گلدن';
        document.getElementById('settingsAddress').value = settings.gym_address || 'کابل، افغانستان';
        document.getElementById('settingsPhone').value = settings.gym_phone || '+93 700 000 000';
        document.getElementById('settingsEmail').value = settings.gym_email || 'info@goldengym.af';
        document.getElementById('settingsCurrency').value = settings.currency || 'AFN';
    });
    loadLogoSignaturePreviews();
}