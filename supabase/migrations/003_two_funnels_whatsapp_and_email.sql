-- ============================================================
-- OFICINA DE ESTUDOS — Dois Funis Independentes (WhatsApp & E-mail)
-- Preserva todos os leads existentes e adiciona origem + segmentação.
-- ============================================================

-- 1. Permitir leads sem campanha vinculada (para o Funil WhatsApp)
ALTER TABLE public.leads
  ALTER COLUMN campaign_id DROP NOT NULL;

-- 2. Campos de origem, funil, segmentação e controle na tabela leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'email'
    CHECK (origin IN ('whatsapp', 'email')),
  ADD COLUMN IF NOT EXISTS entry_page TEXT,
  ADD COLUMN IF NOT EXISTS funnel_id TEXT,
  ADD COLUMN IF NOT EXISTS interest TEXT
    CHECK (interest IS NULL OR interest IN ('enem', 'ssa')),
  ADD COLUMN IF NOT EXISTS school_year_2027 TEXT
    CHECK (school_year_2027 IS NULL OR school_year_2027 IN ('concluiu', '9_ano', '1_ano', '2_ano', '3_ano')),
  ADD COLUMN IF NOT EXISTS modality TEXT
    CHECK (modality IS NULL OR modality IN ('online', 'presencial')),
  ADD COLUMN IF NOT EXISTS school_network TEXT
    CHECK (school_network IS NULL OR school_network IN ('publica', 'particular')),
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Backfill seguro para leads antigos vindos do funil de e-mail
UPDATE public.leads
SET
  origin     = 'email',
  entry_page = COALESCE(entry_page, '/funil-envio-email'),
  funnel_id  = COALESCE(funnel_id, 'funil-email')
WHERE origin IS NULL OR entry_page IS NULL OR funnel_id IS NULL;

-- 4. Índices para filtros combinados rápidos no painel administrativo
CREATE INDEX IF NOT EXISTS idx_leads_origin          ON public.leads (origin);
CREATE INDEX IF NOT EXISTS idx_leads_interest        ON public.leads (interest);
CREATE INDEX IF NOT EXISTS idx_leads_school_year     ON public.leads (school_year_2027);
CREATE INDEX IF NOT EXISTS idx_leads_modality        ON public.leads (modality);
CREATE INDEX IF NOT EXISTS idx_leads_school_network  ON public.leads (school_network);
