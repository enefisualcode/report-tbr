(() => {
  const monthInput = document.getElementById('monthFilter');
  if (!monthInput) return;

  const updatePeriodLabels = () => {
    const value = window.tbrState?.month || monthInput.value;
    if (!value) return;
    document.querySelectorAll('[data-current-month]').forEach((el) => {
      el.textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
        .format(new Date(`${value}-01T12:00:00`));
    });
  };

  monthInput.value = new Date().toLocaleDateString('en-CA').slice(0, 7);
  monthInput.addEventListener('change', async () => {
    if (!monthInput.value || !window.tbrLoadMonth) return;
    monthInput.disabled = true;
    try {
      await window.tbrLoadMonth(monthInput.value);
      updatePeriodLabels();
    } catch (error) {
      alert(`Gagal memuat laporan: ${error.message}`);
    } finally {
      monthInput.disabled = false;
    }
  });
  window.tbrUpdatePeriodLabels = updatePeriodLabels;
})();

