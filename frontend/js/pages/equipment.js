/**
 * Equipment Page
 * تجهیزات
 */

function renderEquipment() {
    var search = document.getElementById('equipmentSearch') ? document.getElementById('equipmentSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_equipment(search).then(function(equipment) {
        var body = document.getElementById('equipmentBody');
        var resultCount = document.getElementById('equipmentResultCount');
        if (!body) return;
        if (resultCount) resultCount.textContent = equipment.length;
        
        bridge.get_equipment_stats().then(function(stats) {
            setEquipmentMetric('equipmentStatTotal', stats.total);
            setEquipmentMetric('equipmentStatActive', stats.active);
            setEquipmentMetric('equipmentStatBroken', stats.broken);
            setEquipmentMetric('equipmentStatInactive', stats.inactive);
        });
        
        if (equipment.length === 0) {
            body.innerHTML = '<tr><td colspan="6"><div class="equipment-empty"><span><i class="fas fa-dumbbell"></i></span><strong>تجهیزاتی پیدا نشد</strong><p>جستجو را تغییر دهید یا یک مورد جدید به فهرست اضافه کنید.</p><button class="btn-gold-small" type="button" onclick="openEquipmentModal()"><i class="fas fa-plus me-1"></i>افزودن تجهیزات</button></div></td></tr>';
            return;
        }
        
        body.innerHTML = equipment.map(function(e) {
            var statusClass = e.status === 'Active' ? 'active' : e.status === 'Broken' ? 'broken' : 'inactive';
            var statusLabel = e.status === 'Active' ? 'فعال' : e.status === 'Broken' ? 'خراب' : 'غیرفعال';
            var equipmentName = escapeEquipmentText(e.name || '-');
            var category = escapeEquipmentText(e.category || 'سایر');
            var location = escapeEquipmentText(e.location || 'محل ثبت‌نشده');
            return '<tr>' +
                '<td><div class="equipment-identity"><span class="equipment-avatar"><i class="fas fa-dumbbell"></i></span><strong>' + equipmentName + '</strong></div></td>' +
                '<td><span class="equipment-category">' + category + '</span></td>' +
                '<td><span class="equipment-quantity"><i class="fas fa-cubes-stacked"></i>' + (parseInt(e.quantity, 10) || 1) + ' عدد</span></td>' +
                '<td><span class="equipment-location"><i class="fas fa-location-dot"></i>' + location + '</span></td>' +
                '<td><span class="equipment-status equipment-status--' + statusClass + '"><i class="fas fa-circle"></i>' + statusLabel + '</span></td>' +
                '<td><div class="equipment-row-actions"><button class="equipment-row-action is-primary" type="button" title="ویرایش تجهیزات" onclick="editEquipment(' + e.id + ')"><i class="fas fa-pen"></i></button><button class="equipment-row-action is-danger" type="button" title="حذف تجهیزات" onclick="deleteEquipment(' + e.id + ')"><i class="fas fa-trash"></i></button></div></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function filterEquipment() { renderEquipment(); }

function clearEquipmentFilter() {
    var search = document.getElementById('equipmentSearch');
    if (search) search.value = '';
    renderEquipment();
}

function setEquipmentMetric(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value || 0;
}

function escapeEquipmentText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function openEquipmentModal(data) {
    data = data || null;
    var modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
    document.getElementById('equipmentForm').reset();
    document.getElementById('equipmentEditId').value = '';
    
    if (data) {
        document.getElementById('equipmentEditId').value = data.id;
        document.getElementById('eName').value = data.name || '';
        document.getElementById('eCategory').value = data.category || 'سایر';
        document.getElementById('eQuantity').value = data.quantity || 1;
        document.getElementById('eStatus').value = data.status || 'Active';
        document.getElementById('eLocation').value = data.location || '';
        document.getElementById('eNotes').value = data.notes || '';
    }
    modal.show();
}

function editEquipment(id) {
    var bridge = getBridge();
    bridge.get_equipment_by_id(id).then(function(equip) {
        if (equip) openEquipmentModal(equip);
    });
}

function saveEquipment() {
    var id = getEquipmentFormControl('equipmentEditId').value;
    var name = getEquipmentFormControl('eName').value.trim();
    
    if (!name) {
        showToast('خطا', 'نام تجهیزات الزامی است', 'error');
        return;
    }
    
    var data = {
        name: name,
        category: getEquipmentFormControl('eCategory').value,
        quantity: parseInt(getEquipmentFormControl('eQuantity').value) || 1,
        status: getEquipmentFormControl('eStatus').value,
        location: getEquipmentFormControl('eLocation').value,
        notes: getEquipmentFormControl('eNotes').value
    };
    
    var bridge = getBridge();
    var promise;
    if (id) {
        promise = bridge.update_equipment(parseInt(id), data);
    } else {
        promise = bridge.add_equipment(data);
    }
    
    promise.then(function(result) {
        if (result.success) {
            navigate('equipment').then(function() {
                renderEquipment();
                updateDashboard();
            });
            showToast('موفق', id ? 'تجهیزات ویرایش شد' : 'تجهیزات جدید اضافه شد');
        } else {
            showToast('خطا', result.message || 'خطا در ذخیره', 'error');
        }
    })['catch'](function(e) {
        showToast('خطا', 'خطا در ذخیره: ' + e.message, 'error');
    });
}

function deleteEquipment(id) {
    if (confirm('آیا از حذف این تجهیزات اطمینان دارید؟')) {
        var bridge = getBridge();
        bridge.delete_equipment(id).then(function(result) {
            if (result.success) {
                renderEquipment();
                updateDashboard();
                showToast('حذف', 'تجهیزات با موفقیت حذف شد');
            } else {
                showToast('خطا', result.message || 'خطا در حذف', 'error');
            }
        });
    }
}

function openEquipmentModal(data) {
    data = data || null;
    navigate('equipment-form').then(function() {
        var form = document.getElementById('equipmentPageForm');
        if (!form) return;
        form.reset();
        getEquipmentFormControl('equipmentEditId').value = '';
        document.getElementById('equipmentFormTitle').textContent = data ? 'ویرایش تجهیزات' : 'افزودن تجهیزات جدید';
        document.getElementById('equipmentFormKicker').textContent = data ? 'EQUIPMENT DETAILS' : 'EQUIPMENT INVENTORY';
        document.getElementById('equipmentFormSubtitle').textContent = data ? 'جزئیات این مورد را بررسی و تغییرات مورد نیاز را ذخیره کنید.' : 'مشخصات و وضعیت عملیاتی تجهیزات باشگاه را ثبت کنید.';
        if (data) {
            getEquipmentFormControl('equipmentEditId').value = data.id;
            getEquipmentFormControl('eName').value = data.name || '';
            getEquipmentFormControl('eCategory').value = data.category || 'سایر';
            getEquipmentFormControl('eQuantity').value = data.quantity || 1;
            getEquipmentFormControl('eStatus').value = data.status || 'Active';
            getEquipmentFormControl('eLocation').value = data.location || '';
            getEquipmentFormControl('eNotes').value = data.notes || '';
        } else {
            getEquipmentFormControl('eQuantity').value = 1;
            getEquipmentFormControl('eStatus').value = 'Active';
        }
    });
}

function getEquipmentFormControl(id) {
    return document.querySelector('#page-equipment-form [id="' + id + '"]');
}

function deleteEquipment(id) {
    showDeleteConfirmation({
        title: 'حذف تجهیزات',
        message: 'این مورد از فهرست تجهیزات حذف می‌شود. این عمل قابل بازگشت نیست.',
        onConfirm: function() {
            getBridge().delete_equipment(id).then(function(result) {
                if (result.success) {
                    renderEquipment();
                    updateDashboard();
                    showToast('حذف شد', 'تجهیزات با موفقیت حذف شد');
                } else {
                    showToast('خطا', result.message || 'خطا در حذف تجهیزات', 'error');
                }
            })['catch'](function(error) {
                showToast('خطا', 'خطا در حذف تجهیزات: ' + error.message, 'error');
            });
        }
    });
}
