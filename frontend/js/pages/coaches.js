/**
 * Coaches & Staff Page
 * مربیان و کارمندان
 */

function filterTrainers() { renderTrainers(); }
function filterStaff() { renderStaff(); }

function renderTrainers() {
    var search = document.getElementById('trainerSearch') ? document.getElementById('trainerSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_trainers(search).then(function(trainers) {
        var body = document.getElementById('trainersBody');
        
        bridge.get_trainer_stats().then(function(stats) {
            document.getElementById('trainerStats').textContent = 'کل: ' + (stats.total || 0) + ' | فعال: ' + (stats.active || 0);
        });
        
        if (trainers.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-muted text-center">هیچ مربی یافت نشد</td></tr>';
            return;
        }
        
        body.innerHTML = trainers.map(function(t) {
            var statusClass = t.status === 'Active' ? 'success' : 'secondary';
            var statusLabel = t.status === 'Active' ? 'فعال' : 'غیرفعال';
            return '<tr>' +
                '<td><span class="text-gold">' + t.trainer_code + '</span></td>' +
                '<td>' + t.full_name + '</td>' +
                '<td>' + (t.specialization || '-') + '</td>' +
                '<td>' + (t.phone || '-') + '</td>' +
                '<td><span class="badge bg-' + statusClass + '">' + statusLabel + '</span></td>' +
                '<td><button class="btn btn-sm btn-gold me-1" onclick="editTrainer(' + t.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-gold" onclick="deleteTrainer(' + t.id + ')"><i class="fas fa-trash"></i></button></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function renderStaff() {
    var search = document.getElementById('staffSearch') ? document.getElementById('staffSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_staff(search).then(function(staff) {
        var body = document.getElementById('staffBody');
        
        bridge.get_staff_stats().then(function(stats) {
            document.getElementById('staffStats').textContent = 'کل: ' + (stats.total || 0) + ' | فعال: ' + (stats.active || 0);
        });
        
        if (staff.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-muted text-center">هیچ کارمندی یافت نشد</td></tr>';
            return;
        }
        
        body.innerHTML = staff.map(function(s) {
            var statusClass = s.status === 'Active' ? 'success' : 'secondary';
            var statusLabel = s.status === 'Active' ? 'فعال' : 'غیرفعال';
            return '<tr>' +
                '<td><span class="text-gold">' + s.staff_code + '</span></td>' +
                '<td>' + s.full_name + '</td>' +
                '<td>' + (s.position || '-') + '</td>' +
                '<td>' + (s.phone || '-') + '</td>' +
                '<td><span class="badge bg-' + statusClass + '">' + statusLabel + '</span></td>' +
                '<td><button class="btn btn-sm btn-gold me-1" onclick="editStaff(' + s.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-gold" onclick="deleteStaff(' + s.id + ')"><i class="fas fa-trash"></i></button></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function openTrainerModal(data) {
    data = data || null;
    var modal = new bootstrap.Modal(document.getElementById('trainerModal'));
    document.getElementById('trainerForm').reset();
    document.getElementById('trainerEditId').value = '';
    
    if (data) {
        document.getElementById('trainerEditId').value = data.id;
        document.getElementById('tName').value = data.full_name || '';
        document.getElementById('tFather').value = data.father_name || '';
        document.getElementById('tPhone').value = data.phone || '';
        document.getElementById('tSpecialization').value = data.specialization || '';
        document.getElementById('tStatus').value = data.status || 'Active';
        document.getElementById('tSalary').value = data.salary || '';
        document.getElementById('tHireDate').value = data.hire_date || '';
        document.getElementById('tNotes').value = data.notes || '';
    } else {
        document.getElementById('tHireDate').value = new Date().toISOString().split('T')[0];
    }
    modal.show();
}

function editTrainer(id) {
    var bridge = getBridge();
    bridge.get_trainer(id).then(function(trainer) {
        if (trainer) openTrainerModal(trainer);
    });
}

function saveTrainer() {
    var id = document.getElementById('trainerEditId').value;
    var name = document.getElementById('tName').value.trim();
    var father = document.getElementById('tFather').value.trim();
    
    if (!name || !father) {
        showToast('خطا', 'نام و نام پدر الزامی است', 'error');
        return;
    }
    
    var data = {
        full_name: name,
        father_name: father,
        phone: document.getElementById('tPhone').value,
        specialization: document.getElementById('tSpecialization').value,
        status: document.getElementById('tStatus').value,
        salary: parseFloat(document.getElementById('tSalary').value) || 0,
        hire_date: document.getElementById('tHireDate').value,
        notes: document.getElementById('tNotes').value
    };
    
    var bridge = getBridge();
    var promise;
    if (id) {
        promise = bridge.update_trainer(parseInt(id), data);
    } else {
        promise = bridge.get_next_trainer_code().then(function(result) {
            data.trainer_code = result.code;
            return bridge.add_trainer(data);
        });
    }
    
    promise.then(function(result) {
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('trainerModal')).hide();
            renderTrainers();
            updateDashboard();
            showToast('موفق', id ? 'مربی ویرایش شد' : 'مربی جدید اضافه شد');
        } else {
            showToast('خطا', result.message || 'خطا در ذخیره', 'error');
        }
    })['catch'](function(e) {
        showToast('خطا', 'خطا در ذخیره: ' + e.message, 'error');
    });
}

function deleteTrainer(id) {
    if (confirm('آیا از حذف این مربی اطمینان دارید؟')) {
        var bridge = getBridge();
        bridge.delete_trainer(id).then(function(result) {
            if (result.success) {
                renderTrainers();
                updateDashboard();
                showToast('حذف', 'مربی با موفقیت حذف شد');
            } else {
                showToast('خطا', result.message || 'خطا در حذف', 'error');
            }
        });
    }
}

function openStaffModal(data) {
    data = data || null;
    var modal = new bootstrap.Modal(document.getElementById('staffModal'));
    document.getElementById('staffForm').reset();
    document.getElementById('staffEditId').value = '';
    
    if (data) {
        document.getElementById('staffEditId').value = data.id;
        document.getElementById('sName').value = data.full_name || '';
        document.getElementById('sFather').value = data.father_name || '';
        document.getElementById('sPhone').value = data.phone || '';
        document.getElementById('sPosition').value = data.position || '';
        document.getElementById('sStatus').value = data.status || 'Active';
        document.getElementById('sSalary').value = data.salary || '';
        document.getElementById('sHireDate').value = data.hire_date || '';
        document.getElementById('sNotes').value = data.notes || '';
    } else {
        document.getElementById('sHireDate').value = new Date().toISOString().split('T')[0];
    }
    modal.show();
}

function editStaff(id) {
    var bridge = getBridge();
    bridge.get_staff_by_id(id).then(function(staff) {
        if (staff) openStaffModal(staff);
    });
}

function saveStaff() {
    var id = document.getElementById('staffEditId').value;
    var name = document.getElementById('sName').value.trim();
    var father = document.getElementById('sFather').value.trim();
    
    if (!name || !father) {
        showToast('خطا', 'نام و نام پدر الزامی است', 'error');
        return;
    }
    
    var data = {
        full_name: name,
        father_name: father,
        phone: document.getElementById('sPhone').value,
        position: document.getElementById('sPosition').value,
        status: document.getElementById('sStatus').value,
        salary: parseFloat(document.getElementById('sSalary').value) || 0,
        hire_date: document.getElementById('sHireDate').value,
        notes: document.getElementById('sNotes').value
    };
    
    var bridge = getBridge();
    var promise;
    if (id) {
        promise = bridge.update_staff(parseInt(id), data);
    } else {
        promise = bridge.get_next_staff_code().then(function(result) {
            data.staff_code = result.code;
            return bridge.add_staff(data);
        });
    }
    
    promise.then(function(result) {
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('staffModal')).hide();
            renderStaff();
            updateDashboard();
            showToast('موفق', id ? 'کارمند ویرایش شد' : 'کارمند جدید اضافه شد');
        } else {
            showToast('خطا', result.message || 'خطا در ذخیره', 'error');
        }
    })['catch'](function(e) {
        showToast('خطا', 'خطا در ذخیره: ' + e.message, 'error');
    });
}

function deleteStaff(id) {
    if (confirm('آیا از حذف این کارمند اطمینان دارید؟')) {
        var bridge = getBridge();
        bridge.delete_staff(id).then(function(result) {
            if (result.success) {
                renderStaff();
                updateDashboard();
                showToast('حذف', 'کارمند با موفقیت حذف شد');
            } else {
                showToast('خطا', result.message || 'خطا در حذف', 'error');
            }
        });
    }
}