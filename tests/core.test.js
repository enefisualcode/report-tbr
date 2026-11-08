const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../js/core/core.js');

test('escapeHtml escapes unsafe markup', () => {
  assert.equal(utils.escapeHtml('<a href="x">Tom & Jerry</a>'), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;');
});

test('month boundaries handle leap years', () => {
  assert.equal(utils.monthStart('2024-02'), '2024-02-01');
  assert.equal(utils.monthEnd('2024-02'), '2024-02-29');
});

test('ranking periods stay inside the selected month', () => {
  assert.deepEqual(utils.rankingPeriodBounds('2026-11', 'daily', '2026-12-10'), ['2026-11-30', '2026-11-30']);
  assert.deepEqual(utils.rankingPeriodBounds('2026-11', 'monthly', '2026-11-08'), ['2026-11-01', '2026-11-30']);
});

test('normalizeClosing preserves legacy data fields', () => {
  const row = utils.normalizeClosing({ id: '1', user_id: 'u1', closing_date: '2026-11-08', product: 'QRIS', activity: 'Registrasi baru', quantity: 2, notes: 'Toko' }, 'Siti', true);
  assert.equal(row.qty, 2);
  assert.equal(row.activity, 'Registrasi baru');
  assert.match(row.detail, /Siti.*Registrasi baru.*Toko/);
});

test('history filter combines product and quantity filters', () => {
  const rows = [{ product: 'QRIS', qty: 2, rawDate: '2026-11-08', detail: 'Registrasi baru', staffName: 'A' }, { product: 'EDC', qty: 1, rawDate: '2026-11-08', detail: 'Pemasangan baru', staffName: 'B' }];
  const filters = { date: '', staff: '', product: 'QRIS', activity: '', qty: '2', status: '' };
  assert.deepEqual(utils.filterHistoryRecords(rows, filters, '', false), [rows[0]]);
});

test('productTotals sums quantities without changing records', () => {
  const products = [{ name: 'QRIS' }, { name: 'EDC' }];
  assert.deepEqual(utils.productTotals([{ product: 'QRIS', qty: 2 }, { product: 'QRIS', qty: 3 }, { product: 'EDC', qty: 1 }], products), [{ name: 'QRIS', total: 5 }, { name: 'EDC', total: 1 }]);
});
