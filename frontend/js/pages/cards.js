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
        preview.innerHTML = '<div class="access-preview-empty"><i class="fas fa-id-card"></i><strong>یک شخص را انتخاب کنید</strong><p>اطلاعات کارت پس از انتخاب شخص نمایش داده می‌شود.</p></div>';
        return;
    }
    
    var bridge = getBridge();
    var promise;
    if (type === 'member') promise = bridge.get_member_by_code(code);
    else if (type === 'trainer') promise = bridge.get_trainer_by_code(code);
    else promise = bridge.get_staff_by_code(code);
    
    promise.then(function(person) {
        if (!person) {
            preview.innerHTML = '<div class="access-preview-empty"><i class="fas fa-user-slash"></i><strong>شخص پیدا نشد</strong><p>فهرست افراد را به‌روزرسانی و دوباره تلاش کنید.</p></div>';
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
                <div class="gym-card type-${type}" style="width:100%;max-width:460px;aspect-ratio:16/10;background:#fdfdfb;border:2.5px solid #1a1a2e;border-radius:26px;padding:16px 22px;margin:0 auto;font-family:Vazirmatn,'Segoe UI',Tahoma,sans-serif;direction:rtl;box-shadow:0 12px 40px rgba(0,0,0,0.35);display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
                    
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

function escapeCardText(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function bindCardPrintAction() {
    var printButton = document.querySelector('.access-panel__actions .access-action:not(.is-primary)');
    if (!printButton) return;
    printButton.onclick = printCard;
}

function generateCardPreview() {
    bindCardPrintAction();
    var type = document.getElementById('cardPersonType').value;
    var code = document.getElementById('cardPersonSelect').value;
    var preview = document.getElementById('cardPreview');
    if (!code || !preview) {
        if (preview) preview.innerHTML = '<div class="access-preview-empty"><i class="fas fa-id-card"></i><strong>یک شخص را انتخاب کنید</strong><p>پس از انتخاب شخص، پیش‌نمایش کارت نمایش داده می‌شود.</p></div>';
        return;
    }

    var bridge = getBridge();
    var personPromise = type === 'member' ? bridge.get_member_by_code(code) : type === 'trainer' ? bridge.get_trainer_by_code(code) : bridge.get_staff_by_code(code);
    personPromise.then(function(person) {
        if (!person) throw new Error('شخص مورد نظر پیدا نشد');
        var personCode = person.member_code || person.trainer_code || person.staff_code || '';
        var qrPrefix = type === 'member' ? 'GGYM' : type === 'trainer' ? 'GGYM-TRN' : 'GGYM-STF';
        var qrData = qrPrefix + '|' + personCode + '|' + (person.full_name || '') + '|' + (person.status || '') + '|' + (person.expiry_date || '');
        return Promise.all([bridge.get_settings(), bridge.get_gym_logo(), bridge.get_gym_signature(), bridge.generate_qr(qrData), bridge.get_person_photo(personCode, type), Promise.resolve(person)]);
    }).then(function(results) {
        var settings = results[0] || {};
        var logo = results[1];
        var signature = results[2];
        var qr = results[3];
        var photo = results[4];
        var person = results[5];
        var personCode = person.member_code || person.trainer_code || person.staff_code || '';
        var typeLabels = { member: 'عضو باشگاه', trainer: 'مربی باشگاه', staff: 'کارمند باشگاه' };
        var detailLabel = type === 'member' ? 'نوع عضویت' : type === 'trainer' ? 'تخصص' : 'سمت';
        var detailValue = person.membership_type || person.specialization || person.position || '—';
        var expiry = person.expiry_date || 'ندارد';
        var statusActive = person.status === 'Active';
        var logoMarkup = logo ? '<img src="data:image/png;base64,' + logo + '" alt="لوگو">' : '<i class="fas fa-dumbbell"></i>';
        var signatureMarkup = signature ? '<img src="data:image/png;base64,' + signature + '" alt="امضای مدیر">' : '<span>امضای مدیر</span>';
        var qrMarkup = qr && qr.success && qr.image ? '<img src="data:image/png;base64,' + qr.image + '" alt="QR کارت">' : '<i class="fas fa-qrcode"></i>';
        preview.innerHTML = '<article class="gym-card professional-card" dir="rtl">' +
            '<div class="professional-card__accent"></div>' +
            '<header class="professional-card__header"><div class="professional-card__brand"><span class="professional-card__logo">' + logoMarkup + '</span><div><strong>' + escapeCardText(settings.gym_name || 'جیم گلدن') + '</strong><span>GOLDEN GYM · FITNESS CLUB</span></div></div><div class="professional-card__kind"><i class="fas fa-id-card"></i>' + escapeCardText(typeLabels[type]) + '</div></header>' +
            '<div class="professional-card__main"><div class="professional-card__person"><span class="professional-card__avatar professional-card__avatar--photo"><i class="fas fa-camera"></i></span><div><h2>' + escapeCardText(person.full_name || '—') + '</h2><p>فرزند ' + escapeCardText(person.father_name || '—') + '</p><code>' + escapeCardText(personCode) + '</code></div></div><div class="professional-card__qr">' + qrMarkup + '<span>اسکن برای اعتبارسنجی</span></div></div>' +
            '<div class="professional-card__details"><div><span>' + detailLabel + '</span><strong>' + escapeCardText(detailValue) + '</strong></div><div><span>تاریخ انقضا</span><strong>' + escapeCardText(expiry) + '</strong></div><div><span>وضعیت کارت</span><strong class="professional-card__status ' + (statusActive ? 'is-active' : 'is-inactive') + '"><i class="fas fa-circle"></i>' + (statusActive ? 'فعال' : 'غیرفعال') + '</strong></div></div>' +
            '<footer class="professional-card__footer"><div class="professional-card__signature">' + signatureMarkup + '<span>امضا و تأیید مدیریت</span></div><small>مالک این کارت، عضو ثبت‌شده باشگاه است</small></footer>' +
        '</article>';
        if (photo) {
            var portrait = preview.querySelector('.professional-card__avatar--photo');
            if (portrait) portrait.innerHTML = '<img src="data:image/png;base64,' + photo + '" alt="portrait">';
        }
    })['catch'](function(error) {
        if (preview) preview.innerHTML = '<div class="access-preview-empty"><i class="fas fa-circle-exclamation"></i><strong>نمایش کارت ممکن نیست</strong><p>' + escapeCardText(error.message || 'دوباره تلاش کنید.') + '</p></div>';
    });
}

function printCard() {
    var card = document.querySelector('.professional-card');
    if (!card) {
        showToast('خطا', 'ابتدا یک کارت را انتخاب و آماده کنید', 'error');
        return;
    }
    var printWindow = window.open('', '_blank', 'width=920,height=620');
    if (!printWindow) {
        showToast('خطا', 'پنجره چاپ باز نشد. اجازه باز شدن پنجره را بررسی کنید.', 'error');
        return;
    }
    var printCss = document.getElementById('cardPrintStyles');
    printWindow.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>کارت باشگاه</title><style>' + (printCss ? printCss.textContent : '') + '</style></head><body><main class="print-card-sheet">' + card.outerHTML + '</main></body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function() { printWindow.print(); }, 250);
}

function getCardSaveData() {
    var type = document.getElementById('cardPersonType').value;
    var code = document.getElementById('cardPersonSelect').value;
    if (!code) return Promise.reject(new Error('ابتدا یک شخص را انتخاب کنید'));
    var bridge = getBridge();
    var personPromise = type === 'member' ? bridge.get_member_by_code(code) : type === 'trainer' ? bridge.get_trainer_by_code(code) : bridge.get_staff_by_code(code);
    return Promise.all([personPromise, bridge.get_settings()]).then(function(results) {
        var person = results[0];
        var settings = results[1] || {};
        if (!person) throw new Error('شخص مورد نظر پیدا نشد');
        var personCode = person.member_code || person.trainer_code || person.staff_code || code;
        var qrPrefix = type === 'member' ? 'GGYM' : type === 'trainer' ? 'GGYM-TRN' : 'GGYM-STF';
        return {
            type: type === 'trainer' ? 'coach' : type,
            type_label: type === 'member' ? 'عضو' : type === 'trainer' ? 'مربی' : 'کارمند',
            code: personCode,
            full_name: person.full_name || '',
            father_name: person.father_name || '',
            blood_group: person.blood_group || '',
            membership_type: person.membership_type || person.specialization || person.position || '',
            join_date: person.join_date || person.hire_date || '',
            expiry_date: person.expiry_date || '',
            issue_date: new Date().toISOString().split('T')[0],
            photo_path: person.photo_path || '',
            qr_data: qrPrefix + '|' + personCode + '|' + (person.full_name || '') + '|' + (person.status || '') + '|' + (person.expiry_date || ''),
            gym_name: settings.gym_name || 'جیم گلدن',
            gym_address: settings.gym_address || '',
            gym_phone: settings.gym_phone || ''
        };
    });
}

function capturePreviewCard() {
    var card = document.querySelector('.professional-card');
    if (!card) return Promise.reject(new Error('ابتدا یک کارت را آماده کنید'));
    if (typeof html2canvas === 'undefined') return Promise.reject(new Error('ابزار تولید تصویر کارت بارگذاری نشده است'));
    return html2canvas(card, { scale: 5, backgroundColor: '#f8f7f2', useCORS: true, logging: false }).then(function(canvas) {
        return { base64: canvas.toDataURL('image/png').split(',')[1], width: canvas.width, height: canvas.height };
    });
}

function saveCardAsImage() {
    var code = document.getElementById('cardPersonSelect').value || 'card';
    var type = document.getElementById('cardPersonType').value || 'member';
    capturePreviewCard().then(function(image) {
        return getBridge().save_rendered_card(image.base64, code, type);
    }).then(function(result) {
        if (!result || !result.success) throw new Error((result && result.message) || 'ذخیره کارت انجام نشد');
        showToast('کارت ذخیره شد', 'PNG با کیفیت چاپ (' + result.width + '×' + result.height + ') ذخیره شد: ' + result.path);
    })['catch'](function(error) {
        showToast('خطا', 'ذخیره کارت انجام نشد: ' + error.message, 'error');
    });
}

function printCard() {
    var card = document.querySelector('.professional-card');
    var sourceStyles = document.getElementById('cardPrintStyles');
    if (!card || !sourceStyles) {
        showToast('خطا', 'ابتدا یک کارت را انتخاب و آماده کنید', 'error');
        return;
    }
    var oldSheet = document.getElementById('printCardSheet');
    var oldStyles = document.getElementById('activeCardPrintStyles');
    if (oldSheet) oldSheet.remove();
    if (oldStyles) oldStyles.remove();

    var css = sourceStyles.textContent.replace(/@page\s*\{[^}]*\}/, '');
    var style = document.createElement('style');
    style.id = 'activeCardPrintStyles';
    style.textContent = '@page { size: 85.6mm 54mm; margin: 0; } @media print {' + css + ' body > * { display: none !important; } #printCardSheet { display: block !important; } }';
    var sheet = document.createElement('main');
    sheet.id = 'printCardSheet';
    sheet.className = 'print-card-sheet';
    sheet.innerHTML = card.outerHTML;
    document.head.appendChild(style);
    document.body.appendChild(sheet);

    var cleanUp = function() {
        var activeSheet = document.getElementById('printCardSheet');
        var activeStyles = document.getElementById('activeCardPrintStyles');
        if (activeSheet) activeSheet.remove();
        if (activeStyles) activeStyles.remove();
        window.removeEventListener('afterprint', cleanUp);
    };
    window.addEventListener('afterprint', cleanUp);
    setTimeout(function() { window.print(); }, 80);
    setTimeout(cleanUp, 60000);
}

function printCard() {
    capturePreviewCard().then(function(image) {
        return getBridge().print_rendered_card(image.base64);
    }).then(function(result) {
        if (!result || !result.success) throw new Error((result && result.message) || 'چاپ کارت انجام نشد');
        showToast('چاپ کارت', 'کارت با اندازه CR80 به چاپگر ' + (result.printer || 'پیش‌فرض') + ' ارسال شد');
    })['catch'](function(error) {
        showToast('خطا', 'چاپ کارت انجام نشد: ' + error.message, 'error');
    });
}
