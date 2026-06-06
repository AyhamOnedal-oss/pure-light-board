// send-login-notification — sends an Arabic RTL "new sign-in" email via
// Resend using support@fuqah.net. Called from the client right after a
// successful sign-in. Idempotent within a 1-minute window per user.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function loginEmailHtml(opts: {
  storeName: string;
  loginDate: string;
  loginTime: string;
  packageStatus: string;
  changePasswordUrl: string;
}): string {
  const e = {
    store_name: escapeHtml(opts.storeName),
    login_date: escapeHtml(opts.loginDate),
    login_time: escapeHtml(opts.loginTime),
    package_status: escapeHtml(opts.packageStatus),
    change_password_url: escapeHtml(opts.changePasswordUrl),
  };
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e3a5f;direction:rtl;text-align:right;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7fb;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6eaf2;">
          <tr>
            <td style="background:linear-gradient(135deg,#0b2546,#1e3a6b);padding:36px 24px;text-align:center;color:#ffffff;">
              <div style="font-size:36px;line-height:1;margin-bottom:12px;">🔐</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;">تسجيل دخول جديد إلى حسابك</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-size:15px;line-height:1.8;color:#1e3a5f;direction:rtl;text-align:right;">
              <p style="margin:0 0 12px;">مرحبًا <strong>${e.store_name}</strong>،</p>
              <p style="margin:0 0 20px;">تم تسجيل دخول إلى حسابك في فقاعة AI</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5fb;border:1px solid #dbe6f5;border-radius:10px;margin:16px 0;">
                <tr><td style="padding:18px 20px;direction:rtl;text-align:right;">
                  <div style="margin:6px 0;font-size:14px;color:#1e3a5f;">📅 <strong>التاريخ:</strong> ${e.login_date}</div>
                  <div style="margin:6px 0;font-size:14px;color:#1e3a5f;">🕐 <strong>الوقت:</strong> ${e.login_time}</div>
                  <div style="margin:6px 0;font-size:14px;color:#1e3a5f;">📦 <strong>حالة الباقة:</strong> ${e.package_status}</div>
                </td></tr>
              </table>

              <div style="background:#fff8e1;border:1px solid #ffe7a3;color:#7a5a00;border-radius:8px;padding:12px 14px;font-size:13px;margin:18px 0;direction:rtl;text-align:right;">
                ⚠ إذا لم تكن أنت من قام بتسجيل الدخول، يرجى <strong>تغيير كلمة المرور فورًا</strong> لحماية حسابك.
              </div>

              <div style="text-align:center;margin:24px 0 8px;">
                <a href="${e.change_password_url}" style="display:inline-block;background:#1e3a6b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;">تغيير كلمة المرور</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f7f9fc;border-top:1px solid #e6eaf2;padding:18px 24px;text-align:center;font-size:12px;color:#5a6b85;direction:rtl;">
              <div style="margin:0 0 6px;">🌐 <a href="https://www.fuqah.ai" style="color:#1e3a5f;text-decoration:none;" target="_blank" rel="noopener noreferrer nofollow">www.fuqah.ai</a></div>
              <div>📧 للدعم الفني: <a href="mailto:support@fuqah.ai" style="color:#1e3a5f;text-decoration:none;" target="_blank" rel="noopener noreferrer nofollow">support@fuqah.ai</a></div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendResend(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Fuqah AI <support@fuqah.net>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!r.ok) {
    const txt = await r.text();
    return { ok: false, error: `${r.status}: ${txt.slice(0, 400)}` };
  }
  return { ok: true };
}

// In-memory dedupe to avoid duplicate sends from token refresh races. Keys
// expire ~1 minute after creation. Best-effort only — edge function instances
// are ephemeral, so this is a safety net, not a guarantee.
const recentSends = new Map<string, number>();
function isDuplicate(userId: string): boolean {
  const now = Date.now();
  for (const [k, t] of recentSends) {
    if (now - t > 60_000) recentSends.delete(k);
  }
  const last = recentSends.get(userId) ?? 0;
  if (now - last < 60_000) return true;
  recentSends.set(userId, now);
  return false;
}

function packageStatusLabel(plan: any): string {
  const tier = String(plan?.tier ?? plan?.plan ?? "").toLowerCase();
  const status = String(plan?.status ?? "").toLowerCase();
  if (status === "trial" || tier === "trial") return "تجريبية";
  if (tier === "free") return "مجانية";
  if (tier === "basic") return "أساسية";
  if (tier === "pro") return "احترافية";
  if (tier === "enterprise") return "مؤسسات";
  if (status === "active") return "نشطة";
  if (status === "expired") return "منتهية";
  return "نشطة";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing_auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "invalid_auth" }, 401);
    const user = userData.user;
    const email = (user.email ?? "").toLowerCase();
    if (!email) return json({ error: "no_email" }, 400);

    if (isDuplicate(user.id)) return json({ ok: true, deduped: true });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve tenant via membership, mirroring AppContext's priority.
    const [memRes, invRes] = await Promise.all([
      admin.from("auth_tenant_members")
        .select("tenant_id, role, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      admin.from("team_members")
        .select("tenant_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const memberships = memRes.data ?? [];
    const inviteIds = new Set((invRes.data ?? []).map((i: any) => i.tenant_id));
    const pick =
      memberships.find((m: any) => inviteIds.has(m.tenant_id)) ||
      memberships.find((m: any) => m.role !== "owner") ||
      memberships[0];
    const tenantId = pick?.tenant_id ?? null;

    let storeName = "متجرك";
    let packageStatus = "نشطة";
    if (tenantId) {
      const [{ data: ws }, { data: plan }] = await Promise.all([
        admin.from("settings_workspace").select("name").eq("id", tenantId).maybeSingle(),
        admin.from("settings_plans").select("*").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      if (ws?.name) storeName = ws.name;
      if (plan) packageStatus = packageStatusLabel(plan);
    }

    const now = new Date();
    const loginDate = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "long", day: "numeric",
    }).format(now);
    const loginTime = new Intl.DateTimeFormat("ar-SA", {
      timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(now);

    const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
    const changePasswordUrl = `${APP_URL}/dashboard/settings/account?changePassword=1`;

    const html = loginEmailHtml({
      storeName, loginDate, loginTime, packageStatus, changePasswordUrl,
    });
    const sent = await sendResend(email, "تسجيل دخول جديد إلى حسابك — فقاعة AI", html);
    return json({ ok: true, email_sent: sent.ok, email_error: sent.error });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});