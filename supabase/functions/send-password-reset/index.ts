// send-password-reset — generates a Supabase recovery link via the admin
// API and emails it using the same Resend setup as send-login-notification,
// with an Arabic RTL template matching the brand's password-reset mockup.
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

function resetEmailHtml(opts: {
  storeName: string;
  requestDate: string;
  requestTime: string;
  expiryMinutes: number;
  resetUrl: string;
}): string {
  const e = {
    store_name: escapeHtml(opts.storeName),
    request_date: escapeHtml(opts.requestDate),
    request_time: escapeHtml(opts.requestTime),
    expiry_minutes: String(opts.expiryMinutes),
    reset_url: escapeHtml(opts.resetUrl),
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
              <div style="font-size:36px;line-height:1;margin-bottom:12px;">🔑</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;">إعادة تعيين كلمة المرور</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-size:15px;line-height:1.8;color:#1e3a5f;direction:rtl;text-align:right;">
              <p style="margin:0 0 12px;">مرحبًا <strong>${e.store_name}</strong>،</p>
              <p style="margin:0 0 20px;">لقد تم طلب إعادة تعيين كلمة المرور لحسابك في فقاعة AI</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5fb;border:1px solid #dbe6f5;border-radius:10px;margin:16px 0;">
                <tr><td style="padding:18px 20px;direction:rtl;text-align:right;">
                  <div style="margin:6px 0;font-size:14px;color:#1e3a5f;">📅 <strong>التاريخ:</strong> ${e.request_date}</div>
                  <div style="margin:6px 0;font-size:14px;color:#1e3a5f;">🕐 <strong>الوقت:</strong> ${e.request_time}</div>
                  <div style="margin:6px 0;font-size:14px;color:#1e3a5f;">⏱ <strong>صلاحية الرابط:</strong> ${e.expiry_minutes} دقيقة</div>
                </td></tr>
              </table>

              <div style="text-align:center;margin:24px 0 8px;">
                <a href="${e.reset_url}" style="display:inline-block;background:#1e3a6b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;">🔗 إعادة تعيين كلمة المرور</a>
              </div>

              <div style="background:#f7f9fc;border:1px solid #e6eaf2;color:#5a6b85;border-radius:8px;padding:12px 14px;font-size:13px;margin:18px 0;direction:rtl;text-align:right;">
                💡 إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
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

function buildDirectResetUrl(opts: {
  appResetUrl: string;
  actionLink: string;
  tokenHash?: string | null;
}): string {
  try {
    if (!opts.tokenHash) return opts.actionLink;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const url = new URL(`${supabaseUrl}/functions/v1/send-password-reset`);
    url.searchParams.set("token_hash", opts.tokenHash);
    url.searchParams.set("redirect_to", opts.appResetUrl);
    return url.toString();
  } catch (_) {
    return opts.actionLink;
  }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    const fallbackAppUrl = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get("redirect_to") || `${fallbackAppUrl}/reset-password`;
    const safeRedirect = redirectTo.startsWith("http") ? redirectTo : `${fallbackAppUrl}/reset-password`;
    const tokenHash = url.searchParams.get("token_hash") || "";

    const redirectWithError = new URL(safeRedirect);
    redirectWithError.searchParams.set("type", "recovery");
    redirectWithError.searchParams.set("error_code", "otp_expired");

    if (!tokenHash) {
      return Response.redirect(redirectWithError.toString(), 302);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const auth = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    const session = data?.session;
    if (error || !session?.access_token || !session?.refresh_token) {
      return Response.redirect(redirectWithError.toString(), 302);
    }

    const resetUrl = new URL(safeRedirect);
    const hash = new URLSearchParams({
      access_token: session.access_token,
      expires_at: String(session.expires_at ?? Math.floor(Date.now() / 1000) + Number(session.expires_in ?? 3600)),
      expires_in: String(session.expires_in ?? 3600),
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? "bearer",
      type: "recovery",
    });
    resetUrl.hash = hash.toString();
    return Response.redirect(resetUrl.toString(), 302);
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { email: rawEmail, redirectTo } = await req.json().catch(() => ({}));
    const email = String(rawEmail ?? "").trim().toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return json({ error: "invalid_email" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
    const redirect = typeof redirectTo === "string" && redirectTo.startsWith("http")
      ? redirectTo
      : `${APP_URL}/reset-password`;

    // Generate the recovery link (does not send Supabase's own email).
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect },
    });

    // Always return ok to avoid email enumeration.
    const props = linkData?.properties as { action_link?: string; hashed_token?: string } | undefined;
    if (linkErr || !props?.action_link) {
      return json({ ok: true });
    }
    const resetUrl = buildDirectResetUrl({
      appResetUrl: redirect,
      actionLink: props.action_link,
      tokenHash: props.hashed_token,
    });

    // Resolve store name (best-effort).
    let storeName = "متجرك";
    try {
      const userId = linkData.user?.id;
      if (userId) {
        const { data: mem } = await admin
          .from("auth_tenant_members")
          .select("tenant_id, role, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        const tenantId = (mem ?? []).find((m: any) => m.role !== "owner")?.tenant_id
          ?? (mem ?? [])[0]?.tenant_id ?? null;
        if (tenantId) {
          const { data: ws } = await admin
            .from("settings_workspace")
            .select("name")
            .eq("id", tenantId)
            .maybeSingle();
          if (ws?.name) storeName = ws.name;
        }
      }
    } catch (_) { /* ignore */ }

    const now = new Date();
    // Always Gregorian English to avoid Hijri month names like "محرم".
    const requestDate = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "short", day: "2-digit",
    }).format(now);
    const requestTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);

    const html = resetEmailHtml({
      storeName, requestDate, requestTime, expiryMinutes: 60, resetUrl,
    });
    const sent = await sendResend(email, "إعادة تعيين كلمة المرور — فقاعة AI", html);
    return json({ ok: true, email_sent: sent.ok, email_error: sent.error });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});