import { INITIAL_PRODUCTS_DATA, DEFAULT_PRODUCT_ARTWORKS, type Product } from '../data/catalog';

/**
 * Katalog & harga disimpan di server (sumber kebenaran). Browser hanya menyimpan salinan
 * cadangan di localStorage agar toko tetap tampil bila jaringan putus sesaat.
 */
const ADMIN_TOKEN_STORAGE_KEY = 'cahyo_admin_token_v1';

export interface RemoteCatalog {
  products: Product[];
  custom: boolean; // false = server belum punya katalog tersimpan (masih bawaan)
  updatedAt: string | null;
}

/** Pulihkan gambar bawaan (tidak ikut disimpan ke server) dan rapikan bentuk produk. */
export function normalizeProducts(list: Product[]): Product[] {
  return list
    .filter((p) => p && p.id && p.id !== 'ffmax')
    .map((p) => {
      const fresh = INITIAL_PRODUCTS_DATA.find((x) => x.id === p.id);
      return {
        ...p,
        image: (fresh && fresh.image) || DEFAULT_PRODUCT_ARTWORKS[p.id] || p.image || '',
        imageFit: 'cover' as const
      };
    });
}

export async function fetchCatalog(): Promise<RemoteCatalog | null> {
  try {
    const res = await fetch('/api/catalog', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.products) || data.products.length === 0) return null;
    return {
      products: normalizeProducts(data.products),
      custom: Boolean(data.custom),
      updatedAt: data.updatedAt || null
    };
  } catch {
    return null;
  }
}

/** Gambar bawaan tidak dikirim (besar & bisa dipulihkan dari kode); hanya gambar URL kustom. */
function stripBuiltInImages(list: Product[]): Product[] {
  return list.map((p) => {
    const builtIn = INITIAL_PRODUCTS_DATA.find((x) => x.id === p.id)?.image || DEFAULT_PRODUCT_ARTWORKS[p.id];
    const isBuiltIn = !p.image || p.image === builtIn || p.image.startsWith('data:image/svg');
    return { ...p, image: isBuiltIn ? '' : p.image };
  });
}

/** Berhasil hanya untuk Author yang sedang login (server menolak selain itu). */
export async function pushCatalog(list: Product[]): Promise<boolean> {
  try {
    let token = '';
    try {
      token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
    } catch {
      // ignore
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }
    const res = await fetch('/api/admin/catalog', {
      method: 'PUT',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ products: stripBuiltInImages(list) })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Sidik jari sederhana untuk membandingkan dua katalog (id, nama, harga). */
export function catalogSignature(list: Product[]): string {
  return list
    .map((p) => `${p.id}|${p.name}|${p.category}|${p.image}|${p.items.map((i) => `${i.id}:${i.name}:${i.price}`).join(',')}`)
    .join(';');
}
