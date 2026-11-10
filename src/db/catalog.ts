import { pool } from './index.js';
import { INITIAL_PRODUCTS_DATA, type Product } from '../data/catalog.js';
import { sanitizeCatalog } from '../utils/catalogSanitize.js';

export { sanitizeCatalog };

/**
 * Katalog & harga yang diatur Author disimpan di server (tabel custom_products, satu baris).
 * Server memakai katalog ini untuk MENAMPILKAN produk ke pembeli dan untuk MEMVALIDASI total order,
 * sehingga yang dilihat pembeli selalu sama dengan yang ditagih server.
 * Tanpa katalog tersimpan, katalog bawaan (INITIAL_PRODUCTS_DATA) dipakai.
 */
const CATALOG_ROW_ID = '__catalog_v1__';
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS public.custom_products (
          id text PRIMARY KEY,
          data_json text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady!;
}

export async function loadCustomCatalog(): Promise<{ products: Product[]; updatedAt: string | null } | null> {
  await ensureTable();
  const result = await pool.query('select data_json, updated_at from public.custom_products where id = $1 limit 1', [CATALOG_ROW_ID]);
  const row = result.rows[0];
  if (!row) return null;
  try {
    const products = sanitizeCatalog(JSON.parse(row.data_json));
    if (!products) return null;
    return { products, updatedAt: new Date(row.updated_at).toISOString() };
  } catch {
    return null;
  }
}

export async function saveCustomCatalog(products: Product[]): Promise<string> {
  await ensureTable();
  const result = await pool.query(
    `insert into public.custom_products (id, data_json, updated_at) values ($1, $2, now())
     on conflict (id) do update set data_json = excluded.data_json, updated_at = now()
     returning updated_at`,
    [CATALOG_ROW_ID, JSON.stringify(products)]
  );
  invalidateCatalogCache();
  return new Date(result.rows[0].updated_at).toISOString();
}

let cache: { at: number; value: { products: Product[]; custom: boolean; updatedAt: string | null } } | null = null;
const CACHE_MS = 10_000;

export function invalidateCatalogCache() {
  cache = null;
}

/** Katalog yang berlaku: simpanan Author bila ada, jika tidak katalog bawaan. */
export async function getEffectiveCatalog(): Promise<{ products: Product[]; custom: boolean; updatedAt: string | null }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const saved = await loadCustomCatalog();
  const value = saved
    ? { products: saved.products, custom: true, updatedAt: saved.updatedAt }
    : { products: INITIAL_PRODUCTS_DATA, custom: false, updatedAt: null };
  cache = { at: Date.now(), value };
  return value;
}
