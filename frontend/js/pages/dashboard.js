/**
 * Dashboard Page
 * داشبورد مدیریت
 */

function updateDashboard() {
    var bridge = getBridge();
    var dashboardDateEl = document.getElementById('dashboardDate');
    if (dashboardDateEl) {
        try {
            dashboardDateEl.textContent = new Intl.DateTimeFormat('fa-IR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }).format(new Date());
        } catch (e) {
            dashboardDateEl.textContent = new Date().toLocaleDateString();
        }
    }

    bridge.get_dashboard_stats().then(function(stats) {
        var totalMembersEl = document.getElementById('statTotalMembers');
        var activeMembersEl = document.getElementById('statActiveMembers');
        var expiredMembersEl = document.getElementById('statExpiredMembers');
        var totalTrainersEl = document.getElementById('statTotalTrainers');
        var totalStaffEl = document.getElementById('statTotalStaff');
        var totalIncomeEl = document.getElementById('statTotalIncome');
        var memberBadgeEl = document.getElementById('memberCountBadge');
        
        if (totalMembersEl) totalMembersEl.textContent = stats.total_members || 0;
        if (activeMembersEl) activeMembersEl.textContent = stats.active_members || 0;
        if (expiredMembersEl) expiredMembersEl.textContent = stats.expired_members || 0;
        if (totalTrainersEl) totalTrainersEl.textContent = stats.active_trainers || 0;
        if (totalStaffEl) totalStaffEl.textContent = stats.active_staff || 0;
        if (totalIncomeEl) totalIncomeEl.textContent = (stats.yearly_income || 0).toLocaleString();
        if (memberBadgeEl) memberBadgeEl.textContent = stats.total_members || 0;
        
        // Expiring members
        var expBody = document.getElementById('expiringMembersBody');
        if (expBody) {
            if (stats.expiring_soon && stats.expiring_soon.length > 0) {
                expBody.innerHTML = stats.expiring_soon.map(function(m) {
                    return '<tr><td>' + (m.member_code || '-') + '</td><td>' + (m.full_name || '-') + '</td><td>' + (m.expiry_date || '-') + '</td><td><span class="expiry-status">در حال انقضا</span></td></tr>';
                }).join('');
            } else {
                expBody.innerHTML = '<tr><td colspan="4" class="text-muted text-center py-4">در ۷ روز آینده، عضوی در حال انقضا نیست.</td></tr>';
            }
        }
        
        loadIncomeChart();
    })['catch'](function(e) { console.error(e); });
}

function loadIncomeChart() {
    var bridge = getBridge();
    bridge.get_payment_chart_data('monthly').then(function(data) {
        var ctx = document.getElementById('incomeChart');
        if (!ctx) return;
        if (App.chartInstances.income) { App.chartInstances.income.destroy(); }
        var themeStyles = getComputedStyle(document.documentElement);
        var accentColor = themeStyles.getPropertyValue('--gg-accent').trim() || '#FFB900';
        var textMuted = themeStyles.getPropertyValue('--gg-text-muted').trim() || '#9BA8C0';
        var textColor = themeStyles.getPropertyValue('--gg-text').trim() || '#EEF2FF';
        var borderColor = themeStyles.getPropertyValue('--gg-border').trim() || '#2A3348';
        var surfaceColor = themeStyles.getPropertyValue('--gg-surface').trim() || '#141922';
        
        var labels = data.map(function(d) { return d.label; });
        var values = data.map(function(d) { return d.value; });
        
        App.chartInstances.income = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'درآمد (AFN)',
                    data: values,
                    backgroundColor: accentColor + 'B8',
                    borderColor: accentColor,
                    borderWidth: 2,
                    borderRadius: 7,
                    borderSkipped: false,
                    maxBarThickness: 42
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: surfaceColor, titleColor: textColor, bodyColor: textMuted,
                        borderColor: borderColor, borderWidth: 1, padding: 12,
                        callbacks: { label: function(context) { return ' درآمد: ' + Number(context.raw || 0).toLocaleString() + ' AFN'; } }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { color: textMuted, font: { size: 11 }, padding: 8 },
                        grid: { color: borderColor, drawBorder: false }
                    },
                    x: { 
                        ticks: { color: textMuted, font: { size: 11 } },
                        grid: { display: false, drawBorder: false }
                    }
                }
            }
        });
    })['catch'](function(e) { console.error(e); });
}
