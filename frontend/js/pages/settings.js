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
    var gymName = document.getElementById('settingsGymName').value.trim();
    if (!gymName) {
        showToast('خطا', 'نام باشگاه را وارد کنید', 'error');
        return;
    }
    var settings = {
        gym_name: gymName,
        gym_address: document.getElementById('settingsAddress').value,
        gym_phone: document.getElementById('settingsPhone').value,
        gym_email: document.getElementById('settingsEmail').value,
        currency: document.getElementById('settingsCurrency').value,
        theme: ThemeManager.preference,
        backup_schedule_enabled: document.getElementById('backupScheduleEnabled').checked ? 'true' : 'false'
    };
    
    var bridge = getBridge();
    bridge.save_settings(settings).then(function(result) {
        if (result.success) {
            applyGymBrand(settings);
            updateSettingsBrandPreview(settings.gym_name);
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
        document.getElementById('settingsGymName').value = settings.gym_name || 'باشگاه شما';
        document.getElementById('settingsAddress').value = settings.gym_address || 'کابل، افغانستان';
        document.getElementById('settingsPhone').value = settings.gym_phone || '+93 700 000 000';
        document.getElementById('settingsEmail').value = settings.gym_email || 'info@goldengym.af';
        document.getElementById('settingsCurrency').value = settings.currency || 'AFN';
        document.getElementById('backupScheduleEnabled').checked = settings.backup_schedule_enabled !== 'false';
        applyGymBrand(settings);
        updateSettingsBrandPreview(settings.gym_name || 'باشگاه شما');
        ThemeManager.apply(settings.theme || ThemeManager.preference);
    });
    loadLogoSignaturePreviews();
    loadBackupScheduleStatus();
}

function loadBackupScheduleStatus() {
    getBridge().get_backup_schedule_status().then(function(status) {
        var target = document.getElementById('backupScheduleStatus');
        if (!target) return;
        var last = status.last_run_date ? 'آخرین نسخه: ' + status.last_run_date : 'هنوز نسخه خودکاری تهیه نشده است';
        target.textContent = (status.enabled ? 'فعال — هر شب ساعت ۹. ' : 'غیرفعال. ') + last + ' مسیر: ' + status.folder;
    })['catch'](function() {});
}

function chooseBackupDirectory() {
    getBridge().choose_backup_directory().then(function(result) {
        if (!result.success) {
            if (!result.cancelled) showToast('خطا', result.message || 'انتخاب محل ذخیره انجام نشد.', 'error');
            return;
        }
        showToast('محل ذخیره تنظیم شد', 'پشتیبان‌های خودکار در این پوشه ذخیره می‌شوند.');
        loadBackupScheduleStatus();
    })['catch'](function(error) {
        showToast('خطا', error.message || 'انتخاب محل ذخیره انجام نشد.', 'error');
    });
}

function downloadBackup() {
    showToast('Ù„Ø·ÙØ§Ù‹ ØµØ¨Ø± Ú©Ù†ÛŒØ¯', 'Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ø¯Ø± Ø­Ø§Ù„ Ø¢Ù…Ø§Ø¯Ù‡â€ŒØ³Ø§Ø²ÛŒ Ø§Ø³Øª');
    getBridge().create_backup().then(function(result) {
        if (!result.success) {
            showToast('Ø®Ø·Ø§', result.message || 'Ø®Ø·Ø§ Ø¯Ø± Ø³Ø§Ø®Øª Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù†', 'error');
            return;
        }
        var link = document.createElement('a');
        link.href = 'data:application/zip;base64,' + result.data;
        link.download = result.filename || 'golden_gym_backup.zip';
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('Ù…ÙˆÙÙ‚', 'Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯');
    })['catch'](function(error) {
        showToast('Ø®Ø·Ø§', error.message || 'Ø®Ø·Ø§ Ø¯Ø± Ø³Ø§Ø®Øª Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù†', 'error');
    });
}

