/**
 * Payments Page
 * مدیریت پرداخت‌ها
 */

var PAYMENTS_PER_PAGE = 20;
var paymentsCurrentPage = 1;

function renderPayments() {
    var search = document.getElementById('paymentSearch') ? document.getElementById('paymentSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_payments_page(search, '', '', paymentsCurrentPage, PAYMENTS_PER_PAGE).then(function(result) {
        var payments = result.payments || [];
        var totalPayments = Number(result.total) || 0;
        var body = document.getElementById('paymentsBody');
        var resultCount = document.getElementById('paymentsResultCount');
        if (!body) return;
        if (resultCount) resultCount.textContent = totalPayments;
        var totalPages = Math.max(1, Math.ceil(totalPayments / PAYMENTS_PER_PAGE));
        if (paymentsCurrentPage > totalPages) {
            paymentsCurrentPage = totalPages;
            renderPayments();
            return;
        }
        
        bridge.get_payment_stats().then(function(stats) {
            setPaymentMetric('paymentStatDaily', stats.daily);
            setPaymentMetric('paymentStatMonthly', stats.monthly);
            setPaymentMetric('paymentStatYearly', stats.yearly);
            setPaymentMetric('paymentStatTotal', stats.total);
        });
        
        if (totalPayments === 0) {
            body.innerHTML = '<tr><td colspan="6"><div class="payments-empty"><span><i class="fas fa-receipt"></i></span><strong>پرداختی پیدا نشد</strong><p>جستجو را تغییر دهید یا اولین تراکنش را ثبت کنید.</p><button class="btn-gold-small" type="button" onclick="openPaymentModal()"><i class="fas fa-plus me-1"></i>ثبت پرداخت</button></div></td></tr>';
            renderPaymentsPagination(0, 0);
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
                '<td><span class="payment-date"><i class="far fa-calendar"></i>' + escapePaymentText(afghanDate(p.payment_date || '') || '-') + '</span></td>' +
                '<td><div class="payment-row-actions"><button class="payment-row-action is-primary" type="button" title="ویرایش پرداخت" onclick="editPayment(' + p.id + ')"><i class="fas fa-pen"></i></button><button class="payment-row-action is-danger" type="button" title="حذف پرداخت" onclick="deletePayment(' + p.id + ')"><i class="fas fa-trash"></i></button></div></td>' +
            '</tr>';
        }).join('');
        renderPaymentsPagination(totalPayments, totalPages);
    })['catch'](function(e) { console.error(e); });
}

function filterPayments() {
    paymentsCurrentPage = 1;
    renderPayments();
}

function changePaymentsPage(page) {
    paymentsCurrentPage = page;
    renderPayments();
}

function renderPaymentsPagination(totalPayments, totalPages) {
    var pagination = document.getElementById('paymentsPagination');
    if (!pagination) return;
    if (totalPayments <= PAYMENTS_PER_PAGE) {
        pagination.innerHTML = '';
        pagination.hidden = true;
        return;
    }
    pagination.hidden = false;
    var buttons = '<button class="payments-pagination__button" type="button" onclick="changePaymentsPage(' + (paymentsCurrentPage - 1) + ')" ' + (paymentsCurrentPage === 1 ? 'disabled' : '') + ' aria-label="صفحه قبل"><i class="fas fa-chevron-left"></i></button>';
    for (var page = 1; page <= totalPages; page++) {
        buttons += '<button class="payments-pagination__button' + (page === paymentsCurrentPage ? ' is-active' : '') + '" type="button" onclick="changePaymentsPage(' + page + ')" aria-label="صفحه ' + page + '" ' + (page === paymentsCurrentPage ? 'aria-current="page"' : '') + '>' + page + '</button>';
    }
    buttons += '<button class="payments-pagination__button" type="button" onclick="changePaymentsPage(' + (paymentsCurrentPage + 1) + ')" ' + (paymentsCurrentPage === totalPages ? 'disabled' : '') + ' aria-label="صفحه بعد"><i class="fas fa-chevron-right"></i></button>';
    pagination.innerHTML = buttons + '<span class="payments-pagination__summary">نمایش ' + ((paymentsCurrentPage - 1) * PAYMENTS_PER_PAGE + 1) + ' تا ' + Math.min(paymentsCurrentPage * PAYMENTS_PER_PAGE, totalPayments) + ' از ' + totalPayments + ' تراکنش</span>';
}

