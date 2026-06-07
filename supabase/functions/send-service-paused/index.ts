// Triggered by bump_word_usage when monthly quota is exhausted.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail } from "../_shared/resend.ts";
import { servicePausedHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-service-paused-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secretRow } = await admin.from("_app_secrets").select("value").eq("key", "service_paused_webhook_secret").maybeSingle();
    const expected = secretRow?.value as string | undefined;
    if (!expected || req.headers.get("x-service-paused-secret") !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
    }
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "missing tenant_id" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const { data: ws } = await admin.from("settings_workspace").select("name").eq("id", tenant_id).maybeSingle();
    const { data: member } = await admin
      .from("auth_tenant_members").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!member?.user_id) {
      return new Response(JSON.stringify({ error: "no owner" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });
    }
    const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
    const recipient = userRes?.user?.email;
    if (!recipient) {
      return new Response(JSON.stringify({ error: "owner has no email" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });
    }

    const html = servicePausedHtml({
      store_name: ws?.name ?? "متجرك",
      renewal_link: "https://fuqah.ai/?settings=plans",
    });
    const send = await sendResendEmail({
      to: recipient,
      subject: "تم إيقاف خدمة فقاعة AI مؤقتًا — اشحن رصيدك",
      html,
    });
    return new Response(JSON.stringify(send), { status: send.ok ? 200 : 500, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});