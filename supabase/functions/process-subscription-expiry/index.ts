// Daily cron entrypoint. Sends:
//  - subscription-expiry warning when 1..7 days remain (once per period).
//  - subscription-expired email on or after the end date (once).
// Header x-expiry-secret must match _app_secrets.subscription_expiry_webhook_secret.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail, formatRiyadhDate } from "../_shared/resend.ts";
import { subscriptionExpiredHtml, subscriptionExpiryWarningHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-expiry-secret",
};
const RENEWAL_LINK = "https://fuqah.ai/billing";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secretRow } = await admin.from("_app_secrets").select("value").eq("key", "subscription_expiry_webhook_secret").maybeSingle();
    const expected = secretRow?.value as string | undefined;
    if (!expected || req.headers.get("x-expiry-secret") !== expected) return json({ error: "unauthorized" }, 401);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const { data: plans } = await admin.from("settings_plans")
      .select("tenant_id, plan, subscription_end_date, expired_emailed_at, expiry_warned_for_date")
      .not("subscription_end_date", "is", null);

    const results: Array<{ tenant: string; action: string; ok: boolean; error?: string }> = [];
    for (const p of plans ?? []) {
      const end = String(p.subscription_end_date);
      const endDate = new Date(end + "T00:00:00Z");
      const diffDays = Math.floor((endDate.getTime() - new Date(todayStr + "T00:00:00Z").getTime()) / 86400000);

      const wantExpired = diffDays <= 0 && !p.expired_emailed_at;
      const wantWarn = diffDays > 0 && diffDays <= 7
        && (p.expiry_warned_for_date == null || String(p.expiry_warned_for_date) !== end);

      if (!wantExpired && !wantWarn) continue;

      const { data: ws } = await admin.from("settings_workspace").select("name").eq("id", p.tenant_id).maybeSingle();
      const { data: member } = await admin.from("auth_tenant_members")
        .select("user_id").eq("tenant_id", p.tenant_id).eq("role", "owner")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!member?.user_id) { results.push({ tenant: p.tenant_id, action: "skip", ok: false, error: "no owner" }); continue; }
      const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
      const recipient = userRes?.user?.email;
      if (!recipient) { results.push({ tenant: p.tenant_id, action: "skip", ok: false, error: "no email" }); continue; }

      if (wantExpired) {
        const html = subscriptionExpiredHtml({
          store_name: ws?.name ?? "متجرك",
          expiry_date: formatRiyadhDate(endDate),
          renewal_link: RENEWAL_LINK,
        });
        const send = await sendResendEmail({ to: recipient, subject: "انتهى اشتراكك في فقاعة AI", html });
        if (send.ok) {
          await admin.from("settings_plans").update({ expired_emailed_at: new Date().toISOString() }).eq("tenant_id", p.tenant_id);
        }
        results.push({ tenant: p.tenant_id, action: "expired", ok: send.ok, error: send.error });
      } else if (wantWarn) {
        const html = subscriptionExpiryWarningHtml({
          store_name: ws?.name ?? "متجرك",
          days_remaining: String(diffDays),
          package_name: String(p.plan ?? "الحالية"),
          renewal_link: RENEWAL_LINK,
        });
        const send = await sendResendEmail({ to: recipient, subject: `باقتك تنتهي خلال ${diffDays} يوم`, html });
        if (send.ok) {
          await admin.from("settings_plans").update({ expiry_warned_for_date: end }).eq("tenant_id", p.tenant_id);
        }
        results.push({ tenant: p.tenant_id, action: "warn", ok: send.ok, error: send.error });
      }
    }

    return json({ processed: results.length, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});