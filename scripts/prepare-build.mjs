import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.join(process.cwd(), 'public');
fs.rmSync(path.join(publicDir, '_app'), { recursive: true, force: true });
fs.rmSync(path.join(publicDir, 'index.html'), { force: true });
console.log('Removed previous generated Vite output from public/.');
