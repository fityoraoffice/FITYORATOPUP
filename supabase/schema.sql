-- =========================================================================
-- CAHYOSTORE (FITYORA STORE) - SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- =========================================================================
-- Skema ini dirancang khusus untuk deployment Vercel + Supabase
-- INSTALASI BARU: jalankan file ini SATU KALI di Supabase SQL Editor (aman diulang; semua IF NOT EXISTS).
-- DATABASE LAMA yang sudah berjalan: jalankan supabase/migrations/20261110_tahap6_secure_and_tables.sql.
-- Seluruh akses data lewat server (DATABASE_URL). Peran browser (anon/authenticated) TIDAK diberi akses apa pun.
-- =========================================================================

-- 1. TABEL PENGGUNA & MEMBER (users)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL, -- ID unik member (UID internal)
  email TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  photo_url TEXT,
  name TEXT,
  whatsapp TEXT,
  password_hash TEXT,
  joined_at TIMESTAMPTZ,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'author', 'admin')),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pencarian pengguna
CREATE INDEX IF NOT EXISTS idx_users_uid ON public.users(uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. TABEL PESANAN & TRANSAKSI (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY, -- Format: CS-XXXXXX
  user_id TEXT, -- Relasi ke users(uid) jika member
  product TEXT NOT NULL,
  product_id TEXT,
  item TEXT NOT NULL,
  item_id TEXT,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu Pembayaran',
  total TEXT NOT NULL,
  total_num INTEGER DEFAULT 0,
  unique_code INTEGER DEFAULT 0,
  payment TEXT,
  payment_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'rejected')),
  fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped')),
  whatsapp TEXT,
  email TEXT,
  line_items_json TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index performa query pesanan
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_target ON public.orders(target);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- 3. TABEL KATALOG & HARGA KUSTOM AUTHOR (custom_products)
CREATE TABLE IF NOT EXISTS public.custom_products (
  id TEXT PRIMARY KEY, -- Product ID (cth: 'mlbb', 'ff', 'pointblank')
  data_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL AUDIT LOG KEAMANAN AUTHOR (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 5. SESI LOGIN (auth_sessions) - hanya hash token yang disimpan
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('admin', 'member')),
  user_id TEXT,
  email TEXT NOT NULL,
  name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON public.auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON public.auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_kind_expires ON public.auth_sessions (kind, expires_at);

-- Indeks tambahan untuk kueri berskala
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON public.users (whatsapp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whatsapp_unique ON public.users (whatsapp) WHERE whatsapp IS NOT NULL AND whatsapp <> '';
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders (fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_created ON public.orders (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_whatsapp_norm ON public.orders (lower(regexp_replace(coalesce(whatsapp, ''), '[\s-]', '', 'g')));

-- 6. PENGATURAN TAMPILAN PUBLIK (tema, animasi, wallpaper, musik latar)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ULASAN PELANGGAN (hanya dari pesanan terkirim; tampil setelah disetujui Author)
CREATE TABLE IF NOT EXISTS public.reviews (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  product TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON public.reviews (status, created_at DESC);

-- 8. LANGGANAN NOTIFIKASI PUSH PERANGKAT AUTHOR
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- KEAMANAN: RLS aktif + tanpa policy publik + peran browser dicabut aksesnya.
-- Server memakai DATABASE_URL (peran postgres) sehingga tidak terpengaruh RLS.
-- Kunci anon Supabase bersifat publik; karena itu TIDAK boleh ada policy
-- yang mengizinkan baca/tulis orders, users, dsb. langsung dari browser.
-- =========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','orders','custom_products','audit_logs','auth_sessions','site_settings','reviews','push_subscriptions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 9. PEMBATAS LAJU TERPUSAT (dipakai bersama semua instance Vercel)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;
