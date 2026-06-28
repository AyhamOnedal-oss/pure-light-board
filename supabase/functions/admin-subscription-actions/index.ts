import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const uid = claims.claims.sub as string;

  const admin = createClient(url, service);
  const { data: roleRow } = await admin
    .from("auth_user_roles")
    .select("role")
    .eq("user_id", uid)
    .in("role", ["super_admin", "admin"])
    .maybeSingle();
  if (!roleRow) return json({ error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const tenantId: string = body.tenantId;
  const action: string = body.action;
  if (!tenantId || !action) return json({ error: "missing_fields" }, 400);

  const today = new Date().toISOString().slice(0, 10);

  if (action === "end") {
    const { error: e1 } = await admin
      .from("settings_plans")
      .update({ subscription_end_date: today, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (e1) return json({ error: e1.message }, 500);
    await admin
      .from("settings_workspace")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("id", tenantId);
    return json({ ok: true });
  }

  if (action === "add_words") {
    const words = Math.floor(Number(body.words || 0));
    if (!words || words <= 0) return json({ error: "invalid_words" }, 400);
    const { data: plan, error: pErr } = await admin
      .from("settings_plans")
      .select("monthly_word_quota")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    const newQuota = Number(plan?.monthly_word_quota || 0) + words;
    const { error: uErr } = await admin
      .from("settings_plans")
      .update({ monthly_word_quota: newQuota, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (uErr) return json({ error: uErr.message }, 500);
    await admin.from("admin_credit_topups").insert({
      tenant_id: tenantId, words, added_by: uid, note: body.note ?? null,
    });
    return json({ ok: true, new_quota: newQuota });
  }

  if (action === "renew_trial") {
    const { data: ws } = await admin
      .from("settings_workspace")
      .select("plan, status")
      .eq("id", tenantId)
      .maybeSingle();
    const planKey = String(ws?.plan || "").toLowerCase();
    const isTrial = planKey === "" || planKey === "free" || planKey === "trial";
    if (!isTrial) return json({ error: "trial_only" }, 400);
    const end = new Date(); end.setUTCDate(end.getUTCDate() + 14);
    const endStr = end.toISOString().slice(0, 10);
    const { error: pErr } = await admin
      .from("settings_plans")
      .update({
        monthly_words_used: 0,
        period_start: today,
        subscription_end_date: endStr,
        service_paused_emailed_period: null,
        low_balance_emailed_period: null,
        expired_emailed_at: null,
        trial_ended_emailed_at: null,
        expiry_warned_for_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);
    if (pErr) return json({ error: pErr.message }, 500);
    await admin
      .from("settings_workspace")
      .update({ status: "trial", updated_at: new Date().toISOString() })
      .eq("id", tenantId);
    // Resolve actor name
    let actorName: string | null = null;
    const { data: staffRow } = await admin
      .from("admin_team_members").select("full_name").eq("user_id", uid).maybeSingle();
    if (staffRow?.full_name) actorName = staffRow.full_name as string;
    await admin.from("admin_activity_events").insert({
      tenant_id: tenantId,
      event_type: "resubscribe",
      actor_user_id: uid,
      actor_name: actorName,
      metadata: { end_date: endStr },
    });
    return json({ ok: true });
  }

  // ---- Helpers shared by account actions ----
  async function getTenantOwners(): Promise<Array<{ user_id: string; email: string | null }>> {
    const { data: members } = await admin
      .from("auth_tenant_members")
      .select("user_id, role, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    const owners = (members || []).filter((m: any) => m.role === "owner");
    const list = (owners.length ? owners : (members || [])).slice();
    const out: Array<{ user_id: string; email: string | null }> = [];
    for (const m of list) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      out.push({ user_id: m.user_id, email: u?.user?.email ?? null });
    }
    return out;
  }

  async function logActivity(eventType: string, metadata: Record<string, unknown> = {}) {
    let actorName: string | null = null;
    const { data: staffRow } = await admin
      .from("admin_team_members").select("full_name").eq("user_id", uid).maybeSingle();
    if (staffRow?.full_name) actorName = staffRow.full_name as string;
    await admin.from("admin_activity_events").insert({
      tenant_id: tenantId, event_type: eventType,
      actor_user_id: uid, actor_name: actorName, metadata,
    });
  }

  if (action === "disable_account") {
    const { error } = await admin
      .from("settings_workspace")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("id", tenantId);
    if (error) return json({ error: error.message }, 500);
    await logActivity("account_disabled");
    return json({ ok: true });
  }

  if (action === "enable_account") {
    const { data: ws } = await admin
      .from("settings_workspace").select("plan").eq("id", tenantId).maybeSingle();
    const planKey = String(ws?.plan || "").toLowerCase();
    const isTrial = planKey === "" || planKey === "free" || planKey === "trial";
    const { error } = await admin
      .from("settings_workspace")
      .update({ status: isTrial ? "trial" : "active", updated_at: new Date().toISOString() })
      .eq("id", tenantId);
    if (error) return json({ error: error.message }, 500);
    await logActivity("account_enabled");
    return json({ ok: true });
  }

  if (action === "enable_bubble" || action === "disable_bubble") {
    const enabled = action === "enable_bubble";
    // upsert to be safe if no design row exists yet
    const { data: existing } = await admin
      .from("settings_chat_design").select("tenant_id").eq("tenant_id", tenantId).maybeSingle();
    let err;
    if (existing) {
      ({ error: err } = await admin
        .from("settings_chat_design")
        .update({ bubble_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId));
    } else {
      ({ error: err } = await admin
        .from("settings_chat_design")
        .insert({ tenant_id: tenantId, bubble_enabled: enabled }));
    }
    if (err) return json({ error: err.message }, 500);
    await logActivity(enabled ? "bubble_enabled" : "bubble_disabled");
    return json({ ok: true });
  }

  if (action === "send_password_reset" || action === "send_email_reset") {
    const owners = await getTenantOwners();
    if (!owners.length) return json({ error: "no_owner" }, 404);
    const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";
    let sent = 0;
    for (const o of owners) {
      if (!o.email) continue;
      if (action === "send_password_reset") {
        await fetch(`${url}/functions/v1/send-password-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: service, Authorization: `Bearer ${service}` },
          body: JSON.stringify({ email: o.email, redirectTo: `${APP_URL}/reset-password` }),
        });
      } else {
        // Email reset = send magic link so they can sign in and change email from settings.
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: "magiclink", email: o.email,
          options: { redirectTo: `${APP_URL}/settings` },
        } as any);
        const link = (linkData?.properties as any)?.action_link;
        if (link) {
          const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
          if (apiKey) {
            const from = Deno.env.get("RESEND_FROM_EMAIL") || "Fuqah AI <support@fuqah.net>";
            const html = `<div dir="rtl" style="font-family:sans-serif;color:#1e3a5f;line-height:1.7">
              <h2>تحديث البريد الإلكتروني</h2>
              <p>تم طلب رابط لتسجيل الدخول وتحديث البريد الإلكتروني لحسابك في فقاعة AI.</p>
              <p><a href="${link}" style="display:inline-block;background:#1e3a6b;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">تسجيل الدخول وتحديث البريد</a></p>
              <p style="color:#5a6b85;font-size:13px">إن لم تطلب ذلك يمكنك تجاهل الرسالة.</p>
            </div>`;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from, to: [o.email], subject: "تحديث البريد الإلكتروني — فقاعة AI", html }),
            });
          }
        }
      }
      sent++;
    }
    await logActivity(action, { recipients: sent });
    return json({ ok: true, sent });
  }

  if (action === "delete_account") {
    const owners = await getTenantOwners();
    for (const o of owners) {
      try { await admin.auth.admin.deleteUser(o.user_id); } catch (_) { /* ignore */ }
    }
    // Delete tenant-scoped rows first (in case FKs are missing CASCADE).
    const tables = [
      "admin_customer_notes", "admin_activity_events", "admin_credit_topups",
      "conversations_messages", "conversations_main", "conversations_customers",
      "tickets_activities", "tickets_main",
      "dashboard_usage_daily", "ai_classifier_usage",
      "settings_chat_design", "settings_train_ai", "settings_plans",
      "zid_connections", "salla_connections", "team_members",
      "auth_tenant_members",
    ];
    for (const tbl of tables) {
      try { await admin.from(tbl).delete().eq("tenant_id", tenantId); } catch (_) { /* ignore */ }
    }
    await admin.from("settings_workspace").delete().eq("id", tenantId);
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});