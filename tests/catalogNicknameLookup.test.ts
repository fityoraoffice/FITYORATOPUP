import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTarget } from '../src/utils/targetVerification';

const cases: Array<[string, string, boolean]> = [
  ['codm', 'cod', false],
  ['ff', 'ff', false],
  ['genshin', 'gi', false],
  ['hsr', 'hsr', false],
  ['magicchess', 'mcgg', true],
  ['mlbb', 'ml', true],
  ['pointblank', 'pb', false],
  ['supersus', 'sus', false],
  ['valorant', 'valo', false],
  ['zzz', 'zzz', false],
];

test('game katalog yang didukung memakai endpoint nickname provider yang sesuai', async () => {
  for (const [productId, slug, needsZone] of cases) {
    let requestedUrl = '';
    const mockFetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ success: true, name: 'Nama•Uji' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const zoneId = needsZone ? '13486' : undefined;
    const result = await verifyTarget({ productId, userId: '123456789', zoneId }, mockFetch);
    const url = new URL(requestedUrl);
    assert.equal(url.pathname, `/nickname/${slug}`);
    assert.equal(url.searchParams.get('id'), '123456789');
    if (needsZone) assert.ok(url.searchParams.get('zone') || url.searchParams.get('server'));
    assert.equal(result.level, 'confirmed', productId);
    assert.equal(result.accountName, 'Nama•Uji', productId);
  }
});

test('game katalog tanpa rute provider tetap format_only dan tidak mengarang nickname', async () => {
  let calls = 0;
  const mockFetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ success: true, name: 'Nama Palsu' }), { status: 200 });
  }) as typeof fetch;
  for (const productId of ['fcmobile', 'hok', 'pubg', 'efootball', 'steam', 'psn']) {
    const result = await verifyTarget({ productId, userId: '123456789' }, mockFetch);
    assert.equal(result.level, 'format_only', productId);
    assert.match(result.accountName || '', /^ID:/);
  }
  assert.equal(calls, 0);
});

test('lookup nickname yang gagal tetap format_only tanpa nama buatan', async () => {
  const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
  const result = await verifyTarget({ productId: 'ff', userId: '7715033898' }, offline);
  assert.equal(result.level, 'format_only');
  assert.equal(result.accountName, 'ID: 7715033898');
});

test('lookup e-wallet memakai kode dompet dari item katalog dan nama dari respons provider', async () => {
  const cases: Array<[string, string]> = [
    ['Saldo DANA 20.000', 'dana'],
    ['Saldo OVO 50.000', 'ovo'],
    ['Saldo GoPay 100.000', 'gopay'],
    ['Saldo ShopeePay 50.000', 'shopeepay'],
    ['Saldo LinkAja 50.000', 'linkaja'],
  ];

  for (const [itemName, code] of cases) {
    let requestUrl = '';
    let requestBody: any = null;
    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ data: { account_holder: 'NAMA UJI' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const result = await verifyTarget({
      productId: 'ewallet',
      category: 'ewallet',
      itemName,
      userId: '081234567890',
    }, mockFetch);

    assert.equal(requestUrl, 'https://cekrekening-api.belibayar.online/api/v1/account-inquiry');
    assert.equal(requestBody.account_bank, code);
    assert.equal(requestBody.account_number, '081234567890');
    assert.equal(result.level, 'confirmed', itemName);
    assert.equal(result.accountName, 'NAMA UJI', itemName);
  }
});

test('lookup e-wallet tanpa item yang dikenali tidak memanggil provider', async () => {
  let calls = 0;
  const mockFetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ data: { account_holder: 'NAMA UJI' } }), { status: 200 });
  }) as typeof fetch;

  const result = await verifyTarget({
    productId: 'ewallet',
    category: 'ewallet',
    userId: '081234567890',
  }, mockFetch);

  assert.equal(calls, 0);
  assert.equal(result.level, 'format_only');
  assert.ok((result.regionOrInfo || '').includes('Pilih nominal/produk e-wallet'));
});

test('lookup e-wallet saat provider gagal tetap format_only tanpa nama buatan', async () => {
  const offline = (async () => new Response('Service unavailable', { status: 503 })) as typeof fetch;
  const result = await verifyTarget({
    productId: 'ewallet',
    category: 'ewallet',
    itemName: 'Saldo DANA 20.000',
    userId: '081234567890',
  }, offline);

  assert.equal(result.valid, true);
  assert.equal(result.level, 'format_only');
  assert.equal(result.accountName, 'Nomor tujuan: 081234567890');
  assert.doesNotMatch(result.accountName || '', /NAMA UJI/);
});
