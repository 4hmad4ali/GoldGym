/**
 * Notifications Page
 * اعلانات
 */

function renderNotifications() {
    var bridge = getBridge();
    bridge.get_notifications(false).then(function(notifications) {
        var container = document.getElementById('notificationsList');
        if (!container) return;
        var unreadCount = notifications.filter(function(notification) { return !notification.is_read; }).length;
        setNotificationMetric('notificationsTotal', notifications.length);
        setNotificationMetric('notificationsUnread', unreadCount);
        setNotificationMetric('notificationsRead', notifications.length - unreadCount);
        setNotificationMetric('notificationsFeedCount', notifications.length);
        
        if (notifications.length === 0) {
            container.innerHTML = '<div class="notifications-empty"><span><i class="fas fa-bell-slash"></i></span><strong>اعلان جدیدی ندارید</strong><p>وقتی رویداد مهمی در سیستم ثبت شود، در این بخش نمایش داده می‌شود.</p></div>';
            return;
        }
        
        container.innerHTML = notifications.map(function(n) {
            var title = escapeNotificationText(n.title || 'اعلان سیستم');
            var message = escapeNotificationText(n.message || '');
            var createdAt = escapeNotificationText(n.created_at || '');
            return '<article class="notification-item ' + (n.is_read ? 'is-read' : 'is-unread') + '">' +
                '<span class="notification-item__icon"><i class="fas ' + (n.is_read ? 'fa-bell' : 'fa-bell-ring') + '"></i></span>' +
                '<div class="notification-item__content"><div class="notification-item__top"><strong>' + title + '</strong>' + (!n.is_read ? '<span class="notification-item__new">جدید</span>' : '') + '</div><p>' + message + '</p><time><i class="far fa-clock"></i>' + createdAt + '</time></div>' +
                '<div class="notification-item__actions">' +
                    (!n.is_read ? '<button class="notification-row-action is-primary" type="button" title="خوانده شد" onclick="markNotificationRead(' + n.id + ')"><i class="fas fa-check"></i></button>' : '') +
                    '<button class="notification-row-action is-danger" type="button" title="حذف اعلان" onclick="deleteNotification(' + n.id + ')"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</article>';
        }).join('');
    })['catch'](function(e) { console.error(e); });
}

function setNotificationMetric(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value || 0;
}

function escapeNotificationText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
