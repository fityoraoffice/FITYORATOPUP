import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { buildVapidAuthorization, verifyVapidJwt, isAllowedPushEndpoint, loadVapidConfig, sendEmptyPush, type VapidConfig } from '../src/utils/webPush';

const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function makeCfg(): VapidConfig {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pj = publicKey.export({ format: 'jwk' }) as any;
  const sj = privateKey.export({ format: 'jwk' }) as any;
  const pub = Buffer.concat([Buffer.from([4]), fromB64u(pj.x), fromB64u(pj.y)]);
  return { publicKey: b64u(pub), privateKey: sj.d, subject: 'mailto:test@example.com' };
}

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

test('header VAPID berisi JWT bertanda tangan valid & audience benar', () => {
  const cfg = makeCfg();
  const header = buildVapidAuthorization(ENDPOINT, cfg, 1_000_000);
  const m = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m);
  assert.equal(m![2], cfg.publicKey);
  assert.equal(verifyVapidJwt(m![1], cfg.publicKey), true);
  const claims = JSON.parse(fromB64u(m![1].split('.')[1]).toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'mailto:test@example.com');
  assert.equal(claims.exp, 1_000_000 + 43200);
});

test('tanda tangan dengan kunci lain ditolak', () => {
  const header = buildVapidAuthorization(ENDPOINT, makeCfg());
  const jwt = header.match(/t=([^,]+)/)![1];
  assert.equal(verifyVapidJwt(jwt, makeCfg().publicKey), false);
});

test('hanya endpoint push resmi (https) yang diizinkan', () => {
  assert.equal(isAllowedPushEndpoint(ENDPOINT), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/x'), true);
  assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/x'), false);
  assert.equal(isAllowedPushEndpoint('https://evil.example.com/x'), false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x'), false);
  assert.equal(isAllowedPushEndpoint('http://169.254.169.254/'), false);
});

test('konfigurasi VAPID: kosong/rusak = nonaktif', () => {
  assert.equal(loadVapidConfig({} as any), null);
  assert.equal(loadVapidConfig({ VAPID_PUBLIC_KEY: 'abc', VAPID_PRIVATE_KEY: 'def' } as any), null);
  const cfg = makeCfg();
  assert.ok(loadVapidConfig({ VAPID_PUBLIC_KEY: cfg.publicKey, VAPID_PRIVATE_KEY: cfg.privateKey } as any));
});

test('sendEmptyPush: 201 = sent, 410 = gone, error jaringan = failed, payload kosong', async () => {
  const cfg = makeCfg();
  const sub = { endpoint: ENDPOINT, p256dh: 'x', auth: 'y' };
  let seen: any = null;
  const ok = (async (_u: any, init: any) => { seen = init; return new Response(null, { status: 201 }); }) as typeof fetch;
  assert.equal(await sendEmptyPush(sub, cfg, ok), 'sent');
  assert.equal(seen.body, undefined);
  assert.match(seen.headers.Authorization, /^vapid t=/);
  assert.equal(await sendEmptyPush(sub, cfg, (async () => new Response(null, { status: 410 })) as typeof fetch), 'gone');
  assert.equal(await sendEmptyPush(sub, cfg, (async () => new Response(null, { status: 500 })) as typeof fetch), 'failed');
  assert.equal(await sendEmptyPush(sub, cfg, (async () => { throw new Error('net'); }) as typeof fetch), 'failed');
  assert.equal(await sendEmptyPush({ ...sub, endpoint: 'https://evil.example.com/x' }, cfg, ok), 'gone');
});
