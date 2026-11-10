import { createPrivateKey, createPublicKey, createSign, createVerify, type KeyObject } from 'node:crypto';

/**
 * Web Push (VAPID, RFC 8292) tanpa dependensi tambahan.
 * Pesan dikirim TANPA isi (payload kosong): layanan push pihak ketiga tidak pernah menerima data
 * pesanan/pembeli. Service worker menampilkan teks tetap, lalu dashboard memuat data lewat sesi Author.
 */

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  publicKey: string; // base64url, titik P-256 tak terkompresi (65 byte)
  privateKey: string; // base64url, skalar d (32 byte)
  subject: string; // mailto:... atau https://...
}

/** Hanya layanan push browser resmi yang diizinkan (mencegah endpoint arbitrer / SSRF). */
const ALLOWED_PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function loadVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(env.VAPID_PRIVATE_KEY || '').trim();
  if (!publicKey || !privateKey) return null;
  if (fromB64url(publicKey).length !== 65 || fromB64url(privateKey).length !== 32) return null;
  const subject = String(env.VAPID_SUBJECT || '').trim() || `mailto:${String(env.ADMIN_EMAIL || 'admin@example.com').trim()}`;
  return { publicKey, privateKey, subject };
}

function toPrivateKeyObject(cfg: VapidConfig): KeyObject {
  const pub = fromB64url(cfg.publicKey);
  return createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: cfg.privateKey,
    },
    format: 'jwk',
  });
}

/** Header Authorization VAPID untuk satu endpoint push. */
export function buildVapidAuthorization(endpoint: string, cfg: VapidConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: audience, exp: nowSeconds + 12 * 60 * 60, sub: cfg.subject }));
  const signingInput = `${header}.${claims}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  const signature = signer.sign({ key: toPrivateKeyObject(cfg), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${signingInput}.${b64url(signature)}, k=${cfg.publicKey}`;
}

/** Untuk pengujian: verifikasi tanda tangan JWT VAPID dengan kunci publik. */
export function verifyVapidJwt(jwt: string, publicKeyB64url: string): boolean {
  const [h, c, sig] = jwt.split('.');
  if (!h || !c || !sig) return false;
  const pub = fromB64url(publicKeyB64url);
  const key = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const verifier = createVerify('SHA256');
  verifier.update(`${h}.${c}`);
  return verifier.verify({ key, dsaEncoding: 'ieee-p1363' }, fromB64url(sig));
}

export type PushResult = 'sent' | 'gone' | 'failed';

/** Kirim satu "ketukan" push kosong. 'gone' = langganan sudah tidak berlaku dan harus dihapus. */
export async function sendEmptyPush(
  sub: PushSubscriptionRecord,
  cfg: VapidConfig,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000
): Promise<PushResult> {
  if (!isAllowedPushEndpoint(sub.endpoint)) return 'gone';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: buildVapidAuthorization(sub.endpoint, cfg),
        TTL: '3600',
        Urgency: 'high',
        'Content-Length': '0',
      },
      signal: controller.signal,
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}
