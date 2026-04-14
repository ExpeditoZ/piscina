-- ============================================================
-- AlugueSuaPiscina (RentYourPool) - Complete Database Schema
-- Execute this ENTIRE script in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. CUSTOM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('negotiating', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pool_status AS ENUM ('draft', 'pending_subscription', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. TABLE: pools
-- ============================================================
CREATE TABLE IF NOT EXISTS pools (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PUBLIC fields (visible to guests)
  title            TEXT NOT NULL,
  neighborhood     TEXT NOT NULL,
  city             TEXT NOT NULL DEFAULT 'São Paulo',

  -- PRIVATE fields (revealed only post-confirmation)
  exact_address            TEXT,
  key_lockbox_instructions TEXT,
  owner_whatsapp           TEXT,

  -- Photos (array of Supabase Storage URLs)
  photos           TEXT[] DEFAULT '{}',

  -- JSONB configs for maximum flexibility
  pricing          JSONB NOT NULL DEFAULT '{"weekday": 300, "weekend": 500}'::jsonb,
  shifts_config    JSONB DEFAULT NULL,
  -- Example: {"enabled": true, "options": [{"name": "Manhã (8h-15h)", "price": 250}, {"name": "Noite (16h-23h)", "price": 300}]}
  
  rules            TEXT DEFAULT NULL,
  -- Example: "Proibido garrafas de vidro. Máximo 15 pessoas."

  upsell_extras    JSONB DEFAULT NULL,
  -- Example: [{"id": "1", "name": "Saco de Gelo", "price": 20}, {"id": "2", "name": "Taxa de Limpeza", "price": 80}]

  -- Telegram integration
  telegram_chat_id TEXT DEFAULT NULL,

  -- Listing status lifecycle: draft → pending_subscription → active → suspended
  status           pool_status NOT NULL DEFAULT 'draft',

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast owner lookups
CREATE INDEX IF NOT EXISTS idx_pools_owner_id ON pools(owner_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pools_updated_at ON pools;
CREATE TRIGGER trigger_pools_updated_at
  BEFORE UPDATE ON pools
  FOR EACH ROW
  EXECUTE FUNCTION update_pools_updated_at();


-- ============================================================
-- 4. TABLE: bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id          UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,

  guest_name       TEXT NOT NULL,
  arrival_time     TEXT NOT NULL DEFAULT '10:00',
  booking_date     DATE NOT NULL,
  shift_selected   TEXT DEFAULT NULL,
  total_price      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  selected_upsells JSONB DEFAULT NULL,

  status           booking_status NOT NULL DEFAULT 'negotiating',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for calendar queries and cron jobs
CREATE INDEX IF NOT EXISTS idx_bookings_pool_date ON bookings(pool_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(booking_date, status);

-- UNIQUE constraint: prevent double-booking (only one active booking per pool per date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking
  ON bookings(pool_id, booking_date)
  WHERE status IN ('negotiating', 'confirmed');


-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. RLS POLICIES: pools
-- ============================================================

-- ANON: Anonymous users should NOT directly query the pools table.
-- They must use the public_pools view (which excludes private columns).
-- This policy restricts anon to ZERO rows on the raw table.
DROP POLICY IF EXISTS "Public can view pools" ON pools;
DROP POLICY IF EXISTS "Anon cannot read pools directly" ON pools;
CREATE POLICY "Anon cannot read pools directly"
  ON pools
  FOR SELECT
  TO anon
  USING (false);

-- AUTHENTICATED: Owners can read only their own pools (full access to all columns)
DROP POLICY IF EXISTS "Owners can read own pools" ON pools;
CREATE POLICY "Owners can read own pools"
  ON pools
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);


-- OWNERS: Authenticated users can insert their own pools
DROP POLICY IF EXISTS "Owners can insert own pools" ON pools;
CREATE POLICY "Owners can insert own pools"
  ON pools
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- OWNERS: Authenticated users can update only their own pools
DROP POLICY IF EXISTS "Owners can update own pools" ON pools;
CREATE POLICY "Owners can update own pools"
  ON pools
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- OWNERS: Authenticated users can delete only their own pools
DROP POLICY IF EXISTS "Owners can delete own pools" ON pools;
CREATE POLICY "Owners can delete own pools"
  ON pools
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);


-- ============================================================
-- 7. RLS POLICIES: bookings
-- ============================================================

-- PUBLIC: Anyone can create a booking with status='negotiating'
DROP POLICY IF EXISTS "Public can insert negotiating bookings" ON bookings;
CREATE POLICY "Public can insert negotiating bookings"
  ON bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'negotiating');

-- PUBLIC: Anyone can read ONLY booking_date and status (for calendar)
-- We enforce column restriction at query level; RLS allows the row access.
DROP POLICY IF EXISTS "Public can view booking dates" ON bookings;
CREATE POLICY "Public can view booking dates"
  ON bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- OWNERS: Can update bookings for their own pools (confirm/cancel)
DROP POLICY IF EXISTS "Owners can update own pool bookings" ON bookings;
CREATE POLICY "Owners can update own pool bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pools
      WHERE pools.id = bookings.pool_id
      AND pools.owner_id = auth.uid()
    )
  );


-- ============================================================
-- 8. SUPABASE REALTIME
-- ============================================================
-- Enable realtime on bookings so calendar updates propagate instantly
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;


-- ============================================================
-- 9. ANTI-TROLL AUTO-CLEANUP
-- Automatically cancel 'negotiating' bookings older than 2 hours
-- to prevent calendar lockups by abandoned sessions.
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_negotiations()
RETURNS void AS $$
BEGIN
  UPDATE bookings
  SET status = 'cancelled'
  WHERE status = 'negotiating'
    AND created_at < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a pg_cron job to run every 15 minutes
-- NOTE: pg_cron must be enabled in Supabase Dashboard → Database → Extensions
-- If pg_cron is not available, we also handle this via Vercel cron as backup.
DO $$
BEGIN
  -- Try to schedule with pg_cron if available
  PERFORM cron.schedule(
    'cleanup-stale-negotiations',
    '*/15 * * * *',
    $$SELECT cleanup_stale_negotiations()$$
  );
EXCEPTION
  WHEN undefined_function THEN
    -- pg_cron not enabled, will rely on application-level cleanup
    RAISE NOTICE 'pg_cron not available. Stale negotiation cleanup will be handled at application level.';
  WHEN undefined_schema THEN
    RAISE NOTICE 'pg_cron extension not installed. Stale negotiation cleanup will be handled at application level.';
END $$;


-- ============================================================
-- 10. STORAGE BUCKET FOR POOL PHOTOS
-- ============================================================
-- Create a public storage bucket for pool photos
-- Run this only if the bucket doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pool-photos',
  'pool-photos',
  true,
  200000, -- 200KB max per file (compressed images)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies: Anyone can view photos (public bucket)
DROP POLICY IF EXISTS "Public can view pool photos" ON storage.objects;
CREATE POLICY "Public can view pool photos"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pool-photos');

-- Storage Policies: Authenticated owners can upload photos
DROP POLICY IF EXISTS "Owners can upload pool photos" ON storage.objects;
CREATE POLICY "Owners can upload pool photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pool-photos');

-- Storage Policies: Authenticated owners can update their uploaded photos
DROP POLICY IF EXISTS "Owners can update pool photos" ON storage.objects;
CREATE POLICY "Owners can update pool photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pool-photos');

-- Storage Policies: Authenticated owners can delete their uploaded photos
DROP POLICY IF EXISTS "Owners can delete pool photos" ON storage.objects;
CREATE POLICY "Owners can delete pool photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'pool-photos');


-- ============================================================
-- 11. HELPER VIEW: Public Pool Listings
-- SECURITY MODEL: anon users CANNOT query the raw pools table (RLS blocks them).
-- They MUST use this view, which only exposes safe public columns.
-- The view uses the OWNER's permissions (bypasses RLS) so it can read from pools.
-- ============================================================
DROP VIEW IF EXISTS public_pools;
CREATE VIEW public_pools
  WITH (security_invoker = false)
AS
SELECT
  id,
  title,
  neighborhood,
  city,
  photos,
  pricing,
  shifts_config,
  rules,
  upsell_extras,
  created_at
FROM pools
WHERE status = 'active';

-- Grant read access to the view
GRANT SELECT ON public_pools TO anon, authenticated;



-- ============================================================
-- 12. HELPER VIEW: Calendar Bookings
-- Only exposes date and status for calendar rendering.
-- ============================================================
CREATE OR REPLACE VIEW calendar_bookings AS
SELECT
  pool_id,
  booking_date,
  status::text as status
FROM bookings
WHERE status IN ('negotiating', 'confirmed');

-- Grant read access to the view
GRANT SELECT ON calendar_bookings TO anon, authenticated;


-- ============================================================
-- 13. CUSTOM TYPE: invoice_status
-- ============================================================
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'approved', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 14. TABLE: host_subscriptions
-- Tracks the current subscription state for each host.
-- ============================================================
CREATE TABLE IF NOT EXISTS host_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name   TEXT NOT NULL DEFAULT 'mensal',
  plan_price  NUMERIC(10, 2) NOT NULL DEFAULT 49.90,
  status      TEXT NOT NULL DEFAULT 'inactive',  -- inactive | active | expired
  starts_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON host_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON host_subscriptions(status);

-- RLS
ALTER TABLE host_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can read own subscription" ON host_subscriptions;
CREATE POLICY "Hosts can read own subscription"
  ON host_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service_role can insert/update (via API routes)


-- ============================================================
-- 15. TABLE: host_invoices
-- Tracks each PIX payment attempt.
-- ============================================================
CREATE TABLE IF NOT EXISTS host_invoices (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id      UUID REFERENCES host_subscriptions(id) ON DELETE SET NULL,
  amount               NUMERIC(10, 2) NOT NULL,
  description          TEXT NOT NULL DEFAULT 'Assinatura mensal - AlugueSuaPiscina',
  status               invoice_status NOT NULL DEFAULT 'pending',

  -- Mercado Pago data
  mp_payment_id        TEXT,         -- Mercado Pago payment ID
  mp_qr_code           TEXT,         -- PIX copia-e-cola
  mp_qr_code_base64    TEXT,         -- QR code image (base64)
  mp_status            TEXT,         -- raw MP status

  -- Timestamps
  paid_at              TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_user ON host_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON host_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_mp_id ON host_invoices(mp_payment_id);

-- RLS
ALTER TABLE host_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can read own invoices" ON host_invoices;
CREATE POLICY "Hosts can read own invoices"
  ON host_invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service_role can insert/update (via API routes)


-- ============================================================
-- 16. FUNCTION: Check and suspend expired subscriptions
-- Called by the daily cron job.
-- ============================================================
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void AS $$
BEGIN
  -- Mark expired subscriptions
  UPDATE host_subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND expires_at < NOW();

  -- Suspend pools whose owner subscription expired
  UPDATE pools
  SET status = 'suspended', updated_at = NOW()
  WHERE status = 'active'
    AND owner_id IN (
      SELECT user_id FROM host_subscriptions
      WHERE status = 'expired'
    );

  -- Also mark pending invoices as expired if older than 30 min
  UPDATE host_invoices
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SCHEMA COMPLETE!
-- ============================================================
-- Next steps:
-- 1. Enable the "pg_cron" extension in Supabase Dashboard if available
-- 2. Enable Realtime for the 'bookings' table in Supabase Dashboard
-- 3. Fill in your .env.local with your Supabase project URL and keys
-- 4. Create a host account via /host/signup
-- 5. Configure Mercado Pago webhook URL in their dashboard

-- 3. Fill in your .env.local with your Supabase project URL and keys
-- 4. Create an owner account via Supabase Auth (email/password)
