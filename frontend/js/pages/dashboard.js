/**
 * Dashboard Page
 * داشبورد مدیریت
 */

function updateDashboard() {
    var bridge = getBridge();
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
                    return '<tr><td>' + (m.member_code || '-') + '</td><td>' + (m.full_name || '-') + '</td><td>' + (m.expiry_date || '-') + '</td><td><span class="badge bg-warning text-dark">در حال انقضا</span></td></tr>';
                }).join('');
            } else {
                expBody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">هیچ عضوی در حال انقضا نیست</td></tr>';
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
        
        var labels = data.map(function(d) { return d.label; });
        var values = data.map(function(d) { return d.value; });
        
        App.chartInstances.income = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'درآمد (AFN)',
                    data: values,
                    backgroundColor: 'rgba(255, 185, 0, 0.7)',
                    borderColor: '#FFB900',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e0e0e0' } }
                },
                scales: {
                    y: { 
                        ticks: { color: '#a0a0a0' }, 
                        grid: { color: 'rgba(255,255,255,0.05)' } 
                    },
                    x: { 
                        ticks: { color: '#a0a0a0' }, 
                        grid: { color: 'rgba(255,255,255,0.05)' } 
                    }
                }
            }
        });
    })['catch'](function(e) { console.error(e); });
}