import test from 'node:test';
import assert from 'node:assert/strict';
import { findPricedItem, normalizeUniqueCode, calculateExpectedTotal, totalMatches } from '../src/utils/orderPricing';
import type { Product } from '../src/data/catalog';

const catalog = [
  { id: 'mlbb', name: 'Mobile Legends', publisher: 'Moonton', category: 'game', image: '', hasZoneId: true, idLabel: 'User ID', items: [
    { id: 'dm86', name: '86 Diamonds', price: 20000 },
    { id: 'free', name: 'Belum diatur', price: 0 },
  ] },
] as unknown as Product[];

test('harga diambil dari katalog server', () => {
  const r = findPricedItem(catalog, 'mlbb', 'dm86');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.item.price, 20000);
});

test('produk/item tidak dikenal ditolak', () => {
  assert.deepEqual(findPricedItem(catalog, 'x', 'dm86'), { ok: false, reason: 'not_found' });
  assert.deepEqual(findPricedItem(catalog, 'mlbb', 'nope'), { ok: false, reason: 'not_found' });
});

test('item berharga 0 tidak bisa dipesan', () => {
  const r = findPricedItem(catalog, 'mlbb', 'free');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'no_price');
});

test('kode unik hanya 0..999 bilangan bulat', () => {
  assert.equal(normalizeUniqueCode(123), 123);
  assert.equal(normalizeUniqueCode('45'), 45);
  for (const bad of [-1, 1000, 1.5, 'abc', null, undefined, NaN]) assert.equal(normalizeUniqueCode(bad), 0);
});

test('total = subtotal + biaya + kode unik', () => {
  assert.equal(calculateExpectedTotal(20000, 700, 123), 20823);
});

test('total dari browser harus persis sama', () => {
  assert.equal(totalMatches('Rp 20.823', 20823), true);
  assert.equal(totalMatches(20823, 20823), true);
  assert.equal(totalMatches('Rp 100', 20823), false); // harga dimanipulasi
  assert.equal(totalMatches('', 20823), false);
  assert.equal(totalMatches(undefined, 20823), false);
});
