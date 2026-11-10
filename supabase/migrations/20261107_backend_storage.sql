-- CahyoStore backend persistence migration (additive; preserves existing rows).
-- Run once in Supabase SQL Editor. Do NOT rerun the original schema.

BEGIN;

-- Additional member fields used by the existing member login/registration API.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz;

-- Keep the complete application order object (cart lines and audit history)
-- while retaining searchable/order-report columns already present in public.orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_whatsapp
  ON public.users (whatsapp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON public.users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whatsapp_unique
  ON public.users (whatsapp)
  WHERE whatsapp IS NOT NULL AND whatsapp <> '';
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status
  ON public.orders (fulfillment_status);

-- Server-side sessions. Only the hash of a random session token is stored.
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  token_hash text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('admin', 'member')),
  user_id text,
  email text NOT NULL,
  name text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON public.auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
  ON public.auth_sessions (user_id);

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_sessions FROM anon, authenticated;
GRANT ALL ON public.auth_sessions TO service_role;

-- Direct server PostgreSQL connection uses DATABASE_URL and does not use anon key.
-- Keep browser roles denied; RLS without policies remains deny-by-default.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.custom_products FROM anon, authenticated;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.custom_products TO service_role;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
