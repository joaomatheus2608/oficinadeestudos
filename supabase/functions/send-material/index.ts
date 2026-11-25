import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(params: {
  recipientName: string;
  campaignTitle: string;
  customMessage: string;
  downloadUrl: string;
}): string {
  const firstName = escapeHtml(params.recipientName.trim().split(" ")[0] || "Estudante");
  const safeTitle = escapeHtml(params.campaignTitle);
  const personalizedBody = escapeHtml(
    params.customMessage.replace(/\{nome\}/gi, firstName)
  ).replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#121926;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(4,16,38,0.18);">
          <!-- Header -->
          <tr>
            <td style="background:#041026;border-bottom:3px solid #FF5500;padding:28px 32px;text-align:center;">
              <div style="font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:0.5px;">Oficina de</div>
              <div style="font-size:24px;font-weight:800;color:#FF5500;letter-spacing:1px;">ESTUDOS</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#041026;">Olá, ${firstName}!</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#121926;">
                Você solicitou o material gratuito <strong>${safeTitle}</strong>.
              </p>
              <div style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#121926;background:#F4F6F9;padding:18px;border-radius:8px;border-left:4px solid #FF5500;">
                ${personalizedBody}
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
                <tr>
                  <td style="background:#FF5500;border-radius:8px;">
                    <a href="${params.downloadUrl}" target="_blank" rel="noopener"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">
                      ACESSAR / BAIXAR MATERIAL
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#5A6578;text-align:center;">
                Este link é exclusivo para você e expira em 7 dias.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#020814;padding:20px 32px;text-align:center;color:rgba(255,255,255,0.75);font-size:12px;">
              <strong style="color:#FFFFFF;">Oficina de Estudos</strong><br />
              Educação, organização e conhecimento ao seu alcance.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "Oficina de Estudos <materiais@oficinadeestudos.com.br>";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const campaignId = String(body.campaign_id ?? "").trim();
    const privacyConsent = Boolean(body.privacy_consent);

    // 1. Server-side validation
    if (name.length < 3 || name.length > 120) {
      return jsonResponse({ error: "Informe um nome válido (mínimo 3 caracteres)." }, 400);
    }
    if (!isValidEmail(email) || email.length > 200) {
      return jsonResponse({ error: "Informe um e-mail válido." }, 400);
    }
    if (!isValidPhoneBR(phone)) {
      return jsonResponse({ error: "Informe um telefone/WhatsApp válido com DDD." }, 400);
    }
    if (!privacyConsent) {
      return jsonResponse({ error: "É obrigatório aceitar a política de privacidade." }, 400);
    }
    if (!campaignId) {
      return jsonResponse({ error: "Campanha inválida." }, 400);
    }

    // 2. Verify active campaign
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .select("id, name, title, material_url, email_subject, email_content, is_active")
      .eq("id", campaignId)
      .eq("is_active", true)
      .maybeSingle();

    if (campError || !campaign) {
      return jsonResponse({ error: "Nenhuma campanha ativa encontrada." }, 404);
    }

    // 3. Check duplicate lead for same email + campaign
    let leadId: string;
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("campaign_id", campaign.id)
      .ilike("email", email)
      .maybeSingle();

    if (existingLead) {
      // Check if already sent recently (anti-spam / accidental double send)
      const { data: existingSend } = await supabase
        .from("email_sends")
        .select("id, status, created_at")
        .eq("lead_id", existingLead.id)
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSend && ["sent", "delivered", "processing"].includes(existingSend.status)) {
        return jsonResponse({
          ok: true,
          message: "Este e-mail já recebeu o material desta campanha. Verifique sua caixa de entrada e spam.",
        });
      }
      leadId = existingLead.id;
    } else {
      const { data: insertedLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name,
          email,
          phone,
          campaign_id: campaign.id,
          privacy_consent: true,
        })
        .select("id")
        .single();

      if (leadError || !insertedLead) {
        console.error("Lead insert error:", leadError);
        return jsonResponse({ error: "Erro ao registrar cadastro." }, 500);
      }
      leadId = insertedLead.id;
    }

    // 4. Create initial email_send record (processing)
    const { data: sendRecord, error: sendInsertErr } = await supabase
      .from("email_sends")
      .insert({
        lead_id: leadId,
        campaign_id: campaign.id,
        status: "processing",
      })
      .select("id")
      .single();

    if (sendInsertErr || !sendRecord) {
      console.error("email_sends insert error:", sendInsertErr);
      return jsonResponse({ error: "Erro ao iniciar envio." }, 500);
    }

    // 5. Generate signed URL for private material (7 days = 604800 seconds)
    let downloadUrl = campaign.material_url || "";
    if (downloadUrl.includes("/campaign-materials/")) {
      const storagePath = downloadUrl.split("/campaign-materials/").pop() ?? "";
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("campaign-materials")
        .createSignedUrl(storagePath, 604800);

      if (!signedErr && signedData?.signedUrl) {
        downloadUrl = signedData.signedUrl;
      }
    }

    if (!downloadUrl) {
      await supabase
        .from("email_sends")
        .update({ status: "failed", error_message: "Material da campanha não encontrado." })
        .eq("id", sendRecord.id);
      return jsonResponse({ error: "Material da campanha indisponível no momento." }, 500);
    }

    // 6. Send email via Resend API
    const html = buildEmailHtml({
      recipientName: name,
      campaignTitle: campaign.title,
      customMessage: campaign.email_content,
      downloadUrl,
    });

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [email],
        subject: campaign.email_subject,
        html,
      }),
    });

    const resendData = await resendResp.json();

    if (!resendResp.ok) {
      const errMsg = resendData?.message || `Resend HTTP ${resendResp.status}`;
      await supabase
        .from("email_sends")
        .update({
          status: "failed",
          error_message: errMsg,
        })
        .eq("id", sendRecord.id);
      return jsonResponse({ error: "Não foi possível enviar o e-mail. Tente novamente." }, 502);
    }

    // 7. Update email_sends with Resend ID & sent status
    await supabase
      .from("email_sends")
      .update({
        resend_id: resendData.id ?? null,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", sendRecord.id);

    return jsonResponse({ ok: true, resend_id: resendData.id });
  } catch (err) {
    console.error("Unexpected error in send-material:", err);
    return jsonResponse({ error: "Erro interno ao processar solicitação." }, 500);
  }
});
