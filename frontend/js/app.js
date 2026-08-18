/**
 * Golden Gym Desktop — Main Application v4.0
 * جیم گلدن — سیستم مدیریت حرفه‌ای باشگاه
 */

// ── Theme system ──────────────────────────────────────────────
// Theme tokens live in index.html. All future pages should use the --gg-* tokens
// rather than hard-coded colours so they inherit both themes automatically.
var ThemeManager = {
    storageKey: 'goldenGymTheme',
    preference: 'dark',

    normalize: function(theme) {
        if (theme === 'light' || theme === 'system') return theme;
        return 'dark'; // Includes the legacy database value: dark_gold.
    },

    getSystemTheme: function() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    },

    apply: function(theme) {
        this.preference = this.normalize(theme);
        var resolvedTheme = this.preference === 'system' ? this.getSystemTheme() : this.preference;
        document.documentElement.dataset.theme = resolvedTheme;
        document.documentElement.dataset.themePreference = this.preference;

        if (window.Chart && window.Chart.defaults) {
            window.Chart.defaults.font.family = "Vazirmatn, 'Segoe UI', Tahoma, sans-serif";
        }

        try { localStorage.setItem(this.storageKey, this.preference); } catch (e) { /* Storage can be unavailable in restricted webviews. */ }

        var picker = document.getElementById('settingsTheme');
        if (picker) picker.value = this.preference;

        if (typeof loadIncomeChart === 'function' && document.getElementById('incomeChart')) {
            loadIncomeChart();
        }
    },

    setPreference: function(theme, persist) {
        this.apply(theme);
        if (!persist) return;

        var bridge = getBridge();
        bridge.save_settings({ theme: this.preference })['catch'](function(error) {
            console.error('Unable to save theme preference:', error);
        });
    },

    load: function() {
        var savedTheme = 'dark';
        try { savedTheme = localStorage.getItem(this.storageKey) || 'dark'; } catch (e) { /* Use default. */ }
        this.apply(savedTheme);

        var manager = this;
        getBridge().get_settings().then(function(settings) {
            if (settings && settings.theme) manager.apply(settings.theme);
        })['catch'](function(error) {
            console.warn('Unable to load saved theme preference:', error);
        });
    }
};

function setThemePreference(theme, persist) {
    ThemeManager.setPreference(theme, persist !== false);
}

// ── Global State ──────────────────────────────────────────────
var App = {
    currentPage: 'dashboard',
    user: null,
    isLoggedIn: false,
    bridge: null,
    data: {
        members: [],
        payments: [],
        attendance: [],
        trainers: [],
        staff: [],
        equipment: [],
        notifications: [],
        settings: {
            gymName: 'جیم گلدن',
            address: 'کابل، افغانستان',
            phone: '+93 700 000 000',
            email: 'info@goldengym.af',
            currency: 'AFN',
            logo: null,
            signature: null
        }
    },
    nextIds: {
        member: 1,
        payment: 1,
        trainer: 1,
        staff: 1,
        equipment: 1,
        attendance: 1
    },
    chartInstances: {},
    loadedPages: {}
};

// ── Initialize Bridge ─────────────────────────────────────────
function getBridge() {
    // pywebview exposes its API asynchronously. Prefer the real bridge
    // whenever it becomes available; otherwise retain browser-only mock mode.
    if (window.pywebview && window.pywebview.api) {
        if (App.bridge !== window.pywebview.api) {
            App.bridge = window.pywebview.api;
            console.log('✅ Bridge connected via pywebview');
        }
    } else if (!App.bridge) {
        console.warn('⚠️ Bridge not available yet, using temporary mock mode');
        App.bridge = promisifyBridge(createMockBridge());
    }
    return App.bridge;
}

// The event fires after pywebview injects the Python API. This is important
// because calls made before that moment must not leave the app stuck in mock
// mode for the rest of the session.
window.addEventListener('pywebviewready', function() {
    if (window.pywebview && window.pywebview.api) {
        App.bridge = window.pywebview.api;
        console.log('✅ Bridge connected via pywebviewready');
    }
});

