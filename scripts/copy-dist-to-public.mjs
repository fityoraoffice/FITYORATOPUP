import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const indexSource = path.join(dist, 'index.html');
const assetsSource = path.join(dist, '_app');

if (!fs.existsSync(indexSource)) {
  throw new Error('Build Vite gagal: dist/index.html tidak ditemukan.');
}
if (!fs.existsSync(assetsSource)) {
  throw new Error('Build Vite gagal: dist/_app tidak ditemukan.');
}

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(indexSource, path.join(publicDir, 'index.html'));
const publicAssets = path.join(publicDir, '_app');
fs.rmSync(publicAssets, { recursive: true, force: true });
fs.cpSync(assetsSource, publicAssets, { recursive: true });
console.log('Vite index and versioned app assets copied to public/ for Vercel CDN serving.');
