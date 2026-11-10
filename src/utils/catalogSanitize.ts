import type { Product } from '../data/catalog';

/** Validasi katalog dari Author (murni, tanpa database): hanya bentuk Product yang dikenal, harga bilangan bulat. */
const MAX_PRODUCTS = 200;
const MAX_ITEMS_PER_PRODUCT = 400;
const MAX_PRICE = 100_000_000;
const CATEGORIES: Product['category'][] = ['game', 'pcgame', 'streaming', 'sosmed', 'digital', 'voucher', 'ewallet', 'pln'];

const text = (value: unknown, max: number, fallback = ''): string =>
  String(value ?? fallback).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) || fallback;

function cleanImage(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/') && raw.length <= 60_000) return raw;
  if (raw.length > 2000) return '';
  try {
    return /^https?:$/.test(new URL(raw).protocol) ? raw : '';
  } catch {
    return '';
  }
}

/** Validasi ketat: hanya bentuk Product yang dikenal, harga bilangan bulat 0..MAX_PRICE. */
export function sanitizeCatalog(input: unknown): Product[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_PRODUCTS) return null;
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Record<string, unknown>;
    const id = text(p.id, 60);
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(id) || seen.has(id)) return null;
    seen.add(id);
    const category = CATEGORIES.includes(p.category as Product['category']) ? (p.category as Product['category']) : 'game';
    if (!Array.isArray(p.items) || p.items.length > MAX_ITEMS_PER_PRODUCT) return null;
    const itemIds = new Set<string>();
    const items: Product['items'] = [];
    for (const rawItem of p.items) {
      const it = (rawItem || {}) as Record<string, unknown>;
      const itemId = text(it.id, 80);
      const price = Number(it.price);
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(itemId) || itemIds.has(itemId)) return null;
      if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) return null;
      itemIds.add(itemId);
      items.push({ id: itemId, name: text(it.name, 160, itemId), price });
    }
    const zoneLabel = text(p.zoneLabel, 80);
    out.push({
      id,
      name: text(p.name, 120, id),
      publisher: text(p.publisher, 120),
      category,
      image: cleanImage(p.image),
      imageFit: p.imageFit === 'contain' ? 'contain' : 'cover',
      hasZoneId: Boolean(p.hasZoneId),
      idLabel: text(p.idLabel, 120, 'ID Pengguna'),
      ...(zoneLabel ? { zoneLabel } : {}),
      items,
    });
  }
  return out;
}
