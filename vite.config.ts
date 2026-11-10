import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * Alamat situs untuk canonical/og:url/sitemap. Tidak ditanam permanen di kode:
 * 1) APP_URL (bila diisi), 2) domain produksi Vercel, 3) domain deploy Vercel, 4) kosong (relatif).
 * Dengan begitu mengganti domain nanti cukup mengubah APP_URL lalu deploy ulang.
 */
function resolveSiteUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  return raw.trim().replace(/\/+$/, '');
}

function siteUrlPlugin(): Plugin {
  const site = resolveSiteUrl();
  return {
    name: 'fityora-site-url',
    transformIndexHtml(html) {
      let out = html.replaceAll('%SITE_URL%', site);
      if (!site) {
        // Tanpa alamat pasti, jangan menulis tag absolut yang salah.
        out = out
          .replace(/\s*<meta property="og:url"[^>]*>/g, '')
          .replace(/\s*<meta property="og:image"[^>]*>/g, '')
          .replace(/\s*<meta name="twitter:image"[^>]*>/g, '')
          .replace(/\s*<link rel="canonical"[^>]*>/g, '');
      }
      return out;
    },
    closeBundle() {
      const publicDir = path.join(rootDir, 'public');
      if (!fs.existsSync(publicDir)) return;
      try {
        fs.writeFileSync(
          path.join(publicDir, 'robots.txt'),
          `User-agent: *\nAllow: /\nDisallow: /api/\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`
        );
        if (site) {
          fs.writeFileSync(
            path.join(publicDir, 'sitemap.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${site}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`
          );
        } else {
          fs.rmSync(path.join(publicDir, 'sitemap.xml'), { force: true });
        }
      } catch (error) {
        console.warn('[site-url] Gagal menulis robots/sitemap:', error);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss(), siteUrlPlugin()],
    build: { assetsDir: '_app/assets' },
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
  };
});
