import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCatalog } from '../src/utils/catalogSanitize';

const valid = () => [{
  id: 'mlbb', name: 'Mobile Legends', publisher: 'Moonton', category: 'game',
  image: 'https://example.com/a.png', hasZoneId: true, idLabel: 'User ID',
  items: [{ id: 'dm86', name: '86 Diamonds', price: 20000 }],
}];

test('katalog valid diterima dan dirapikan', () => {
  const out = sanitizeCatalog(valid());
  assert.ok(out);
  assert.equal(out![0].items[0].price, 20000);
  assert.equal(out![0].imageFit, 'cover');
});

test('harga negatif, pecahan, atau terlalu besar ditolak', () => {
  for (const price of [-1, 10.5, 1e12, 'abc']) {
    const c = valid(); (c[0].items[0] as any).price = price;
    assert.equal(sanitizeCatalog(c), null, `price ${price}`);
  }
});

test('id duplikat / karakter berbahaya ditolak', () => {
  const dup = [...valid(), ...valid()];
  assert.equal(sanitizeCatalog(dup), null);
  const bad = valid(); bad[0].id = 'a b<script>';
  assert.equal(sanitizeCatalog(bad), null);
});

test('input bukan array atau kosong ditolak', () => {
  for (const v of [null, {}, 'x', [], undefined]) assert.equal(sanitizeCatalog(v as any), null);
});

test('gambar javascript: dibuang, URL https dipertahankan', () => {
  const c = valid(); c[0].image = 'javascript:alert(1)';
  assert.equal(sanitizeCatalog(c)![0].image, '');
  const d = valid(); d[0].image = 'https://cdn.example.com/x.webp';
  assert.equal(sanitizeCatalog(d)![0].image, 'https://cdn.example.com/x.webp');
});

test('kategori tak dikenal dikembalikan ke game', () => {
  const c = valid(); (c[0] as any).category = 'hack';
  assert.equal(sanitizeCatalog(c)![0].category, 'game');
});
