-- ============================================================
-- OFICINA DE ESTUDOS — Initial Database Schema & RLS Policies
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ADMIN_USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
  );
$$;

CREATE POLICY "Admins can view admin_users"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 2. CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  image_url     TEXT,
  material_url  TEXT,
  email_subject TEXT NOT NULL,
  email_content TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure at most ONE active campaign at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_single_active
  ON public.campaigns (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at
  ON public.campaigns (created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Public visitors can ONLY read the active campaign (non-sensitive public fields)
CREATE POLICY "Public can view active campaign"
  ON public.campaigns FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admins can view all campaigns (active & inactive)
CREATE POLICY "Admins can view all campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert, update, delete campaigns
CREATE POLICY "Admins can insert campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  privacy_consent BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_email       ON public.leads (lower(email));
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON public.leads (created_at DESC);

-- Prevent duplicate lead for the same email + campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_campaign_unique
  ON public.leads (lower(email), campaign_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Public visitors CANNOT read, update, or delete leads.
-- Inserts are handled server-side by the Edge Function using service_role key.
CREATE POLICY "Admins can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete leads (LGPD)"
  ON public.leads FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 4. EMAIL_SENDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  resend_id     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'rejected')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_lead_id     ON public.email_sends (lead_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON public.email_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status      ON public.email_sends (status);
CREATE INDEX IF NOT EXISTS idx_email_sends_resend_id   ON public.email_sends (resend_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_created_at  ON public.email_sends (created_at DESC);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email_sends"
  ON public.email_sends FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 5. STORAGE BUCKETS & POLICIES
-- ============================================================
-- Public bucket for campaign presentation images
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

-- Private bucket for campaign materials (accessed via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-materials', 'campaign-materials', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for campaign-images
CREATE POLICY "Public can read campaign images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'campaign-images');

CREATE POLICY "Admins can upload campaign images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'campaign-images' AND public.is_admin());

CREATE POLICY "Admins can update campaign images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'campaign-images' AND public.is_admin());

CREATE POLICY "Admins can delete campaign images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'campaign-images' AND public.is_admin());

-- Policies for campaign-materials (private!)
CREATE POLICY "Admins can manage campaign materials"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'campaign-materials' AND public.is_admin())
  WITH CHECK (bucket_id = 'campaign-materials' AND public.is_admin());
