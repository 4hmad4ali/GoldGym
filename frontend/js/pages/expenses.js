function expenseControl(id) { return document.querySelector('#page-expenses [id="' + id + '"]'); }
function escapeExpenseText(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function setExpenseMetric(id, value) { var el = expenseControl(id); if (el) el.textContent = Number(value || 0).toLocaleString(); }

function loadExpenseCategories(selected) {
    return getBridge().get_expense_categories().then(function(categories) {
        var select = expenseControl('expenseCategory');
        var list = expenseControl('expenseCategoryList');
        if (select) select.innerHTML = '<option value="">بدون دسته‌بندی</option>' + categories.map(function(category) { return '<option value="' + category.id + '">' + escapeExpenseText(category.name) + '</option>'; }).join('');
        if (select && selected) select.value = selected;
        if (list) list.innerHTML = categories.map(function(category) { return '<span class="expense-category-chip">' + escapeExpenseText(category.name) + '<button type="button" title="حذف دسته‌بندی" onclick="deleteExpenseCategory(' + category.id + ')"><i class="fas fa-xmark"></i></button></span>'; }).join('') || '<span class="text-muted small">دسته‌بندی ثبت نشده است.</span>';
    });
}

function renderExpenses() {
    var dateField = expenseControl('expenseDate');
    if (dateField && !dateField.value) { var today = new Date().toISOString().split('T')[0]; dateField.value = afghanDate(today); var isoField = expenseControl('expenseDateIso'); if (isoField) isoField.value = today; }
    var search = expenseControl('expenseSearch');
    getBridge().get_expenses(search ? search.value : '').then(function(expenses) {
        var body = expenseControl('expensesBody'); var count = expenseControl('expenseResultCount');
        if (count) count.textContent = expenses.length;
        if (body) body.innerHTML = expenses.length ? expenses.map(function(expense) { return '<tr><td><strong>' + escapeExpenseText(expense.title) + '</strong><small class="expense-row-note">' + escapeExpenseText(expense.notes || '') + '</small></td><td><span class="expense-category-chip is-static">' + escapeExpenseText(expense.category_name || 'بدون دسته‌بندی') + '</span></td><td><span class="payment-amount">' + Number(expense.amount || 0).toLocaleString() + '<small>AFN</small></span></td><td>' + escapeExpenseText(expense.payment_method || '-') + '</td><td>' + escapeExpenseText(afghanDate(expense.expense_date || '') || '-') + '</td><td><div class="payment-row-actions"><button class="payment-row-action is-primary" type="button" onclick="openExpenseForm(' + expense.id + ')" title="ویرایش"><i class="fas fa-pen"></i></button><button class="payment-row-action is-danger" type="button" onclick="deleteExpense(' + expense.id + ')" title="حذف"><i class="fas fa-trash"></i></button></div></td></tr>'; }).join('') : '<tr><td colspan="6"><div class="payments-empty"><span><i class="fas fa-receipt"></i></span><strong>هزینه‌ای ثبت نشده است</strong><p>اولین هزینه باشگاه را ثبت کنید.</p></div></td></tr>';
    });
    getBridge().get_expense_stats().then(function(stats) { setExpenseMetric('expenseStatDaily', stats.daily); setExpenseMetric('expenseStatMonthly', stats.monthly); setExpenseMetric('expenseStatTotal', stats.total); });
    loadExpenseCategories();
}

function resetExpenseForm() { var form = expenseControl('expenseForm'); if (form) form.reset(); expenseControl('expenseEditId').value = ''; var today = new Date().toISOString().split('T')[0]; expenseControl('expenseDate').value = afghanDate(today); expenseControl('expenseDateIso').value = today; expenseControl('expenseFormTitle').textContent = 'ثبت هزینه جدید'; }
function openExpenseForm(id) { resetExpenseForm(); if (!id) return; getBridge().get_expenses('').then(function(expenses) { var expense = expenses.find(function(item) { return item.id === id; }); if (!expense) return; expenseControl('expenseEditId').value = expense.id; expenseControl('expenseTitle').value = expense.title || ''; expenseControl('expenseAmount').value = expense.amount || ''; expenseControl('expenseDate').value = afghanDate(expense.expense_date || ''); expenseControl('expenseDateIso').value = expense.expense_date || ''; expenseControl('expenseMethod').value = expense.payment_method || 'نقدی'; expenseControl('expenseNotes').value = expense.notes || ''; expenseControl('expenseFormTitle').textContent = 'ویرایش هزینه'; loadExpenseCategories(expense.category_id); }); }
function saveExpense() { var id = expenseControl('expenseEditId').value; var data = { title: expenseControl('expenseTitle').value.trim(), category_id: expenseControl('expenseCategory').value || null, amount: parseFloat(expenseControl('expenseAmount').value), expense_date: expenseControl('expenseDateIso').value, payment_method: expenseControl('expenseMethod').value, notes: expenseControl('expenseNotes').value }; if (!data.title || !data.amount) { showToast('خطا', 'عنوان و مبلغ هزینه الزامی است', 'error'); return; } var call = id ? getBridge().update_expense(parseInt(id), data) : getBridge().add_expense(data); call.then(function(result) { if (!result.success) throw new Error(result.message || 'ذخیره انجام نشد'); resetExpenseForm(); renderExpenses(); updateDashboard(); showToast('موفق', id ? 'هزینه ویرایش شد' : 'هزینه ثبت شد'); })['catch'](function(error) { showToast('خطا', error.message, 'error'); }); }
function addExpenseCategory() { var input = expenseControl('expenseCategoryName'); var name = input.value.trim(); if (!name) return; getBridge().add_expense_category(name).then(function(result) { if (!result.success) throw new Error(result.message || 'افزودن انجام نشد'); input.value = ''; loadExpenseCategories(); showToast('موفق', 'دسته‌بندی اضافه شد'); })['catch'](function(error) { showToast('خطا', error.message, 'error'); }); }
function deleteExpenseCategory(id) { showDeleteConfirmation({ title: 'حذف دسته‌بندی', message: 'هزینه‌های قبلی حذف نمی‌شوند و فقط دسته‌بندی آن‌ها خالی می‌شود.', onConfirm: function() { getBridge().delete_expense_category(id).then(function() { renderExpenses(); }); } }); }
function deleteExpense(id) { showDeleteConfirmation({ title: 'حذف هزینه', message: 'این هزینه از سوابق مالی حذف می‌شود.', onConfirm: function() { getBridge().delete_expense(id).then(function(result) { if (result.success) { renderExpenses(); updateDashboard(); showToast('حذف شد', 'هزینه با موفقیت حذف شد'); } }); } }); }