// pywebview's js_api automatically returns a Promise from every call.
// The mock bridge (used in a plain browser without pywebview) returns
// plain values, but every page in this app calls bridge.xxx().then(...).
// Wrap every method so both bridges behave identically.
function promisifyBridge(rawBridge) {
    var wrapped = {};
    Object.keys(rawBridge).forEach(function(key) {
        if (typeof rawBridge[key] === 'function') {
            wrapped[key] = function() {
                try {
                    var result = rawBridge[key].apply(rawBridge, arguments);
                    return Promise.resolve(result);
                } catch (err) {
                    return Promise.reject(err);
                }
            };
        }
    });
    return wrapped;
}

// Mirrors the real backend's SQL JOINs: attach the person's name/code to a
// raw attendance record based on user_type + user_id.
function mockEnrichAttendance(a) {
    var enriched = Object.assign({}, a);
    if (a.user_type === 'member') {
        var m = App.data.members.find(function(x) { return x.id === a.user_id; });
        if (m) { enriched.member_name = m.full_name; enriched.member_code = m.member_code; }
    } else if (a.user_type === 'trainer') {
        var t = App.data.trainers.find(function(x) { return x.id === a.user_id; });
        if (t) { enriched.trainer_name = t.full_name; enriched.trainer_code = t.trainer_code; }
    } else if (a.user_type === 'staff') {
        var s = App.data.staff.find(function(x) { return x.id === a.user_id; });
        if (s) { enriched.staff_name = s.full_name; enriched.staff_code = s.staff_code; }
    }
    return enriched;
}

