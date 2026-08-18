/**
 * Cards Page
 * کارت‌ها
 */

function updateCardPersonList() {
    var type = document.getElementById('cardPersonType').value;
    var select = document.getElementById('cardPersonSelect');
    
    var bridge = getBridge();
    var promise;
    if (type === 'member') promise = bridge.get_members('', 'Active');
    else if (type === 'trainer') promise = bridge.get_trainers();
    else promise = bridge.get_staff();
    
    promise.then(function(persons) {
        select.innerHTML = '<option value="">-- انتخاب کنید --</option>';
        select.innerHTML += persons.map(function(p) {
            var code = p.member_code || p.trainer_code || p.staff_code;
            return '<option value="' + code + '">' + p.full_name + ' (' + code + ')</option>';
        }).join('');
        if (persons.length === 0) {
            select.innerHTML = '<option value="">-- هیچ شخصی یافت نشد --</option>';
        }
        generateCardPreview();
    })['catch'](function(e) { console.error(e); });
}

function generateCardPreview() {
    var type = document.getElementById('cardPersonType').value;
    var code = document.getElementById('cardPersonSelect').value;
    var preview = document.getElementById('cardPreview');
    
    if (!code) {
        preview.innerHTML = '<div style="padding:40px;text-align:center;color:#888;"><i class="fas fa-id-card" style="font-size:48px;color:#555;"></i><p style="margin-top:12px;">لطفاً یک شخص را انتخاب کنید</p></div>';
        return;
    }
    
    var bridge = getBridge();
    var promise;
    if (type === 'member') promise = bridge.get_member_by_code(code);
    else if (type === 'trainer') promise = bridge.get_trainer_by_code(code);
    else promise = bridge.get_staff_by_code(code);
    
    promise.then(function(person) {
        if (!person) {
            preview.innerHTML = '<div style="padding:40px;text-align:center;color:#888;"><p>شخص یافت نشد</p></div>';
            return;
        }
        
        var typeLabels = { member: 'عضو', trainer: 'مربی', staff: 'کارمند' };
        var typeLabel = typeLabels[type] || '';
        var statusColor = person.status === 'Active' ? '#2ecc71' : '#e74c3c';
        var statusLabel = person.status === 'Active' ? 'فعال' : 'غیرفعال';
        var expiryDate = person.expiry_date || '---';
        var joinDate = person.join_date || person.hire_date || '---';
        var personCode = person.member_code || person.trainer_code || person.staff_code;
        var membershipType = person.membership_type || person.specialization || person.position || '---';
        var qrData = 'GGYM|' + personCode + '|' + person.full_name + '|' + person.status + '|' + (person.expiry_date || '');
        
        // Pull gym info + the logo/signature uploaded on the Settings page,
        // and the verification QR, then render them all into the card.
        Promise.all([
            bridge.get_settings(),
            bridge.get_gym_logo(),
            bridge.get_gym_signature(),
            bridge.generate_qr(qrData)
        ]).then(function(results) {
            var settings = results[0] || {};
            var logoBase64 = results[1];
            var sigBase64 = results[2];
            var qrResult = results[3];
            
            var gymName = settings.gym_name || 'جیم گلدن';
            
            var logoBoxContent = logoBase64
                ? '<img src="data:image/png;base64,' + logoBase64 + '" style="width:100%;height:100%;object-fit:contain;border-radius:10px;">'
                : '<span style="color:#aaa;font-size:12px;">لوگو</span>';
            
            var qrImg = qrResult && qrResult.success && qrResult.image
                ? '<img src="data:image/png;base64,' + qrResult.image + '" style="width:56px;height:56px;">'
                : '<i class="fas fa-qrcode" style="font-size:36px;color:#333;"></i>';
            
            var signatureContent = sigBase64
                ? '<img src="data:image/png;base64,' + sigBase64 + '" style="max-width:100%;max-height:34px;object-fit:contain;">'
                : '<span style="color:#bbb;font-size:9px;">بدون امضا</span>';
            
            var cardHTML = `
                <div class="gym-card type-${type}" style="width:100%;max-width:460px;aspect-ratio:16/10;background:#fdfdfb;border:2.5px solid #1a1a2e;border-radius:26px;padding:16px 22px;margin:0 auto;font-family:Segoe UI,Tahoma,sans-serif;direction:rtl;box-shadow:0 12px 40px rgba(0,0,0,0.35);display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
                    
                    <!-- Top row: ID (right) — Gym name + logo (center) — QR/barcode (left) -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div style="text-align:center;">
                            <div style="font-size:10px;color:#666;font-weight:600;">ایدی ${typeLabel}</div>
                            <div style="font-size:13px;color:#1a1a2e;font-weight:800;">${personCode}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:6px;">${gymName}</div>
                            <div style="width:78px;height:56px;border:2px solid #1a1a2e;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto;overflow:hidden;background:#fff;">${logoBoxContent}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="width:66px;height:66px;border:2px solid #1a1a2e;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#fff;">${qrImg}</div>
                            <div style="font-size:8px;color:#666;font-weight:600;margin-top:2px;">بارکد تاییدی کارت</div>
                        </div>
                    </div>
                    
                    <!-- Middle: name/father/blood/membership (right) — dates (left) -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:6px;">
                        <div style="text-align:right;font-size:12px;line-height:1.9;">
                            <div><span style="color:#666;">نام: </span><span style="color:#1a1a2e;font-weight:700;">${person.full_name}</span></div>
                            <div><span style="color:#666;">نام پدر: </span><span style="color:#1a1a2e;font-weight:700;">${person.father_name || '---'}</span></div>
                            <div><span style="color:#666;">گروپ خون: </span><span style="color:#1a1a2e;font-weight:700;">${person.blood_group || '---'}</span></div>
                            <div><span style="color:#666;">نوع عضویت: </span><span style="color:#1a1a2e;font-weight:700;">${membershipType}</span></div>
                        </div>
                        <div style="text-align:right;font-size:12px;line-height:1.9;">
                            <div><span style="color:#666;">تاریخ عضویت: </span><span style="color:#1a1a2e;font-weight:700;">${joinDate}</span></div>
                            <div><span style="color:#666;">تاریخ انقضاء: </span><span style="color:#1a1a2e;font-weight:700;">${expiryDate}</span></div>
                            <div style="margin-top:6px;"><span style="background:${statusColor};color:#fff;padding:2px 12px;border-radius:14px;font-size:10px;font-weight:700;">${statusLabel}</span></div>
                        </div>
                    </div>
                    
                    <!-- Bottom: status spacer (right) — signature box (left) -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
                        <div style="font-size:8px;color:#999;">Golden Gym — ${new Date().toISOString().split('T')[0]}</div>
                        <div style="text-align:center;">
                            <div style="width:110px;height:48px;border:2px solid #1a1a2e;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#fff;">${signatureContent}</div>
                            <div style="font-size:9px;color:#666;font-weight:700;margin-top:2px;">تاییدی جیم</div>
                            <div style="font-size:8px;color:#999;">امضای ریس</div>
                        </div>
                    </div>
                </div>`;
            
            preview.innerHTML = cardHTML;
        });
    })['catch'](function(e) { console.error(e); });
}

function saveCardAsImage() {
    var cardElement = document.querySelector('.gym-card');
    if (!cardElement) {
        showToast('خطا', 'کارتی برای ذخیره وجود ندارد', 'error');
        return;
    }
    
    var code = document.getElementById('cardPersonSelect').value || 'card';
    var type = document.getElementById('cardPersonType').value || 'member';
    
    if (typeof html2canvas !== 'undefined') {
        html2canvas(cardElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            allowTaint: true,
            useCORS: true
        }).then(function(canvas) {
            var link = document.createElement('a');
            link.download = 'golden_gym_card_' + code + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast('موفق', 'کارت با موفقیت ذخیره شد');
        })['catch'](function(err) {
            showToast('خطا', 'خطا در ذخیره کارت: ' + err.message, 'error');
        });
    } else {
        showToast('اطلاع', 'برای ذخیره تصویر، از گزینه چاپ استفاده کنید', 'info');
        window.print();
    }
}