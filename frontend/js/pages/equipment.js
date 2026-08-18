/**
 * Equipment Page
 * تجهیزات
 */

function renderEquipment() {
    var search = document.getElementById('equipmentSearch') ? document.getElementById('equipmentSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_equipment(search).then(function(equipment) {
        var body = document.getElementById('equipmentBody');
        
        bridge.get_equipment_stats().then(function(stats) {
            document.getElementById('equipmentStats').textContent =
                'کل: ' + (stats.total || 0) + ' | فعال: ' + (stats.active || 0) +
                ' | خراب: ' + (stats.broken || 0) + ' | غیرفعال: ' + (stats.inactive || 0);
        });
        
        if (equipment.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-muted text-center">هیچ تجهیزاتی یافت نشد</td></tr>';
            return;
        }
        
        body.innerHTML = equipment.map(function(e) {
            var statusClass = e.status === 'Active' ? 'success' : e.status === 'Broken' ? 'danger' : 'secondary';
            var statusLabel = e.status === 'Active' ? 'فعال' : e.status === 'Broken' ? 'خراب' : 'غیرفعال';
            return '<tr>' +
                '<td>' + e.name + '</td>' +
                '<td>' + (e.category || '-') + '</td>' +
                '<td>' + (e.quantity || 1) + '</td>' +
                '<td><span class="badge bg-' + statusClass + '">' + statusLabel + '</span></td>' +
                '<td>' + (e.location || '-') + '</td>' +
                '<td><button class="btn btn-sm btn-gold me-1" onclick="editEquipment(' + e.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-gold" onclick="deleteEquipment(' + e.id + ')"><i class="fas fa-trash"></i></button></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function filterEquipment() { renderEquipment(); }

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
    var id = document.getElementById('equipmentEditId').value;
    var name = document.getElementById('eName').value.trim();
    
    if (!name) {
        showToast('خطا', 'نام تجهیزات الزامی است', 'error');
        return;
    }
    
    var data = {
        name: name,
        category: document.getElementById('eCategory').value,
        quantity: parseInt(document.getElementById('eQuantity').value) || 1,
        status: document.getElementById('eStatus').value,
        location: document.getElementById('eLocation').value,
        notes: document.getElementById('eNotes').value
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
            bootstrap.Modal.getInstance(document.getElementById('equipmentModal')).hide();
            renderEquipment();
            updateDashboard();
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