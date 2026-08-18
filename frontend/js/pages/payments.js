/**
 * Payments Page
 * مدیریت پرداخت‌ها
 */

function renderPayments() {
    var search = document.getElementById('paymentSearch') ? document.getElementById('paymentSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_payments(search).then(function(payments) {
        var body = document.getElementById('paymentsBody');
        var resultCount = document.getElementById('paymentsResultCount');
        if (!body) return;
        if (resultCount) resultCount.textContent = payments.length;
        
        bridge.get_payment_stats().then(function(stats) {
            setPaymentMetric('paymentStatDaily', stats.daily);
            setPaymentMetric('paymentStatMonthly', stats.monthly);
            setPaymentMetric('paymentStatYearly', stats.yearly);
            setPaymentMetric('paymentStatTotal', stats.total);
        });
        
        if (payments.length === 0) {
            body.innerHTML = '<tr><td colspan="6"><div class="payments-empty"><span><i class="fas fa-receipt"></i></span><strong>پرداختی پیدا نشد</strong><p>جستجو را تغییر دهید یا اولین تراکنش را ثبت کنید.</p><button class="btn-gold-small" type="button" onclick="openPaymentModal()"><i class="fas fa-plus me-1"></i>ثبت پرداخت</button></div></td></tr>';
            return;
        }
        
        body.innerHTML = payments.map(function(p) {
            var isDailyPayment = p.payment_type === 'daily';
            var memberName = escapePaymentText(p.visitor_name || (isDailyPayment ? 'عضو روزانه' : p.member_name || p.member_code || '-'));
            var receipt = escapePaymentText(p.receipt_number || '—');
            var method = escapePaymentText(p.payment_method || 'ثبت‌نشده');
            return '<tr>' +
                '<td><span class="payment-receipt"><i class="fas fa-receipt"></i>' + receipt + '</span></td>' +
                '<td><div class="payment-member"><span class="payment-member__avatar">' + paymentInitials(p.visitor_name || p.member_name || p.member_code || 'ع') + '</span><strong>' + memberName + (isDailyPayment ? '<small class="payment-daily-tag">روزانه</small>' : '') + '</strong></div></td>' +
                '<td><span class="payment-amount">' + Number(p.amount || 0).toLocaleString() + '<small>AFN</small></span></td>' +
                '<td><span class="payment-method"><i class="fas fa-credit-card"></i>' + method + '</span></td>' +
                '<td><span class="payment-date"><i class="far fa-calendar"></i>' + escapePaymentText(p.payment_date || '-') + '</span></td>' +
                '<td><div class="payment-row-actions"><button class="payment-row-action is-primary" type="button" title="ویرایش پرداخت" onclick="editPayment(' + p.id + ')"><i class="fas fa-pen"></i></button><button class="payment-row-action is-danger" type="button" title="حذف پرداخت" onclick="deletePayment(' + p.id + ')"><i class="fas fa-trash"></i></button></div></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function filterPayments() { renderPayments(); }

function clearPaymentFilter() {
    var search = document.getElementById('paymentSearch');
    if (search) search.value = '';
    renderPayments();
}

function setPaymentMetric(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = Number(value || 0).toLocaleString();
}

function escapePaymentText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function paymentInitials(name) {
    return escapePaymentText(String(name).trim().split(/\s+/).slice(0, 2).map(function(part) { return part.charAt(0); }).join('') || 'ع');
}

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
    var id = getPaymentFormControl('paymentEditId').value;
    var paymentType = getPaymentFormControl('pPaymentType').value;
    var memberId = getPaymentFormControl('pMember').value;
    var visitorName = getPaymentFormControl('pDailyVisitor').value.trim();
    var amount = parseFloat(getPaymentFormControl('pAmount').value);
    var method = getPaymentFormControl('pMethod').value;
    var date = getPaymentFormControl('pDate').value;
    var notes = getPaymentFormControl('pNotes').value;
    
    if ((!memberId && paymentType !== 'daily') || !amount) {
        showToast('خطا', 'عضو و مبلغ الزامی است', 'error');
        return;
    }
    
    var data = {
        member_id: paymentType === 'daily' ? null : parseInt(memberId),
        amount: amount,
        payment_method: method,
        payment_date: date,
        notes: notes,
        payment_type: paymentType,
        visitor_name: paymentType === 'daily' ? visitorName : ''
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
            navigate('payments').then(function() {
                renderPayments();
                updateDashboard();
            });
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

function togglePaymentPersonFields() {
    var type = getPaymentFormControl('pPaymentType');
    var memberField = getPaymentFormControl('pMemberField');
    var visitorField = getPaymentFormControl('pDailyVisitorField');
    var member = getPaymentFormControl('pMember');
    if (!type || !memberField || !visitorField || !member) return;
    var isDaily = type.value === 'daily';
    memberField.hidden = isDaily;
    visitorField.hidden = !isDaily;
    member.required = !isDaily;
    if (isDaily) member.value = '';
}

function openPaymentModal(data) {
    data = data || null;
    navigate('payment-form').then(function() {
        var form = document.getElementById('paymentPageForm');
        if (!form) return;
        form.reset();
        var select = getPaymentFormControl('pMember');
        getPaymentFormControl('paymentEditId').value = '';
        document.getElementById('paymentFormTitle').textContent = data ? 'ویرایش پرداخت' : 'ثبت پرداخت جدید';
        document.getElementById('paymentFormKicker').textContent = data ? 'PAYMENT DETAILS' : 'PAYMENT REGISTER';
        document.getElementById('paymentFormSubtitle').textContent = data ? 'جزئیات این پرداخت را بررسی و تغییرات را ذخیره کنید.' : 'دریافتی عضو را ثبت کنید تا در گزارش‌های مالی باشگاه نمایش داده شود.';
        getBridge().get_members('', 'All').then(function(members) {
            select.innerHTML = '<option value="">-- انتخاب عضو --</option>' + members.map(function(member) {
                return '<option value="' + member.id + '">' + escapePaymentText(member.full_name) + ' (' + escapePaymentText(member.member_code) + ')</option>';
            }).join('');
            if (data) {
                getPaymentFormControl('paymentEditId').value = data.id;
                getPaymentFormControl('pPaymentType').value = data.payment_type || 'member';
                select.value = data.member_id || '';
                getPaymentFormControl('pDailyVisitor').value = data.visitor_name || '';
                getPaymentFormControl('pAmount').value = data.amount || '';
                getPaymentFormControl('pMethod').value = data.payment_method || 'نقدی';
                getPaymentFormControl('pDate').value = data.payment_date || '';
                getPaymentFormControl('pNotes').value = data.notes || '';
            } else {
                getPaymentFormControl('pDate').value = new Date().toISOString().split('T')[0];
            }
            togglePaymentPersonFields();
        });
    });
}

function getPaymentFormControl(id) {
    return document.querySelector('#page-payment-form [id="' + id + '"]');
}

function deletePayment(id) {
    showDeleteConfirmation({
        title: 'حذف پرداخت',
        message: 'این پرداخت از سوابق مالی حذف می‌شود. این عمل قابل بازگشت نیست.',
        onConfirm: function() {
            getBridge().delete_payment(id).then(function(result) {
                if (result.success) {
                    renderPayments();
                    updateDashboard();
                    showToast('حذف شد', 'پرداخت با موفقیت حذف شد');
                } else {
                    showToast('خطا', result.message || 'خطا در حذف پرداخت', 'error');
                }
            })['catch'](function(error) {
                showToast('خطا', 'خطا در حذف پرداخت: ' + error.message, 'error');
            });
        }
    });
}
