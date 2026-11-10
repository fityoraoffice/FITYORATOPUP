// Membuat sepasang kunci VAPID untuk notifikasi push. Jalankan sekali: node scripts/generate-vapid-keys.mjs
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pubJwk = publicKey.export({ format: 'jwk' });
const prvJwk = privateKey.export({ format: 'jwk' });
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const pub = Buffer.concat([Buffer.from([4]), fromB64u(pubJwk.x), fromB64u(pubJwk.y)]);

console.log('Tambahkan ketiga nilai ini sebagai Environment Variable (server-only) di Vercel:\n');
console.log(`VAPID_PUBLIC_KEY=${b64u(pub)}`);
console.log(`VAPID_PRIVATE_KEY=${prvJwk.d}`);
console.log('VAPID_SUBJECT=mailto:emailanda@contoh.com');
console.log('\nJangan bagikan VAPID_PRIVATE_KEY. Setelah mengisi env, deploy ulang.');
