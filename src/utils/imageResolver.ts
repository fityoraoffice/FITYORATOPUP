/**
 * Image resolver utility for CahyoStore
 * Handles safe image loading, live CDN resolution, and high-fidelity SVG placeholders.
 */

import { Product, DEFAULT_PRODUCT_ARTWORKS } from '../data/catalog';

const verifiedImageCache = new Map<string, boolean>();

/**
 * Checks if an image URL can be loaded without network or CORS errors
 */
export function canLoadImage(url: string, _minSize?: number, timeoutMs = 9000): Promise<boolean> {
  if (!url || typeof url !== 'string') return Promise.resolve(false);
  if (url.startsWith('data:image/svg+xml')) return Promise.resolve(true);

  if (verifiedImageCache.has(url)) {
    return Promise.resolve(verifiedImageCache.get(url)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        verifiedImageCache.set(url, false);
        resolve(false);
      }
    }, timeoutMs || 9000);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        verifiedImageCache.set(url, true);
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        verifiedImageCache.set(url, false);
        resolve(false);
      }
    };

    img.src = url;
  });
}

/**
 * Generates a clean, modern SVG data URI placeholder for products
 */
export function placeholderImage(productId: string, productName: string): string {
  // Tidak ada file ikon lokal: ikon utama dimuat dari platform online (lihat DEFAULT_PRODUCT_ARTWORKS).
  // Bila ikon online gagal dimuat, ilustrasi SVG di bawah dibuat langsung dari nama produk (tanpa file).
  const safeName = (productName || 'CahyoStore').trim();
  const initials = safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'CS';

  const hash = safeName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue1 = (hash * 37) % 360;
  const hue2 = (hue1 + 45) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 75%, 16%)"/>
        <stop offset="100%" stop-color="hsl(${hue2}, 85%, 8%)"/>
      </linearGradient>
      <radialGradient id="glowGrad" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="hsl(${hue1}, 90%, 55%)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="hsl(${hue2}, 90%, 20%)" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect width="400" height="400" rx="36" fill="url(#bgGrad)"/>
    <circle cx="200" cy="180" r="160" fill="url(#glowGrad)"/>
    <circle cx="200" cy="180" r="76" fill="#0f172a" stroke="hsl(${hue1}, 80%, 60%)" stroke-width="3" filter="url(#shadow)"/>
    <text x="200" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">
      ${initials}
    </text>
    <text x="200" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="#f8fafc" text-anchor="middle" opacity="0.95">
      ${safeName.length > 20 ? safeName.slice(0, 18) + '...' : safeName}
    </text>
    <text x="200" y="348" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="hsl(${hue1}, 80%, 75%)" text-anchor="middle" letter-spacing="2">
      OFFICIAL DIGITAL STORE
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves a live image for a catalog product.
 * Falls back to styled SVG artwork if the external CDN URL fails.
 */
export async function resolveLiveProductImage(
  product: Product,
  callback: (id: string, url: string, fit: 'cover' | 'contain') => void
): Promise<void> {
  if (!product || !product.id) return;

  if (product.image && typeof product.image === 'string') {
    if (product.image.startsWith('data:image/svg+xml')) {
      callback(product.id, product.image, product.imageFit || 'cover');
      return;
    }
    const works = await canLoadImage(product.image);
    if (works) {
      callback(product.id, product.image, product.imageFit || 'cover');
      return;
    }
  }

  // Ikon bawaan katalog (online). Bila gagal dimuat juga, pakai ilustrasi SVG buatan kode.
  try {
    const artwork = DEFAULT_PRODUCT_ARTWORKS[product.id];
    if (artwork && (artwork.startsWith('data:image/svg+xml') || (await canLoadImage(artwork)))) {
      callback(product.id, artwork, 'cover');
      return;
    }
  } catch {
    // jatuh ke ilustrasi buatan
  }
  callback(product.id, placeholderImage(product.id, product.name), 'cover');
}
