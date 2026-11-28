import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://oficinadeestudosrec.vercel.app",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const extraOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const allowed = extraOrigin
    ? [...DEFAULT_ALLOWED_ORIGINS, extraOrigin]
    : DEFAULT_ALLOWED_ORIGINS;

  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  corsHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhoneBR(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

const VALID_INTERESTS = new Set(["enem", "ssa"]);
const VALID_YEARS_BY_INTEREST: Record<string, Set<string>> = {
  enem: new Set(["concluiu", "1_ano", "2_ano", "3_ano"]),
  ssa: new Set(["9_ano", "1_ano", "2_ano", "3_ano"]),
};
const VALID_MODALITIES = new Set(["online", "presencial"]);
const VALID_NETWORKS = new Set(["publica", "particular"]);

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const reply = (body: Record<string, unknown>, status = 200) =>
    jsonResponse(body, status, cors);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return reply({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return reply({ error: "Configuração do servidor incompleta." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const interest = String(body.interest ?? "").trim().toLowerCase();
    const schoolYear = String(body.school_year_2027 ?? "").trim().toLowerCase();
    const modality = String(body.modality ?? "").trim().toLowerCase();
    const schoolNetwork = String(body.school_network ?? "").trim().toLowerCase();
    const entryPage = String(body.entry_page ?? "/funil-captacao-whatsapp").trim();
    const privacyConsent = Boolean(body.privacy_consent);

    // Server-side validation
    if (name.length < 3 || name.length > 120) {
      return reply({ error: "Informe um nome válido (mínimo 3 caracteres)." }, 400);
    }
    if (!isValidEmail(email) || email.length > 200) {
      return reply({ error: "Informe um e-mail válido." }, 400);
    }
    if (!isValidPhoneBR(phone)) {
      return reply({ error: "Informe um WhatsApp válido com DDD." }, 400);
    }
    if (!privacyConsent) {
      return reply({ error: "É obrigatório aceitar a política de privacidade." }, 400);
    }
    if (!VALID_INTERESTS.has(interest)) {
      return reply({ error: "Selecione um interesse válido (ENEM ou SSA)." }, 400);
    }
    if (!VALID_YEARS_BY_INTEREST[interest]?.has(schoolYear)) {
      return reply({ error: "Ano escolar inválido para o caminho selecionado." }, 400);
    }
    if (!VALID_MODALITIES.has(modality)) {
      return reply({ error: "Selecione uma modalidade válida (Online ou Presencial)." }, 400);
    }
    if (!VALID_NETWORKS.has(schoolNetwork)) {
      return reply({ error: "Selecione uma rede de ensino válida." }, 400);
    }

    const phoneDigits = phone.replace(/\D/g, "");
    const nowIso = new Date().toISOString();

    // Check existing WhatsApp funnel lead by email or phone_digits to avoid duplicate clutter
    const { data: existingByEmail } = await supabase
      .from("leads")
      .select("id")
      .eq("origin", "whatsapp")
      .ilike("email", email)
      .maybeSingle();

    const { data: existingByPhone } = await supabase
      .from("leads")
      .select("id")
      .eq("origin", "whatsapp")
      .eq("phone_digits", phoneDigits)
      .maybeSingle();

    const existingLead = existingByEmail ?? existingByPhone;

    if (existingLead) {
      const { error: updateErr } = await supabase
        .from("leads")
        .update({
          name,
          email,
          phone,
          interest,
          school_year_2027: schoolYear,
          modality,
          school_network: schoolNetwork,
          entry_page: entryPage,
          funnel_id: "funil-whatsapp",
          updated_at: nowIso,
        })
        .eq("id", existingLead.id);

      if (updateErr) {
        console.error("WhatsApp lead update error:", updateErr);
        return reply({ error: "Erro ao atualizar cadastro." }, 500);
      }

      return reply({ ok: true, lead_id: existingLead.id, updated: true });
    }

    const { data: insertedLead, error: insertErr } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        phone,
        campaign_id: null,
        privacy_consent: true,
        origin: "whatsapp",
        entry_page: entryPage,
        funnel_id: "funil-whatsapp",
        interest,
        school_year_2027: schoolYear,
        modality,
        school_network: schoolNetwork,
        lead_status: "novo",
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (insertErr || !insertedLead) {
      console.error("WhatsApp lead insert error:", insertErr);
      return reply({ error: "Erro ao registrar cadastro." }, 500);
    }

    return reply({ ok: true, lead_id: insertedLead.id, updated: false });
  } catch (err) {
    console.error("Unexpected error in save-whatsapp-lead:", err);
    return reply({ error: "Erro interno ao processar solicitação." }, 500);
  }
});
