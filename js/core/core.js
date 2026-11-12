(function initializeCore(global) {
  'use strict';

  const PRODUCTS = [
    { id: 'qris', name: 'QRIS', fields: [['Nama merchant', 'text', 'Contoh: Toko Berkah'], ['Jenis aktivitas', 'select', ['Registrasi baru', 'Aktivasi']]] },
    { id: 'emas', name: 'Tabungan Emas', fields: [['Gramasi emas', 'number', 'Contoh: 5 gram'], ['Nominal rupiah', 'number', 'Contoh: 500000']] },
    { id: 'agen', name: 'BSI Agen', fields: [['Nama usaha / agen', 'text', 'Contoh: Warung Makmur'], ['Jenis aktivitas', 'select', ['Akuisisi baru', 'Aktivasi']]] },
    { id: 'edc', name: 'EDC', fields: [['Nama merchant', 'text', 'Contoh: Resto Sejahtera'], ['Jenis aktivitas', 'select', ['Pemasangan baru', 'Aktivasi']]] },
    { id: 'tabungan', name: 'Tabungan', fields: [['Jenis tabungan', 'select', ['Wadiah', 'Mudharabah', 'Haji', 'Umroh']], ['Status CIF', 'select', ['New CIF', 'Existing CIF']], ['Nomor rekening', 'text', 'Masukkan nomor rekening'], ['Nama nasabah', 'text', 'Masukkan nama nasabah']] },
    { id: 'cicil', name: 'Cicil Emas', fields: [['Jenis aktivitas', 'select', ['Realisasi', 'Pengajuan']], ['Gramasi emas', 'number', 'Contoh: 5 gram'], ['Total outstanding', 'number', 'Contoh: 25000000']] }
  ];

  const PAGE_META = {
    dashboard: ['Dashboard Saya', 'Pantau aktivitas dan pencapaian hari ini.'],
    closing: ['Input Closing', 'Catat pencapaian baru dengan cepat.'],
    ranking: ['Ranking Tim', 'Lihat posisi closing seluruh anggota tim.'],
    visits: ['Dokumentasi Kunjungan', 'Simpan catatan aktivitas lapangan.'],
    history: ['Riwayat Laporan', 'Temukan kembali data closing Anda.'],
    supervisor: ['Dashboard Supervisor', 'Pantau performa dan aktivitas seluruh tim.'],
    admin: ['Admin Overview', 'Kelola user terdaftar dan role akses tim.']
  };

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    closing: '<svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/></svg>',
    ranking: '<svg viewBox="0 0 24 24"><path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 22"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 22"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3H6v6Z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/></svg>',
    visits: '<svg viewBox="0 0 24 24"><path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    history: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>'
  };

  function isoToday(date = new Date()) { return date.toLocaleDateString('en-CA'); }
  function currentMonth(date = new Date()) { return isoToday(date).slice(0, 7); }
  function monthStart(month) { return `${month || currentMonth()}-01`; }
  function monthEnd(month) {
    const [year, monthNumber] = String(month || currentMonth()).split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  }
  function formatMonth(month) {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month || currentMonth()}-01T12:00:00`));
  }
  function formatDate(value) {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  function normalizeNip(value) { return String(value || '').trim().toUpperCase(); }
  function nipToEmail(nip) { return `${normalizeNip(nip).toLowerCase()}@nip.tbr.local`; }
  function normalizeClosing(row, staffName = '', includeStaff = false) {
    return {
      id: row.id,
      userId: row.user_id,
      rawDate: row.closing_date,
      date: formatDate(row.closing_date),
      staffName,
      product: row.product,
      activity: row.activity || '',
      notes: row.notes || '',
      detail: [includeStaff ? staffName : '', row.activity, row.notes].filter(Boolean).join(' · '),
      qty: Number(row.quantity) || 0
    };
  }
  function rankingPeriodBounds(month, period, today = isoToday()) {
    const startOfMonth = monthStart(month);
    const endOfMonth = monthEnd(month);
    const anchor = today >= startOfMonth && today <= endOfMonth ? today : endOfMonth;
    if (period === 'daily') return [anchor, anchor];
    if (period === 'weekly') {
      const date = new Date(`${anchor}T12:00:00`);
      const day = date.getDay() || 7;
      date.setDate(date.getDate() - day + 1);
      const start = isoToday(date);
      const end = isoToday(new Date(date.getTime() + 6 * 86400000));
      return [start < startOfMonth ? startOfMonth : start, end > endOfMonth ? endOfMonth : end];
    }
    return [startOfMonth, endOfMonth];
  }
  function filterHistoryRecords(records, filters, query, isSupervisor) {
    const search = String(query || '').toLowerCase();
    return records.filter(row => {
      if (isSupervisor && !row.staffName) return false;
      const searchable = `${row.staffName || ''} ${row.product || ''} ${row.detail || ''}`.toLowerCase();
      return searchable.includes(search)
        && (!filters.date || row.rawDate === filters.date)
        && (!filters.staff || row.staffName === filters.staff)
        && (!filters.product || row.product === filters.product)
        && (!filters.activity || String(row.detail).toLowerCase().includes(filters.activity.toLowerCase()))
        && (!filters.qty || String(row.qty) === filters.qty)
        && (!filters.status || filters.status === 'Tersimpan');
    });
  }
  function productTotals(records, products = PRODUCTS) {
    return products.map(product => ({
      name: product.name,
      total: records.filter(row => row.product === product.name).reduce((sum, row) => sum + Number(row.qty || 0), 0)
    }));
  }

  const store = {
    state: { role: 'staff', page: 'dashboard', product: 'qris', chartStaff: '', month: currentMonth(), periodScope: 'month', rankingPeriod: 'monthly' },
    currentUser: null,
    profile: null,
    records: [],
    visits: [],
    ranking: [],
    periodRankingRows: null,
    editingClosingId: null,
    pendingVisitDelete: null,
    historyFilters: { date: '', staff: '', product: '', activity: '', qty: '', status: '' },
    registrationInProgress: false,
    loadedSessionKey: '',
    sessionPromise: null,
    adminUsers: []
  };

  const api = global.TBR || {};
  api.constants = { PRODUCTS, PAGE_META, ICONS };
  api.store = store;
  api.utils = { isoToday, currentMonth, monthStart, monthEnd, formatMonth, formatDate, escapeHtml, normalizeNip, nipToEmail, normalizeClosing, rankingPeriodBounds, filterHistoryRecords, productTotals };
  global.TBR = api;

  if (typeof module !== 'undefined' && module.exports) module.exports = api.utils;
})(typeof window !== 'undefined' ? window : globalThis);
