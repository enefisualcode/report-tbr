(() => {
  pageMeta.admin = ['Admin Overview', 'Kelola user terdaftar dan persetujuan akses supervisor.'];
  pageMeta.adminApproval = ['Approval TBR SPV', 'Setujui permintaan akses TBR Supervisor.'];
  const originalNavItems = navItems;
  navItems = () => state.role === 'admin' ? [['admin', icon.home, 'Overview'], ['adminApproval', icon.ranking, 'Approval SPV']] : originalNavItems();
  const originalAllowedPage = allowedPage;
  allowedPage = (page) => state.role === 'admin' ? (page === 'adminApproval' ? 'adminApproval' : 'admin') : originalAllowedPage(page);
  const originalRoleStatus = roleStatus;
  roleStatus = () => state.role === 'admin' ? { pending: false, label: 'Admin' } : originalRoleStatus();
  let adminUsers = [];
  const roleLabel = (role) => ({ admin: 'Admin', supervisor: 'TBR Supervisor', staff: 'TBR Staff' }[role] || role);
  const statusLabel = (user) => user.role === 'supervisor' ? 'Disetujui' : user.requested_role === 'supervisor' ? 'Menunggu approval' : 'Aktif';

  async function loadAdminUsers() {
    const result = await db.from('profiles').select('id,full_name,nip,role,requested_role,area,created_at').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    adminUsers = result.data || [];
  }
  function renderAdminUsers() {
    if (state.role !== 'admin') return;
    const pendingUsers = adminUsers.filter((user) => user.role !== 'supervisor' && user.requested_role === 'supervisor');
    const table = document.getElementById('adminUsersTable');
    const approvalTable = document.getElementById('adminApprovalTable');
    const rows = adminUsers.map((user) => {
      const pending = user.role !== 'supervisor' && user.requested_role === 'supervisor';
      return `<tr><td><strong>${esc(user.full_name)}</strong><small>${esc(user.area || '')}</small></td><td>${esc(user.nip || '-')}</td><td>${roleLabel(user.role)}</td><td><span class="status-pill ${pending ? 'pending' : ''}">${statusLabel(user)}</span></td></tr>`;
    }).join('');
    if (table) table.innerHTML = rows || '<tr><td colspan="4">Belum ada user terdaftar.</td></tr>';
    if (approvalTable) approvalTable.innerHTML = pendingUsers.map((user) => {
      const pending = user.role !== 'supervisor' && user.requested_role === 'supervisor';
      return `<tr><td><strong>${esc(user.full_name)}</strong><small>${esc(user.area || '')}</small></td><td>${esc(user.nip || '-')}</td><td>${roleLabel(user.role)}</td><td><span class="status-pill ${pending ? 'pending' : ''}">${statusLabel(user)}</span></td><td>${pending ? `<button class="button primary approve-user" data-user-id="${user.id}" type="button">Approve SPV</button>` : '<span class="muted-text">—</span>'}</td></tr>`;
    }).join('') || '<tr><td colspan="5">Tidak ada permintaan approval.</td></tr>';
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setText('adminName', profile?.full_name || 'Admin');
    setText('adminTotalUsers', adminUsers.length);
    setText('adminStaffCount', adminUsers.filter((user) => user.role === 'staff').length);
    setText('adminSupervisorCount', adminUsers.filter((user) => user.role === 'supervisor').length);
    setText('adminPendingCount', pendingUsers.length);
    setText('adminApprovalCount', pendingUsers.length);
  }
  const originalRender = render;
  render = function renderAdmin() {
    if (state.role === 'admin' && !['admin', 'adminApproval'].includes(state.page)) state.page = 'admin';
    originalRender();
    renderAdminUsers();
  };
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.approve-user');
    if (!button || state.role !== 'admin') return;
    button.disabled = true;
    try {
      const result = await db.rpc('approve_supervisor', { target_user_id: button.dataset.userId });
      if (result.error) throw result.error;
      await loadAdminUsers();
      renderAdminUsers();
    } catch (error) {
      alert(`Approval gagal: ${error.message}`);
      button.disabled = false;
    }
  });
  const originalLoadData = loadData;
  loadData = async function loadDataWithAdmin() {
    await originalLoadData();
    if (state.role === 'admin') {
      await loadAdminUsers();
      state.page = 'admin';
      render();
    }
  };
})();
