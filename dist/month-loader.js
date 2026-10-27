hydrateVisitPhotos = async function hydrateVisitPhotosForMonth(rows) {
  const start = monthStart(state.month);
  const end = monthEnd(state.month);
  const filtered = rows.filter((row) => row.visit_date >= start && row.visit_date <= end);
  const paths = filtered.map((row) => row.photo_path).filter(Boolean);
  if (!paths.length) return filtered.map((row) => ({ userId: row.user_id, rawDate: row.visit_date, date: formatDate(row.visit_date), note: row.notes, photo: '' }));
  const signed = await db.storage.from('visit-photos').createSignedUrls(paths, 3600);
  const urls = new Map((signed.data || []).map((item) => [item.path, item.signedUrl || '']));
  return filtered.map((row) => ({ userId: row.user_id, rawDate: row.visit_date, date: formatDate(row.visit_date), note: row.notes, photo: row.photo_path ? urls.get(row.photo_path) || '' : '' }));
};

window.tbrLoadMonth = async function loadMonth(month) {
  const start = monthStart(month);
  const end = monthEnd(month);
  state.month = month;
  window.tbrState.month = month;
  document.body.classList.add('loading');
  try {
    const [closingResult, visitResult, leaderboardResult] = await Promise.all([
      db.from('closings').select('id,user_id,closing_date,product,activity,quantity,notes')
        .gte('closing_date', start).lte('closing_date', end).order('closing_date', { ascending: false }),
      db.from('visits').select('id,user_id,visit_date,notes,photo_path')
        .gte('visit_date', start).lte('visit_date', end).order('visit_date', { ascending: false }).limit(100),
      db.rpc('monthly_leaderboard', { month_start: start })
    ]);
    if (closingResult.error) throw closingResult.error;
    if (visitResult.error) throw visitResult.error;
    if (leaderboardResult.error) throw leaderboardResult.error;

    const [hydratedVisits, hydratedRanking] = await Promise.all([
      hydrateVisitPhotos(visitResult.data),
      hydrateRankingAvatars(leaderboardResult.data)
    ]);
    const staffNames = new Map(hydratedRanking.map((row) => [row.userId, row.name]));
    records = closingResult.data.map((row) => ({
      id: row.id, userId: row.user_id, rawDate: row.closing_date, date: formatDate(row.closing_date),
      product: row.product,
      detail: [state.role === 'supervisor' ? staffNames.get(row.user_id) : null, row.activity, row.notes].filter(Boolean).join(' · '),
      qty: row.quantity
    }));
    ranking = hydratedRanking;
    visits = hydratedVisits.map((visit) => ({ ...visit, staffName: staffNames.get(visit.userId) || '' }));
    document.querySelectorAll('[data-current-month]').forEach((el) => { el.textContent = formatMonth(month); });
    render();
  } finally {
    document.body.classList.remove('loading');
  }
};

const originalRender = render;
render = function renderWithIdentity() {
  originalRender();
  const name = profile?.full_name || currentUser?.email || 'Staff';
  const status = roleStatus();
  const dashboardName = document.getElementById('dashboardName');
  const dashboardRole = document.getElementById('dashboardRoleLabel');
  if (dashboardName) dashboardName.textContent = name;
  if (dashboardRole) dashboardRole.textContent = status.label;
  const monthInput = document.getElementById('monthFilter');
  if (monthInput) monthInput.value = state.month;
  document.querySelectorAll('[data-current-month]').forEach((el) => { el.textContent = formatMonth(state.month); });
};
