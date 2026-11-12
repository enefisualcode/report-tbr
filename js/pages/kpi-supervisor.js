(function initializeSupervisorKpi(global) {
  'use strict';

  const app = global.TBR;
  const { store, utils, views } = app;
  const definitions = [
    { key: 'agen', name: 'BSI Agen', target: 4, matches: row => row.product === 'BSI Agen' && /akuisisi baru/i.test(row.activity || row.detail || '') },
    { key: 'qris', name: 'QRIS', target: 10, matches: row => row.product === 'QRIS' && /registrasi baru/i.test(row.activity || row.detail || '') },
    { key: 'edc', name: 'EDC', target: 3, matches: row => row.product === 'EDC' && /pemasangan baru/i.test(row.activity || row.detail || '') },
    { key: 'cif', name: 'New CIF', target: 50, matches: row => row.product === 'Tabungan' && /new cif/i.test(row.activity || row.detail || '') }
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
  function productIcon(key) {
    const icons = {
      qris: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM16 16h2v2h-2zM12 12h3v3h-3zM16 12h4v2h-4zM12 16h2v4h-2z"/></svg>',
      agen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18M5 10v9h14v-9M2 10l3-5h14l3 5M9 10v4h6v-4"/><path d="M8 19v-4h8v4"/></svg>',
      edc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h8M9 15h1M12 15h1M15 15h1M9 18h1M12 18h1M15 18h1"/></svg>',
      cif: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5M18 8v8M14 12h8"/></svg>'
    };
    return icons[key] || '';
  }
  function renderStaff() {
    const section = views.byId('staffKpiSection');
    if (!section) return;
    const visible = store.state.role === 'staff';
    section.hidden = !visible;
    if (!visible) return;
    const row = staffRow();
    views.byId('staffKpiTotal').innerHTML = `<div class="staff-kpi-total-bar" aria-hidden="true"><i style="width:${Math.min(100, row.percentage)}%"></i></div><strong>${row.percentage}%</strong>`;
    const visualItems = [row.items.find(item => item.key === 'qris'), row.items.find(item => item.key === 'agen'), row.items.find(item => item.key === 'edc'), row.items.find(item => item.key === 'cif')].filter(Boolean);
    const highestPercentage = Math.max(...visualItems.map(item => percent(item.actual, item.target)));
    views.byId('staffKpiCards').innerHTML = visualItems.map(item => {
      const achieved = item.actual >= item.target;
      const status = !item.actual ? { key: 'not-started', label: 'Belum mulai' } : achieved ? { key: 'achieved', label: 'Target tercapai' } : { key: 'attention', label: `${item.target - item.actual} NOA lagi` };
      const isBest = item.actual > 0 && percent(item.actual, item.target) === highestPercentage;
      return `<article class="staff-kpi-card staff-kpi-${item.key}" data-kpi-product="${item.key}" role="button" tabindex="0" aria-label="Lihat detail closing ${item.name}"><span class="staff-kpi-icon">${productIcon(item.key)}</span><div class="staff-kpi-content"><div class="staff-kpi-card-head"><small class="staff-kpi-name">${item.name}</small>${isBest ? '<span class="staff-kpi-best">♛ Terbaik</span>' : ''}</div><div class="staff-kpi-result"><strong class="staff-kpi-percent">${percent(item.actual, item.target)}%</strong><span class="kpi-status ${status.key}">${status.label}</span></div><div class="progress"><span style="width:${width(item.actual, item.target)}%"></span></div><div class="staff-kpi-footer"><small>Target: ${item.target} NOA</small><small>Tercapai: ${item.actual} NOA</small></div></div></article>`;
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

  function closingName(record, key) {
    const values = String(record.activity || '').split(' · ');
    if (key === 'cif') return String(values[3] || '').trim();
    const name = String(values[0] || '').trim();
    return /^(registrasi baru|aktivasi|akuisisi baru|pemasangan baru)$/i.test(name) ? '' : name;
  }

  function openProduct(key) {
    const definition = definitions.find(item => item.key === key);
    if (!definition || !store.currentUser) return;
    const names = [...new Set(store.records
      .filter(record => record.userId === store.currentUser.id && definition.matches(record))
      .map(record => closingName(record, key))
      .filter(Boolean))];
    views.byId('supervisorKpiDetailTitle').textContent = `Detail ${definition.name}`;
    views.byId('supervisorKpiDetailSubtitle').textContent = `${names.length} closing dengan nama yang tercatat`;
    views.byId('supervisorKpiDetailRows').innerHTML = names.map(name => `<article class="kpi-detail-row kpi-name-detail"><strong>${utils.escapeHtml(name)}</strong></article>`).join('') || '<p class="empty">Belum ada nama merchant atau nama nasabah yang tercatat.</p>';
    views.byId('supervisorKpiDetail').hidden = false;
  }

  app.kpi = { render, renderStaff, setSearch, setStatus, open, openProduct };
})(window);
