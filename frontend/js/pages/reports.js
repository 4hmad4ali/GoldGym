/**
 * Reports Page
 * گزارشات
 */

function generateReport() {
    var type = document.getElementById('reportType').value;
    var bridge = getBridge();
    
    bridge.get_report_data(type).then(function(data) {
        var headers = [];
        var rows = [];
        
        if (data.length > 0) {
            headers = Object.keys(data[0]);
            rows = data.map(function(item) {
                return headers.map(function(h) { return item[h] || '-'; });
            });
        }
        
        var thead = document.getElementById('reportHead');
        var tbody = document.getElementById('reportBody');
        
        if (headers.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td colspan="1" class="text-muted text-center">هیچ داده‌ای برای این گزارش وجود ندارد</td></tr>';
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
            return '<th>' + (headerLabels[h] || h) + '</th>';
        }).join('') + '</tr>';
        
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + headers.length + '" class="text-muted text-center">هیچ داده‌ای وجود ندارد</td></tr>';
        } else {
            tbody.innerHTML = rows.slice(0, 50).map(function(row) {
                return '<tr>' + row.map(function(cell) {
                    return '<td>' + cell + '</td>';
                }).join('') + '</tr>';
            }).join('');
            
            if (rows.length > 50) {
                tbody.innerHTML += '<tr><td colspan="' + headers.length + '" class="text-muted text-center">... و ' + (rows.length - 50) + ' رکورد دیگر</td></tr>';
            }
        }
        
        window._reportData = { headers: headers, rows: rows };
    })['catch'](function(e) {
        console.error('Error generating report:', e);
        document.getElementById('reportBody').innerHTML = '<tr><td colspan="1" class="text-danger text-center">خطا در تولید گزارش</td></tr>';
    });
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
        csv += row.map(function(cell) { return '"' + cell + '"'; }).join(',') + '\n';
    });
    
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'report_' + document.getElementById('reportType').value + '_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    showToast('موفق', 'گزارش با موفقیت ذخیره شد');
}