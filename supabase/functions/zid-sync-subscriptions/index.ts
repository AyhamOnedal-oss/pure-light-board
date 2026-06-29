// Hourly sync: for every active Zid connection, fetch current subscription
// and charge list from Zid Merchant API and upsert into zid_subscriptions /
// zid_charges. Idempotent on (tenant_id) and (zid_charge_id).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { computeZidCharge, normalizeZidPlanCode, normalizeZidStatus } from "../_shared/zid-billing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const ZID_API_BASE = "https://api.zid.sa";

async function zidGet(path: string, authToken: string, managerToken: string) {
  const res = await fetch(`${ZID_API_BASE}${path}`, {
    headers: {
      "Accept": "application/json",
      "Accept-Language": "ar",
      "Authorization": `Bearer ${authToken}`,
      "X-Manager-Token": managerToken,
      "Store-Id": "",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`zid ${path} ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return {}; }
}

async function syncOneTenant(conn: any) {
  const tenantId: string = conn.tenant_id;
  const storeUuid: string = conn.store_uuid;
  const authToken: string = conn.authorization_token;
  const managerToken: string = conn.manager_token;
  if (!authToken || !managerToken) return { tenantId, skipped: "missing tokens" };

  let inserted = 0, subUpdated = false;
  try {
    // 1. Current subscription
    const subRes = await zidGet("/v1/managers/store/subscriptions", authToken, managerToken);
    const sub = subRes?.subscription ?? subRes?.data?.subscription ?? subRes?.data ?? subRes;
    if (sub) {
      const planRaw = sub.plan_code ?? sub.plan?.code ?? sub.plan?.name ?? sub.plan_name;
      await supabase.from("zid_subscriptions").upsert({
        tenant_id: tenantId,
        zid_store_id: storeUuid,
        zid_plan_code: normalizeZidPlanCode(planRaw),
        status: normalizeZidStatus(sub.status),
        started_at: sub.started_at ?? sub.created_at ?? null,
        current_period_end: sub.current_period_end ?? sub.expires_at ?? sub.end_at ?? null,
        cancelled_at: sub.cancelled_at ?? null,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
      subUpdated = true;
    }

    // 2. Charges
    const chargesRes = await zidGet("/v1/managers/store/charges", authToken, managerToken);
    const charges: any[] = chargesRes?.charges ?? chargesRes?.data?.charges ?? chargesRes?.data ?? [];
    for (const ch of Array.isArray(charges) ? charges : []) {
      const zidChargeId = String(ch.id ?? ch.charge_id ?? ch.uuid ?? "");
      if (!zidChargeId) continue;
      const gross = Number(ch.amount ?? ch.price ?? ch.total ?? 0);
      const chargedAt = new Date(ch.paid_at ?? ch.charged_at ?? ch.created_at ?? Date.now());
      const status = (ch.status ?? "paid").toString().toLowerCase();
      const normStatus = status.includes("refund") ? "refunded"
        : status.includes("pend") ? "pending" : "paid";
      const planRaw = ch.plan_code ?? ch.plan?.code ?? ch.plan?.name;
      const math = computeZidCharge(gross, chargedAt);
      const { error } = await supabase.from("zid_charges").upsert({
        tenant_id: tenantId,
        zid_charge_id: zidChargeId,
        zid_plan_code: normalizeZidPlanCode(planRaw),
        charged_at: chargedAt.toISOString(),
        status: normStatus,
        ...math,
        raw: ch,
      }, { onConflict: "zid_charge_id", ignoreDuplicates: false });
      if (!error) inserted++;
    }
  } catch (e) {
    return { tenantId, error: (e as Error).message };
  }
  return { tenantId, subUpdated, charges: inserted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { data: conns, error } = await supabase
    .from("zid_connections")
    .select("tenant_id,store_uuid,authorization_token,manager_token")
    .eq("is_active", true)
    .eq("connection_status", "connected");
  if (error) return jsonResponse({ error: error.message }, 500);

  const results = [];
  for (const c of conns ?? []) {
    results.push(await syncOneTenant(c));
  }
  return jsonResponse({ ok: true, processed: results.length, results });
});