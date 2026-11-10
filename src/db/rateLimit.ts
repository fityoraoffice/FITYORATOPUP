import { pool } from './index.js';

/**
 * Pembatas laju terpusat di Postgres. Di Vercel setiap request bisa dilayani instance berbeda,
 * jadi penghitung di memori mudah dilewati; penghitung ini dipakai bersama oleh semua instance.
 * Satu query atomik per pemanggilan.
 */
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.rate_limits (
          key text PRIMARY KEY,
          count integer NOT NULL,
          reset_at timestamptz NOT NULL
        )
      `);
      await pool.query('ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY');
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady!;
}

/** Mengembalikan jumlah percobaan dalam jendela waktu saat ini (termasuk yang barusan). */
export async function hitRateLimit(key: string, windowMs: number): Promise<number> {
  await ensureTable();
  const result = await pool.query(
    `insert into public.rate_limits as r (key, count, reset_at)
     values ($1, 1, now() + ($2::int * interval '1 millisecond'))
     on conflict (key) do update set
       count = case when r.reset_at <= now() then 1 else r.count + 1 end,
       reset_at = case when r.reset_at <= now() then now() + ($2::int * interval '1 millisecond') else r.reset_at end
     returning count`,
    [key.slice(0, 200), Math.max(1000, Math.floor(windowMs))]
  );
  if (Math.random() < 0.01) {
    pool.query(`delete from public.rate_limits where reset_at < now() - interval '1 day'`).catch(() => undefined);
  }
  return Number(result.rows[0]?.count ?? 1);
}
