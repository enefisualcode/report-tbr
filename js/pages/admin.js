(function initializeAdminPage(global) {
  'use strict';

  const app = global.TBR;
  const { store, utils, views, services } = app;
  const roleLabel = role => ({ admin: 'Admin', supervisor: 'TBR Supervisor', staff: 'TBR Staff' })[role] || role;

  function render() {
    if (store.state.role !== 'admin') return;
    const table = views.byId('adminUsersTable');
    table.innerHTML = store.adminUsers.map(user => `<tr><td><strong>${utils.escapeHtml(user.full_name)}</strong><small>${utils.escapeHtml(user.area || '')}</small></td><td>${utils.escapeHtml(user.nip || '-')}</td><td>${roleLabel(user.role)}</td><td><span class="status-pill">Aktif</span></td></tr>`).join('') || '<tr><td colspan="4">Belum ada user terdaftar.</td></tr>';
    views.byId('adminApprovalTable').innerHTML = '<tr><td colspan="5">Tidak ada permintaan approval.</td></tr>';
    views.byId('adminName').textContent = store.profile?.full_name || 'Admin';
    views.byId('adminActiveUsers').textContent = store.adminUsers.length;
    views.byId('adminTotalUsers').textContent = store.adminUsers.length;
    views.byId('adminStaffCount').textContent = store.adminUsers.filter(user => user.role === 'staff').length;
    views.byId('adminSupervisorCount').textContent = store.adminUsers.filter(user => user.role === 'supervisor').length;
    views.byId('adminApprovalCount').textContent = '0';
  }
  async function load() {
    store.adminUsers = await services.fetchAdminUsers();
  }
  async function approve(userId) {
    await services.approveSupervisor(userId);
    await load();
    render();
  }

  app.admin = { render, load, approve };
})(window);
