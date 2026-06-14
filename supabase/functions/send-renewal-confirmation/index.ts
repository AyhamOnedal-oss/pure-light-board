// Triggered when subscription_end_date is extended (renewal or upgrade with payment).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail, formatRiyadhDate } from "../_shared/resend.ts";
import { renewalConfirmationHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-renewal-secret",
};

function planLabel(plan: string | null | undefined): string {
  switch ((plan ?? "").toLowerCase()) {
    case "economy":
    case "economic":
    case "starter":
    case "free": return "الاقتصادية";
    case "basic":
    case "essential": return "الأساسية";
    case "growth":
    case "professional":
    case "pro": return "الاحترافية";
    case "business":
    case "enterprise": return "الأعمال";
    default: return plan ? plan : "الحالية";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secretRow } = await admin.from("_app_secrets").select("value").eq("key", "renewal_confirmation_webhook_secret").maybeSingle();
    const expected = secretRow?.value as string | undefined;
    if (!expected || req.headers.get("x-renewal-secret") !== expected) return json({ error: "unauthorized" }, 401);

    const { tenant_id } = await req.json();
    if (!tenant_id) return json({ error: "missing tenant_id" }, 400);

    const { data: plan } = await admin.from("settings_plans")
      .select("monthly_word_quota, subscription_end_date").eq("tenant_id", tenant_id).maybeSingle();
    const { data: ws } = await admin.from("settings_workspace").select("name, plan").eq("id", tenant_id).maybeSingle();
    const { data: member } = await admin.from("auth_tenant_members")
      .select("user_id").eq("tenant_id", tenant_id).eq("role", "owner")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!member?.user_id) return json({ error: "no owner" }, 404);
    const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
    const recipient = userRes?.user?.email;
    if (!recipient) return json({ error: "owner has no email" }, 404);

    const end = plan?.subscription_end_date ? new Date(String(plan.subscription_end_date) + "T00:00:00Z") : null;
    const html = renewalConfirmationHtml({
      store_name: ws?.name ?? "متجرك",
      plan_name: planLabel(ws?.plan),
      new_end_date: end ? formatRiyadhDate(end) : "—",
      monthly_quota: (plan?.monthly_word_quota ?? 0).toLocaleString("en-US"),
    });
    const send = await sendResendEmail({
      to: recipient,
      subject: "تم تجديد اشتراكك في فقاعة AI بنجاح",
      html,
    });
    return json(send, send.ok ? 200 : 500);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});