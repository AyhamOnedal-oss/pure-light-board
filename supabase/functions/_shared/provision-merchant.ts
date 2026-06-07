// Shared helper: provision a Supabase auth user for a merchant who installed
// our app on Zid or Salla, then email them their login credentials via Resend.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail } from "./resend.ts";
import { welcomeHtml } from "./email-templates-ar.ts";

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
  let send: { ok: boolean; error?: string };
  if (isNewUser) {
    // Pull plan metadata for the welcome email card
    let packageName = "تجريبية";
    let monthlyWordQuota = 0;
    let periodStart: string | null = null;
    if (tenantId) {
      const [{ data: ws }, { data: pl }] = await Promise.all([
        admin.from("settings_workspace").select("plan").eq("id", tenantId).maybeSingle(),
        admin.from("settings_plans").select("monthly_word_quota, period_start").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      if (ws?.plan) packageName = String(ws.plan);
      monthlyWordQuota = Number(pl?.monthly_word_quota ?? 0);
      periodStart = (pl?.period_start as string | null) ?? null;
    }
    const expiresDate = periodStart ? new Date(periodStart) : new Date();
    expiresDate.setUTCMonth(expiresDate.getUTCMonth() + 1);
    const expiresAt = new Intl.DateTimeFormat("ar-SA", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "long", day: "numeric",
    }).format(expiresDate);
    const charactersCount = monthlyWordQuota > 0
      ? new Intl.NumberFormat("ar-SA").format(monthlyWordQuota * 5)
      : "غير محدود";
    send = await sendResendEmail({
      to: email,
      subject: "تم تفعيل اشتراكك بنجاح",
      html: welcomeHtml({
        store_name: opts.storeName ?? email.split("@")[0],
        email,
        package_name: packageName,
        expires_at: expiresAt,
        password: generatedPassword!,
        conversations_count: "غير محدود",
        characters_count: charactersCount,
      }),
    });
  } else {
    send = await sendResendEmail({
        to: email,
        subject: `Your ${opts.platform === "zid" ? "Zid" : "Salla"} store is now linked to Fuqah AI`,
        html: linkedEmailHtml({
          platform: opts.platform,
          storeName: opts.storeName,
          email,
          loginUrl,
        }),
      });
  }
  emailSent = send.ok;
  emailError = send.error;

  return { tenantId, userId, isNewUser, generatedPassword, emailSent, emailError };
}