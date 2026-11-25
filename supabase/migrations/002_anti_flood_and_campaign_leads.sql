-- ============================================================
-- OFICINA DE ESTUDOS — Anti-Flood (Email + WhatsApp) por Campanha
-- ============================================================

-- 1. Controle por campanha para bloquear ou permitir repetição
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS block_duplicates BOOLEAN NOT NULL DEFAULT true;

-- 2. Coluna normalizada de dígitos do WhatsApp/telefone para evitar burla com formatação
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_digits TEXT
  GENERATED ALWAYS AS (regexp_replace(phone, '\D', '', 'g')) STORED;

-- 3. Índice único de WhatsApp por campanha (permite o mesmo WhatsApp em campanhas diferentes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_campaign_unique
  ON public.leads (phone_digits, campaign_id)
  WHERE phone_digits <> '';
