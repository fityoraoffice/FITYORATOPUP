import type { Product } from '../data/catalog';

export interface AiCatalogSummary {
  productId: string;
  productName: string;
  category: string;
  items: Array<{ itemId: string; itemName: string; price: number }>;
}

export interface ValidatedAiRecommendation {
  productId: string;
  productName: string;
  itemId: string;
  itemName: string;
  price: number;
  valueScore: string;
  reason: string;
}

export interface ValidatedAiRecommendationResponse {
  headline: string;
  strategySummary: string;
  recommendations: ValidatedAiRecommendation[];
  proTip: string;
}

function cleanText(value: unknown, max: number, fallback: string): string {
  const result = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return result || fallback;
}

/** Tidak pernah mengirim biaya supplier atau data privat ke model AI. */
export function buildAiCatalogSummary(products: Product[]): AiCatalogSummary[] {
  return products.map((product) => ({
    productId: product.id,
    productName: product.name,
    category: product.category,
    items: product.items.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      price: item.price
    }))
  }));
}

/**
 * Output model dianggap tidak tepercaya. ID harus cocok persis dan nama/harga selalu
 * diambil ulang dari katalog server; item Rp 0, duplikat, dan harga di luar budget dibuang.
 */
export function validateAiRecommendations(
  raw: unknown,
  products: Product[],
  budget: number
): ValidatedAiRecommendationResponse {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const candidates = Array.isArray(source.recommendations) ? source.recommendations : [];
  const seen = new Set<string>();
  const recommendations: ValidatedAiRecommendation[] = [];
  const maxPrice = Math.ceil(budget * 1.15);

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const row = candidate as Record<string, unknown>;
    const productId = String(row.productId ?? '').trim();
    const itemId = String(row.itemId ?? '').trim();
    const product = products.find((entry) => entry.id === productId);
    const item = product?.items.find((entry) => entry.id === itemId);
    if (!product || !item || !Number.isSafeInteger(item.price) || item.price <= 0 || item.price > maxPrice) continue;
    const key = `${product.id}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recommendations.push({
      productId: product.id,
      productName: product.name,
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      valueScore: 'Sesuai budget',
      reason: cleanText(row.reason, 220, `Pilihan ${item.name} dari ${product.name}.`)
    });
    if (recommendations.length >= 3) break;
  }

  return {
    headline: cleanText(source.headline, 100, `Rekomendasi untuk Rp ${budget.toLocaleString('id-ID')}`),
    strategySummary: cleanText(source.strategySummary, 320, 'Pilihan disaring berdasarkan katalog dan harga resmi yang tersimpan di server.'),
    recommendations,
    // Jangan biarkan model menjanjikan biaya gratis atau status pembayaran otomatis.
    proTip: 'Periksa total dan biaya pada invoice. Pembayaran QRIS saat ini diperiksa manual oleh Author.'
  };
}
