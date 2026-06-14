// Triggered by bump_word_usage when monthly usage first crosses 80% in a period.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail } from "../_shared/resend.ts";
import { lowBalanceWarningHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-low-balance-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secretRow } = await admin.from("_app_secrets").select("value").eq("key", "low_balance_webhook_secret").maybeSingle();
    const expected = secretRow?.value as string | undefined;
    if (!expected || req.headers.get("x-low-balance-secret") !== expected) return json({ error: "unauthorized" }, 401);

    const { tenant_id } = await req.json();
    if (!tenant_id) return json({ error: "missing tenant_id" }, 400);

    const { data: plan } = await admin.from("settings_plans")
      .select("monthly_word_quota, monthly_words_used").eq("tenant_id", tenant_id).maybeSingle();
    const { data: ws } = await admin.from("settings_workspace").select("name").eq("id", tenant_id).maybeSingle();
    const { data: member } = await admin.from("auth_tenant_members")
      .select("user_id").eq("tenant_id", tenant_id).eq("role", "owner")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!member?.user_id) return json({ error: "no owner" }, 404);
    const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
    const recipient = userRes?.user?.email;
    if (!recipient) return json({ error: "owner has no email" }, 404);

    const total = plan?.monthly_word_quota ?? 0;
    const used = plan?.monthly_words_used ?? 0;
    const remaining = Math.max(total - used, 0);
    const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

    const html = lowBalanceWarningHtml({
      store_name: ws?.name ?? "متجرك",
      used_percent: String(percent),
      used_words: used.toLocaleString("en-US"),
      total_words: total.toLocaleString("en-US"),
      remaining_words: remaining.toLocaleString("en-US"),
      renewal_link: "https://fuqah.ai/?settings=plans",
    });
    const send = await sendResendEmail({
      to: recipient,
      subject: `وصلت إلى ${percent}% من رصيدك في فقاعة AI`,
      html,
    });
    return json(send, send.ok ? 200 : 500);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});