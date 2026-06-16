// invite-employee — create/find auth user, insert team_members row,
// send Arabic RTL welcome email via Resend (support@fuqah.net).
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

function generatePassword(len = 12): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function inviteEmailHtml(opts: {
  employeeName: string;
  storeName: string;
  email: string;
  password: string;
  addDate: string;
  addTime: string;
  loginUrl: string;
}): string {
  const e = {
    employee_name: escapeHtml(opts.employeeName),
    store_name: escapeHtml(opts.storeName),
    email: escapeHtml(opts.email),
    password: escapeHtml(opts.password),
    add_date: escapeHtml(opts.addDate),
    add_time: escapeHtml(opts.addTime),
    loginUrl: escapeHtml(opts.loginUrl),
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
              <div style="font-size:36px;line-height:1;margin-bottom:12px;">👋</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;">مرحبًا بك في فقاعة AI!</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-size:15px;line-height:1.8;color:#1e3a5f;direction:rtl;text-align:right;">
              <p style="margin:0 0 12px;">مرحبًا <strong>${e.employee_name}</strong>،</p>
              <p style="margin:0 0 20px;">تمت إضافتك كموظف خدمة عملاء في متجر <strong>${e.store_name}</strong> عبر منصة فقاعة AI 🎉</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5fb;border:1px solid #dbe6f5;border-radius:10px;margin:16px 0;">
                <tr><td style="padding:18px 20px;direction:rtl;text-align:right;">
                  <div style="font-weight:700;margin-bottom:12px;color:#1e3a5f;">📋 تفاصيل الدخول:</div>
                  <div style="margin:8px 0;font-size:13px;color:#3b5680;">📧 البريد الإلكتروني:</div>
                  <div style="background:#ffffff;border:1px solid #dbe6f5;border-radius:8px;padding:10px 12px;font-family:Menlo,Consolas,monospace;direction:ltr;text-align:left;unicode-bidi:isolate;">${e.email}</div>
                  <div style="margin:14px 0 8px;font-size:13px;color:#3b5680;">🔐 كلمة المرور:</div>
                  <div style="background:#ffffff;border:1px solid #dbe6f5;border-radius:8px;padding:10px 12px;font-family:Menlo,Consolas,monospace;direction:ltr;text-align:left;unicode-bidi:isolate;">${e.password}</div>
                  <div style="margin-top:14px;font-size:13px;color:#3b5680;">📅 تاريخ الإضافة: ${e.add_date} - ${e.add_time}</div>
                </td></tr>
              </table>

              <div style="background:#fff8e1;border:1px solid #ffe7a3;color:#7a5a00;border-radius:8px;padding:12px 14px;font-size:13px;margin:18px 0;direction:rtl;text-align:right;">
                ⚠ يُنصح بتغيير كلمة المرور بعد تسجيل الدخول الأول
              </div>

              <div style="text-align:center;margin:24px 0 8px;">
                <a href="${e.loginUrl}" style="display:inline-block;background:#1e3a6b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;">🔗 تسجيل الدخول</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f7f9fc;border-top:1px solid #e6eaf2;padding:18px 24px;text-align:center;font-size:12px;color:#5a6b85;direction:rtl;">
              <div style="margin:0 0 6px;">🌐 <a href="https://www.fugah.ai" style="color:#1e3a5f;text-decoration:none;" target="_blank" rel="noopener noreferrer nofollow">www.fugah.ai</a></div>
              <div>📧 للدعم الفني: <a href="mailto:support@fugah.ai" style="color:#1e3a5f;text-decoration:none;" target="_blank" rel="noopener noreferrer nofollow">support@fugah.ai</a></div>
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
    // Validate JWT via claims (works even if the server-side session was
    // revoked/expired, as long as the access token itself is still valid).
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(jwt);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !callerId) return json({ error: "invalid_auth" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body?.tenant_id ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const permissions = body?.permissions ?? {};
    const allow_existing = body?.allow_existing === true; // true for "resend invite"
    if (!tenant_id || !name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "invalid_input" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: caller must belong to tenant
    const { data: membership } = await admin
      .from("auth_tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    // Reject duplicate team member for this tenant (unless this is a
    // resend). Soft-deleted rows (deleted_at IS NOT NULL) are ignored so
    // a previously-removed member can be re-invited with the same email.
    const { data: dup } = await admin
      .from("team_members")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup && !allow_existing) {
      return json({ error: "email_exists", member_id: dup.id }, 409);
    }

    // Reject duplicate phone for this tenant (ignoring soft-deleted rows)
    if (phone) {
      const { data: dupPhone } = await admin
        .from("team_members")
        .select("id,email")
        .eq("tenant_id", tenant_id)
        .eq("phone", phone)
        .is("deleted_at", null)
        .maybeSingle();
      if (dupPhone && !allow_existing && dupPhone.email?.toLowerCase() !== email) {
        return json({ error: "phone_exists", member_id: dupPhone.id }, 409);
      }
    }

    // Find or create auth user (fast lookup via GoTrue admin REST)
    let isNewUser = false;
    let password = generatePassword(12);
    let userId: string | null = null;
    try {
      const lookup = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            apikey: SERVICE_ROLE,
          },
        },
      );
      if (lookup.ok) {
        const j = await lookup.json();
        const list = Array.isArray(j?.users) ? j.users : [];
        const match = list.find(
          (u: any) => (u?.email ?? "").toLowerCase() === email,
        );
        if (match?.id) userId = match.id;
      }
    } catch (_) {
      // fall through to createUser
    }
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });
      if (error || !created.user) {
        return json({ error: "create_user_failed", detail: error?.message }, 500);
      }
      userId = created.user.id;
      isNewUser = true;
    } else {
      await admin.auth.admin.updateUserById(userId, { password });
    }

    // Upsert team_members row keyed on (tenant_id, email). Match any row
    // including soft-deleted ones so re-inviting a deleted member revives
    // the original row instead of failing on a unique constraint.
    const { data: existingMember } = await admin
      .from("team_members")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("email", email)
      .maybeSingle();

    let memberId = existingMember?.id ?? null;
    if (memberId) {
      await admin.from("team_members").update({
        name,
        phone,
        permissions,
        status: "active",
        deleted_at: null,
        auth_revoked_at: null,
        disabled_at: null,
        dashboard_snapshot: null,
      }).eq("id", memberId);
    } else {
      const { data: ins, error: insErr } = await admin.from("team_members").insert({
        tenant_id, name, email, phone, permissions,
        status: "active", invited_by: callerId,
      }).select("id").single();
      if (insErr || !ins) {
        return json({ error: "insert_failed", detail: insErr?.message }, 500);
      }
      memberId = ins.id;
    }

    // Link team_members row to the auth user
    if (userId && memberId) {
      await admin.from("team_members").update({ user_id: userId }).eq("id", memberId);
    }

    // Enroll invitee as a member of the inviter's tenant
    if (userId) {
      await admin.from("auth_tenant_members").upsert(
        { tenant_id, user_id: userId, role: "viewer" },
        { onConflict: "tenant_id,user_id", ignoreDuplicates: true } as any,
      );
    }

    // Clean up any solo "personal" workspaces the invitee owns so they only
    // see the inviter's tenant. Runs for both newly-created users (where
    // handle_new_user auto-provisioned a workspace) and previously-existing
    // users that still carry a leftover personal workspace.
    if (userId) {
      const { data: ownTenants } = await admin
        .from("auth_tenant_members")
        .select("tenant_id, role")
        .eq("user_id", userId);
      for (const row of ownTenants ?? []) {
        if (row.tenant_id === tenant_id) continue;
        if (row.role !== "owner") continue;
        const { count } = await admin
          .from("auth_tenant_members")
          .select("user_id", { count: "exact", head: true })
          .eq("tenant_id", row.tenant_id);
        if ((count ?? 0) <= 1) {
          await admin.from("auth_tenant_members").delete().eq("tenant_id", row.tenant_id);
          await admin.from("settings_workspace").delete().eq("id", row.tenant_id);
        }
      }
    }

    // Resolve store name
    const { data: ws } = await admin
      .from("settings_workspace")
      .select("name")
      .eq("id", tenant_id)
      .maybeSingle();
    const storeName = ws?.name || "متجرك";

    const now = new Date();
    const fmtDate = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
    const fmtTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);

    const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
    // `invite=1` tells the login page to force-sign-out any stale session
    // (e.g. the admin who just sent the invite from the same browser) so the
    // invited employee actually authenticates as themselves.
    const loginUrl = `${APP_URL}/login?email=${encodeURIComponent(email)}&invite=1`;

    const html = inviteEmailHtml({
      employeeName: name,
      storeName,
      email,
      password,
      addDate: fmtDate,
      addTime: fmtTime,
      loginUrl,
    });

    const sent = await sendResend(
      email,
      `مرحبًا بك في فقاعة AI — ${storeName}`,
      html,
    );

    return json({
      ok: true,
      member_id: memberId,
      is_new_user: isNewUser,
      email_sent: sent.ok,
      email_error: sent.error,
    });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});