// ── Mock Bridge ──────────────────────────────────────────────
function createMockBridge() {
    return {
        login: function(username, password) {
            if (username === 'admin' && password === 'admin123') {
                return { success: true, user: { full_name: 'مدیر سیستم', role: 'admin', username: 'admin' } };
            }
            return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است' };
        },
        get_current_user: function() { return { full_name: 'مدیر سیستم', role: 'admin', username: 'admin' }; },
        change_password: function(username, newPassword) { return { success: true }; },
        get_settings: function() { return App.data.settings; },
        save_settings: function(settings) { 
            App.data.settings = { ...App.data.settings, ...settings };
            return { success: true };
        },
        get_gym_logo: function() { return App.data.settings.logo || null; },
        get_gym_signature: function() { return App.data.settings.signature || null; },
        upload_gym_logo: function(base64) {
            App.data.settings.logo = base64;
            return { success: true };
        },
        upload_gym_signature: function(base64) {
            App.data.settings.signature = base64;
            return { success: true };
        },
        get_members: function(search, status) {
            var results = App.data.members;
            if (search) {
                var s = search.toLowerCase();
                results = results.filter(function(m) { 
                    return m.full_name && (m.full_name.includes(s) || (m.father_name && m.father_name.includes(s)) || (m.member_code && m.member_code.toLowerCase().includes(s)));
                });
            }
            if (status && status !== 'All' && status !== 'all') {
                results = results.filter(function(m) { return m.status === status; });
            }
            return results;
        },
        get_member: function(id) { 
            for (var i = 0; i < App.data.members.length; i++) {
                if (App.data.members[i].id === id) return App.data.members[i];
            }
            return null;
        },
        get_member_by_code: function(code) { 
            for (var i = 0; i < App.data.members.length; i++) {
                if (App.data.members[i].member_code === code) return App.data.members[i];
            }
            return null;
        },
        add_member: function(data) {
            var newMember = { id: App.nextIds.member++, ...data };
            App.data.members.push(newMember);
            return { success: true, id: newMember.id };
        },
        update_member: function(id, data) {
            for (var i = 0; i < App.data.members.length; i++) {
                if (App.data.members[i].id === id) {
                    App.data.members[i] = { ...App.data.members[i], ...data };
                    return { success: true };
                }
            }
            return { success: false };
        },
        delete_member: function(id) {
            var newMembers = [];
            for (var i = 0; i < App.data.members.length; i++) {
                if (App.data.members[i].id !== id) {
                    newMembers.push(App.data.members[i]);
                }
            }
            App.data.members = newMembers;
            return { success: true };
        },
        get_member_stats: function() {
            var total = App.data.members.length;
            var active = 0, expired = 0, inactive = 0, male = 0, female = 0;
            for (var i = 0; i < App.data.members.length; i++) {
                var m = App.data.members[i];
                if (m.status === 'Active') active++;
                else if (m.status === 'Expired') expired++;
                else inactive++;
                if (m.gender === 'Male') male++;
                else if (m.gender === 'Female') female++;
            }
            return { total: total, active: active, expired: expired, inactive: inactive, male: male, female: female };
        },
        get_next_member_code: function() {
            var maxCode = 0;
            for (var i = 0; i < App.data.members.length; i++) {
                var code = parseInt(App.data.members[i].member_code.replace('MBR', ''));
                if (code > maxCode) maxCode = code;
            }
            return { code: 'MBR' + String(maxCode + 1).padStart(3, '0') };
        },
        get_payments: function(search) { return App.data.payments; },
        add_payment: function(data) {
            var newPayment = { id: App.nextIds.payment++, ...data };
            App.data.payments.push(newPayment);
            return { success: true, id: newPayment.id };
        },
        update_payment: function(id, data) {
            for (var i = 0; i < App.data.payments.length; i++) {
                if (App.data.payments[i].id === id) {
                    App.data.payments[i] = { ...App.data.payments[i], ...data };
                    return { success: true };
                }
            }
            return { success: false };
        },
        delete_payment: function(id) {
            var newPayments = [];
            for (var i = 0; i < App.data.payments.length; i++) {
                if (App.data.payments[i].id !== id) {
                    newPayments.push(App.data.payments[i]);
                }
            }
            App.data.payments = newPayments;
            return { success: true };
        },
        get_payment_stats: function() {
            var total = 0;
            for (var i = 0; i < App.data.payments.length; i++) {
                total += App.data.payments[i].amount || 0;
            }
            return { daily: 0, monthly: 0, yearly: 0, total: total };
        },
        get_payment_chart_data: function(period) {
            var data = [];
            var months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
            for (var i = 0; i < 12; i++) {
                data.push({ label: months[i], value: Math.floor(Math.random() * 50000) + 10000 });
            }
            return data;
        },
        get_trainers: function(search) { return App.data.trainers; },
        get_trainer_by_code: function(code) {
            for (var i = 0; i < App.data.trainers.length; i++) {
                if (App.data.trainers[i].trainer_code === code) return App.data.trainers[i];
            }
            return null;
        },
        get_trainer: function(id) {
            for (var i = 0; i < App.data.trainers.length; i++) {
                if (App.data.trainers[i].id === id) return App.data.trainers[i];
            }
            return null;
        },
        add_trainer: function(data) {
            var newTrainer = { id: App.nextIds.trainer++, ...data };
            App.data.trainers.push(newTrainer);
            return { success: true, id: newTrainer.id };
        },
        update_trainer: function(id, data) {
            for (var i = 0; i < App.data.trainers.length; i++) {
                if (App.data.trainers[i].id === id) {
                    App.data.trainers[i] = { ...App.data.trainers[i], ...data };
                    return { success: true };
                }
            }
            return { success: false };
        },
        delete_trainer: function(id) {
            var newTrainers = [];
            for (var i = 0; i < App.data.trainers.length; i++) {
                if (App.data.trainers[i].id !== id) {
                    newTrainers.push(App.data.trainers[i]);
                }
            }
            App.data.trainers = newTrainers;
            return { success: true };
        },
        get_next_trainer_code: function() {
            var maxCode = 0;
            for (var i = 0; i < App.data.trainers.length; i++) {
                var code = parseInt(App.data.trainers[i].trainer_code.replace('TRN', ''));
                if (code > maxCode) maxCode = code;
            }
            return { code: 'TRN' + String(maxCode + 1).padStart(3, '0') };
        },
        get_trainer_stats: function() {
            var total = App.data.trainers.length;
            var active = 0, inactive = 0;
            for (var i = 0; i < App.data.trainers.length; i++) {
                if (App.data.trainers[i].status === 'Active') active++;
                else inactive++;
            }
            return { total: total, active: active, inactive: inactive };
        },
        get_staff: function(search) { return App.data.staff; },
        get_staff_by_code: function(code) {
            for (var i = 0; i < App.data.staff.length; i++) {
                if (App.data.staff[i].staff_code === code) return App.data.staff[i];
            }
            return null;
        },
        get_staff_by_id: function(id) {
            for (var i = 0; i < App.data.staff.length; i++) {
                if (App.data.staff[i].id === id) return App.data.staff[i];
            }
            return null;
        },
        add_staff: function(data) {
            var newStaff = { id: App.nextIds.staff++, ...data };
            App.data.staff.push(newStaff);
            return { success: true, id: newStaff.id };
        },
        update_staff: function(id, data) {
            for (var i = 0; i < App.data.staff.length; i++) {
                if (App.data.staff[i].id === id) {
                    App.data.staff[i] = { ...App.data.staff[i], ...data };
                    return { success: true };
                }
            }
            return { success: false };
        },
        delete_staff: function(id) {
            var newStaff = [];
            for (var i = 0; i < App.data.staff.length; i++) {
                if (App.data.staff[i].id !== id) {
                    newStaff.push(App.data.staff[i]);
                }
            }
            App.data.staff = newStaff;
            return { success: true };
        },
        get_next_staff_code: function() {
            var maxCode = 0;
            for (var i = 0; i < App.data.staff.length; i++) {
                var code = parseInt(App.data.staff[i].staff_code.replace('STF', ''));
                if (code > maxCode) maxCode = code;
            }
            return { code: 'STF' + String(maxCode + 1).padStart(3, '0') };
        },
        get_staff_stats: function() {
            var total = App.data.staff.length;
            var active = 0, inactive = 0;
            for (var i = 0; i < App.data.staff.length; i++) {
                if (App.data.staff[i].status === 'Active') active++;
                else inactive++;
            }
            return { total: total, active: active, inactive: inactive };
        },
        get_equipment: function(search) { return App.data.equipment; },
        get_equipment_by_id: function(id) {
            for (var i = 0; i < App.data.equipment.length; i++) {
                if (App.data.equipment[i].id === id) return App.data.equipment[i];
            }
            return null;
        },
        add_equipment: function(data) {
            var newEquip = { id: App.nextIds.equipment++, ...data };
            App.data.equipment.push(newEquip);
            return { success: true, id: newEquip.id };
        },
        update_equipment: function(id, data) {
            for (var i = 0; i < App.data.equipment.length; i++) {
                if (App.data.equipment[i].id === id) {
                    App.data.equipment[i] = { ...App.data.equipment[i], ...data };
                    return { success: true };
                }
            }
            return { success: false };
        },
        delete_equipment: function(id) {
            var newEquipment = [];
            for (var i = 0; i < App.data.equipment.length; i++) {
                if (App.data.equipment[i].id !== id) {
                    newEquipment.push(App.data.equipment[i]);
                }
            }
            App.data.equipment = newEquipment;
            return { success: true };
        },
        get_equipment_stats: function() {
            var total = App.data.equipment.length;
            var active = 0, broken = 0, inactive = 0;
            for (var i = 0; i < App.data.equipment.length; i++) {
                if (App.data.equipment[i].status === 'Active') active++;
                else if (App.data.equipment[i].status === 'Broken') broken++;
                else inactive++;
            }
            return { total: total, active: active, broken: broken, inactive: inactive };
        },
        get_plans: function() {
            return [
                { id: 1, plan_name: 'روزانه', duration_days: 1, price: 200 },
                { id: 2, plan_name: 'ماهانه', duration_days: 30, price: 2800 },
                { id: 3, plan_name: 'سالانه', duration_days: 365, price: 22000 }
            ];
        },
        get_notifications: function(unreadOnly) {
            var results = App.data.notifications;
            if (unreadOnly) {
                var unread = [];
                for (var i = 0; i < results.length; i++) {
                    if (!results[i].is_read) unread.push(results[i]);
                }
                return unread;
            }
            return results;
        },
        mark_read: function(id) {
            for (var i = 0; i < App.data.notifications.length; i++) {
                if (App.data.notifications[i].id === id) {
                    App.data.notifications[i].is_read = true;
                    return { success: true };
                }
            }
            return { success: true };
        },
        mark_all_read: function() {
            for (var i = 0; i < App.data.notifications.length; i++) {
                App.data.notifications[i].is_read = true;
            }
            return { success: true };
        },
        delete_notification: function(id) {
            var before = App.data.notifications.length;
            App.data.notifications = App.data.notifications.filter(function(n) { return n.id !== id; });
            return { success: App.data.notifications.length < before };
        },
        get_recent_activities: function(limit) { return App.data.activities || []; },
        get_dashboard_stats: function() {
            var memberStats = this.get_member_stats();
            var trainerStats = this.get_trainer_stats();
            var staffStats = this.get_staff_stats();
            var equipStats = this.get_equipment_stats();
            var paymentStats = this.get_payment_stats();
            return {
                total_members: memberStats.total || 0,
                active_members: memberStats.active || 0,
                expired_members: memberStats.expired || 0,
                inactive_members: memberStats.inactive || 0,
                total_trainers: trainerStats.total || 0,
                active_trainers: trainerStats.active || 0,
                inactive_trainers: trainerStats.inactive || 0,
                total_staff: staffStats.total || 0,
                active_staff: staffStats.active || 0,
                inactive_staff: staffStats.inactive || 0,
                total_equipment: equipStats.total || 0,
                active_equipment: equipStats.active || 0,
                broken_equipment: equipStats.broken || 0,
                inactive_equipment: equipStats.inactive || 0,
                daily_income: paymentStats.daily || 0,
                monthly_income: paymentStats.monthly || 0,
                yearly_income: paymentStats.yearly || 0,
                today_attendance: 0,
                unread_notifs: 0,
                expiring_soon: []
            };
        },
        generate_qr: function(data) { return { success: true, image: '' }; },
        generate_card: function(data) { return { success: true, filename: data.code + '.png', path: 'members/' + data.code + '.png' }; },
        verify_card: function(data) {
            var member = this.get_member_by_code(data.code);
            if (member) return { valid: true, data: member, message: 'کارت معتبر است' };
            var staff = this.get_staff_by_code(data.code);
            if (staff) return { valid: true, data: staff, message: 'کارت معتبر است' };
            var trainer = this.get_trainer_by_code(data.code);
            if (trainer) return { valid: true, data: trainer, message: 'کارت معتبر است' };
            return { valid: false, message: 'کارت نامعتبر است' };
        },
        scan_card_image: function(base64) {
            return { success: true, qr_data: 'GGYM|MBR001|Test|Active|2025-12-31', verification: { valid: true, type_label: 'عضو', data: { full_name: 'کاربر تست', father_name: 'پدر تست', member_code: 'MBR001' } } };
        },
        get_report_data: function(type) {
            if (type === 'members') return App.data.members;
            if (type === 'trainers') return App.data.trainers;
            if (type === 'staff') return App.data.staff;
            if (type === 'payments') return App.data.payments;
            if (type === 'equipment') return App.data.equipment;
            return [];
        },
        export_report: function(type, format) {
            return { success: true, data: 'name,code\nTest,001\n' };
        },
        get_today_attendance: function() {
            var todayStr = new Date().toISOString().split('T')[0];
            return App.data.attendance
                .filter(function(a) { return (a.check_in || '').slice(0, 10) === todayStr; })
                .map(function(a) { return mockEnrichAttendance(a); })
                .sort(function(a, b) { return a.check_in < b.check_in ? 1 : -1; });
        },
        get_attendance_history: function(search, dateFrom, dateTo) {
            var results = App.data.attendance.map(function(a) { return mockEnrichAttendance(a); });
            if (dateFrom) results = results.filter(function(a) { return a.check_in >= dateFrom; });
            if (dateTo) results = results.filter(function(a) { return a.check_in <= dateTo + ' 23:59:59'; });
            if (search) {
                var s = search.toLowerCase();
                results = results.filter(function(a) {
                    var name = (a.member_name || a.trainer_name || a.staff_name || '').toLowerCase();
                    var code = (a.member_code || a.trainer_code || a.staff_code || '').toLowerCase();
                    return name.includes(s) || code.includes(s);
                });
            }
            return results.sort(function(a, b) { return a.check_in < b.check_in ? 1 : -1; });
        },
        checkin: function(userId, userType) {
            userType = userType || 'member';
            var todayStr = new Date().toISOString().split('T')[0];
            var alreadyIn = App.data.attendance.some(function(a) {
                return a.user_id === userId && a.user_type === userType &&
                    (a.check_in || '').slice(0, 10) === todayStr && !a.check_out;
            });
            if (alreadyIn) return { att_id: null, message: 'قبلاً ثبت ورود شده' };
            var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            var record = { id: App.nextIds.attendance++, user_id: userId, user_type: userType, check_in: now, check_out: null, notes: '' };
            App.data.attendance.push(record);
            return { att_id: record.id, message: 'ورود با موفقیت ثبت شد' };
        },
        checkout: function(attId) {
            var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            for (var i = 0; i < App.data.attendance.length; i++) {
                if (App.data.attendance[i].id === attId) {
                    App.data.attendance[i].check_out = now;
                    return { success: true };
                }
            }
            return { success: false };
        },
        delete_attendance: function(attId) {
            var before = App.data.attendance.length;
            App.data.attendance = App.data.attendance.filter(function(a) { return a.id !== attId; });
            return { success: App.data.attendance.length < before };
        },
        get_attendance_stats: function() {
            var todayStr = new Date().toISOString().split('T')[0];
            var now = new Date();
            var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            var monthPrefix = todayStr.slice(0, 7);
            var today = 0, week = 0, month = 0;
            App.data.attendance.forEach(function(a) {
                var day = (a.check_in || '').slice(0, 10);
                if (day === todayStr) today++;
                if (day >= weekAgo) week++;
                if (day.slice(0, 7) === monthPrefix) month++;
            });
            return { today: today, week: week, month: month };
        },
        verify_qr: function(qrData) {
            var parts = qrData.split('|');
            if (parts[0] !== 'GGYM') return { valid: false, reason: 'فرمت QR نامعتبر است' };
            var member = this.get_member_by_code(parts[1]);
            if (!member) return { valid: false, reason: 'عضو یافت نشد' };
            return { valid: true, status: 'active', member: member, days_left: 30, reason: 'کارت معتبر' };
        },
        get_current_date: function() { return new Date().toISOString().split('T')[0]; },
        get_current_datetime: function() { return new Date().toISOString().replace('T', ' '); }
    };
}

