import type { Product } from '../data/catalog';

/** Aturan harga order yang dipakai server: harga selalu dari katalog server, bukan dari browser. */
export function findPricedItem(catalog: Product[], productId: string, itemId: string) {
  const product = catalog.find((p) => p.id === productId);
  const item = product?.items.find((i) => i.id === itemId);
  if (!product || !item) return { ok: false as const, reason: 'not_found' as const };
  if (item.price <= 0) return { ok: false as const, reason: 'no_price' as const, item };
  return { ok: true as const, product, item };
}

/** Kode unik valid hanya bilangan bulat 0..999; selain itu dianggap 0. */
export function normalizeUniqueCode(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : 0;
}

export function calculateExpectedTotal(subtotal: number, fee: number, uniqueCode: number): number {
  return subtotal + fee + uniqueCode;
}

/** Total yang dikirim browser harus persis sama dengan hitungan server. */
export function totalMatches(postedRaw: unknown, expected: number): boolean {
  const posted = Number(String(postedRaw ?? '').replace(/[^0-9]/g, ''));
  return Number.isSafeInteger(posted) && posted === expected;
}
