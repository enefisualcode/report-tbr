(function initializeSupervisorKpi(global) {
  'use strict';

  const app = global.TBR;
  const { store, utils, views } = app;
  const definitions = [
    { name: 'BSI Agen', target: 4, matches: row => row.product === 'BSI Agen' && /akuisisi baru/i.test(row.activity || row.detail || '') },
    { name: 'QRIS', target: 10, matches: row => row.product === 'QRIS' && /registrasi baru/i.test(row.activity || row.detail || '') },
    { name: 'EDC', target: 3, matches: row => row.product === 'EDC' && /pemasangan baru/i.test(row.activity || row.detail || '') },
    { name: 'New CIF', target: 50, matches: row => row.product === 'Tabungan' && /new cif/i.test(row.activity || row.detail || '') }
  ];
  const targetPerStaff = definitions.reduce((sum, definition) => sum + definition.target, 0);
  const filters = { search: '', status: 'all' };
  const percent = (actual, target) => Math.round(actual / target * 100);
  const width = (actual, target) => Math.min(100, percent(actual, target));

  function statusFor(row) {
    if (!row.actual) return { key: 'not-started', label: 'Belum ada capaian' };
    if (row.items.every(item => item.actual >= item.target)) return { key: 'achieved', label: 'Target tercapai' };
    return { key: 'attention', label: 'Perlu perhatian' };
  }
  function rows() {
    return store.ranking.map(staff => {
      const records = store.records.filter(record => record.userId === staff.userId);
      const items = definitions.map(definition => ({ ...definition, actual: records.filter(definition.matches).reduce((sum, record) => sum + Number(record.qty || 0), 0) }));
      const actual = items.reduce((sum, item) => sum + item.actual, 0);
      return { id: staff.userId, name: staff.name, items, actual, target: targetPerStaff, percentage: percent(actual, targetPerStaff) };
    }).sort((left, right) => left.percentage - right.percentage || left.name.localeCompare(right.name, 'id'));
  }
  function cell(item) {
    return `<div class="kpi-cell"><strong>${item.actual} / ${item.target}</strong><small>${percent(item.actual, item.target)}%</small><div class="progress"><span style="width:${width(item.actual, item.target)}%"></span></div></div>`;
  }
  function staffRow() {
    const records = store.records.filter(record => record.userId === store.currentUser?.id);
    const items = definitions.map(definition => ({ ...definition, actual: records.filter(definition.matches).reduce((sum, record) => sum + Number(record.qty || 0), 0) }));
    const actual = items.reduce((sum, item) => sum + item.actual, 0);
    return { items, actual, target: targetPerStaff, percentage: percent(actual, targetPerStaff) };
  }
  function renderStaff() {
    const section = views.byId('staffKpiSection');
    if (!section) return;
    const visible = store.state.role === 'staff';
    section.hidden = !visible;
    if (!visible) return;
    const row = staffRow();
    views.byId('staffKpiTotal').innerHTML = `<div class="staff-kpi-total-bar" aria-hidden="true"><i style="width:${Math.min(100, row.percentage)}%"></i></div><strong>${row.percentage}%</strong>`;
    views.byId('staffKpiCards').innerHTML = row.items.map(item => {
      const achieved = item.actual >= item.target;
      const status = !item.actual ? { key: 'not-started', label: 'Belum mulai' } : achieved ? { key: 'achieved', label: 'Target tercapai' } : { key: 'attention', label: `${item.target - item.actual} NOA lagi` };
      return `<article class="staff-kpi-card"><small>${item.name}</small><strong>${item.actual} / ${item.target}</strong><small>NOA · ${percent(item.actual, item.target)}%</small><div class="progress"><span style="width:${width(item.actual, item.target)}%"></span></div><span class="kpi-status ${status.key}">${status.label}</span></article>`;
    }).join('');
  }
  function render() {
    if (store.state.role !== 'supervisor') return;
    const allRows = rows();
    const teamTarget = allRows.length * targetPerStaff;
    const teamActual = allRows.reduce((sum, row) => sum + row.actual, 0);
    const average = teamTarget ? percent(teamActual, teamTarget) : 0;
    const allTarget = allRows.filter(row => statusFor(row).key === 'achieved').length;
    const achieved = allRows.reduce((sum, row) => sum + row.items.filter(item => item.actual >= item.target).length, 0);
    views.byId('kpiTeamSummary').innerHTML = `<article class="kpi-summary-card"><span>Rata-rata capaian tim</span><strong>${average}%</strong><small>${teamActual} dari ${teamTarget} NOA</small><div class="progress"><span style="width:${Math.min(100, average)}%"></span></div></article><article class="kpi-summary-card"><span>Staf capai semua target</span><strong>${allTarget} / ${allRows.length}</strong><small>Memenuhi 4 KPI bulan ini</small></article><article class="kpi-summary-card"><span>KPI tim tercapai</span><strong>${achieved} / ${allRows.length * definitions.length}</strong><small>BSI Agen, QRIS, EDC, dan New CIF</small></article>`;
    const query = filters.search.trim().toLocaleLowerCase('id');
    const visible = allRows.filter(row => (!query || row.name.toLocaleLowerCase('id').includes(query)) && (filters.status === 'all' || statusFor(row).key === filters.status));
    views.byId('supervisorKpiTable').innerHTML = visible.map(row => {
      const status = statusFor(row);
      return `<tr><td class="kpi-name"><strong>${utils.escapeHtml(row.name)}</strong><small>${row.actual} dari ${row.target} NOA</small></td>${row.items.map(item => `<td>${cell(item)}</td>`).join('')}<td>${cell({ actual: row.actual, target: row.target })}<span class="kpi-status ${status.key}">${status.label}</span></td><td><button type="button" class="kpi-detail-button" data-kpi-staff="${utils.escapeHtml(row.id)}">Detail</button></td></tr>`;
    }).join('') || '<tr><td class="kpi-empty" colspan="7">Tidak ada staf yang sesuai dengan filter.</td></tr>';
  }
  function setSearch(value) { filters.search = value; render(); }
  function setStatus(value) { filters.status = value; render(); }
  function open(staffId) {
    const row = rows().find(item => item.id === staffId);
    if (!row) return;
    const status = statusFor(row);
    views.byId('supervisorKpiDetailTitle').textContent = `KPI ${row.name}`;
    views.byId('supervisorKpiDetailSubtitle').textContent = `${row.actual} dari ${row.target} NOA · ${row.percentage}% · ${status.label}`;
    views.byId('supervisorKpiDetailRows').innerHTML = row.items.map(item => `<article class="kpi-detail-row"><div><div><strong>${item.name}</strong><small>${item.actual >= item.target ? 'Target tercapai' : `${item.target - item.actual} NOA lagi`}</small></div><b>${item.actual} / ${item.target} NOA</b></div><div class="progress"><span style="width:${width(item.actual, item.target)}%"></span></div></article>`).join('');
    views.byId('supervisorKpiDetail').hidden = false;
  }

  app.kpi = { render, renderStaff, setSearch, setStatus, open };
})(window);
