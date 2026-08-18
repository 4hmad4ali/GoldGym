/**
 * Members Page
 * مدیریت اعضا
 */

function renderMembers() {
    var search = document.getElementById('memberSearch') ? document.getElementById('memberSearch').value : '';
    var statusFilter = document.getElementById('memberStatusFilter') ? document.getElementById('memberStatusFilter').value : 'all';
    
    var bridge = getBridge();
    bridge.get_members(search, statusFilter === 'all' ? 'All' : statusFilter).then(function(members) {
        var body = document.getElementById('membersBody');
        
        bridge.get_member_stats().then(function(stats) {
            document.getElementById('memberStats').textContent =
                'کل: ' + stats.total + ' | فعال: ' + stats.active + ' | منقضی: ' + stats.expired + ' | مرد: ' + stats.male + ' | زن: ' + stats.female;
        });
        
        if (members.length === 0) {
            body.innerHTML = '<tr><td colspan="8" class="text-muted text-center">هیچ عضوی یافت نشد</td></tr>';
            return;
        }
        
        body.innerHTML = members.map(function(m) {
            var statusClass = m.status === 'Active' ? 'success' : m.status === 'Expired' ? 'danger' : 'secondary';
            var statusLabel = m.status === 'Active' ? 'فعال' : m.status === 'Expired' ? 'منقضی' : 'غیرفعال';
            return '<tr>' +
                '<td><span class="text-gold">' + m.member_code + '</span></td>' +
                '<td>' + m.full_name + '</td>' +
                '<td>' + (m.father_name || '-') + '</td>' +
                '<td>' + (m.phone || '-') + '</td>' +
                '<td>' + (m.membership_type || '-') + '</td>' +
                '<td>' + (m.expiry_date || '-') + '</td>' +
                '<td><span class="badge bg-' + statusClass + '">' + statusLabel + '</span></td>' +
                '<td><button class="btn btn-sm btn-gold me-1" onclick="editMember(' + m.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-gold me-1" onclick="deleteMember(' + m.id + ')"><i class="fas fa-trash"></i></button>' +
                '<button class="btn btn-sm btn-outline-gold" onclick="viewMemberCard(\'' + m.member_code + '\')"><i class="fas fa-qrcode"></i></button></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function filterMembers() { renderMembers(); }

function openMemberModal(data) {
    data = data || null;
    var modal = new bootstrap.Modal(document.getElementById('memberModal'));
    var form = document.getElementById('memberForm');
    form.reset();
    document.getElementById('memberEditId').value = '';
    document.getElementById('memberModalTitle').innerHTML = '<i class="fas fa-user me-2"></i>افزودن عضو جدید';
    
    if (data) {
        document.getElementById('memberModalTitle').innerHTML = '<i class="fas fa-user-edit me-2"></i>ویرایش عضو';
        document.getElementById('memberEditId').value = data.id;
        document.getElementById('mName').value = data.full_name || '';
        document.getElementById('mFather').value = data.father_name || '';
        document.getElementById('mPhone').value = data.phone || '';
        document.getElementById('mEmail').value = data.email || '';
        document.getElementById('mGender').value = data.gender || 'Male';
        document.getElementById('mBlood').value = data.blood_group || 'A+';
        document.getElementById('mDob').value = data.date_of_birth || '';
        document.getElementById('mPlan').value = data.membership_type || 'ماهانه';
        document.getElementById('mExpiry').value = data.expiry_date || '';
        document.getElementById('mStatus').value = data.status || 'Active';
        document.getElementById('mEmergency').value = data.emergency_contact || '';
        document.getElementById('mAddress').value = data.address || '';
        document.getElementById('mNotes').value = data.notes || '';
    } else {
        document.getElementById('mExpiry').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    modal.show();
}

function editMember(id) {
    var bridge = getBridge();
    bridge.get_member(id).then(function(member) {
        if (member) openMemberModal(member);
    });
}

function saveMember() {
    var id = document.getElementById('memberEditId').value;
    var name = document.getElementById('mName').value.trim();
    var father = document.getElementById('mFather').value.trim();
    
    if (!name || !father) {
        showToast('خطا', 'نام و نام پدر الزامی است', 'error');
        return;
    }
    
    var data = {
        full_name: name,
        father_name: father,
        phone: document.getElementById('mPhone').value,
        email: document.getElementById('mEmail').value,
        gender: document.getElementById('mGender').value,
        blood_group: document.getElementById('mBlood').value,
        date_of_birth: document.getElementById('mDob').value,
        membership_type: document.getElementById('mPlan').value,
        expiry_date: document.getElementById('mExpiry').value,
        status: document.getElementById('mStatus').value,
        emergency_contact: document.getElementById('mEmergency').value,
        address: document.getElementById('mAddress').value,
        notes: document.getElementById('mNotes').value
    };
    
    var bridge = getBridge();
    var promise;
    if (id) {
        promise = bridge.update_member(parseInt(id), data);
    } else {
        promise = bridge.get_next_member_code().then(function(result) {
            data.member_code = result.code;
            data.join_date = new Date().toISOString().split('T')[0];
            return bridge.add_member(data);
        });
    }
    
    promise.then(function(result) {
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('memberModal')).hide();
            renderMembers();
            updateDashboard();
            showToast('موفق', id ? 'عضو ویرایش شد' : 'عضو جدید اضافه شد');
        } else {
            showToast('خطا', result.message || 'خطا در ذخیره', 'error');
        }
    })['catch'](function(e) {
        showToast('خطا', 'خطا در ذخیره: ' + e.message, 'error');
    });
}

function deleteMember(id) {
    if (confirm('آیا از حذف این عضو اطمینان دارید؟')) {
        var bridge = getBridge();
        bridge.delete_member(id).then(function(result) {
            if (result.success) {
                renderMembers();
                updateDashboard();
                showToast('حذف', 'عضو با موفقیت حذف شد');
            } else {
                showToast('خطا', result.message || 'خطا در حذف', 'error');
            }
        });
    }
}

function viewMemberCard(code) {
    navigate('cards');
    document.getElementById('cardPersonType').value = 'member';
    if (typeof updateCardPersonList === 'function') {
        setTimeout(function() {
            updateCardPersonList();
            document.getElementById('cardPersonSelect').value = code;
            if (typeof generateCardPreview === 'function') generateCardPreview();
        }, 200);
    }
}