// ─── HANDLE LOGIN ──────────────────────────────────────────────
function handleLogin(e) {
    if (e) e.preventDefault();
    
    var usernameEl = document.getElementById('loginUsername');
    var passwordEl = document.getElementById('loginPassword');
    var errorEl = document.getElementById('loginError');
    
    if (!usernameEl || !passwordEl) {
        console.error('Login elements not found');
        return;
    }
    
    var username = usernameEl.value;
    var password = passwordEl.value;
    
    var bridge = getBridge();
    bridge.login(username, password).then(function(result) {
        if (result && result.success) {
            App.user = result.user;
            App.isLoggedIn = true;
            var loginScreen = document.getElementById('loginScreen');
            var mainApp = document.getElementById('mainApp');
            if (loginScreen) loginScreen.style.display = 'none';
            if (mainApp) mainApp.classList.add('show');
            var userNameDisplay = document.getElementById('userNameDisplay');
            if (userNameDisplay) userNameDisplay.textContent = result.user.full_name || 'مدیر سیستم';
            navigate('dashboard').then(function() {
                updateAll();
            });
        } else {
            if (errorEl) {
                errorEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (result ? result.message : 'نام کاربری یا رمز عبور اشتباه است');
                errorEl.style.display = 'block';
            }
        }
    })['catch'](function(error) {
        if (errorEl) {
            errorEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> خطا در ارتباط با سیستم: ' + error.message;
            errorEl.style.display = 'block';
        }
    });
}

