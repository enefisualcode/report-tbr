(function initializeViews(global) {
  'use strict';

  const app = global.TBR;
  const { PRODUCTS, PAGE_META, ICONS } = app.constants;
  const { store, utils } = app;
  const byId = id => document.getElementById(id);
  const escape = utils.escapeHtml;

  function showMessage(element, message, isError = false) {
    element.hidden = false;
    element.textContent = message;
    element.classList.toggle('error', isError);
  }
  function roleStatus() {
    const pending = store.profile?.requested_role === 'supervisor' && store.profile?.role !== 'supervisor';
    const labels = { admin: 'Admin', supervisor: 'TBR Supervisor', staff: pending ? 'Supervisor · Menunggu persetujuan' : 'TBR Staff' };
    return { pending, label: labels[store.profile?.role] || labels.staff };
  }
  function allowedPage(page) {
    if (store.state.role === 'admin') return 'admin';
    if (store.state.role === 'supervisor' && ['dashboard', 'closing'].includes(page)) return 'supervisor';
    return page;
  }
  function navItems() {
    const base = [['dashboard', ICONS.home, 'Beranda'], ['closing', ICONS.closing, 'Closing'], ['ranking', ICONS.ranking, 'Ranking'], ['visits', ICONS.visits, 'Kunjungan'], ['history', ICONS.history, 'Riwayat']];
    if (store.state.role === 'admin') return [['admin', ICONS.home, 'Overview']];
    if (store.state.role === 'supervisor') return [['supervisor', ICONS.home, 'Overview'], ['ranking', ICONS.ranking, 'Ranking'], ['visits', ICONS.visits, 'Kunjungan'], ['history', ICONS.history, 'Riwayat']];
    return base;
  }
  function renderNavigation() {
    const markup = navItems().map(([id, icon, label]) => `<button class="${store.state.page === id ? 'active' : ''}" data-route="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${escape(label)}</span></button>`).join('');
    byId('desktopNav').innerHTML = markup;
    byId('mobileNav').innerHTML = markup;
    byId('mobileNav').classList.toggle('supervisor-nav', store.state.role === 'supervisor');
  }
  function renderRole() {
    const status = roleStatus();
    byId('roleDesktop').textContent = status.label;
    byId('profileRole').textContent = status.label;
    byId('rolePendingNotice').hidden = !status.pending;
  }
  function renderProfile() {
    const profile = store.profile;
    const name = profile?.full_name || profile?.nip || 'Staff';
    const firstLetter = name.trim().charAt(0).toUpperCase() || 'S';
    const image = byId('historyProfileImage');
    const fallback = byId('historyProfileFallback');
    const header = byId('avatar');
    const showFallback = () => { image.hidden = true; fallback.hidden = false; header.textContent = firstLetter; };
    byId('historyProfileName').textContent = name;
    byId('historyProfileNip').textContent = profile?.nip || 'NIP belum tersedia';
    byId('historyProfileRole').textContent = roleStatus().label;
    fallback.textContent = firstLetter;
    if (!profile?.avatarUrl) {
      image.removeAttribute('src');
      showFallback();
      return;
    }
    image.hidden = false;
    fallback.hidden = true;
    image.classList.add('zoomable-photo');
    image.onerror = showFallback;
    image.onload = () => { image.hidden = false; fallback.hidden = true; };
    image.src = profile.avatarUrl;
    header.innerHTML = `<img class="zoomable-photo" src="${profile.avatarUrl}" alt="Foto profil ${escape(name)}">`;
    header.querySelector('img').onerror = () => { header.textContent = firstLetter; };
  }
  function renderProductForm() {
    const product = PRODUCTS.find(item => item.id === store.state.product) || PRODUCTS[0];
    byId('productSelect').innerHTML = PRODUCTS.map(item => `<option value="${item.id}" ${item.id === product.id ? 'selected' : ''}>${item.name}</option>`).join('');
    byId('formTitle').textContent = `Detail ${product.name}`;
    const fieldMarkup = product.fields.map((field, index) => {
      const [label, type, options] = field;
      const optional = product.id === 'tabungan' && ['Nomor rekening', 'Nama nasabah'].includes(label);
      const className = product.id === 'tabungan' ? 'tabungan-field' : label.startsWith('Nama') ? 'wide' : '';
      if (product.id === 'cicil' && index === 0) return '';
      if (type === 'select') return `<label class="${className}">${label}<select name="f${index}" required><option value="">Pilih opsi</option>${options.map(value => `<option>${value}</option>`).join('')}</select></label>`;
      return `<label class="${className}">${label}<input name="f${index}" type="${type}" ${type === 'number' ? 'min="0" step="any"' : ''} placeholder="${options}" ${optional ? '' : 'required'}></label>`;
    }).join('');
    const baseClass = product.id === 'cicil' ? 'wide' : '';
    byId('closingFields').innerHTML = `<label class="${baseClass}">Tanggal closing<input name="date" type="date" value="${utils.isoToday()}" required></label><label class="${baseClass}">Jumlah closing<input name="qty" type="number" min="1" max="100" value="1" required></label>${fieldMarkup}<label class="wide">Keterangan tambahan<textarea name="notes" placeholder="Catatan opsional"></textarea></label>`;
    renderClosingMode();
  }
  function renderClosingMode() {
    const editing = Boolean(store.editingClosingId);
    const product = PRODUCTS.find(item => item.id === store.state.product) || PRODUCTS[0];
    const summary = byId('closingEditSummary');
    document.body.classList.toggle('editing-closing', editing);
    byId('productSelect').closest('.product-select-label').hidden = editing;
    summary.hidden = !editing;
    byId('formTitle').textContent = editing ? `Edit data ${product.name}` : `Detail ${product.name}`;
    byId('closingFormSubtitle').textContent = editing ? 'Perbarui data yang sebelumnya sudah disimpan.' : 'Lengkapi informasi closing di bawah ini.';
    byId('closingModePill').textContent = editing ? 'Mode edit' : 'Input manual';
    byId('closingCancel').textContent = editing ? 'Batal edit' : 'Reset';
    byId('closingForm').querySelector('button[type="submit"]').textContent = editing ? 'Simpan perubahan' : 'Simpan closing';
    if (editing) summary.innerHTML = `<span>Data sebelumnya</span><strong>${escape(product.name)}</strong><small>Produk dikunci saat mengedit. Batalkan edit untuk membuat input closing baru.</small>`;
  }
  function fillClosingForm(data) {
    const product = PRODUCTS.find(item => item.name === data.product);
    if (!product) return false;
    store.state.product = product.id;
    renderProductForm();
    byId('closingFields').querySelector('[name="date"]').value = data.closing_date || '';
    byId('closingFields').querySelector('[name="qty"]').value = data.quantity || '';
    const activity = String(data.activity || '').split(' · ');
    product.fields.forEach((_, index) => {
      const field = byId('closingFields').querySelector(`[name="f${index}"]`);
      const activityIndex = product.id === 'cicil' ? index - 1 : index;
      if (field) field.value = activity[activityIndex] || '';
    });
    byId('closingFields').querySelector('[name="notes"]').value = data.notes || '';
    return true;
  }
  function normalizedRanking() {
    if (['admin', 'supervisor'].includes(store.state.role)) return store.ranking;
    return store.ranking.length ? store.ranking : [{ name: store.profile?.full_name || 'Saya', total: store.records.reduce((sum, row) => sum + row.qty, 0), isMe: true }];
  }
  function rankingRow(row, index, max) {
    const letter = (row.name || 'S').trim().charAt(0).toUpperCase() || 'S';
    const avatar = row.avatarUrl ? `<img src="${row.avatarUrl}" data-fallback="${escape(letter)}" alt="Foto profil ${escape(row.name)}" loading="lazy" decoding="async">` : `<span>${escape(letter)}</span>`;
    const staffId = row.userId || store.currentUser?.id || '';
    return `<div class="list-row staff-detail-trigger" data-staff-detail="${escape(staffId)}" role="button" tabindex="0" aria-label="Lihat detail closing ${escape(row.name)}"><div class="rank-avatar" aria-label="Peringkat ${index + 1}">${avatar}</div><div class="list-body"><strong>${escape(row.name)}</strong><div class="progress"><span style="width:${max ? row.total / max * 100 : 0}%"></span></div></div><span class="rank-total">${row.total}</span><small class="rank-unit">closing</small></div>`;
  }
  function currentRankingRows() {
    if (store.state.rankingPeriod === 'monthly') return normalizedRanking();
    if (store.periodRankingRows) return store.periodRankingRows;
    const [start, end] = utils.rankingPeriodBounds(store.state.month, store.state.rankingPeriod);
    return normalizedRanking().map(row => ({ ...row, total: store.records.filter(record => record.userId === row.userId && record.rawDate >= start && record.rawDate <= end).reduce((sum, record) => sum + Number(record.qty || 0), 0) })).sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
  }
  function renderRanking() {
    const rows = currentRankingRows();
    const max = rows[0]?.total || 1;
    document.querySelectorAll('[data-ranking-period]').forEach(button => button.classList.toggle('active', button.dataset.rankingPeriod === store.state.rankingPeriod));
    byId('leaderboard').innerHTML = rows.map((row, index) => rankingRow(row, index, max)).join('') || '<p class="empty">Belum ada data ranking pada periode ini.</p>';
  }
  function renderDistribution() {
    const colors = ['#f4772f', '#f6ae3c', '#119b91', '#3f82c6', '#9761c8', '#99aaa5'];
    const selected = store.state.chartStaff === 'all' ? store.records : store.records.filter(row => row.userId === store.state.chartStaff);
    const totals = utils.productTotals(selected);
    const max = Math.max(1, ...totals.map(row => row.total));
    byId('barChart').classList.add('product-distribution');
    byId('barChart').innerHTML = totals.map((row, index) => `<div class="product-distribution-row"><span>${escape(row.name)}</span><div class="product-distribution-track" style="min-width:100px;background:#edf2f1"><i style="display:block;height:100%;width:${row.total / max * 100}%;background:${colors[index % colors.length]};border-radius:0 7px 7px 0"></i></div><b>${row.total}</b></div>`).join('');
  }
  function renderVisits() {
    byId('visitGallery').innerHTML = store.visits.map(visit => `<div class="visit-card"><div class="visit-image">${visit.photo ? `<img class="zoomable-photo" src="${visit.photo}" alt="Dokumentasi kunjungan" loading="lazy" decoding="async">` : '⌖'}</div><div class="visit-card-content"><strong>${escape(store.state.role === 'supervisor' && visit.staffName ? visit.staffName : 'Dokumentasi kunjungan')}</strong><small>${escape(visit.date)}</small><p>${escape(visit.note)}</p></div>${visit.userId === store.currentUser?.id ? `<button class="visit-delete-button" type="button" data-delete-visit="${escape(visit.id)}" aria-label="Hapus dokumentasi tanggal ${escape(visit.date)}" title="Hapus dokumentasi">&times;</button>` : ''}</div>`).join('') || '<p class="empty">Belum ada dokumentasi.</p>';
  }
  function renderDashboardLists() {
    const rows = normalizedRanking();
    const max = rows[0]?.total || 1;
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const reporterIds = new Set(store.records.filter(row => row.rawDate === utils.isoToday()).map(row => row.userId));
    const reporterNames = [...reporterIds].map(userId => store.ranking.find(row => row.userId === userId)?.name).filter(Boolean);
    byId('recentList').innerHTML = store.records.slice(0, 4).map(row => `<div class="list-row"><span class="list-icon">✓</span><div class="list-body"><strong>${escape(row.product)}</strong><small>${escape(row.detail)} · ${escape(row.date)}</small></div><span class="pill">+${row.qty}</span></div>`).join('') || '<p class="empty">Belum ada aktivitas.</p>';
    byId('topList').innerHTML = rows.slice(0, 3).map((row, index) => rankingRow(row, index, max)).join('');
    byId('supervisorTop').innerHTML = rows.slice(0, 4).map((row, index) => rankingRow(row, index, max)).join('');
    byId('heroTotal').textContent = store.records.filter(row => row.userId === store.currentUser?.id).reduce((sum, row) => sum + row.qty, 0);
    byId('heroRank').textContent = `#${Math.max(1, rows.findIndex(row => row.isMe) + 1)}`;
    byId('heroStaffCount').textContent = store.ranking.length;
    byId('teamTotal').textContent = total;
    byId('activeStaff').textContent = rows.length;
    byId('reportingStaff').textContent = `${reporterIds.size}/${rows.length}`;
    byId('reportingStaffNames').textContent = reporterNames.join(' · ') || 'Belum ada staf yang melapor hari ini.';
    renderDistribution();
    renderVisits();
    renderRanking();
  }
  function renderHistory() {
    const isSupervisor = store.state.role === 'supervisor';
    const query = byId('historySearch').value || '';
    const rows = utils.filterHistoryRecords(store.records, store.historyFilters, query, isSupervisor);
    const filter = (key, type = 'text', placeholder = 'Filter') => `<input class="history-filter" data-history-filter="${key}" type="${type}" placeholder="${placeholder}" value="${escape(store.historyFilters[key] || '')}">`;
    const select = (key, placeholder, values) => `<select class="history-filter" data-history-filter="${key}"><option value="">${escape(placeholder)}</option>${values.map(value => `<option value="${escape(value)}" ${store.historyFilters[key] === value ? 'selected' : ''}>${escape(value)}</option>`).join('')}</select>`;
    const staffOptions = [...new Set(store.ranking.map(row => row.name))].sort((a, b) => a.localeCompare(b, 'id'));
    const productOptions = [...new Set([...PRODUCTS.map(product => product.name), ...store.records.map(row => row.product)])].sort((a, b) => a.localeCompare(b, 'id'));
    const status = `<select class="history-filter" data-history-filter="status"><option value="">Semua</option><option value="Tersimpan" ${store.historyFilters.status === 'Tersimpan' ? 'selected' : ''}>Tersimpan</option></select>`;
    const head = byId('historyTable').closest('table').querySelector('thead');
    const role = isSupervisor ? 'supervisor' : 'staff';
    if (head.dataset.historyRole !== role) {
      head.dataset.historyRole = role;
      head.innerHTML = isSupervisor
        ? `<tr><th>Tanggal</th><th>Nama TBR Staff</th><th>Produk</th><th>Aktivitas</th><th>Jumlah</th><th>Status</th></tr><tr class="history-filter-row"><th>${filter('date', 'date', '')}</th><th>${select('staff', 'Semua staff', staffOptions)}</th><th>${select('product', 'Semua produk', productOptions)}</th><th>${filter('activity', 'text', 'Aktivitas')}</th><th>${filter('qty', 'number', 'Jumlah')}</th><th>${status}</th></tr>`
        : `<tr><th>Tanggal</th><th>Produk</th><th>Aktivitas</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr><tr class="history-filter-row"><th>${filter('date', 'date', '')}</th><th>${select('product', 'Semua produk', productOptions)}</th><th>${filter('activity', 'text', 'Aktivitas')}</th><th>${filter('qty', 'number', 'Jumlah')}</th><th>${status}</th><th></th></tr>`;
    }
    byId('historyTable').innerHTML = rows.map(row => isSupervisor
      ? `<tr><td>${escape(row.date)}</td><td><strong>${escape(row.staffName)}</strong></td><td><span class="pill">${escape(row.product)}</span></td><td>${escape(row.detail)}</td><td><strong>${row.qty}</strong></td><td><span class="status">Tersimpan</span></td></tr>`
      : `<tr><td>${escape(row.date)}</td><td><span class="pill">${escape(row.product)}</span></td><td>${escape(row.detail)}</td><td><strong>${row.qty}</strong></td><td><span class="status">Tersimpan</span></td><td><div class="history-actions"><button class="edit-button" type="button" data-edit-closing="${escape(row.id)}">Edit</button><button class="delete-button" type="button" data-delete-closing="${escape(row.id)}">Hapus</button></div></td></tr>`).join('') || '<tr><td colspan="6">Data tidak ditemukan.</td></tr>';
  }
  function renderChart(targetId, staffId, colorIndex = 0) {
    const target = byId(targetId);
    if (!target) return;
    const colors = ['#119b91', '#477ee8', '#8b62cf', '#e28b35', '#d65d8d', '#3993a5'];
    if (targetId === 'supervisorStaffChart' && staffId === 'all') {
      target.classList.add('all-staff-charts');
      target.innerHTML = store.ranking.map((row, index) => `<article class="all-staff-chart-card"><div><strong>${escape(row.name)}</strong><small>${row.total} closing</small></div><div id="allStaffChart${index}" class="staff-chart staff-chart-mini"></div></article>`).join('') || '<p class="empty">Belum ada staff untuk ditampilkan.</p>';
      store.ranking.forEach((row, index) => renderChart(`allStaffChart${index}`, row.userId, index));
      return;
    }
    target.classList.remove('all-staff-charts');
    const daily = new Map();
    store.records.filter(row => row.userId === staffId).forEach(row => daily.set(row.rawDate, (daily.get(row.rawDate) || 0) + Number(row.qty || 0)));
    const chartRows = [...daily.entries()].sort(([left], [right]) => left.localeCompare(right));
    const values = chartRows.length ? chartRows.map(([, value]) => value) : [0];
    const labels = chartRows.length ? chartRows.map(([date]) => { const [, month, day] = date.split('-'); return `${day}/${month}`; }) : ['—'];
    const max = Math.max(10, Math.ceil(Math.max(...values) / 10) * 10);
    const chartWidth = Math.max(320, target.clientWidth - 32);
    const edge = 4;
    const baseline = 150;
    const step = (chartWidth - edge * 2) / Math.max(1, values.length - 1);
    const points = values.map((value, index) => ({ x: edge + index * step, y: baseline - value / max * 125 }));
    const curve = points.reduce((path, point, index) => { if (!index) return `M ${point.x} ${point.y}`; const previous = points[index - 1]; const control = (previous.x + point.x) / 2; return `${path} C ${control} ${previous.y}, ${control} ${point.y}, ${point.x} ${point.y}`; }, '');
    const area = `${curve} L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z`;
    const gradientId = `${targetId}-gradient`;
    target.innerHTML = `<div class="chart-y"><span>${max}</span><span>${Math.round(max * .75)}</span><span>${Math.round(max * .5)}</span><span>${Math.round(max * .25)}</span><span>0</span></div><svg style="--chart-color:${colors[colorIndex % colors.length]}" viewBox="0 0 ${chartWidth} 170" preserveAspectRatio="none"><defs><linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${colors[colorIndex % colors.length]}" stop-opacity=".34"/><stop offset="100%" stop-color="${colors[colorIndex % colors.length]}" stop-opacity=".02"/></linearGradient></defs><path class="chart-area" d="${area}" fill="url(#${gradientId})"/><path class="chart-line" d="${curve}"/></svg><div class="chart-x">${labels.map(label => `<span>${label}</span>`).join('')}</div>`;
  }
  function renderStaffSelectors() {
    const options = store.state.role === 'supervisor' ? store.ranking : [{ userId: store.currentUser?.id, name: store.profile?.full_name || 'Saya' }];
    if (!(store.state.role === 'supervisor' && store.state.chartStaff === 'all') && !options.some(row => row.userId === store.state.chartStaff)) store.state.chartStaff = options[0]?.userId || store.currentUser?.id;
    byId('staffChartSelect').hidden = store.state.role !== 'supervisor';
    byId('staffChartSelect').innerHTML = options.map(row => `<option value="${row.userId}" ${row.userId === store.state.chartStaff ? 'selected' : ''}>${escape(row.name)}</option>`).join('');
    byId('supervisorStaffSelect').innerHTML = (store.state.role === 'supervisor' ? `<option value="all" ${store.state.chartStaff === 'all' ? 'selected' : ''}>Semua staff</option>` : '') + options.map(row => `<option value="${row.userId}" ${row.userId === store.state.chartStaff ? 'selected' : ''}>${escape(row.name)}</option>`).join('');
  }
  function updatePeriodLabels() {
    byId('monthFilter').value = store.state.month;
    document.querySelectorAll('[data-current-month]').forEach(element => { element.textContent = utils.formatMonth(store.state.month); });
  }
  function render() {
    document.body.classList.toggle('supervisor-mode', store.state.role === 'supervisor');
    document.querySelectorAll('.page').forEach(element => element.classList.toggle('active', element.id === store.state.page));
    const meta = PAGE_META[store.state.page] || PAGE_META.dashboard;
    byId('pageTitle').textContent = meta[0];
    byId('pageSubtitle').textContent = store.state.role === 'supervisor' && store.state.page === 'visits' ? 'Lihat dokumentasi kunjungan seluruh staff.' : meta[1];
    byId('profileName').textContent = store.profile?.full_name || store.currentUser?.email || 'Staff';
    byId('dashboardName').textContent = store.profile?.full_name || store.currentUser?.email || 'Staff';
    byId('dashboardRoleLabel').textContent = roleStatus().label;
    renderProfile();
    renderRole();
    renderNavigation();
    renderStaffSelectors();
    renderProductForm();
    renderDashboardLists();
    renderHistory();
    renderChart('staffChart', store.state.chartStaff);
    renderChart('supervisorStaffChart', store.state.chartStaff);
    updatePeriodLabels();
    if (app.kpi) app.kpi.renderStaff();
    if (app.admin) app.admin.render();
    if (app.kpi) app.kpi.render();
  }
  function renderClosingSummary() {
    byId('closingBars').innerHTML = PRODUCTS.map(product => {
      const total = store.records.filter(row => row.product === product.name).reduce((sum, row) => {
        if (product.id !== 'cicil') return sum + Number(row.qty || 0);
        return sum + (Number(String(row.detail || '').match(/[0-9]+(?:[.][0-9]+)?/)?.[0]) || 0);
      }, 0);
      return `<div class="closing-bar-row"><span>${product.name}</span><div><i style="width:${Math.min(100, total * 5)}%;background:${product.id === 'cicil' ? '#d9a21b' : '#0d9488'}"></i></div><b>${total}${product.id === 'cicil' ? ' gram' : ''}</b></div>`;
    }).join('');
  }
  function renderTeamClosing() {
    byId('teamClosingRows').innerHTML = store.ranking.map(staff => {
      const breakdown = utils.productTotals(store.records.filter(row => row.userId === staff.userId)).filter(row => row.total > 0).map(row => `${row.name}: ${row.total}`).join(' · ');
      return `<div class="team-closing-row"><div><strong>${escape(staff.name)}</strong><small>${escape(breakdown || 'Belum ada closing pada bulan ini.')}</small></div><b>${staff.total} closing</b></div>`;
    }).join('') || '<p class="empty">Belum ada data staff pada bulan ini.</p>';
    byId('teamClosingDetail').hidden = false;
  }
  function showStaffBreakdown(staffId, rows) {
    const staff = store.ranking.find(row => row.userId === staffId);
    byId('staffClosingTitle').textContent = `Closing ${staff?.name || 'Staff'}`;
    byId('staffClosingSubtitle').textContent = `Rincian closing per produk · ${utils.formatMonth(store.state.month)}`;
    const summary = rows.filter(row => Number(row.total) > 0).map(row => ({ name: row.product, total: Number(row.total) }));
    const max = Math.max(1, ...summary.map(row => row.total));
    byId('staffClosingRows').innerHTML = summary.map(row => `<div class="closing-bar-row"><span>${escape(row.name)}</span><div><i style="width:${row.total / max * 100}%;background:${row.name === 'Cicil Emas' ? '#d9a21b' : '#0d9488'}"></i></div><b>${row.total}${row.name === 'Cicil Emas' ? '&nbsp;gram' : ''}</b></div>`).join('') || '<p class="empty">Belum ada closing pada bulan ini.</p>';
    byId('staffClosingDetail').hidden = false;
  }

  app.views = { byId, showMessage, roleStatus, allowedPage, render, renderProductForm, renderClosingMode, fillClosingForm, renderRanking, renderDistribution, renderChart, renderHistory, renderClosingSummary, renderTeamClosing, showStaffBreakdown, updatePeriodLabels };
})(window);
