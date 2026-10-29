(() => {
  const staff = document.getElementById('achievementStaff');
  const product = document.getElementById('achievementProduct');
  const tbody = document.getElementById('achievementRows');
  const total = document.getElementById('achievementTotal');
  const count = document.getElementById('achievementCount');
  const priorRender = render;
  function renderAchievements() {
    if (state.role !== 'supervisor') return;
    const previousStaff = staff.value;
    const staffById = new Map(ranking.map(row => [row.userId, row.name]));
    staff.innerHTML = '<option value="">Semua staff</option>' + ranking.map(row => `<option value="${esc(row.userId)}">${esc(row.name)}</option>`).join('');
    staff.value = staffById.has(previousStaff) ? previousStaff : '';
    const rows = records.filter(row => (!staff.value || row.userId === staff.value) && (!product.value || row.product === product.value));
    total.textContent = rows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
    count.textContent = `${rows.length} laporan`;
    tbody.innerHTML = rows.map(row => `<tr><td>${esc(row.date)}</td><td>${esc(staffById.get(row.userId) || 'Staff')}</td><td>${esc(row.product)}</td><td>${esc(row.detail)}</td><td><strong>${Number(row.qty)}</strong></td></tr>`).join('') || '<tr><td colspan="5">Tidak ada pencapaian untuk filter ini.</td></tr>';
  }
  render = function renderWithAchievements() { priorRender(); renderAchievements(); };
  staff.addEventListener('change', renderAchievements);
  product.addEventListener('change', renderAchievements);
  document.getElementById('achievementReset').addEventListener('click', () => { staff.value = ''; product.value = ''; renderAchievements(); });
  const priorLoad = loadData;
  loadData = async function loadDataWithMonth() {
    await priorLoad();
    if (state.role === 'supervisor') await window.tbrLoadMonth(state.month);
  };
})();
