/**
 * Notifications Page
 * اعلانات
 */

function renderNotifications() {
    var bridge = getBridge();
    bridge.get_notifications(false).then(function(notifications) {
        var container = document.getElementById('notificationsList');
        
        if (notifications.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">هیچ اعلانی وجود ندارد</p>';
            return;
        }
        
        container.innerHTML = notifications.map(function(n) {
            return '<div class="stat-card mb-2 ' + (n.is_read ? 'opacity-75' : '') + '" style="border-right: 4px solid ' + (n.is_read ? '#555' : 'var(--gold)') + ';">' +
                '<div class="d-flex justify-content-between">' +
                    '<div><strong>' + n.title + '</strong><p class="mb-0 text-muted small">' + n.message + '</p><small class="text-muted">' + n.created_at + '</small></div>' +
                    '<div>' +
                        (!n.is_read ? '<button class="btn btn-sm btn-gold me-1" onclick="markNotificationRead(' + n.id + ')"><i class="fas fa-check"></i></button>' : '') +
                        '<button class="btn btn-sm btn-outline-gold" onclick="deleteNotification(' + n.id + ')"><i class="fas fa-trash"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function markNotificationRead(id) {
    var bridge = getBridge();
    bridge.mark_read(id).then(function() {
        renderNotifications();
        updateNotificationBadge();
    });
}

function markAllRead() {
    var bridge = getBridge();
    bridge.mark_all_read().then(function() {
        renderNotifications();
        updateNotificationBadge();
        showToast('اعلانات', 'همه اعلانات خوانده شد');
    });
}

function clearNotifications() {
    if (!confirm('آیا از پاک کردن همه اعلانات اطمینان دارید؟')) return;
    var bridge = getBridge();
    bridge.get_notifications(false).then(function(notifications) {
        if (!notifications || notifications.length === 0) {
            showToast('اعلانات', 'اعلانی برای پاک کردن وجود ندارد');
            return;
        }
        Promise.all(notifications.map(function(n) { return bridge.delete_notification(n.id); }))
            .then(function() {
                renderNotifications();
                updateNotificationBadge();
                showToast('اعلانات', 'همه اعلانات پاک شد');
            });
    })['catch'](function(e) { console.error(e); });
}

function deleteNotification(id) {
    var bridge = getBridge();
    bridge.delete_notification(id).then(function(result) {
        renderNotifications();
        updateNotificationBadge();
        if (result && result.success) {
            showToast('اعلانات', 'اعلان حذف شد');
        }
    })['catch'](function(e) {
        showToast('خطا', 'خطا در حذف: ' + e.message, 'error');
    });
}

function updateNotificationBadge() {
    var bridge = getBridge();
    bridge.get_notifications(true).then(function(notifs) {
        var count = notifs.length;
        var badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    })['catch'](function(e) { console.error(e); });
}