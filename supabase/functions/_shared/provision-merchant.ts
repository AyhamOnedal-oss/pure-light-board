// Shared helper: provision a Supabase auth user for a merchant who installed
// our app on Zid or Salla, then email them their login credentials via Resend.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2.49.8";

export type Platform = "zid" | "salla";

export interface ProvisionResult {
  tenantId: string | null;
  userId: string | null;
  isNewUser: boolean;
  generatedPassword?: string;
  emailSent: boolean;
  emailError?: string;
}

function generatePassword(len = 16): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  // listUsers is paginated; iterate until found or pages exhausted (cap to 5 pages = 5000 users).
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (match) return { id: match.id };
    if (data.users.length < 1000) break;
  }
  return null;
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `${r.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function welcomeEmailHtml(opts: {
  platform: Platform;
  storeName: string | null;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  const platformName = opts.platform === "zid" ? "Zid" : "Salla";
  const greetingName = opts.storeName ? ` ${opts.storeName}` : "";
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f6f7fb; padding:24px; color:#0b1320;">
    <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:14px; padding:28px; border:1px solid #e6e8ef;">
      <h2 style="margin:0 0 8px; color:#043CC8;">Welcome to Fuqah AI${greetingName}!</h2>
      <p style="margin:0 0 16px; color:#444;">Your ${platformName} store has been connected successfully. Use the credentials below to sign in to your dashboard.</p>
      <div style="background:#f3f5fb; border-radius:10px; padding:16px; margin:18px 0; font-size:14px;">
        <div><strong>Email:</strong> ${opts.email}</div>
        <div style="margin-top:6px;"><strong>Temporary password:</strong> <code style="background:#fff; padding:2px 6px; border-radius:4px; border:1px solid #e6e8ef;">${opts.password}</code></div>
      </div>
      <a href="${opts.loginUrl}" style="display:inline-block; background:#043CC8; color:#fff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:600;">Sign in to your dashboard</a>
      <p style="margin:24px 0 0; color:#666; font-size:12px;">For your security, please change this password after your first sign-in from Settings → Account.</p>
      <hr style="border:none; border-top:1px solid #eef0f5; margin:22px 0;" />
      <p style="margin:0; color:#999; font-size:12px;">Fuqah AI · AI-powered customer service</p>
    </div>
  </body>
</html>`;
}

function linkedEmailHtml(opts: {
  platform: Platform;
  storeName: string | null;
  email: string;
  loginUrl: string;
}): string {
  const platformName = opts.platform === "zid" ? "Zid" : "Salla";
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f6f7fb; padding:24px; color:#0b1320;">
    <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:14px; padding:28px; border:1px solid #e6e8ef;">
      <h2 style="margin:0 0 8px; color:#043CC8;">Your ${platformName} store is connected</h2>
      <p style="margin:0 0 16px; color:#444;">${opts.storeName ?? "Your store"} has been linked to your existing Fuqah AI account (${opts.email}). Sign in with your existing password.</p>
      <a href="${opts.loginUrl}" style="display:inline-block; background:#043CC8; color:#fff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:600;">Sign in to your dashboard</a>
    </div>
  </body>
</html>`;
}

/**
 * Look up or create a Supabase auth user for the merchant's store_email.
 * Returns the resolved tenant_id (best-effort: most recent owned tenant).
 * Sends a Resend email with credentials (new user) or a "linked" notice (existing).
 */
export async function provisionMerchantAccount(opts: {
  email: string;
  platform: Platform;
  storeName: string | null;
  appBaseUrl: string;
}): Promise<ProvisionResult> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const email = opts.email.trim().toLowerCase();
  // Use the root URL (always served by the published host) with an explicit
  // oauth_result marker so the SPA renders the success/login screen.
  const loginUrl = `${opts.appBaseUrl}/?oauth_result=install_success&from=${opts.platform}&email=${encodeURIComponent(email)}`;

  let userId: string | null = null;
  let isNewUser = false;
  let generatedPassword: string | undefined;

  const existing = await findUserByEmail(admin, email);
  if (existing) {
    userId = existing.id;
  } else {
    const password = generatePassword(16);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: opts.storeName ?? email.split("@")[0],
        source: opts.platform,
      },
    });
    if (error || !created.user) {
      throw error ?? new Error("createUser returned no user");
    }
    userId = created.user.id;
    isNewUser = true;
    generatedPassword = password;
  }

  // Resolve tenant id (most-recent owned tenant) — handle_new_user trigger
  // creates a workspace + owner membership for new users automatically.
  let tenantId: string | null = null;
  if (userId) {
    const { data: membership } = await admin
      .from("auth_tenant_members")
      .select("tenant_id, created_at")
      .eq("user_id", userId)
      .eq("role", "owner")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    tenantId = membership?.tenant_id ?? null;
  }

  // Send credentials / linked notice
  let emailSent = false;
  let emailError: string | undefined;
  const send = isNewUser
    ? await sendResendEmail({
        to: email,
        subject: `Your ${opts.platform === "zid" ? "Zid" : "Salla"} store is connected — sign in to Fuqah AI`,
        html: welcomeEmailHtml({
          platform: opts.platform,
          storeName: opts.storeName,
          email,
          password: generatedPassword!,
          loginUrl,
        }),
      })
    : await sendResendEmail({
        to: email,
        subject: `Your ${opts.platform === "zid" ? "Zid" : "Salla"} store is now linked to Fuqah AI`,
        html: linkedEmailHtml({
          platform: opts.platform,
          storeName: opts.storeName,
          email,
          loginUrl,
        }),
      });
  emailSent = send.ok;
  emailError = send.error;

  return { tenantId, userId, isNewUser, generatedPassword, emailSent, emailError };
}