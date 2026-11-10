-- FITYORA STORE Tahap 6: tabel baru + penutupan akses publik. Aditif & aman dijalankan ulang.
-- Jalankan SATU KALI di Supabase SQL Editor pada database yang sudah berjalan
-- (setelah 20261107_backend_storage.sql dan 20261108_performance_indexes.sql).
-- Catatan: server juga membuat tabel baru otomatis saat pertama dipakai; file ini membuatnya lebih awal
-- dan memastikan peran browser (anon/authenticated) tidak punya akses.

BEGIN;

-- 1. Hapus policy publik lama dari schema.sql versi awal (orders dapat dibaca/ditulis siapa pun yang punya anon key).
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders by ID" ON public.orders;
DROP POLICY IF EXISTS "Author can update orders" ON public.orders;
DROP POLICY IF EXISTS "Author can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view catalog" ON public.custom_products;
DROP POLICY IF EXISTS "Author can manage catalog" ON public.custom_products;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Only author can view audit logs" ON public.audit_logs;

-- 2. Tabel baru
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL UNIQUE,
  product text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON public.reviews (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

-- 3. RLS aktif, tanpa policy, akses peran browser dicabut
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','orders','custom_products','audit_logs','auth_sessions','site_settings','reviews','push_subscriptions','rate_limits']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

COMMIT;
