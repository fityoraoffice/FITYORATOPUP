import { pool } from './index.js';
import type { PushSubscriptionRecord } from '../utils/webPush.js';

/** Langganan notifikasi push perangkat Author. Hanya sesi Author yang boleh menambah/menghapus. */
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.push_subscriptions (
          endpoint text PRIMARY KEY,
          p256dh text NOT NULL,
          auth text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query('ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY');
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady!;
}

export async function savePushSubscription(sub: PushSubscriptionRecord): Promise<void> {
  await ensureTable();
  await pool.query(
    `insert into public.push_subscriptions (endpoint, p256dh, auth) values ($1, $2, $3)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`,
    [sub.endpoint, sub.p256dh, sub.auth]
  );
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await ensureTable();
  await pool.query('delete from public.push_subscriptions where endpoint = $1', [endpoint]);
}

export async function listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  await ensureTable();
  const result = await pool.query('select endpoint, p256dh, auth from public.push_subscriptions limit 50');
  return result.rows.map((r) => ({ endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) }));
}
