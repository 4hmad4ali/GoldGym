/**
 * Coaches & Staff Page
 * مربیان و کارمندان
 */

function filterTrainers() { renderTrainers(); }
function filterStaff() { renderStaff(); }

function clearTeamFilter(inputId, roster) {
    var input = document.getElementById(inputId);
    if (input) input.value = '';
    if (roster === 'trainers') renderTrainers();
    if (roster === 'staff') renderStaff();
}

function renderTrainers() {
    var search = document.getElementById('trainerSearch') ? document.getElementById('trainerSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_trainers(search).then(function(trainers) {
        var body = document.getElementById('trainersBody');
        if (!body) return;
        setTeamValue('trainerTabCount', trainers.length);
        
        bridge.get_trainer_stats().then(function(stats) {
            setTeamValue('teamTrainerTotal', stats.total);
            setTeamValue('teamTrainerActive', stats.active);
        });
        
        if (trainers.length === 0) {
            body.innerHTML = teamEmptyState('مربی', 'openTrainerModal()');
            return;
        }
        
        body.innerHTML = trainers.map(function(t) {
            var statusClass = t.status === 'Active' ? 'active' : 'inactive';
            var statusLabel = t.status === 'Active' ? 'فعال' : 'غیرفعال';
            var name = escapeTeamText(t.full_name || '-');
            var fatherName = escapeTeamText(t.father_name || '');
            return '<tr>' +
                teamIdentityCell(name, fatherName, 'coach') +
                '<td><span class="team-code">' + escapeTeamText(t.trainer_code || '-') + '</span></td>' +
                '<td><span class="team-role"><i class="fas fa-medal"></i>' + escapeTeamText(t.specialization || 'بدون تخصص ثبت‌شده') + '</span></td>' +
                '<td><span class="team-phone"><i class="fas fa-phone"></i>' + escapeTeamText(t.phone || '-') + '</span></td>' +
                teamStatusCell(statusClass, statusLabel) +
                teamActions('editTrainer(' + t.id + ')', 'deleteTrainer(' + t.id + ')') +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function renderStaff() {
    var search = document.getElementById('staffSearch') ? document.getElementById('staffSearch').value : '';
    
    var bridge = getBridge();
    bridge.get_staff(search).then(function(staff) {
        var body = document.getElementById('staffBody');
        if (!body) return;
        setTeamValue('staffTabCount', staff.length);
        
        bridge.get_staff_stats().then(function(stats) {
            setTeamValue('teamStaffTotal', stats.total);
            setTeamValue('teamStaffActive', stats.active);
        });
        
        if (staff.length === 0) {
            body.innerHTML = teamEmptyState('کارمند', 'openStaffModal()');
            return;
        }
        
        body.innerHTML = staff.map(function(s) {
            var statusClass = s.status === 'Active' ? 'active' : 'inactive';
            var statusLabel = s.status === 'Active' ? 'فعال' : 'غیرفعال';
            var name = escapeTeamText(s.full_name || '-');
            var fatherName = escapeTeamText(s.father_name || '');
            return '<tr>' +
                teamIdentityCell(name, fatherName, 'staff') +
                '<td><span class="team-code">' + escapeTeamText(s.staff_code || '-') + '</span></td>' +
                '<td><span class="team-role"><i class="fas fa-briefcase"></i>' + escapeTeamText(s.position || 'سمت ثبت‌نشده') + '</span></td>' +
                '<td><span class="team-phone"><i class="fas fa-phone"></i>' + escapeTeamText(s.phone || '-') + '</span></td>' +
                teamStatusCell(statusClass, statusLabel) +
                teamActions('editStaff(' + s.id + ')', 'deleteStaff(' + s.id + ')') +
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
    var id = getTeamFormControl('trainer-form', 'trainerEditId').value;
    var name = getTeamFormControl('trainer-form', 'tName').value.trim();
    var father = getTeamFormControl('trainer-form', 'tFather').value.trim();
    
    if (!name || !father) {
        showToast('خطا', 'نام و نام پدر الزامی است', 'error');
        return;
    }
    
    var data = {
        full_name: name,
        father_name: father,
        phone: getTeamFormControl('trainer-form', 'tPhone').value,
        specialization: getTeamFormControl('trainer-form', 'tSpecialization').value,
        status: getTeamFormControl('trainer-form', 'tStatus').value,
        salary: parseFloat(getTeamFormControl('trainer-form', 'tSalary').value) || 0,
        hire_date: getTeamFormControl('trainer-form', 'tHireDate').value,
        notes: getTeamFormControl('trainer-form', 'tNotes').value
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
            navigate('coaches').then(function() {
                renderTrainers();
                updateDashboard();
            });
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
    var id = getTeamFormControl('staff-form', 'staffEditId').value;
    var name = getTeamFormControl('staff-form', 'sName').value.trim();
    var father = getTeamFormControl('staff-form', 'sFather').value.trim();
    
    if (!name || !father) {
        showToast('خطا', 'نام و نام پدر الزامی است', 'error');
        return;
    }
    
    var data = {
        full_name: name,
        father_name: father,
        phone: getTeamFormControl('staff-form', 'sPhone').value,
        position: getTeamFormControl('staff-form', 'sPosition').value,
        status: getTeamFormControl('staff-form', 'sStatus').value,
        salary: parseFloat(getTeamFormControl('staff-form', 'sSalary').value) || 0,
        hire_date: getTeamFormControl('staff-form', 'sHireDate').value,
        notes: getTeamFormControl('staff-form', 'sNotes').value
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
            navigate('coaches').then(function() {
                renderStaff();
                updateDashboard();
            });
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

function setTeamValue(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value || 0;
}

function escapeTeamText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function teamInitials(name) {
    return escapeTeamText(String(name).trim().split(/\s+/).slice(0, 2).map(function(part) { return part.charAt(0); }).join('') || 'ت');
}

function teamIdentityCell(name, fatherName, type) {
    return '<td><div class="team-identity"><span class="team-avatar team-avatar--' + type + '">' + teamInitials(name) + '</span><div><strong>' + name + '</strong><small>' + (fatherName ? 'فرزند ' + fatherName : '—') + '</small></div></div></td>';
}

function teamStatusCell(statusClass, statusLabel) {
    return '<td><span class="team-status team-status--' + statusClass + '"><i class="fas fa-circle"></i>' + statusLabel + '</span></td>';
}

function teamActions(editAction, deleteAction) {
    return '<td><div class="team-row-actions"><button class="team-row-action is-primary" type="button" title="ویرایش" onclick="' + editAction + '"><i class="fas fa-pen"></i></button><button class="team-row-action is-danger" type="button" title="حذف" onclick="' + deleteAction + '"><i class="fas fa-trash"></i></button></div></td>';
}

function teamEmptyState(person, action) {
    return '<tr><td colspan="6"><div class="team-empty"><span><i class="fas fa-user-group"></i></span><strong>فردی پیدا نشد</strong><p>جستجو را تغییر دهید یا فرد جدیدی به تیم اضافه کنید.</p><button class="btn-gold-small" type="button" onclick="' + action + '"><i class="fas fa-plus me-1"></i>افزودن ' + person + '</button></div></td></tr>';
}

// Dedicated pages replace the legacy trainer and staff modals.
function openTrainerModal(data) {
    data = data || null;
    navigate('trainer-form').then(function() {
        var form = document.getElementById('trainerPageForm');
        if (!form) return;
        form.reset();
        getTeamFormControl('trainer-form', 'trainerEditId').value = '';
        document.getElementById('trainerFormTitle').textContent = data ? 'ویرایش مربی' : 'افزودن مربی جدید';
        document.getElementById('trainerFormKicker').textContent = data ? 'TRAINER PROFILE' : 'NEW TRAINER PROFILE';
        document.getElementById('trainerFormSubtitle').textContent = data ? 'اطلاعات حرفه‌ای مربی را بررسی و تغییرات مورد نیاز را ذخیره کنید.' : 'اطلاعات حرفه‌ای مربی و وضعیت همکاری او را ثبت کنید.';
        if (data) {
            getTeamFormControl('trainer-form', 'trainerEditId').value = data.id;
            getTeamFormControl('trainer-form', 'tName').value = data.full_name || '';
            getTeamFormControl('trainer-form', 'tFather').value = data.father_name || '';
            getTeamFormControl('trainer-form', 'tPhone').value = data.phone || '';
            getTeamFormControl('trainer-form', 'tSpecialization').value = data.specialization || '';
            getTeamFormControl('trainer-form', 'tStatus').value = data.status || 'Active';
            getTeamFormControl('trainer-form', 'tSalary').value = data.salary || '';
            getTeamFormControl('trainer-form', 'tHireDate').value = data.hire_date || '';
            getTeamFormControl('trainer-form', 'tNotes').value = data.notes || '';
        } else {
            getTeamFormControl('trainer-form', 'tHireDate').value = new Date().toISOString().split('T')[0];
        }
    });
}

function openStaffModal(data) {
    data = data || null;
    navigate('staff-form').then(function() {
        var form = document.getElementById('staffPageForm');
        if (!form) return;
        form.reset();
        getTeamFormControl('staff-form', 'staffEditId').value = '';
        document.getElementById('staffFormTitle').textContent = data ? 'ویرایش کارمند' : 'افزودن کارمند جدید';
        document.getElementById('staffFormKicker').textContent = data ? 'STAFF PROFILE' : 'NEW STAFF PROFILE';
        document.getElementById('staffFormSubtitle').textContent = data ? 'اطلاعات شغلی کارمند را بررسی و تغییرات مورد نیاز را ذخیره کنید.' : 'اطلاعات شغلی و وضعیت همکاری کارمند را ثبت کنید.';
        if (data) {
            getTeamFormControl('staff-form', 'staffEditId').value = data.id;
            getTeamFormControl('staff-form', 'sName').value = data.full_name || '';
            getTeamFormControl('staff-form', 'sFather').value = data.father_name || '';
            getTeamFormControl('staff-form', 'sPhone').value = data.phone || '';
            getTeamFormControl('staff-form', 'sPosition').value = data.position || '';
            getTeamFormControl('staff-form', 'sStatus').value = data.status || 'Active';
            getTeamFormControl('staff-form', 'sSalary').value = data.salary || '';
            getTeamFormControl('staff-form', 'sHireDate').value = data.hire_date || '';
            getTeamFormControl('staff-form', 'sNotes').value = data.notes || '';
        } else {
            getTeamFormControl('staff-form', 'sHireDate').value = new Date().toISOString().split('T')[0];
        }
    });
}

function getTeamFormControl(page, id) {
    return document.querySelector('#page-' + page + ' [id="' + id + '"]');
}

function deleteTrainer(id) {
    showDeleteConfirmation({
        title: 'حذف مربی',
        message: 'اطلاعات این مربی حذف می‌شود. این عمل قابل بازگشت نیست.',
        onConfirm: function() {
            getBridge().delete_trainer(id).then(function(result) {
                if (result.success) {
                    renderTrainers();
                    updateDashboard();
                    showToast('حذف شد', 'مربی با موفقیت حذف شد');
                } else {
                    showToast('خطا', result.message || 'خطا در حذف مربی', 'error');
                }
            })['catch'](function(error) {
                showToast('خطا', 'خطا در حذف مربی: ' + error.message, 'error');
            });
        }
    });
}

function deleteStaff(id) {
    showDeleteConfirmation({
        title: 'حذف کارمند',
        message: 'اطلاعات این کارمند حذف می‌شود. این عمل قابل بازگشت نیست.',
        onConfirm: function() {
            getBridge().delete_staff(id).then(function(result) {
                if (result.success) {
                    renderStaff();
                    updateDashboard();
                    showToast('حذف شد', 'کارمند با موفقیت حذف شد');
                } else {
                    showToast('خطا', result.message || 'خطا در حذف کارمند', 'error');
                }
            })['catch'](function(error) {
                showToast('خطا', 'خطا در حذف کارمند: ' + error.message, 'error');
            });
        }
    });
}
