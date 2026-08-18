/**
 * Reports Page
 * گزارشات
 */

function generateReport() {
    var type = document.getElementById('reportType').value;
    var bridge = getBridge();
    var thead = document.getElementById('reportHead');
    var tbody = document.getElementById('reportBody');
    var reportMeta = getReportMeta(type);
    updateReportContext(reportMeta, 0);
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '<tr><td><div class="reports-empty"><span><i class="fas fa-spinner fa-spin"></i></span><strong>در حال تولید گزارش</strong><p>داده‌های جدید در حال آماده‌سازی هستند.</p></div></td></tr>';
    
    bridge.get_report_data(type).then(function(data) {
        var headers = [];
        var rows = [];
        
        if (data.length > 0) {
            headers = Object.keys(data[0]);
            rows = data.map(function(item) {
                return headers.map(function(h) { return item[h] === null || item[h] === undefined || item[h] === '' ? '-' : item[h]; });
            });
        }
        
        updateReportContext(reportMeta, rows.length);
        
        if (headers.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td><div class="reports-empty"><span><i class="fas fa-folder-open"></i></span><strong>داده‌ای برای این گزارش وجود ندارد</strong><p>نوع گزارش را تغییر دهید یا اطلاعات مورد نیاز را در سیستم ثبت کنید.</p></div></td></tr>';
            window._reportData = { headers: [], rows: [] };
            return;
        }
        
        var headerLabels = {
            'member_code': 'کد عضو', 'full_name': 'نام', 'father_name': 'نام پدر',
            'phone': 'شماره', 'email': 'ایمیل', 'gender': 'جنسیت',
            'blood_group': 'گروه خون', 'membership_type': 'نوع عضویت',
            'status': 'وضعیت', 'expiry_date': 'تاریخ انقضا',
            'trainer_code': 'کد مربی', 'specialization': 'تخصص',
            'staff_code': 'کد کارمند', 'position': 'سمت',
            'amount': 'مبلغ', 'payment_method': 'روش پرداخت',
            'payment_date': 'تاریخ پرداخت', 'join_date': 'تاریخ عضویت',
            'hire_date': 'تاریخ استخدام', 'salary': 'حقوق',
            'category': 'دسته', 'quantity': 'تعداد', 'location': 'محل'
        };
        
        thead.innerHTML = '<tr>' + headers.map(function(h) {
            return '<th>' + escapeReportText(headerLabels[h] || h) + '</th>';
        }).join('') + '</tr>';
        
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + headers.length + '"><div class="reports-empty"><span><i class="fas fa-folder-open"></i></span><strong>داده‌ای وجود ندارد</strong><p>برای این گزارش هنوز رکوردی ثبت نشده است.</p></div></td></tr>';
        } else {
            tbody.innerHTML = rows.slice(0, 50).map(function(row) {
                return '<tr>' + row.map(function(cell) {
                    return '<td>' + escapeReportText(cell) + '</td>';
                }).join('') + '</tr>';
            }).join('');
            
            if (rows.length > 50) {
                tbody.innerHTML += '<tr><td colspan="' + headers.length + '" class="text-muted text-center">... و ' + (rows.length - 50) + ' رکورد دیگر</td></tr>';
            }
        }
        
        window._reportData = { headers: headers, rows: rows };
    })['catch'](function(e) {
        console.error('Error generating report:', e);
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '<tr><td><div class="reports-empty is-error"><span><i class="fas fa-triangle-exclamation"></i></span><strong>خطا در تولید گزارش</strong><p>لطفاً اتصال برنامه و داده‌های ثبت‌شده را بررسی کنید.</p></div></td></tr>';
    });
}

function getReportMeta(type) {
    var reports = {
        members: { title: 'گزارش اعضا', description: 'نمای کلی از اطلاعات ثبت‌شده اعضای باشگاه' },
        trainers: { title: 'گزارش مربیان', description: 'فهرست مربیان، تخصص‌ها و وضعیت همکاری' },
        staff: { title: 'گزارش کارکنان', description: 'فهرست کارکنان و اطلاعات پرسنلی ثبت‌شده' },
        payments: { title: 'گزارش پرداخت‌ها', description: 'تراکنش‌های مالی و روش‌های پرداخت ثبت‌شده' },
        attendance: { title: 'گزارش حضور و غیاب', description: 'سوابق ورود و خروج اعضا و تیم باشگاه' },
        equipment: { title: 'گزارش تجهیزات', description: 'موجودی، محل و وضعیت عملیاتی تجهیزات' },
        expiring: { title: 'گزارش عضویت‌های در آستانه انقضا', description: 'اعضایی که نیاز به پیگیری و تمدید دارند' }
    };
    return reports[type] || reports.members;
}

function updateReportContext(meta, count) {
    var title = document.getElementById('reportTitle');
    var description = document.getElementById('reportDescription');
    var countElement = document.getElementById('reportResultCount');
    if (title) title.textContent = meta.title;
    if (description) description.textContent = meta.description;
    if (countElement) countElement.textContent = count || 0;
}

function escapeReportText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function exportReportCSV() {
    if (!window._reportData || window._reportData.rows.length === 0) {
        showToast('خطا', 'هیچ داده‌ای برای خروجی وجود ندارد', 'error');
        return;
    }
    
    var headers = window._reportData.headers;
    var rows = window._reportData.rows;
    var csv = headers.join(',') + '\n';
    rows.forEach(function(row) {
        csv += row.map(function(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',') + '\n';
    });
    
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'report_' + document.getElementById('reportType').value + '_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    showToast('موفق', 'گزارش با موفقیت ذخیره شد');
}
