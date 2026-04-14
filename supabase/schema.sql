BEGIN;

-- ============================================================
-- AlugueSuaPiscina (RentYourPool) - Complete Database Schema
-- Migration-safe version: ready to copy and run
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. CUSTOM TYPES
-- ============================================================
DO $$
BEGIN
  CREATE TYPE public.booking_status AS ENUM ('negotiating', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.booking_mode AS ENUM ('shift', 'full_day', 'range');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.pool_status AS ENUM ('draft', 'pending_subscription', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('inactive', 'active', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('pending', 'approved', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. GENERIC updated_at HELPER
-- ============================================================
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. TABLE: pools
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'São Paulo',
  exact_address TEXT,
  key_lockbox_instructions TEXT,
  owner_whatsapp TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  pricing JSONB NOT NULL DEFAULT '{"weekday": 300, "weekend": 500}'::jsonb,
  shifts_config JSONB DEFAULT NULL,
  rules TEXT DEFAULT NULL,
  upsell_extras JSONB DEFAULT NULL,
  telegram_chat_id TEXT DEFAULT NULL,
  status public.pool_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'São Paulo',
  ADD COLUMN IF NOT EXISTS exact_address TEXT,
  ADD COLUMN IF NOT EXISTS key_lockbox_instructions TEXT,
  ADD COLUMN IF NOT EXISTS owner_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT '{"weekday": 300, "weekend": 500}'::jsonb,
  ADD COLUMN IF NOT EXISTS shifts_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rules TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS upsell_extras JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status public.pool_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.pools
SET city = 'São Paulo'
WHERE city IS NULL;

UPDATE public.pools
SET photos = '{}'
WHERE photos IS NULL;

UPDATE public.pools
SET pricing = '{"weekday": 300, "weekend": 500}'::jsonb
WHERE pricing IS NULL;

UPDATE public.pools
SET status = 'draft'
WHERE status IS NULL;

UPDATE public.pools
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.pools
SET updated_at = NOW()
WHERE updated_at IS NULL;

ALTER TABLE public.pools
  ALTER COLUMN city SET DEFAULT 'São Paulo',
  ALTER COLUMN photos SET DEFAULT '{}',
  ALTER COLUMN pricing SET DEFAULT '{"weekday": 300, "weekend": 500}'::jsonb,
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_pools_owner_id ON public.pools(owner_id);
CREATE INDEX IF NOT EXISTS idx_pools_status ON public.pools(status);
CREATE INDEX IF NOT EXISTS idx_pools_city_neighborhood ON public.pools(city, neighborhood);

DROP TRIGGER IF EXISTS trigger_pools_updated_at ON public.pools;
CREATE TRIGGER trigger_pools_updated_at
  BEFORE UPDATE ON public.pools
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. TABLE: bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  arrival_time TEXT NOT NULL DEFAULT '10:00',
  booking_date DATE NOT NULL,
  booking_mode public.booking_mode NOT NULL DEFAULT 'full_day',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 1,
  shift_selected TEXT DEFAULT NULL,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  pricing_breakdown JSONB DEFAULT NULL,
  selected_upsells JSONB DEFAULT NULL,
  status public.booking_status NOT NULL DEFAULT 'negotiating',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add new columns to existing table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS arrival_time TEXT DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS booking_date DATE,
  ADD COLUMN IF NOT EXISTS shift_selected TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_upsells JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status public.booking_status DEFAULT 'negotiating',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- New columns for booking model v2
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_mode public.booking_mode DEFAULT 'full_day',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB DEFAULT NULL;

-- Migrate existing data: populate start_date/end_date from booking_date
UPDATE public.bookings
SET
  start_date = booking_date,
  end_date = booking_date,
  total_days = 1,
  booking_mode = CASE
    WHEN shift_selected IS NOT NULL THEN 'shift'::public.booking_mode
    ELSE 'full_day'::public.booking_mode
  END
WHERE start_date IS NULL;

UPDATE public.bookings SET arrival_time = '10:00' WHERE arrival_time IS NULL;
UPDATE public.bookings SET total_price = 0 WHERE total_price IS NULL;
UPDATE public.bookings SET status = 'negotiating' WHERE status IS NULL;
UPDATE public.bookings SET created_at = NOW() WHERE created_at IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN arrival_time SET DEFAULT '10:00',
  ALTER COLUMN total_price SET DEFAULT 0,
  ALTER COLUMN status SET DEFAULT 'negotiating',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_pool_date ON public.bookings(pool_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_pool_range ON public.bookings(pool_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings(booking_date, status);

-- Drop the old unique index (too restrictive: blocks 2 shifts same day)
DROP INDEX IF EXISTS idx_unique_active_booking;

-- Shift bookings: same pool + same date + same shift = conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_shift_booking
  ON public.bookings(pool_id, start_date, shift_selected)
  WHERE status IN ('negotiating', 'confirmed')
    AND booking_mode = 'shift';

-- Full-day bookings: same pool + same date = conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_fullday_booking
  ON public.bookings(pool_id, start_date)
  WHERE status IN ('negotiating', 'confirmed')
    AND booking_mode = 'full_day';

-- ============================================================
-- 6. TABLE: host_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.host_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'mensal',
  plan_price NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  status public.subscription_status NOT NULL DEFAULT 'inactive',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.host_subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS plan_price NUMERIC(10,2) DEFAULT 49.90,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'host_subscriptions'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.host_subscriptions
      ADD COLUMN status public.subscription_status DEFAULT 'inactive';
  END IF;
END $$;

UPDATE public.host_subscriptions
SET plan_name = 'mensal'
WHERE plan_name IS NULL;

UPDATE public.host_subscriptions
SET plan_price = 49.90
WHERE plan_price IS NULL;

UPDATE public.host_subscriptions
SET status = 'inactive'
WHERE status IS NULL;

UPDATE public.host_subscriptions
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.host_subscriptions
SET updated_at = NOW()
WHERE updated_at IS NULL;

ALTER TABLE public.host_subscriptions
  ALTER COLUMN plan_name SET DEFAULT 'mensal',
  ALTER COLUMN plan_price SET DEFAULT 49.90,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.host_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.host_subscriptions(status);

DROP TRIGGER IF EXISTS trigger_host_subscriptions_updated_at ON public.host_subscriptions;
CREATE TRIGGER trigger_host_subscriptions_updated_at
  BEFORE UPDATE ON public.host_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. TABLE: host_invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS public.host_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.host_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL DEFAULT 'Assinatura mensal - AlugueSuaPiscina',
  status public.invoice_status NOT NULL DEFAULT 'pending',
  mp_payment_id TEXT,
  mp_qr_code TEXT,
  mp_qr_code_base64 TEXT,
  mp_status TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.host_invoices
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.host_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT 'Assinatura mensal - AlugueSuaPiscina',
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS mp_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS mp_status TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'host_invoices'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.host_invoices
      ADD COLUMN status public.invoice_status DEFAULT 'pending';
  END IF;
END $$;

UPDATE public.host_invoices
SET description = 'Assinatura mensal - AlugueSuaPiscina'
WHERE description IS NULL;

UPDATE public.host_invoices
SET status = 'pending'
WHERE status IS NULL;

UPDATE public.host_invoices
SET created_at = NOW()
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_host_invoices_user_id ON public.host_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_host_invoices_status ON public.host_invoices(status);
CREATE INDEX IF NOT EXISTS idx_host_invoices_mp_payment_id ON public.host_invoices(mp_payment_id);

-- ============================================================
-- 8. ENABLE RLS
-- ============================================================
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. RLS POLICIES: pools
-- ============================================================
DROP POLICY IF EXISTS "Anon cannot read pools directly" ON public.pools;
CREATE POLICY "Anon cannot read pools directly"
  ON public.pools
  FOR SELECT
  TO anon
  USING (false);

DROP POLICY IF EXISTS "Owners can read own pools" ON public.pools;
CREATE POLICY "Owners can read own pools"
  ON public.pools
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert own pools" ON public.pools;
CREATE POLICY "Owners can insert own pools"
  ON public.pools
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own pools" ON public.pools;
CREATE POLICY "Owners can update own pools"
  ON public.pools
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own pools" ON public.pools;
CREATE POLICY "Owners can delete own pools"
  ON public.pools
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ============================================================
-- 10. RLS POLICIES: bookings
-- ============================================================
DROP POLICY IF EXISTS "Public can insert negotiating bookings" ON public.bookings;
CREATE POLICY "Public can insert negotiating bookings"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'negotiating');

DROP POLICY IF EXISTS "Anon cannot read bookings directly" ON public.bookings;
CREATE POLICY "Anon cannot read bookings directly"
  ON public.bookings
  FOR SELECT
  TO anon
  USING (false);

DROP POLICY IF EXISTS "Owners can read own pool bookings" ON public.bookings;
CREATE POLICY "Owners can read own pool bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pools
      WHERE public.pools.id = public.bookings.pool_id
        AND public.pools.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update own pool bookings" ON public.bookings;
CREATE POLICY "Owners can update own pool bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pools
      WHERE public.pools.id = public.bookings.pool_id
        AND public.pools.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pools
      WHERE public.pools.id = public.bookings.pool_id
        AND public.pools.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 11. RLS POLICIES: host_subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Hosts can read own subscription" ON public.host_subscriptions;
CREATE POLICY "Hosts can read own subscription"
  ON public.host_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 12. RLS POLICIES: host_invoices
-- ============================================================
DROP POLICY IF EXISTS "Hosts can read own invoices" ON public.host_invoices;
CREATE POLICY "Hosts can read own invoices"
  ON public.host_invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 13. REALTIME
-- ============================================================
DO $realtime$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication not available.';
END
$realtime$;

-- ============================================================
-- 14. FUNCTIONS
-- ============================================================
DROP FUNCTION IF EXISTS public.cleanup_stale_negotiations() CASCADE;

CREATE FUNCTION public.cleanup_stale_negotiations()
RETURNS void AS $$
BEGIN
  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE status = 'negotiating'
    AND created_at < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.check_expired_subscriptions() CASCADE;

CREATE FUNCTION public.check_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.host_subscriptions
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  UPDATE public.pools
  SET status = 'suspended',
      updated_at = NOW()
  WHERE status = 'active'
    AND owner_id IN (
      SELECT user_id
      FROM public.host_subscriptions
      WHERE status = 'expired'
    );

  UPDATE public.host_invoices
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 15. PUBLIC SAFE VIEWS
-- ============================================================
DROP VIEW IF EXISTS public.public_pools;
CREATE VIEW public.public_pools AS
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
FROM public.pools
WHERE status = 'active';

GRANT SELECT ON public.public_pools TO anon, authenticated;

DROP VIEW IF EXISTS public.calendar_bookings;
CREATE VIEW public.calendar_bookings AS
SELECT
  b.pool_id,
  d::date AS booking_date,
  b.shift_selected,
  b.booking_mode::text AS booking_mode,
  b.status::text AS status
FROM public.bookings b,
  generate_series(b.start_date, b.end_date, '1 day'::interval) AS d
WHERE b.status IN ('negotiating', 'confirmed');

GRANT SELECT ON public.calendar_bookings TO anon, authenticated;

-- ============================================================
-- 16. STORAGE BUCKET FOR POOL PHOTOS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pool-photos',
  'pool-photos',
  true,
  200000,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view pool photos" ON storage.objects;
CREATE POLICY "Public can view pool photos"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pool-photos');

DROP POLICY IF EXISTS "Owners can upload pool photos" ON storage.objects;
CREATE POLICY "Owners can upload pool photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pool-photos');

DROP POLICY IF EXISTS "Owners can update pool photos" ON storage.objects;
CREATE POLICY "Owners can update pool photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pool-photos')
  WITH CHECK (bucket_id = 'pool-photos');

DROP POLICY IF EXISTS "Owners can delete pool photos" ON storage.objects;
CREATE POLICY "Owners can delete pool photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'pool-photos');

COMMIT;

-- ============================================================
-- OPTIONAL
-- ============================================================
-- This script intentionally does NOT auto-create a pg_cron job.
-- After enabling pg_cron in Supabase, you can run separately:
-- SELECT cron.schedule(
--   'cleanup-stale-negotiations',
--   '*/15 * * * *',
--   'SELECT public.cleanup_stale_negotiations();'
-- );