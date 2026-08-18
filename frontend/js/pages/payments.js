/**
 * Payments Page
 * مدیریت پرداخت‌ها
 */

function renderPayments() {
    var search = document.getElementById('paymentSearch') ? document.getElementById('paymentSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_payments(search).then(function(payments) {
        var body = document.getElementById('paymentsBody');
        
        bridge.get_payment_stats().then(function(stats) {
            document.getElementById('paymentStats').textContent =
                'امروز: ' + (stats.daily || 0).toLocaleString() + ' | این ماه: ' + (stats.monthly || 0).toLocaleString() +
                ' | امسال: ' + (stats.yearly || 0).toLocaleString() + ' | کل: ' + (stats.total || 0).toLocaleString() + ' AFN';
        });
        
        if (payments.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-muted text-center">هیچ پرداختی یافت نشد</td></tr>';
            return;
        }
        
        body.innerHTML = payments.map(function(p) {
            return '<tr>' +
                '<td><span class="text-gold">' + (p.receipt_number || '') + '</span></td>' +
                '<td>' + (p.member_name || p.member_code || '-') + '</td>' +
                '<td>' + (p.amount || 0).toLocaleString() + '</td>' +
                '<td>' + (p.payment_method || '-') + '</td>' +
                '<td>' + (p.payment_date || '-') + '</td>' +
                '<td><button class="btn btn-sm btn-gold me-1" onclick="editPayment(' + p.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-gold" onclick="deletePayment(' + p.id + ')"><i class="fas fa-trash"></i></button></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function filterPayments() { renderPayments(); }

function openPaymentModal(data) {
    data = data || null;
    var modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    var form = document.getElementById('paymentForm');
    form.reset();
    document.getElementById('paymentEditId').value = '';
    
    var bridge = getBridge();
    bridge.get_members('', 'Active').then(function(members) {
        var select = document.getElementById('pMember');
        select.innerHTML = members.map(function(m) {
            return '<option value="' + m.id + '">' + m.full_name + ' (' + m.member_code + ')</option>';
        }).join('');
        
        if (data) {
            document.getElementById('paymentEditId').value = data.id;
            select.value = data.member_id || '';
            document.getElementById('pAmount').value = data.amount || '';
            document.getElementById('pMethod').value = data.payment_method || 'نقدی';
            document.getElementById('pDate').value = data.payment_date || '';
            document.getElementById('pNotes').value = data.notes || '';
        } else {
            document.getElementById('pDate').value = new Date().toISOString().split('T')[0];
        }
        modal.show();
    });
}

function editPayment(id) {
    var bridge = getBridge();
    bridge.get_payments().then(function(payments) {
        var payment = payments.find(function(p) { return p.id === id; });
        if (payment) openPaymentModal(payment);
    });
}

function savePayment() {
    var id = document.getElementById('paymentEditId').value;
    var memberId = document.getElementById('pMember').value;
    var amount = parseFloat(document.getElementById('pAmount').value);
    var method = document.getElementById('pMethod').value;
    var date = document.getElementById('pDate').value;
    var notes = document.getElementById('pNotes').value;
    
    if (!memberId || !amount) {
        showToast('خطا', 'عضو و مبلغ الزامی است', 'error');
        return;
    }
    
    var data = {
        member_id: parseInt(memberId),
        amount: amount,
        payment_method: method,
        payment_date: date,
        notes: notes,
        payment_type: 'member'
    };
    
    var bridge = getBridge();
    var promise;
    if (id) {
        promise = bridge.update_payment(parseInt(id), data);
    } else {
        promise = bridge.add_payment(data);
    }
    
    promise.then(function(result) {
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
            renderPayments();
            updateDashboard();
            showToast('موفق', id ? 'پرداخت ویرایش شد' : 'پرداخت جدید ثبت شد');
        } else {
            showToast('خطا', result.message || 'خطا در ذخیره', 'error');
        }
    })['catch'](function(e) {
        showToast('خطا', 'خطا در ذخیره: ' + e.message, 'error');
    });
}

function deletePayment(id) {
    if (confirm('آیا از حذف این پرداخت اطمینان دارید؟')) {
        var bridge = getBridge();
        bridge.delete_payment(id).then(function(result) {
            if (result.success) {
                renderPayments();
                updateDashboard();
                showToast('حذف', 'پرداخت با موفقیت حذف شد');
            } else {
                showToast('خطا', result.message || 'خطا در حذف', 'error');
            }
        });
    }
}