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
        var resultCount = document.getElementById('membersResultCount');
        if (!body) return;
        if (resultCount) resultCount.textContent = members.length;
        
        bridge.get_member_stats().then(function(stats) {
            setMemberMetric('memberStatTotal', stats.total);
            setMemberMetric('memberStatActive', stats.active);
            setMemberMetric('memberStatExpired', stats.expired);
            setMemberMetric('memberStatMale', stats.male);
            setMemberMetric('memberStatFemale', stats.female);
        });
        
        if (members.length === 0) {
            body.innerHTML = '<tr><td colspan="7"><div class="member-empty"><span><i class="fas fa-users-slash"></i></span><strong>عضوی پیدا نشد</strong><p>جستجو یا فیلترها را تغییر دهید، یا یک عضو جدید اضافه کنید.</p><button class="btn-gold-small" type="button" onclick="openMemberModal()"><i class="fas fa-user-plus me-1"></i>افزودن عضو</button></div></td></tr>';
            return;
        }
        
        body.innerHTML = members.map(function(m) {
            var statusClass = m.status === 'Active' ? 'active' : m.status === 'Expired' ? 'expired' : 'inactive';
            var statusLabel = m.status === 'Active' ? 'فعال' : m.status === 'Expired' ? 'منقضی' : 'غیرفعال';
            var memberName = escapeMemberText(m.full_name || '-');
            var fatherName = escapeMemberText(m.father_name || '');
            var memberCode = escapeMemberText(m.member_code || '-');
            var phone = escapeMemberText(m.phone || '-');
            var membershipType = escapeMemberText(m.membership_type || '-');
            var initials = getMemberInitials(m.full_name || 'عضو');
            return '<tr>' +
                '<td><div class="member-identity"><span class="member-avatar">' + initials + '</span><div><strong>' + memberName + '</strong><small>' + (fatherName ? 'فرزند ' + fatherName : '—') + '</small></div></div></td>' +
                '<td><span class="member-code">' + memberCode + '</span></td>' +
                '<td><span class="member-phone"><i class="fas fa-phone"></i>' + phone + '</span></td>' +
                '<td><span class="member-plan">' + membershipType + '</span></td>' +
                '<td><span class="member-expiry"><i class="far fa-calendar"></i>' + escapeMemberText(m.expiry_date || '-') + '</span></td>' +
                '<td><span class="member-status member-status--' + statusClass + '"><i class="fas fa-circle"></i>' + statusLabel + '</span></td>' +
                '<td><div class="member-row-actions"><button class="member-row-action is-primary" type="button" title="ویرایش عضو" onclick="editMember(' + m.id + ')"><i class="fas fa-pen"></i></button>' +
                '<button class="member-row-action" type="button" title="نمایش کارت" onclick="viewMemberCard(\'' + String(m.member_code || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-qrcode"></i></button>' +
                '<button class="member-row-action is-danger" type="button" title="حذف عضو" onclick="deleteMember(' + m.id + ')"><i class="fas fa-trash"></i></button></div></td>' +
            '</tr>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function filterMembers() { renderMembers(); }

function clearMemberFilters() {
    var search = document.getElementById('memberSearch');
    var status = document.getElementById('memberStatusFilter');
    if (search) search.value = '';
    if (status) status.value = 'all';
    renderMembers();
}

function setMemberMetric(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value || 0;
}

function escapeMemberText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getMemberInitials(name) {
    return escapeMemberText(String(name).trim().split(/\s+/).slice(0, 2).map(function(part) { return part.charAt(0); }).join('') || 'ع');
}

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
    var id = getMemberFormControl('memberEditId').value;
    var name = getMemberFormControl('mName').value.trim();
    var father = getMemberFormControl('mFather').value.trim();
    
    if (!name || !father) {
        showToast('خطا', 'نام و نام پدر الزامی است', 'error');
        return;
    }
    
    var data = {
        full_name: name,
        father_name: father,
        phone: getMemberFormControl('mPhone').value,
        email: getMemberFormControl('mEmail').value,
        gender: getMemberFormControl('mGender').value,
        blood_group: getMemberFormControl('mBlood').value,
        date_of_birth: getMemberFormControl('mDob').value,
        membership_type: getMemberFormControl('mPlan').value,
        expiry_date: getMemberFormControl('mExpiry').value,
        status: getMemberFormControl('mStatus').value,
        emergency_contact: getMemberFormControl('mEmergency').value,
        address: getMemberFormControl('mAddress').value,
        notes: getMemberFormControl('mNotes').value
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
            navigate('members').then(function() {
                renderMembers();
                updateDashboard();
            });
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
    navigate('cards').then(function() {
        document.getElementById('cardPersonType').value = 'member';
        if (typeof updateCardPersonList === 'function') {
            updateCardPersonList();
            document.getElementById('cardPersonSelect').value = code;
            if (typeof generateCardPreview === 'function') generateCardPreview();
        }
    });
}

// The member form now has its own workspace instead of opening in a modal.
// Keeping this name preserves existing buttons and sidebar shortcuts.
function openMemberModal(data) {
    data = data || null;
    navigate('member-form').then(function() {
        var form = document.getElementById('memberPageForm');
        if (!form) return;

        form.reset();
        getMemberFormControl('memberEditId').value = '';
        document.getElementById('memberFormTitle').textContent = data ? 'ویرایش عضو' : 'افزودن عضو جدید';
        document.getElementById('memberFormKicker').textContent = data ? 'MEMBER PROFILE' : 'NEW MEMBER PROFILE';
        document.getElementById('memberFormSubtitle').textContent = data ? 'اطلاعات عضو را بررسی و تغییرات مورد نیاز را ذخیره کنید.' : 'مشخصات و اطلاعات عضویت را ثبت کنید تا عضو جدید به سیستم اضافه شود.';

        if (data) {
            getMemberFormControl('memberEditId').value = data.id;
            getMemberFormControl('mName').value = data.full_name || '';
            getMemberFormControl('mFather').value = data.father_name || '';
            getMemberFormControl('mPhone').value = data.phone || '';
            getMemberFormControl('mEmail').value = data.email || '';
            getMemberFormControl('mGender').value = data.gender || 'Male';
            getMemberFormControl('mBlood').value = data.blood_group || 'A+';
            getMemberFormControl('mDob').value = data.date_of_birth || '';
            getMemberFormControl('mPlan').value = data.membership_type || 'ماهانه';
            getMemberFormControl('mExpiry').value = data.expiry_date || '';
            getMemberFormControl('mStatus').value = data.status || 'Active';
            getMemberFormControl('mEmergency').value = data.emergency_contact || '';
            getMemberFormControl('mAddress').value = data.address || '';
            getMemberFormControl('mNotes').value = data.notes || '';
        } else {
            getMemberFormControl('mExpiry').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
    });
}

function getMemberFormControl(id) {
    return document.querySelector('#page-member-form [id="' + id + '"]');
}

function deleteMember(id) {
    showDeleteConfirmation({
        title: 'حذف عضو',
        message: 'این عضو و اطلاعات وابسته به او حذف می‌شود. این عمل قابل بازگشت نیست.',
        onConfirm: function() {
            getBridge().delete_member(id).then(function(result) {
                if (result.success) {
                    renderMembers();
                    updateDashboard();
                    showToast('حذف شد', 'عضو با موفقیت حذف شد');
                } else {
                    showToast('خطا', result.message || 'خطا در حذف عضو', 'error');
                }
            })['catch'](function(error) {
                showToast('خطا', 'خطا در حذف عضو: ' + error.message, 'error');
            });
        }
    });
}
