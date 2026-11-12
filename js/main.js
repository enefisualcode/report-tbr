(function initializeApplication(global) {
  'use strict';

  const app = global.TBR;
  const { PRODUCTS, PAGE_META } = app.constants;
  const { store, utils, views, services } = app;
  const byId = views.byId;

  function navigate(page) {
    store.state.page = views.allowedPage(page);
    location.hash = store.state.page;
    views.render();
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function loadMonth(month, initialLoad = false) {
    store.state.month = month;
    document.body.classList.add('loading');
    try {
      const data = await services.fetchMonthData(month, store.currentUser.id, store.profile, store.state.role, initialLoad);
      store.records = data.records;
      store.visits = data.visits;
      store.ranking = data.ranking;
      store.periodRankingRows = null;
      views.render();
    } finally {
      document.body.classList.remove('loading');
    }
  }
  async function loadApplicationData() {
    document.body.classList.add('loading');
    try {
      store.profile = await services.fetchOwnProfile(store.currentUser.id);
      store.state.role = store.profile.role;
      store.profile.avatarUrl = await services.signedAvatar(store.profile.avatar_path);
      if (store.state.role === 'supervisor' && ['dashboard', 'closing'].includes(store.state.page)) store.state.page = 'supervisor';
      if (store.state.role !== 'supervisor' && store.state.page === 'supervisor') store.state.page = 'dashboard';
      if (store.state.role === 'admin') {
        store.state.page = 'admin';
        await app.admin.load();
      }
      await loadMonth(store.state.month, true);
    } finally {
      document.body.classList.remove('loading');
    }
  }
  async function handleSession(session) {
    store.currentUser = session?.user || null;
    byId('authScreen').hidden = Boolean(store.currentUser);
    document.querySelector('.app-shell').hidden = !store.currentUser;
    byId('mobileNav').hidden = !store.currentUser;
    if (!store.currentUser) {
      store.loadedSessionKey = '';
      store.sessionPromise = null;
      return;
    }
    if (store.currentUser.id === store.loadedSessionKey) return;
    if (store.sessionPromise) return store.sessionPromise;
    store.sessionPromise = loadApplicationData();
    try {
      await store.sessionPromise;
      store.loadedSessionKey = store.currentUser.id;
    } catch (error) {
      views.showMessage(byId('loginMessage'), `Gagal memuat data: ${error.message}`, true);
      byId('authScreen').hidden = false;
    } finally {
      store.sessionPromise = null;
      document.body.classList.remove('loading');
    }
  }
  function showAuthPanel(panel) {
    const signIn = panel === 'signin';
    byId('loginForm').hidden = !signIn;
    byId('signupForm').hidden = signIn;
    byId('signInTab').classList.toggle('active', signIn);
    byId('signUpTab').classList.toggle('active', !signIn);
    byId('signInTab').setAttribute('aria-selected', String(signIn));
    byId('signUpTab').setAttribute('aria-selected', String(!signIn));
  }
  async function loadRanking(period) {
    store.state.rankingPeriod = period;
    store.periodRankingRows = null;
    views.renderRanking();
    if (period === 'monthly') return;
    const [start, end] = utils.rankingPeriodBounds(store.state.month, period);
    try {
      const rows = await services.fetchRankingPeriod(start, end);
      if (store.state.rankingPeriod === period) {
        store.periodRankingRows = rows;
        views.renderRanking();
      }
    } catch (error) {
      console.error('Gagal memuat ranking periode:', error);
    }
  }
  async function openStaffBreakdown(staffId) {
    byId('staffClosingRows').innerHTML = '<p class="empty">Memuat detail closing…</p>';
    byId('staffClosingDetail').hidden = false;
    try {
      const rows = await services.fetchStaffBreakdown(staffId, utils.monthStart(store.state.month), utils.monthEnd(store.state.month));
      views.showStaffBreakdown(staffId, rows);
    } catch {
      byId('staffClosingRows').innerHTML = '<p class="empty">Detail closing belum dapat dimuat.</p>';
    }
  }
  async function startEditClosing(id) {
    if (store.state.role === 'supervisor' || !store.currentUser) return;
    try {
      const data = await services.getClosing(id, store.currentUser.id);
      store.editingClosingId = id;
      const product = PRODUCTS.find(item => item.name === data.product);
      if (!product) throw new Error('Produk closing tidak dikenali.');
      store.state.product = product.id;
      navigate('closing');
      views.fillClosingForm(data);
      byId('pageTitle').textContent = 'Edit Closing';
      byId('pageSubtitle').textContent = 'Perbarui data closing yang sudah tersimpan.';
      views.showMessage(byId('closingMessage'), `Mengedit closing ${data.product}.`);
    } catch (error) {
      views.showMessage(byId('historyMessage'), error.message || 'Data closing tidak ditemukan atau tidak dapat diedit.', true);
    }
  }
  async function removeClosing(id, button) {
    const row = store.records.find(item => item.id === id);
    if (!row || !global.confirm(`Hapus input closing ${row.product} tanggal ${row.date}? Data yang dihapus tidak dapat dipulihkan.`)) return;
    button.disabled = true;
    button.textContent = 'Menghapus…';
    try {
      await services.deleteClosing(id, store.currentUser.id);
      views.showMessage(byId('historyMessage'), 'Input closing berhasil dihapus.');
      await loadMonth(store.state.month);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Hapus';
      views.showMessage(byId('historyMessage'), `Gagal menghapus: ${error.message}`, true);
    }
  }
  function requestVisitDeletion(id, button) {
    store.pendingVisitDelete = { id, button };
    byId('visitDeleteDialog').dataset.deleteVisitId = id;
    byId('visitDeleteDialog').hidden = false;
  }
  async function confirmVisitDeletion() {
    const pending = store.pendingVisitDelete;
    if (!pending?.id) return views.showMessage(byId('visitMessage'), 'Dokumentasi tidak dapat diidentifikasi.', true);
    byId('visitDeleteDialog').hidden = true;
    store.pendingVisitDelete = null;
    pending.button.disabled = true;
    pending.button.textContent = 'Menghapus…';
    const visit = store.visits.find(item => item.id === pending.id);
    try {
      const storageError = await services.deleteVisit(pending.id, visit?.photoPath);
      store.visits = store.visits.filter(item => item.id !== pending.id);
      views.render();
      views.showMessage(byId('visitMessage'), storageError ? 'Dokumentasi berhasil dihapus, tetapi foto tidak dapat dibersihkan dari penyimpanan.' : 'Dokumentasi dan foto berhasil dihapus.');
    } catch (error) {
      pending.button.disabled = false;
      pending.button.innerHTML = '&times;';
      views.showMessage(byId('visitMessage'), `Gagal menghapus dokumentasi: ${error.message}`, true);
    }
  }
  function closeModal(id) {
    const modal = byId(id);
    if (!modal) return;
    modal.hidden = true;
    if (id === 'photoLightbox') byId('photoLightboxImage').removeAttribute('src');
    if (id === 'visitDeleteDialog') store.pendingVisitDelete = null;
  }
  function openLightbox(image) {
    byId('photoLightboxImage').src = image.currentSrc || image.src;
    byId('photoLightboxImage').alt = image.alt || 'Pratinjau foto';
    byId('photoLightbox').hidden = false;
  }
  async function handleDocumentClick(event) {
    const target = event.target;
    const route = target.closest('[data-route]');
    if (route) return navigate(route.dataset.route);
    const close = target.closest('[data-close]');
    if (close) return closeModal(close.dataset.close);
    const photo = target.closest('.zoomable-photo');
    if (photo) return openLightbox(photo);
    const period = target.closest('[data-ranking-period]');
    if (period) return loadRanking(period.dataset.rankingPeriod);
    const staff = target.closest('[data-staff-detail]');
    if (staff) return openStaffBreakdown(staff.dataset.staffDetail);
    const edit = target.closest('[data-edit-closing]');
    if (edit) return startEditClosing(edit.dataset.editClosing);
    const remove = target.closest('[data-delete-closing]');
    if (remove) return removeClosing(remove.dataset.deleteClosing, remove);
    const visit = target.closest('[data-delete-visit]');
    if (visit) { event.preventDefault(); return requestVisitDeletion(visit.dataset.deleteVisit, visit); }
    if (target.closest('#visitDeleteConfirm')) return confirmVisitDeletion();
    const kpi = target.closest('[data-kpi-staff]');
    if (kpi) return app.kpi.open(kpi.dataset.kpiStaff);
    const approve = target.closest('.approve-user');
    if (approve && store.state.role === 'admin') {
      approve.disabled = true;
      try { await app.admin.approve(approve.dataset.userId); } catch (error) { alert(`Approval gagal: ${error.message}`); approve.disabled = false; }
      return;
    }
    const open = target.closest('[data-open]');
    if (open?.dataset.open === 'teamClosingDetail') return views.renderTeamClosing();
    if (open?.dataset.open === 'closingDetail') { views.renderClosingSummary(); byId('closingDetail').hidden = false; }
  }
  function handleDocumentInput(event) {
    const input = event.target;
    if (input.id === 'historySearch') return views.renderHistory();
    if (input.id === 'kpiStaffSearch') return app.kpi.setSearch(input.value);
    if (!input.matches('[data-history-filter]')) return;
    store.historyFilters[input.dataset.historyFilter] = input.value;
    views.renderHistory();
  }
  function handleDocumentChange(event) {
    const input = event.target;
    if (input.id === 'kpiStatusFilter') return app.kpi.setStatus(input.value);
    if (!input.matches('[data-history-filter]')) return;
    store.historyFilters[input.dataset.historyFilter] = input.value;
    views.renderHistory();
  }
  function bindEvents() {
    byId('signInTab').addEventListener('click', () => showAuthPanel('signin'));
    byId('signUpTab').addEventListener('click', () => showAuthPanel('signup'));
    byId('authScreen').addEventListener('click', event => {
      const toggle = event.target.closest('[data-password-toggle]');
      if (!toggle) return;
      const input = byId(toggle.dataset.passwordToggle);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.textContent = showing ? 'Lihat' : 'Sembunyikan';
    });
    byId('loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const nip = utils.normalizeNip(byId('loginNip').value);
      const password = byId('loginPassword').value;
      if (!app.client) return views.showMessage(byId('loginMessage'), 'Supabase belum terhubung. Periksa config.js.', true);
      if (nip.length < 3) return views.showMessage(byId('loginMessage'), 'Masukkan NIP yang valid.', true);
      if (password.length < 8) return views.showMessage(byId('loginMessage'), 'Password minimal 8 karakter.', true);
      button.disabled = true;
      views.showMessage(byId('loginMessage'), 'Memeriksa akun…');
      try {
        const lookup = await app.client.rpc('login_email_by_nip', { input_nip: nip });
        if (lookup.error || !lookup.data) throw new Error('NIP atau password tidak valid.');
        const result = await app.client.auth.signInWithPassword({ email: lookup.data, password });
        if (result.error) throw result.error;
      } catch (error) {
        views.showMessage(byId('loginMessage'), `Gagal masuk: ${error.message}`, true);
      } finally { button.disabled = false; }
    });
    byId('signupForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const nip = utils.normalizeNip(byId('signupNip').value);
      const fullName = byId('signupFullName').value.trim();
      const password = byId('signupPassword').value;
      const requestedRole = byId('signupRole').value;
      if (!app.client) return views.showMessage(byId('signupMessage'), 'Supabase belum terhubung. Periksa config.js.', true);
      if (fullName.length < 2 || nip.length < 3 || /\s/.test(nip) || password.length < 8) return views.showMessage(byId('signupMessage'), 'Periksa nama, NIP tanpa spasi, dan password minimal 8 karakter.', true);
      button.disabled = true;
      store.registrationInProgress = true;
      try {
        const result = await app.client.auth.signUp({ email: utils.nipToEmail(nip), password, options: { data: { nip, full_name: fullName, requested_role: requestedRole } } });
        if (result.error) throw result.error;
        if (result.data.session) await app.client.auth.signOut();
        form.reset();
        byId('loginForm').reset();
        showAuthPanel('signin');
        views.showMessage(byId('loginMessage'), 'Pendaftaran berhasil. Silakan masuk dengan NIP dan password Anda.');
      } catch (error) {
        views.showMessage(byId('signupMessage'), error.message.toLowerCase().includes('already') ? 'NIP sudah terdaftar.' : `Pendaftaran gagal: ${error.message}`, true);
      } finally { store.registrationInProgress = false; button.disabled = false; }
    });
    byId('logoutButton').addEventListener('click', () => app.client?.auth.signOut());
    byId('productSelect').addEventListener('change', event => { store.state.product = event.target.value; views.renderProductForm(); });
    byId('staffChartSelect').addEventListener('change', event => { store.state.chartStaff = event.target.value; views.renderChart('staffChart', store.state.chartStaff); views.renderChart('supervisorStaffChart', store.state.chartStaff); views.renderDistribution(); byId('supervisorStaffSelect').value = store.state.chartStaff; });
    byId('supervisorStaffSelect').addEventListener('change', event => { store.state.chartStaff = event.target.value; views.renderChart('staffChart', store.state.chartStaff); views.renderChart('supervisorStaffChart', store.state.chartStaff); views.renderDistribution(); byId('staffChartSelect').value = store.state.chartStaff; });
    byId('monthFilter').addEventListener('change', async event => { if (!event.target.value) return; event.target.disabled = true; try { await loadMonth(event.target.value); } catch (error) { views.showMessage(byId('loginMessage'), `Gagal memuat periode: ${error.message}`, true); } finally { event.target.disabled = false; } });
    byId('closingForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (store.state.role === 'supervisor') return views.showMessage(byId('closingMessage'), 'Akun supervisor hanya dapat memonitor data staff.', true);
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const product = PRODUCTS.find(item => item.id === store.state.product);
      const payload = services.closingPayload(new FormData(event.currentTarget), product);
      button.disabled = true;
      try {
        if (store.editingClosingId) await services.updateClosing(store.editingClosingId, store.currentUser.id, payload);
        else await services.createClosing(store.currentUser.id, payload);
        const edited = Boolean(store.editingClosingId);
        store.editingClosingId = null;
        views.showMessage(byId('closingMessage'), edited ? 'Closing berhasil diperbarui.' : 'Closing berhasil disimpan.');
        await loadMonth(store.state.month);
        if (edited) navigate('history');
      } catch (error) { views.showMessage(byId('closingMessage'), `Gagal menyimpan: ${error.message}`, true); }
      finally { button.disabled = false; }
    });
    byId('closingCancel').addEventListener('click', () => { const edited = Boolean(store.editingClosingId); store.editingClosingId = null; byId('closingForm').reset(); views.renderProductForm(); if (edited) navigate('history'); });
    byId('visitForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (store.state.role === 'supervisor') return views.showMessage(byId('visitMessage'), 'Akun supervisor hanya dapat memonitor data staff.', true);
      const form = event.currentTarget;
      const file = byId('visitPhoto').files[0];
      if (!file) return views.showMessage(byId('visitMessage'), 'Foto dokumentasi wajib diunggah sebelum disimpan.', true);
      const button = form?.querySelector('button[type="submit"]');
      const date = byId('visitDate').value;
      const notes = byId('visitNotes').value;
      if (!form || !button) return views.showMessage(byId('visitMessage'), 'Form dokumentasi tidak tersedia. Silakan muat ulang halaman.', true);
      button.disabled = true;
      try {
        const visit = await services.createVisit(store.currentUser.id, date, notes, file);
        store.visits.unshift({ ...visit, staffName: store.profile?.full_name || '' });
        form.reset();
        byId('visitDate').value = utils.isoToday();
        views.render();
        views.showMessage(byId('visitMessage'), 'Dokumentasi dan foto berhasil disimpan.');
        loadMonth(store.state.month).catch(error => console.warn('Penyegaran galeri gagal:', error));
      }
      catch (error) { views.showMessage(byId('visitMessage'), error.message, true); }
      finally { button.disabled = false; }
    });
    byId('profilePhoto').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      event.target.disabled = true;
      try { await services.updateAvatar(store.currentUser.id, store.profile.avatar_path, file); views.showMessage(byId('profilePhotoMessage'), 'Foto profil berhasil diperbarui.'); await loadApplicationData(); }
      catch (error) { views.showMessage(byId('profilePhotoMessage'), error.message, true); }
      finally { event.target.disabled = false; event.target.value = ''; }
    });
    byId('exportExcel').addEventListener('click', async () => {
      const start = byId('exportStart').value;
      const end = byId('exportEnd').value;
      if (store.state.role !== 'supervisor' || !start || !end || start > end) return views.showMessage(byId('exportMessage'), 'Periksa tanggal awal dan akhir ekspor.', true);
      byId('exportExcel').disabled = true;
      try { const count = await services.exportSupervisorData(start, end); views.showMessage(byId('exportMessage'), `${count} data berhasil dibuat dalam file Excel.`); }
      catch (error) { views.showMessage(byId('exportMessage'), `Gagal membuat Excel: ${error.message}`, true); }
      finally { byId('exportExcel').disabled = false; }
    });
    byId('visitDeleteCancel').addEventListener('click', () => closeModal('visitDeleteDialog'));
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('input', handleDocumentInput);
    document.addEventListener('change', handleDocumentChange);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') ['closingDetail', 'staffClosingDetail', 'teamClosingDetail', 'supervisorKpiDetail', 'photoLightbox', 'visitDeleteDialog'].forEach(closeModal);
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-open],[data-staff-detail]')) event.target.click();
    });
    window.addEventListener('hashchange', () => { const target = location.hash.slice(1); if (PAGE_META[target]) { store.state.page = views.allowedPage(target); views.render(); } });
    let resizeFrame;
    window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (store.currentUser) { views.renderChart('staffChart', store.state.chartStaff); views.renderChart('supervisorStaffChart', store.state.chartStaff); } }); });
    document.addEventListener('error', event => { const image = event.target; if (!image.matches?.('.rank-avatar img')) return; const fallback = document.createElement('span'); fallback.textContent = image.dataset.fallback || 'S'; image.replaceWith(fallback); }, true);
  }
  function initialize() {
    bindEvents();
    byId('visitDate').value = utils.isoToday();
    byId('exportStart').value = utils.monthStart(store.state.month);
    byId('exportEnd').value = utils.isoToday();
    views.updatePeriodLabels();
    if (!app.configured) {
      byId('loginForm').querySelector('button[type="submit"]').disabled = true;
      byId('signupForm').querySelector('button[type="submit"]').disabled = true;
      return;
    }
    app.client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_IN' && store.registrationInProgress) return; setTimeout(() => handleSession(session), 0); });
    app.client.auth.getSession().then(({ data }) => handleSession(data.session));
  }

  app.main = { initialize, loadMonth, navigate };
  initialize();
})(window);
