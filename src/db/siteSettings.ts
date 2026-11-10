import { pool } from './index.js';

/**
 * Pengaturan tampilan yang berlaku untuk SEMUA pengunjung (tema, animasi, wallpaper, musik latar).
 * Hanya Author yang dapat mengubahnya (lihat endpoint /api/admin/site-settings di server.ts).
 * Warna siang/malam TIDAK disimpan di sini: itu pilihan pribadi tiap pengunjung.
 */
export interface PublicSiteSettings {
  preset: string;
  animationMode: string;
  bgUrl: string;
  music: string;
  musicPlaying: boolean;
  vol: number;
}

const SETTINGS_KEY = 'public_fx';

let tableReady: Promise<void> | null = null;

/** Membuat tabel bila belum ada, jadi migrasi manual tidak wajib dijalankan. */
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.site_settings (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query('ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY');
    })().catch((error) => {
      tableReady = null; // coba lagi pada permintaan berikutnya
      throw error;
    });
  }
  return tableReady!;
}

function cleanUrl(value: unknown): string {
  const raw = String(value ?? '').trim().slice(0, 2000);
  if (!raw) return '';
  try {
    return /^https?:$/.test(new URL(raw).protocol) ? raw : '';
  } catch {
    return '';
  }
}

export function sanitizeSiteSettings(input: unknown): PublicSiteSettings | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as Record<string, unknown>;
  const vol = Number(src.vol);
  const music = cleanUrl(src.music);
  return {
    preset: String(src.preset ?? 'cyber').slice(0, 40),
    animationMode: String(src.animationMode ?? 'constellation').slice(0, 40),
    bgUrl: cleanUrl(src.bgUrl),
    music,
    musicPlaying: Boolean(src.musicPlaying) && Boolean(music),
    vol: Number.isFinite(vol) ? Math.min(100, Math.max(0, Math.round(vol))) : 40,
  };
}

export async function getSiteSettings(): Promise<{ settings: PublicSiteSettings | null; updatedAt: string | null }> {
  await ensureTable();
  const result = await pool.query(
    'select value, updated_at from public.site_settings where key = $1 limit 1',
    [SETTINGS_KEY]
  );
  const row = result.rows[0];
  if (!row) return { settings: null, updatedAt: null };
  return {
    settings: sanitizeSiteSettings(row.value),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function saveSiteSettings(settings: PublicSiteSettings): Promise<string> {
  await ensureTable();
  const result = await pool.query(
    `insert into public.site_settings (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()
     returning updated_at`,
    [SETTINGS_KEY, JSON.stringify(settings)]
  );
  return new Date(result.rows[0].updated_at).toISOString();
}
