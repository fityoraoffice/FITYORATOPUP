import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiCatalogSummary, validateAiRecommendations } from '../src/utils/aiCatalogGuard';
import type { Product } from '../src/data/catalog';

const catalog: Product[] = [{
  id: 'ff', name: 'Free Fire', publisher: 'Garena', category: 'game', image: '',
  hasZoneId: false, idLabel: 'UID',
  items: [
    { id: 'ff-5', name: '5 Diamonds', price: 1500 },
    { id: 'ff-zero', name: 'Nominal belum diatur', price: 0 }
  ]
}];

test('AI catalog summary hanya memuat field publik katalog', () => {
  const summary = buildAiCatalogSummary(catalog);
  assert.deepEqual(summary[0].items[0], { itemId: 'ff-5', itemName: '5 Diamonds', price: 1500 });
  assert.equal('supplierPrice' in summary[0].items[0], false);
});

test('rekomendasi mengabaikan harga model dan memakai harga server', () => {
  const result = validateAiRecommendations({ recommendations: [
    { productId: 'ff', itemId: 'ff-5', price: 1, reason: 'Pilihan cocok' }
  ] }, catalog, 1500);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].price, 1500);
  assert.equal(result.recommendations[0].itemName, '5 Diamonds');
});

test('rekomendasi Rp 0, ID palsu, duplikat, dan item di luar budget dibuang', () => {
  const result = validateAiRecommendations({ recommendations: [
    { productId: 'ff', itemId: 'ff-zero' },
    { productId: 'other', itemId: 'ff-5' },
    { productId: 'ff', itemId: 'ff-5' },
    { productId: 'ff', itemId: 'ff-5' }
  ] }, catalog, 1000);
  assert.equal(result.recommendations.length, 0);
});

test('pro tip tidak dapat membuat klaim pembayaran gratis dari model', () => {
  const result = validateAiRecommendations({ proTip: 'Gratis 100% dan otomatis terverifikasi' }, catalog, 5000);
  assert.match(result.proTip, /diperiksa manual oleh Author/i);
});
