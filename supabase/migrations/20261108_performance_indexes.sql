-- FITYORA STORE: indeks tambahan untuk kueri berskala (aditif, aman dijalankan ulang).
-- Jalankan satu kali di Supabase SQL Editor setelah 20261107_backend_storage.sql.

BEGIN;

-- Riwayat pesanan member dicari lewat nomor WhatsApp yang dinormalisasi.
CREATE INDEX IF NOT EXISTS idx_orders_whatsapp_norm
  ON public.orders (lower(regexp_replace(coalesce(whatsapp, ''), '[\s-]', '', 'g')));

-- Daftar pesanan admin selalu diurutkan terbaru; filter status pembayaran sering dipakai.
CREATE INDEX IF NOT EXISTS idx_orders_payment_created
  ON public.orders (payment_status, created_at DESC);

-- Pembersihan sesi kedaluwarsa memakai kolom ini.
CREATE INDEX IF NOT EXISTS idx_auth_sessions_kind_expires
  ON public.auth_sessions (kind, expires_at);

-- Penanda perubahan untuk dashboard admin (max(updated_at)).
CREATE INDEX IF NOT EXISTS idx_orders_updated_at
  ON public.orders (updated_at DESC);

COMMIT;
