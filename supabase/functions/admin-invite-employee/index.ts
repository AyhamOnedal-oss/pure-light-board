// admin-invite-employee — super-admin-only invite/edit/resend for the admin
// team panel. Creates auth user, upserts admin_team_members row, and sends
// the same Arabic RTL welcome email (Resend).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
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
  employeeName: string; email: string; password: string;
  addDate: string; addTime: string; loginUrl: string;
}): string {
  const e = {
    employee_name: escapeHtml(opts.employeeName),
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
              <div style="font-size:36px;line-height:1;margin-bottom:12px;">🛡️</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;">مرحبًا بك في فريق إدارة فقاعة AI!</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-size:15px;line-height:1.8;color:#1e3a5f;direction:rtl;text-align:right;">
              <p style="margin:0 0 12px;">مرحبًا <strong>${e.employee_name}</strong>،</p>
              <p style="margin:0 0 20px;">تمت إضافتك كعضو في فريق إدارة منصة فقاعة AI 🎉</p>

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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!r.ok) return { ok: false, error: `${r.status}: ${(await r.text()).slice(0, 400)}` };
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
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !callerId) return json({ error: "invalid_auth" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: caller must be super_admin
    const { data: roleRow } = await admin
      .from("auth_user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const member_id = body?.member_id ? String(body.member_id) : null;
    const resend = body?.resend === true;
    const name = String(body?.name ?? "").trim();
    const name_ar = String(body?.name_ar ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const permissions: string[] = Array.isArray(body?.permissions) ? body.permissions : [];
    const status = body?.status === "inactive" ? "inactive" : "active";

    // Resend flow: load existing row by id
    if (resend && member_id) {
      const { data: row } = await admin
        .from("admin_team_members")
        .select("id,name,name_ar,email")
        .eq("id", member_id)
        .maybeSingle();
      if (!row) return json({ error: "not_found" }, 404);

      const password = generatePassword(12);
      // Find or create auth user, then reset password
      let userId: string | null = null;
      const lookup = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(row.email)}`,
        { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
      );
      if (lookup.ok) {
        const j = await lookup.json();
        const match = (j?.users ?? []).find((u: any) =>
          (u?.email ?? "").toLowerCase() === row.email.toLowerCase());
        if (match?.id) userId = match.id;
      }
      if (!userId) {
        const { data: created } = await admin.auth.admin.createUser({
          email: row.email, password, email_confirm: true,
          user_metadata: { display_name: row.name || row.name_ar },
        });
        userId = created?.user?.id ?? null;
      } else {
        await admin.auth.admin.updateUserById(userId, { password });
      }

      const now = new Date();
      const fmtDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
      const loginUrl = `${APP_URL}/admin/login?email=${encodeURIComponent(row.email)}&invite=1`;
      // Ensure the admin role is granted (in case it was missing or revoked).
      if (userId) {
        await admin.from("auth_user_roles").upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id,role" },
        );
      }
      const html = inviteEmailHtml({
        employeeName: row.name_ar || row.name || row.email,
        email: row.email, password, addDate: fmtDate, addTime: fmtTime, loginUrl,
      });
      const sent = await sendResend(row.email, `إعادة إرسال بيانات الدخول — فقاعة AI`, html);
      return json({ ok: true, member_id, email_sent: sent.ok, email_error: sent.error });
    }

    // Edit flow: only update fields, no auth/email
    if (member_id) {
      const update: Record<string, unknown> = { name, name_ar, phone, permissions, status };
      if (email) update.email = email;
      const { error: upErr } = await admin.from("admin_team_members").update(update).eq("id", member_id);
      if (upErr) return json({ error: "update_failed", detail: upErr.message }, 500);
      // Grant or revoke the 'admin' role based on status, so the panel access
      // tracks the row's active/inactive state.
      const { data: row } = await admin
        .from("admin_team_members").select("email").eq("id", member_id).maybeSingle();
      if (row?.email) {
        const lookup = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(row.email)}`,
          { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
        );
        let uid: string | null = null;
        if (lookup.ok) {
          const j = await lookup.json();
          const match = (j?.users ?? []).find((u: any) =>
            (u?.email ?? "").toLowerCase() === row.email.toLowerCase());
          if (match?.id) uid = match.id;
        }
        if (uid) {
          if (status === "active") {
            await admin.from("auth_user_roles").upsert(
              { user_id: uid, role: "admin" },
              { onConflict: "user_id,role" },
            );
          } else {
            await admin.from("auth_user_roles").delete()
              .eq("user_id", uid).eq("role", "admin");
          }
        }
      }
      return json({ ok: true, member_id, email_sent: false });
    }

    // Create flow
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !(name || name_ar)) {
      return json({ error: "invalid_input" }, 400);
    }

    const { data: dup } = await admin
      .from("admin_team_members").select("id").eq("email", email).maybeSingle();
    if (dup) return json({ error: "email_exists", member_id: dup.id }, 409);

    const password = generatePassword(12);
    // Find or create auth user
    let userId: string | null = null;
    const lookup = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
    );
    if (lookup.ok) {
      const j = await lookup.json();
      const match = (j?.users ?? []).find((u: any) => (u?.email ?? "").toLowerCase() === email);
      if (match?.id) userId = match.id;
    }
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name: name || name_ar },
      });
      if (error || !created?.user) return json({ error: "create_user_failed", detail: error?.message }, 500);
      userId = created.user.id;
    } else {
      await admin.auth.admin.updateUserById(userId, { password });
    }

    const { data: ins, error: insErr } = await admin.from("admin_team_members").insert({
      name, name_ar, email, phone, permissions, status,
    }).select("id").single();
    if (insErr || !ins) return json({ error: "insert_failed", detail: insErr?.message }, 500);

    // Grant the 'admin' role so the new employee can access the admin panel.
    if (userId) {
      await admin.from("auth_user_roles").upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
    }

    const now = new Date();
    const fmtDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
    const loginUrl = `${APP_URL}/admin/login?email=${encodeURIComponent(email)}&invite=1`;
    const html = inviteEmailHtml({
      employeeName: name_ar || name, email, password,
      addDate: fmtDate, addTime: fmtTime, loginUrl,
    });
    const sent = await sendResend(email, `مرحبًا بك في فريق إدارة فقاعة AI`, html);

    return json({ ok: true, member_id: ins.id, email_sent: sent.ok, email_error: sent.error });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});