/**
 * Scanner Page
 * اسکنر کارت - بررسی با ID و آپلود تصویر
 */

function verifyQR() {
    var data = document.getElementById('qrScanData').value.trim();
    var result = document.getElementById('qrResult');
    
    if (!data) {
        result.innerHTML = scannerPlaceholder('fa-keyboard', 'اطلاعاتی وارد نشده است', 'کد شناسایی یا داده QR را وارد کنید.');
        return;
    }
    
    var bridge = getBridge();
    
    var isQR = data.includes('|');
    var code = data;
    
    if (isQR) {
        var parts = data.split('|');
        if (parts.length >= 2 && parts[0] === 'GGYM') {
            code = parts[1];
        } else {
            result.innerHTML = showErrorResult('فرمت QR نامعتبر', 'لطفاً داده QR معتبر وارد کنید');
            return;
        }
    }
    
    result.innerHTML = scannerPlaceholder('fa-spinner fa-spin', 'در حال بررسی کارت', 'لطفاً چند لحظه صبر کنید.');
    
    bridge.verify_card({ code: code }).then(function(verification) {
        if (verification.valid) {
            result.innerHTML = showValidResult(verification);
        } else {
            result.innerHTML = showInvalidResult(verification.message);
        }
    })['catch'](function(e) {
        result.innerHTML = showErrorResult('خطا در تأیید', e.message);
    });
}

function verifyByCode() {
    var code = document.getElementById('codeVerifyInput').value.trim();
    var result = document.getElementById('qrResult');
    
    if (!code) {
        result.innerHTML = scannerPlaceholder('fa-keyboard', 'کد وارد نشده است', 'کد شناسایی کارت را وارد کنید.');
        return;
    }
    
    document.getElementById('qrScanData').value = code;
    verifyQR();
}

// ─── IMAGE SCANNER ──────────────────────────────────────────
function uploadCardImage() {
    var fileInput = document.getElementById('cardImageUpload');
    var file = fileInput.files[0];
    var result = document.getElementById('qrResult');
    var preview = document.getElementById('imagePreview');
    
    if (!file) {
        result.innerHTML = scannerPlaceholder('fa-image', 'تصویری انتخاب نشده است', 'یک تصویر شامل QR کارت انتخاب کنید.');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid #2A3348;">';
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    result.innerHTML = scannerPlaceholder('fa-spinner fa-spin', 'در حال اسکن تصویر', 'در حال خواندن QR کارت هستیم.');
    
    var bridge = getBridge();
    var reader2 = new FileReader();
    reader2.onload = function(e) {
        var base64 = e.target.result.split(',')[1];
        
        bridge.scan_card_image(base64).then(function(scanResult) {
            if (scanResult.success && scanResult.verification) {
                var verification = scanResult.verification;
                if (verification.valid) {
                    result.innerHTML = showValidResult(verification, scanResult.qr_data);
                } else {
                    result.innerHTML = showInvalidResult(verification.message);
                }
            } else {
                result.innerHTML = showErrorResult('خطا در اسکن', scanResult.message || 'QR کدی در تصویر یافت نشد');
            }
        })['catch'](function(e) {
            result.innerHTML = showErrorResult('خطا در اسکن', e.message);
        });
    };
    reader2.readAsDataURL(file);
}

// ─── RESULT DISPLAY FUNCTIONS ──────────────────────────────

function showValidResult(verification, qrData) {
    var person = verification.data;
    var typeLabel = verification.type_label || 'عضو';
    var statusLabel = person.status === 'Active' ? 'فعال' : 'غیرفعال';
    var statusColor = person.status === 'Active' ? '#2ecc71' : '#e74c3c';
    var code = person.member_code || person.staff_code || person.trainer_code;
    
    var qrSection = qrData ? '<div style="font-size:11px;color:#888;margin-top:8px;"><i class="fas fa-qrcode"></i> داده QR: <span style="font-family:monospace;font-size:10px;">' + qrData + '</span></div>' : '';
    
    return `
        <div style="background:rgba(46,204,113,0.1);border:2px solid rgba(46,204,113,0.3);border-radius:12px;padding:20px;">
            <div class="text-center">
                <i class="fas fa-check-circle" style="color:#2ecc71;font-size:40px;"></i>
                <h5 style="color:#2ecc71;margin-top:8px;">✅ کارت معتبر است</h5>
                <p class="text-muted" style="font-size:13px;">${verification.message}</p>
            </div>
            <hr style="border-color:rgba(46,204,113,0.2);">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px;">
                <div><strong>نوع:</strong> <span class="badge bg-success">${typeLabel}</span></div>
                <div><strong>کد:</strong> <span class="text-gold">${code}</span></div>
                <div><strong>نام:</strong> ${person.full_name}</div>
                <div><strong>نام پدر:</strong> ${person.father_name || '---'}</div>
                <div><strong>گروه خون:</strong> ${person.blood_group || '---'}</div>
                <div><strong>وضعیت:</strong> <span style="color:${statusColor};font-weight:600;">${statusLabel}</span></div>
                <div style="grid-column:span 2;"><strong>تاریخ انقضا:</strong> ${person.expiry_date || '---'}</div>
                ${person.phone ? '<div style="grid-column:span 2;"><strong>شماره تماس:</strong> ' + person.phone + '</div>' : ''}
            </div>
            ${qrSection}
            <div style="text-align:center;margin-top:12px;">
                <span style="background:${statusColor};color:white;padding:4px 24px;border-radius:20px;font-size:12px;font-weight:600;">${statusLabel}</span>
            </div>
        </div>
    `;
}

function showInvalidResult(message) {
    return `
        <div style="background:rgba(231,76,60,0.1);border:2px solid rgba(231,76,60,0.3);border-radius:12px;padding:20px;">
            <div class="text-center">
                <i class="fas fa-times-circle" style="color:#e74c3c;font-size:40px;"></i>
                <h5 style="color:#e74c3c;margin-top:8px;">❌ کارت نامعتبر</h5>
                <p class="text-muted" style="font-size:13px;">${message}</p>
            </div>
        </div>
    `;
}

function showErrorResult(title, message) {
    return `
        <div style="background:rgba(241,196,15,0.1);border:2px solid rgba(241,196,15,0.3);border-radius:12px;padding:20px;">
            <div class="text-center">
                <i class="fas fa-exclamation-triangle" style="color:#f1c40f;font-size:40px;"></i>
                <h5 style="color:#f1c40f;margin-top:8px;">⚠️ ${title}</h5>
                <p class="text-muted" style="font-size:13px;">${message}</p>
            </div>
        </div>
    `;
}

function clearScanner() {
    document.getElementById('qrScanData').value = '';
    document.getElementById('codeVerifyInput').value = '';
    document.getElementById('qrResult').innerHTML = scannerPlaceholder('fa-qrcode', 'منتظر بررسی کارت', 'کد، داده QR یا تصویر کارت را وارد کنید.');
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('cardImageUpload').value = '';
}

function clearImagePreview() {
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('cardImageUpload').value = '';
}

function scannerPlaceholder(icon, title, message) {
    return '<div class="access-result__placeholder"><span><i class="fas ' + icon + '"></i></span><strong>' + title + '</strong><p>' + message + '</p></div>';
}
