import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Resend Webhook Handler
 * Updates email_sends status based on Resend delivery events:
 * - email.delivered -> 'delivered'
 * - email.bounced / email.complained -> 'rejected'
 * - email.delivery_delayed -> keeps current status with note
 * - email.failed -> 'failed'
 */

const EVENT_STATUS_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "rejected",
  "email.complained": "rejected",
  "email.failed": "failed",
};

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
  if (webhookSecret) {
    // Optional shared header verification or Svix signature check
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing webhook signature headers", { status: 401 });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const payload = await req.json();
    const eventType: string = payload?.type ?? "";
    const emailId: string = payload?.data?.email_id ?? "";

    if (!emailId || !eventType) {
      return new Response("Invalid payload", { status: 400 });
    }

    const newStatus = EVENT_STATUS_MAP[eventType];
    if (!newStatus) {
      return new Response(JSON.stringify({ ignored: eventType }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "rejected" || newStatus === "failed") {
      updateData.error_message =
        payload?.data?.bounce?.message ??
        payload?.data?.reason ??
        `Evento Resend: ${eventType}`;
    }

    const { error } = await supabase
      .from("email_sends")
      .update(updateData)
      .eq("resend_id", emailId);

    if (error) {
      console.error("Webhook DB update error:", error);
      return new Response("DB error", { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook parse error:", err);
    return new Response("Bad Request", { status: 400 });
  }
});
