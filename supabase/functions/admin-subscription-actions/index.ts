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
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});