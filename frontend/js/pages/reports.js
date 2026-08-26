/**
 * Reports Page
 * گزارشات
 */

function generateReport() {
    var reportSelect = document.getElementById('reportType');
    if (reportSelect && !reportSelect.querySelector('option[value="expenses"]')) reportSelect.insertAdjacentHTML('beforeend', '<option value="expenses">گزارش هزینه‌ها</option>');
    if (reportSelect && !reportSelect.querySelector('option[value="income"]')) reportSelect.insertAdjacentHTML('beforeend', '<option value="income">گزارش درآمد</option>');
    ensureReportPeriodFilters();
    var type = reportSelect.value;
    var bridge = getBridge();
    var thead = document.getElementById('reportHead');
    var tbody = document.getElementById('reportBody');
    var reportMeta = getReportMeta(type);
    updateReportContext(reportMeta, 0);
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '<tr><td><div class="reports-empty"><span><i class="fas fa-spinner fa-spin"></i></span><strong>در حال تولید گزارش</strong><p>داده‌های جدید در حال آماده‌سازی هستند.</p></div></td></tr>';
    
    bridge.get_report_data(type === 'income' ? 'payments' : type).then(function(data) {
        var year = document.getElementById('reportSolarYear').value;
        var month = document.getElementById('reportSolarMonth').value;
        if ((type === 'income' || type === 'expenses') && (year || month)) {
            var dateKey = type === 'income' ? 'payment_date' : 'expense_date';
            data = data.filter(function(item) { var date = afghanDate(item[dateKey] || ''); return (!year || date.slice(0, 4) === year) && (!month || date.slice(5, 7) === month); });
        }
        var headers = [];
        var rows = [];
        
        if (data.length > 0) {
            headers = Object.keys(data[0]);
            var dateColumns = ['date_of_birth', 'join_date', 'expiry_date', 'hire_date', 'payment_date', 'expense_date', 'check_in', 'check_out', 'created_at'];
            rows = data.map(function(item) {
                return headers.map(function(h) {
                    var value = item[h];
                    if (value === null || value === undefined || value === '') return '-';
                    return dateColumns.indexOf(h) !== -1 ? afghanDate(value) + String(value).slice(10) : value;
                });
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
            'payment_date': 'تاریخ پرداخت', 'expense_date': 'تاریخ هزینه', 'join_date': 'تاریخ عضویت',
            'hire_date': 'تاریخ استخدام', 'check_in': 'زمان ورود', 'check_out': 'زمان خروج', 'salary': 'حقوق', 'total_paid': 'مجموع پرداختی (AFN)',
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

function ensureReportPeriodFilters() {
    var controls = document.querySelector('.reports-control-panel__actions');
    if (!controls || document.getElementById('reportSolarYear')) return;
    var now = afghanDate(new Date().toISOString()).split('/');
    var years = []; for (var year = Number(now[0]); year >= Number(now[0]) - 5; year--) years.push('<option value="' + year + '">' + year + '</option>');
    var months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    controls.insertAdjacentHTML('afterbegin', '<div class="reports-select-wrap"><label class="form-label" for="reportSolarYear">سال شمسی</label><select class="form-control-gold" id="reportSolarYear" onchange="generateReport()">' + years.join('') + '</select></div><div class="reports-select-wrap"><label class="form-label" for="reportSolarMonth">ماه</label><select class="form-control-gold" id="reportSolarMonth" onchange="generateReport()"><option value="">همه ماه‌ها</option>' + months.map(function(name, index) { return '<option value="' + String(index + 1).padStart(2, '0') + '">' + name + '</option>'; }).join('') + '</select></div>');
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
    reports.expenses = { title: 'گزارش هزینه‌ها', description: 'فهرست هزینه‌های ثبت‌شده و دسته‌بندی‌های آن‌ها' };
    reports.income = { title: 'گزارش درآمد', description: 'پرداخت‌ها و درآمد باشگاه در بازه شمسی انتخاب‌شده' };
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
    
    var csv = [window._reportData.headers].concat(window._reportData.rows).map(function(row) { return row.map(function(value) { return '"' + String(value).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    getBridge().save_report_csv_data(csv, 'gym_report_solar_hijri.csv').then(function(result) {
        if (result && result.cancelled) return;
        if (!result || !result.success) throw new Error((result && result.message) || 'ذخیره فایل انجام نشد');
        showToast('موفق', 'فایل CSV ذخیره شد: ' + result.path);
    })['catch'](function(error) { showToast('خطا', 'خروجی CSV انجام نشد: ' + error.message, 'error'); });
}