function handleLogout() {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        App.isLoggedIn = false;
        App.user = null;
        var loginScreen = document.getElementById('loginScreen');
        var mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (mainApp) mainApp.classList.remove('show');
        var errorEl = document.getElementById('loginError');
        if (errorEl) errorEl.style.display = 'none';
    }
}

// ─── PAGE TEMPLATES & NAVIGATION ─────────────────────────────────
function loadPageTemplate(page) {
    if (document.getElementById('page-' + page)) return Promise.resolve();
    if (App.loadedPages[page]) return App.loadedPages[page];

    var mainContent = document.getElementById('mainContent');
    if (!mainContent) return Promise.reject(new Error('Main content area not found'));

    App.loadedPages[page] = getBridge().get_page_template(page).then(function(template) {
        if (!template) throw new Error('Page template not found: ' + page);
        mainContent.insertAdjacentHTML('beforeend', template);
        var loadingState = document.getElementById('pageLoading');
        if (loadingState) loadingState.style.display = 'none';
    })['catch'](function(error) {
        delete App.loadedPages[page];
        console.error('Unable to load page template:', error);
        throw error;
    });

    return App.loadedPages[page];
}

function refreshPage(page) {
    if (page === 'dashboard' && typeof updateDashboard === 'function') updateDashboard();
    if (page === 'members' && typeof renderMembers === 'function') renderMembers();
    if (page === 'payments' && typeof renderPayments === 'function') renderPayments();
    if (page === 'attendance' && typeof renderAttendance === 'function') renderAttendance();
    if (page === 'coaches' && typeof renderTrainers === 'function') renderTrainers();
    if (page === 'coaches' && typeof renderStaff === 'function') renderStaff();
    if (page === 'equipment' && typeof renderEquipment === 'function') renderEquipment();
    if (page === 'notifications' && typeof renderNotifications === 'function') renderNotifications();
    if (page === 'reports' && typeof generateReport === 'function') generateReport();
    if (page === 'cards' && typeof updateCardPersonList === 'function') updateCardPersonList();
    if (page === 'settings' && typeof loadSettings === 'function') loadSettings();
}