function clearPaymentFilter() {
    var search = document.getElementById('paymentSearch');
    if (search) search.value = '';
    paymentsCurrentPage = 1;
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
    bridge.get_payment(id).then(function(payment) {
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
    var date = getPaymentFormControl('pDateIso').value;
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
    if (isDaily) selectPaymentMember('');
}

function openPaymentModal(data) {
    data = data || null;
    navigate('payment-form').then(function() {
        var form = document.getElementById('paymentPageForm');
        if (!form) return;
        form.reset();
        getPaymentFormControl('paymentEditId').value = '';
        document.getElementById('paymentFormTitle').textContent = data ? 'ویرایش پرداخت' : 'ثبت پرداخت جدید';
        document.getElementById('paymentFormKicker').textContent = data ? 'PAYMENT DETAILS' : 'PAYMENT REGISTER';
        document.getElementById('paymentFormSubtitle').textContent = data ? 'جزئیات این پرداخت را بررسی و تغییرات را ذخیره کنید.' : 'دریافتی عضو را ثبت کنید تا در گزارش‌های مالی باشگاه نمایش داده شود.';
        getBridge().get_members('', 'All').then(function(members) {
            window.paymentFormMembers = members || [];
            if (data) {
                getPaymentFormControl('paymentEditId').value = data.id;
                getPaymentFormControl('pPaymentType').value = data.payment_type || 'member';
                selectPaymentMember(data.member_id || '');
                getPaymentFormControl('pDailyVisitor').value = data.visitor_name || '';
                getPaymentFormControl('pAmount').value = data.amount || '';
                getPaymentFormControl('pMethod').value = data.payment_method || 'نقدی';
                getPaymentFormControl('pDate').value = afghanDate(data.payment_date || '');
                getPaymentFormControl('pDateIso').value = data.payment_date || '';
                getPaymentFormControl('pNotes').value = data.notes || '';
            } else {
                var paymentDate = new Date().toISOString().split('T')[0];
                getPaymentFormControl('pDate').value = afghanDate(paymentDate);
                getPaymentFormControl('pDateIso').value = paymentDate;
            }
            togglePaymentPersonFields();
        });
    });
}

function filterPaymentMembers(clearSelection) {
    var search = getPaymentFormControl('pMemberSearch');
    var results = getPaymentFormControl('pMemberResults');
    if (!search || !results) return;
    if (clearSelection) {
        var selected = getPaymentFormControl('pMember');
        var selectedLabel = getPaymentFormControl('pMemberSelected');
        if (selected) selected.value = '';
        if (selectedLabel) {
            selectedLabel.textContent = '';
            selectedLabel.hidden = true;
        }
    }
    var query = search.value.trim().toLocaleLowerCase();
    var members = window.paymentFormMembers || [];
    var matches = members.filter(function(member) {
        if (!query) return true;
        return [member.full_name, member.member_code, member.id].some(function(value) {
            return String(value || '').toLocaleLowerCase().indexOf(query) !== -1;
        });
    }).slice(0, 20);
    if (!matches.length) {
        results.innerHTML = '<div class="payment-member-picker__empty">عضوی با این نام یا شماره عضویت پیدا نشد.</div>';
    } else {
        results.innerHTML = matches.map(function(member) {
            return '<button class="payment-member-picker__option" type="button" role="option" onclick="selectPaymentMember(' + Number(member.id) + ')"><strong>' + escapePaymentText(member.full_name || '-') + '</strong><small>' + escapePaymentText(member.member_code || ('ID ' + member.id)) + '</small></button>';
        }).join('');
    }
    results.hidden = false;
}

function selectPaymentMember(memberId) {
    var selected = getPaymentFormControl('pMember');
    var search = getPaymentFormControl('pMemberSearch');
    var selectedLabel = getPaymentFormControl('pMemberSelected');
    var results = getPaymentFormControl('pMemberResults');
    var member = (window.paymentFormMembers || []).find(function(item) { return String(item.id) === String(memberId); });
    if (!selected || !search || !selectedLabel) return;
    selected.value = member ? member.id : '';
    if (member) {
        search.value = member.full_name || '';
        selectedLabel.innerHTML = '<i class="fas fa-circle-check"></i>' + escapePaymentText(member.full_name || '-') + ' — ' + escapePaymentText(member.member_code || ('ID ' + member.id));
        selectedLabel.hidden = false;
    } else {
        search.value = '';
        selectedLabel.textContent = '';
        selectedLabel.hidden = true;
    }
    if (results) results.hidden = true;
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
