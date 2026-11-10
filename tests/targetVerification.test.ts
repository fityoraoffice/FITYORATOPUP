import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTarget } from '../src/utils/targetVerification';

const down = (async () => { throw new Error('offline'); }) as typeof fetch;
const json = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

test('game: lookup gagal TIDAK mengarang nama, hanya format_only', async () => {
  const r = await verifyTarget({ productId: 'mlbb', userId: '123456789', zoneId: '1234', hasZoneId: true }, down);
  assert.equal(r.level, 'format_only');
  assert.equal(r.accountName, 'ID: 123456789 (1234)');
  assert.doesNotMatch(JSON.stringify(r), /Official|Gateway|TERVERIFIKASI|Garuda|Sultan/i);
});

test('game: nama dari penyedia = confirmed', async () => {
  const r = await verifyTarget({ productId: 'mlbb', userId: '123456789', zoneId: '1234', hasZoneId: true }, json({ success: true, name: 'RealPlayer' }));
  assert.equal(r.level, 'confirmed');
  assert.equal(r.accountName, 'RealPlayer');
});

test('game: respons penyedia tanpa nama = format_only', async () => {
  const r = await verifyTarget({ productId: 'ff', userId: '123456789' }, json({ success: false }));
  assert.equal(r.level, 'format_only');
});

test('game tanpa penyedia (mis. pointblank) = format_only, bukan terverifikasi', async () => {
  const r = await verifyTarget({ productId: 'pointblank', userId: 'abc123' }, down);
  assert.equal(r.level, 'format_only');
});

test('zone wajib & angka berulang ditolak', async () => {
  assert.equal((await verifyTarget({ productId: 'mlbb', userId: '123456789', hasZoneId: true }, down)).level, 'invalid');
  assert.equal((await verifyTarget({ productId: 'mlbb', userId: '1111111111', zoneId: '1', hasZoneId: true }, down)).level, 'invalid');
});

test('nomor HP: format_only, tidak mengaku jaringan aktif/KYC', async () => {
  const r = await verifyTarget({ productId: 'pulsa', userId: '+62 812-3456-7890' }, down);
  assert.equal(r.level, 'format_only');
  assert.equal(r.accountName, 'Nomor tujuan: 081234567890');
  assert.doesNotMatch(JSON.stringify(r), /KYC|HLR|4G|Terdaftar|TERVERIFIKASI/i);
  assert.equal((await verifyTarget({ productId: 'pulsa', userId: '12345' }, down)).level, 'invalid');
});

test('e-wallet: tidak mengarang nama pemilik', async () => {
  const r = await verifyTarget({ productId: 'ewallet', productName: 'DANA', userId: '081234567890' }, down);
  assert.equal(r.level, 'format_only');
  assert.match(r.regionOrInfo!, /tidak dapat dicek/);
});

test('PLN: tidak mengarang tarif/daya, menampilkan nomor yang diketik', async () => {
  const r = await verifyTarget({ productId: 'pln', userId: '14234567890' }, down);
  assert.equal(r.level, 'format_only');
  assert.doesNotMatch(JSON.stringify(r), /\bVA\b|Tarif|Resmi|Stand Meter/);
  assert.equal((await verifyTarget({ productId: 'pln', userId: '123' }, down)).level, 'invalid');
});

test('Roblox: ditemukan = confirmed, tidak ada = invalid, offline = format_only', async () => {
  const ok = await verifyTarget({ productId: 'roblox', userId: 'builderman' }, json({ data: [{ id: 156, name: 'builderman', displayName: 'builderman' }] }));
  assert.equal(ok.level, 'confirmed');
  const none = await verifyTarget({ productId: 'roblox', userId: 'zzzznotreal' }, json({ data: [] }));
  assert.equal(none.level, 'invalid');
  assert.equal(none.valid, false);
  const off = await verifyTarget({ productId: 'roblox', userId: 'builderman' }, down);
  assert.equal(off.level, 'format_only');
});

test('kosong = invalid', async () => {
  assert.equal((await verifyTarget({ productId: 'mlbb', userId: '  ' }, down)).level, 'invalid');
});