function openNewMemberFromSidebar() {
    if (typeof openMemberModal === 'function') openMemberModal();
}

function navigate(page) {
    App.currentPage = page;
    var navItems = document.querySelectorAll('.sidebar .nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
        if (navItems[i].dataset.page === page) navItems[i].classList.add('active');
    }
    return loadPageTemplate(page).then(function() {
        if (App.currentPage !== page) return;
        var pageSections = document.querySelectorAll('.page-section');
        for (var i = 0; i < pageSections.length; i++) {
            pageSections[i].classList.remove('active');
            if (pageSections[i].id === 'page-' + page) pageSections[i].classList.add('active');
        }
        refreshPage(page);
    })['catch'](function(error) {
        showToast('خطا', 'بارگذاری صفحه انجام نشد', 'error');
        console.error(error);
    });
}

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────
function showToast(title, message, type) {
    type = type || 'info';
    var container = document.querySelector('.toast-container');
    if (!container) {
        var div = document.createElement('div');
        div.className = 'toast-container';
        document.body.appendChild(div);
        container = div;
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast-gold show';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto"><i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>${title}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    container.appendChild(toast);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// ─── UPDATE ALL ────────────────────────────────────────────────
function updateAll() {
    // Seed sample data if empty
    if (App.data.members.length === 0) {
        seedSampleData();
    }
    
    var loadedPageNames = ['dashboard', 'members', 'payments', 'attendance', 'coaches', 'equipment', 'notifications', 'reports', 'cards'];
    for (var i = 0; i < loadedPageNames.length; i++) {
        if (document.getElementById('page-' + loadedPageNames[i])) refreshPage(loadedPageNames[i]);
    }
}

var pendingDeleteAction = null;

function showDeleteConfirmation(options) {
    options = options || {};
    var modalElement = document.getElementById('deleteConfirmModal');
    var title = document.getElementById('deleteConfirmTitle');
    var message = document.getElementById('deleteConfirmMessage');
    var confirmButton = document.getElementById('deleteConfirmAction');
    if (!modalElement || !confirmButton || typeof bootstrap === 'undefined') return;

    if (title) title.textContent = options.title || 'حذف مورد';
    if (message) message.textContent = options.message || 'این عمل قابل بازگشت نیست.';
    pendingDeleteAction = typeof options.onConfirm === 'function' ? options.onConfirm : null;

    confirmButton.onclick = function() {
        var action = pendingDeleteAction;
        pendingDeleteAction = null;
        bootstrap.Modal.getOrCreateInstance(modalElement).hide();
        if (action) action();
    };

    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function seedSampleData() {
    var today = new Date().toISOString().split('T')[0];
    var future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    var past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    App.data.members = [
        { id: 1, member_code: 'MBR001', full_name: 'احمد کریمی', father_name: 'محمد', phone: '۰۷۹۹۰۰۱۱۲۲', email: 'ahmad@email.com', address: 'کابل، خیابان اول', gender: 'Male', blood_group: 'A+', date_of_birth: '1995-03-15', join_date: past, expiry_date: future, membership_type: 'ماهانه', status: 'Active', emergency_contact: '۰۷۹۹۰۰۱۱۲۳', notes: '' },
        { id: 2, member_code: 'MBR002', full_name: 'فاطمه احمدی', father_name: 'رضا', phone: '۰۷۸۹۳۳۴۴۵۵', email: 'fatima@email.com', address: 'کابل، خیابان دوم', gender: 'Female', blood_group: 'B-', date_of_birth: '1998-07-22', join_date: past, expiry_date: future, membership_type: 'سه‌ماهه', status: 'Active', emergency_contact: '۰۷۸۹۳۳۴۴۵۶', notes: '' },
        { id: 3, member_code: 'MBR003', full_name: 'عمر نوری', father_name: 'علی', phone: '۰۷۷۷۵۵۶۶۷۷', email: 'omar@email.com', address: 'کابل، خیابان سوم', gender: 'Male', blood_group: 'O+', date_of_birth: '1990-11-05', join_date: past, expiry_date: past, membership_type: 'ماهانه', status: 'Expired', emergency_contact: '', notes: '' }
    ];
    
    App.data.trainers = [
        { id: 1, trainer_code: 'TRN001', full_name: 'یوسف برکزی', father_name: 'عبدالله', phone: '۰۷۷۷۵۵۵۶۶۶', email: 'yusuf@email.com', address: 'کابل، خیابان ورزش', gender: 'Male', blood_group: 'B+', date_of_birth: '1988-03-20', hire_date: '2024-03-01', specialization: 'بدن‌سازی و فیتنس', salary: 20000, status: 'Active', notes: '' }
    ];
    
    App.data.staff = [
        { id: 1, staff_code: 'STF001', full_name: 'حسن محمودی', father_name: 'علی', phone: '۰۷۹۹۱۱۱۲۲۲', email: 'hassan@email.com', address: 'کابل، خیابان اصلی', gender: 'Male', blood_group: 'O+', date_of_birth: '1990-01-01', hire_date: '2024-01-01', position: 'مدیر باشگاه', salary: 35000, status: 'Active', notes: '' }
    ];
    
    App.data.payments = [
        { id: 1, receipt_number: 'PAY001', member_id: 1, amount: 2800, payment_date: today, payment_method: 'نقدی', payment_type: 'member', notes: 'پرداخت ماهانه' }
    ];
    
    App.data.equipment = [
        { id: 1, name: 'تردمیل', category: 'کاردیو', quantity: 4, status: 'Active', location: 'سالن کاردیو', notes: '' },
        { id: 2, name: 'دمبل ست', category: 'وزنه', quantity: 8, status: 'Active', location: 'سالن وزنه', notes: '' }
    ];
    
    App.data.notifications = [
        { id: 1, title: 'خوش آمدید!', message: 'سیستم جیم گلدن با موفقیت راه‌اندازی شد.', is_read: false, created_at: new Date().toLocaleString() }
    ];
    
    App.data.activities = [
        { id: 1, action_type: 'system', title: 'سیستم راه‌اندازی شد', description: 'جیم گلدن با موفقیت راه‌اندازی شد', created_at: new Date().toLocaleString() }
    ];
    
    App.nextIds.member = 4;
    App.nextIds.trainer = 2;
    App.nextIds.staff = 2;
    App.nextIds.payment = 2;
    App.nextIds.equipment = 3;
}

// ─── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏋 Golden Gym v4.0 loaded successfully');
    ThemeManager.load();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
            if (typeof loadIncomeChart === 'function' && document.getElementById('incomeChart')) loadIncomeChart();
        });
    }

    if (window.matchMedia) {
        var systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
        var syncSystemTheme = function() {
            if (ThemeManager.preference === 'system') ThemeManager.apply('system');
        };
        if (systemThemeQuery.addEventListener) systemThemeQuery.addEventListener('change', syncSystemTheme);
        else if (systemThemeQuery.addListener) systemThemeQuery.addListener(syncSystemTheme);
    }
    
    // Setup login form
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Setup show password toggle
    var showPw = document.getElementById('showPassword');
    var pwField = document.getElementById('loginPassword');
    if (showPw && pwField) {
        showPw.addEventListener('change', function() {
            pwField.type = this.checked ? 'text' : 'password';
        });
    }
    
    // Enter key on password field
    if (pwField) {
        pwField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin(e);
            }
        });
    }
    
    // Setup sidebar navigation
    var navItems = document.querySelectorAll('.sidebar .nav-item[data-page]');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].addEventListener('click', function() {
            navigate(this.dataset.page);
        });
    }
    
    // Check bridge
    if (window.pywebview && window.pywebview.api) {
        console.log('✅ pywebview bridge connected');
    } else {
        console.warn('⚠️ pywebview bridge not available, using mock mode');
    }
});

console.log('📌 Golden Gym app.js loaded');
