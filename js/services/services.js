(function initializeServices(global) {
  'use strict';

  const app = global.TBR;
  const { store, utils } = app;
  const config = global.TBR_CONFIG || {};
  const configured = Boolean(
    config.supabaseUrl && !config.supabaseUrl.startsWith('YOUR_')
    && config.supabasePublishableKey && !config.supabasePublishableKey.startsWith('YOUR_')
  );
  const client = configured && global.supabase
    ? global.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
    : null;
  let sheetJsPromise = null;

  function requireClient() {
    if (!client) throw new Error('Supabase belum terhubung. Periksa config.js.');
    return client;
  }
  async function fetchOwnProfile(userId) {
    let result = await requireClient().from('profiles').select('full_name,nip,role,requested_role,area,avatar_path').eq('id', userId).single();
    if (result.error && /avatar_path|column .* does not exist/i.test(result.error.message || '')) {
      result = await client.from('profiles').select('full_name,nip,role,requested_role,area').eq('id', userId).single();
    }
    if (result.error) throw result.error;
    return result.data;
  }
  async function signedAvatar(path) {
    if (!path) return '';
    const result = await requireClient().storage.from('profile-photos').createSignedUrl(path, 3600);
    return result.data?.signedUrl || '';
  }
  async function hydrateVisits(rows) {
    const paths = rows.map(row => row.photo_path).filter(Boolean);
    const signed = paths.length ? await requireClient().storage.from('visit-photos').createSignedUrls(paths, 3600) : { data: [] };
    const urls = new Map((signed.data || []).map(item => [item.path, item.signedUrl || '']));
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      rawDate: row.visit_date,
      date: utils.formatDate(row.visit_date),
      note: row.notes,
      photoPath: row.photo_path || '',
      photo: row.photo_path ? urls.get(row.photo_path) || '' : ''
    }));
  }
  async function hydrateRankings(rows, userId, profile) {
    const hiddenNames = new Set(['tbrstafftest']);
    const mapped = rows.filter(row => !hiddenNames.has(String(row.full_name || '').trim().toLowerCase())).map(row => ({
      userId: row.user_id,
      name: row.full_name,
      total: Number(row.total),
      isMe: row.user_id === userId,
      avatarPath: row.avatar_path || (row.user_id === userId ? profile?.avatar_path : null)
    }));
    const paths = [...new Set(mapped.map(row => row.avatarPath).filter(Boolean))];
    const signed = paths.length ? await requireClient().storage.from('profile-photos').createSignedUrls(paths, 3600) : { data: [] };
    const urls = new Map((signed.data || []).map(item => [item.path, item.signedUrl || '']));
    return mapped.map(row => ({ ...row, avatarUrl: row.avatarPath ? urls.get(row.avatarPath) || '' : '' }));
  }
  async function fetchMonthData(month, userId, profile, role, initialLoad = false) {
    const start = utils.monthStart(month);
    const end = utils.monthEnd(month);
    let visitQuery = requireClient().from('visits').select('id,user_id,visit_date,notes,photo_path').order('visit_date', { ascending: false });
    visitQuery = initialLoad ? visitQuery.limit(20) : visitQuery.gte('visit_date', start).lte('visit_date', end).limit(100);
    const [closingResult, visitResult, leaderboardResult] = await Promise.all([
      requireClient().from('closings').select('id,user_id,closing_date,product,activity,quantity,notes,created_at').gte('closing_date', start).lte('closing_date', end).order('created_at', { ascending: false }).order('closing_date', { ascending: false }),
      visitQuery,
      client.rpc('monthly_leaderboard', { month_start: start })
    ]);
    if (closingResult.error) throw closingResult.error;
    if (visitResult.error) throw visitResult.error;
    if (leaderboardResult.error) throw leaderboardResult.error;
    const [visits, ranking] = await Promise.all([
      hydrateVisits(visitResult.data || []),
      hydrateRankings(leaderboardResult.data || [], userId, profile)
    ]);
    const names = new Map(ranking.map(row => [row.userId, row.name]));
    const records = (closingResult.data || []).map(row => utils.normalizeClosing(row, names.get(row.user_id) || '', role === 'supervisor'));
    return { records, visits: visits.map(visit => ({ ...visit, staffName: names.get(visit.userId) || '' })), ranking };
  }
  async function fetchRankingPeriod(start, end) {
    const result = await requireClient().rpc('period_leaderboard', { period_start: start, period_end: end });
    if (result.error) throw result.error;
    return hydrateRankings(result.data || [], store.currentUser?.id, store.profile);
  }
  async function fetchStaffBreakdown(staffId, start, end) {
    const result = await requireClient().rpc('staff_closing_breakdown', { target_user_id: staffId, period_start: start, period_end: end });
    if (result.error) throw result.error;
    return result.data || [];
  }
  function closingPayload(formData, product) {
    return {
      closing_date: formData.get('date'),
      product: product.name,
      activity: product.fields.map((_, index) => formData.get(`f${index}`)).filter(Boolean).join(' · '),
      quantity: Number(formData.get('qty')),
      notes: formData.get('notes') || null
    };
  }
  async function createClosing(userId, payload) {
    const result = await requireClient().from('closings').insert({ user_id: userId, ...payload });
    if (result.error) throw result.error;
  }
  async function getClosing(id, userId) {
    const result = await requireClient().from('closings').select('id,closing_date,product,activity,quantity,notes').eq('id', id).eq('user_id', userId).single();
    if (result.error) throw result.error;
    return result.data;
  }
  async function updateClosing(id, userId, payload) {
    const result = await requireClient().from('closings').update(payload).eq('id', id).eq('user_id', userId);
    if (result.error) throw result.error;
  }
  async function deleteClosing(id, userId) {
    const result = await requireClient().from('closings').delete().eq('id', id).eq('user_id', userId);
    if (result.error) throw result.error;
  }
  async function preparePhoto(file) {
    const supported = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supported.includes(file.type)) throw new Error('Gunakan foto berformat JPG, PNG, atau WebP.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran foto awal maksimal 15 MB.');
    if (file.size <= 1.8 * 1024 * 1024) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let quality = 0.82;
    let blob;
    do {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      quality -= 0.12;
    } while (blob && blob.size > 4.5 * 1024 * 1024 && quality >= 0.34);
    if (!blob) throw new Error('Foto tidak dapat diproses.');
    if (blob.size > 5 * 1024 * 1024) throw new Error('Foto masih terlalu besar setelah dikompres.');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  }
  async function createVisit(userId, date, notes, sourceFile) {
    const file = await preparePhoto(sourceFile);
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await requireClient().storage.from('visit-photos').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error(`Gagal mengunggah foto: ${upload.error.message}`);
    const insert = await client.from('visits').insert({ user_id: userId, visit_date: date, notes: notes || 'Dokumentasi aktivitas lapangan', photo_path: path }).select('id,user_id,visit_date,notes,photo_path').single();
    if (insert.error) {
      await client.storage.from('visit-photos').remove([path]);
      throw new Error(`Gagal menyimpan dokumentasi: ${insert.error.message}`);
    }
    const signed = await client.storage.from('visit-photos').createSignedUrl(path, 3600);
    return {
      id: insert.data.id,
      userId: insert.data.user_id,
      rawDate: insert.data.visit_date,
      date: utils.formatDate(insert.data.visit_date),
      note: insert.data.notes,
      photoPath: path,
      photo: signed.data?.signedUrl || global.URL.createObjectURL(file)
    };
  }
  async function deleteVisit(id, photoPath) {
    const result = await requireClient().rpc('delete_my_visit_v2', { target_id: id });
    if (result.error) throw result.error;
    if (!result.data?.deleted || result.data.id !== id) throw new Error('Database tidak mengonfirmasi penghapusan dokumentasi.');
    const path = result.data.photo_path || photoPath;
    if (!path) return null;
    const removal = await client.storage.from('visit-photos').remove([path]);
    return removal.error || null;
  }
  async function updateAvatar(userId, oldPath, sourceFile) {
    const file = await preparePhoto(sourceFile);
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const upload = await requireClient().storage.from('profile-photos').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error(`Gagal mengunggah foto: ${upload.error.message || ''}`);
    const saved = await client.rpc('set_my_avatar_path', { target_path: path });
    if (saved.error) {
      await client.storage.from('profile-photos').remove([path]);
      throw new Error(`Gagal menyimpan profil: ${saved.error.message}`);
    }
    if (oldPath && oldPath !== path) await client.storage.from('profile-photos').remove([oldPath]);
  }
  async function fetchAdminUsers() {
    const result = await requireClient().from('profiles').select('id,full_name,nip,role,requested_role,area,created_at').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }
  async function approveSupervisor(userId) {
    const result = await requireClient().rpc('approve_supervisor', { target_user_id: userId });
    if (result.error) throw result.error;
  }
  function loadSheetJs() {
    if (global.XLSX) return Promise.resolve(global.XLSX);
    if (sheetJsPromise) return sheetJsPromise;
    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js';
      script.async = true;
      script.onload = () => global.XLSX ? resolve(global.XLSX) : reject(new Error('Library Excel tidak tersedia.'));
      script.onerror = () => reject(new Error('Gagal memuat library Excel. Periksa koneksi internet.'));
      document.head.appendChild(script);
    });
    return sheetJsPromise;
  }
  async function exportSupervisorData(start, end) {
    const [closingResult, staffResult, XLSX] = await Promise.all([
      requireClient().from('closings').select('closing_date,user_id,product,activity,quantity,notes').gte('closing_date', start).lte('closing_date', end).order('closing_date', { ascending: true }),
      client.from('profiles').select('id,full_name,nip,role').eq('role', 'staff'),
      loadSheetJs()
    ]);
    if (closingResult.error) throw closingResult.error;
    if (staffResult.error) throw staffResult.error;
    const staffMap = new Map(staffResult.data.map(row => [row.id, row]));
    const rows = closingResult.data.filter(row => staffMap.has(row.user_id)).map(row => {
      const staff = staffMap.get(row.user_id);
      return { Tanggal: row.closing_date, 'Nama Staff': staff.full_name, NIP: staff.nip || '', Produk: row.product, Aktivitas: row.activity || '', 'Jumlah Closing': Number(row.quantity), Keterangan: row.notes || '' };
    });
    const headers = ['Tanggal', 'Nama Staff', 'NIP', 'Produk', 'Aktivitas', 'Jumlah Closing', 'Keterangan'];
    const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    sheet['!cols'] = [{ wch: 13 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 32 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Pencapaian Staff');
    XLSX.writeFile(book, `pencapaian-tbr-${start}-${end}.xlsx`, { compression: true });
    return rows.length;
  }

  app.client = client;
  app.configured = configured;
  app.services = { fetchOwnProfile, signedAvatar, fetchMonthData, fetchRankingPeriod, fetchStaffBreakdown, closingPayload, createClosing, getClosing, updateClosing, deleteClosing, createVisit, deleteVisit, updateAvatar, fetchAdminUsers, approveSupervisor, exportSupervisorData };
})(window);
