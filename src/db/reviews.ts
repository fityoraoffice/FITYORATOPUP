import { pool } from './index.js';

/**
 * Ulasan pelanggan. Hanya pesanan berstatus TERKIRIM yang boleh diulas, satu ulasan per pesanan,
 * dan baru tampil di toko setelah disetujui Author (status 'approved').
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewRow {
  id: number;
  orderId: string;
  product: string;
  rating: number;
  comment: string;
  displayName: string;
  status: ReviewStatus;
  createdAt: string;
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.reviews (
          id bigserial PRIMARY KEY,
          order_id text NOT NULL UNIQUE,
          product text NOT NULL,
          rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
          comment text NOT NULL,
          display_name text NOT NULL,
          status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON public.reviews (status, created_at DESC)');
      await pool.query('ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY');
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady!;
}

const toRow = (r: Record<string, unknown>): ReviewRow => ({
  id: Number(r.id),
  orderId: String(r.order_id),
  product: String(r.product),
  rating: Number(r.rating),
  comment: String(r.comment),
  displayName: String(r.display_name),
  status: r.status as ReviewStatus,
  createdAt: new Date(r.created_at as string).toISOString(),
});

/** Nama tampil publik: hanya yang diketik pelanggan, tanpa karakter kontrol. */
export function cleanText(value: unknown, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function createReview(input: { orderId: string; product: string; rating: number; comment: string; displayName: string }): Promise<'created' | 'exists'> {
  await ensureTable();
  const result = await pool.query(
    `insert into public.reviews (order_id, product, rating, comment, display_name)
     values ($1, $2, $3, $4, $5) on conflict (order_id) do nothing returning id`,
    [input.orderId, input.product, input.rating, input.comment, input.displayName]
  );
  return result.rowCount ? 'created' : 'exists';
}

export async function hasReviewForOrder(orderId: string): Promise<boolean> {
  await ensureTable();
  const result = await pool.query('select 1 from public.reviews where order_id = $1 limit 1', [orderId]);
  return (result.rowCount ?? 0) > 0;
}

export async function listApprovedReviews(limit = 60): Promise<{ reviews: Array<Omit<ReviewRow, 'orderId' | 'status'>>; count: number; average: number }> {
  await ensureTable();
  const [list, agg] = await Promise.all([
    pool.query(`select * from public.reviews where status = 'approved' order by created_at desc limit $1`, [limit]),
    pool.query(`select count(*)::int as n, coalesce(avg(rating), 0)::float as avg from public.reviews where status = 'approved'`),
  ]);
  return {
    // order_id sengaja tidak dibuka ke publik
    reviews: list.rows.map((r) => {
      const { orderId: _o, status: _s, ...pub } = toRow(r);
      return pub;
    }),
    count: agg.rows[0]?.n ?? 0,
    average: Math.round((agg.rows[0]?.avg ?? 0) * 10) / 10,
  };
}

export async function listAllReviews(limit = 200): Promise<ReviewRow[]> {
  await ensureTable();
  const result = await pool.query('select * from public.reviews order by (status = \'pending\') desc, created_at desc limit $1', [limit]);
  return result.rows.map(toRow);
}

export async function setReviewStatus(id: number, status: ReviewStatus): Promise<boolean> {
  await ensureTable();
  const result = await pool.query('update public.reviews set status = $2 where id = $1', [id, status]);
  return (result.rowCount ?? 0) > 0;
}

export async function deleteReview(id: number): Promise<boolean> {
  await ensureTable();
  const result = await pool.query('delete from public.reviews where id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