function restoreBackup(input) {
    var file = input && input.files ? input.files[0] : null;
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
        showToast('Ø®Ø·Ø§', 'Ù„Ø·ÙØ§Ù‹ ÙØ§ÛŒÙ„ Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† (.zip) Ø±Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯', 'error');
        input.value = '';
        return;
    }
    if (!window.confirm('Ø¨Ø§Ø²Ú¯Ø±Ø§Ù†ÛŒ Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ø¯Ø§Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ ÙØ¹Ù„ÛŒ Ø±Ø§ Ø¬Ø§ÛŒÚ¯Ø²ÛŒÙ† Ù…ÛŒÚ©Ù†Ø¯. Ø§Ø¯Ø§Ù…Ù‡ Ù…ÛŒâ€ŒØ¯Ù‡ÛŒØ¯ØŸ')) {
        input.value = '';
        return;
    }
    var reader = new FileReader();
    reader.onload = function(event) {
        getBridge().restore_backup(event.target.result).then(function(result) {
            if (result.success) {
                showToast('Ù…ÙˆÙÙ‚', 'Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø¨Ø§Ø²Ú¯Ø±Ø¯Ø§Ù†ÛŒ Ø´Ø¯. ØµÙØ­Ù‡ Ø±Ø§ Ù†Ùˆ Ú©Ù†ÛŒØ¯.');
                setTimeout(function() { window.location.reload(); }, 1200);
            } else {
                showToast('Ø®Ø·Ø§', result.message || 'Ù†Ø³Ø®Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª', 'error');
            }
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// Clean backup messages. These declarations intentionally replace the legacy
// versions above, whose translated strings were stored with the wrong encoding.
function downloadBackup() {
    showToast('لطفاً صبر کنید', 'در حال آماده‌سازی نسخهٔ پشتیبان است');
    getBridge().save_backup().then(function(result) {
        if (!result.success) {
            if (result.cancelled) return;
            showToast('Error', result.message || 'موفق به ساختن نسخهٔ پشتیبان نشد.', 'error');
            return;
        }
        showToast('Done', 'Backup saved as ' + (result.filename || 'golden_gym_backup.zip') + '.');
    })['catch'](function(error) {
        showToast('Error', error.message || 'قادر به ساختن نسخهٔ پشتیبان نشد.', 'error');
    });
}

function restoreBackup(input) {
    var file = input && input.files ? input.files[0] : null;
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
        showToast('Error', 'Please choose a .zip backup file.', 'error');
        input.value = '';
        return;
    }
    showBackupRestoreConfirmation(file, input);
}

function showBackupRestoreConfirmation(file, input) {
    var modalElement = document.getElementById('backupRestoreModal');
    var filename = document.getElementById('backupRestoreFilename');
    var confirmButton = document.getElementById('backupRestoreAction');
    if (!modalElement || !confirmButton || typeof bootstrap === 'undefined') {
        showToast('Error', 'قادر به باز کردن تأیید بازیابی نشد.', 'error');
        input.value = '';
        return;
    }
    if (filename) filename.textContent = file.name;
    modalElement.addEventListener('hidden.bs.modal', function() {
        input.value = '';
    }, { once: true });
    confirmButton.onclick = function() {
        bootstrap.Modal.getOrCreateInstance(modalElement).hide();
        uploadBackupFile(file, input);
    };
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function uploadBackupFile(file, input) {
    var reader = new FileReader();
    reader.onload = function(event) {
        getBridge().restore_backup(event.target.result).then(function(result) {
            if (result.success) {
                showToast('Restored', 'The backup was restored. Reloading the app…');
                setTimeout(function() { window.location.reload(); }, 1200);
            } else {
                showToast('Error', result.message || 'The backup file is invalid.', 'error');
            }
        })['catch'](function(error) {
            showToast('Error', error.message || 'قادر به بازیابی نسخهٔ پشتیبان نشد.', 'error');
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function updateSettingsBrandPreview(gymName) {
    var preview = document.getElementById('settingsGymNamePreview');
    if (preview) preview.textContent = gymName || 'باشگاه ا';
}
