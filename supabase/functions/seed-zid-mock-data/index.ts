// Admin-only: wipes zid_subscriptions + zid_charges and re-seeds deterministic
// fixture data so the Reports page can be verified end-to-end without a live
// Zid store. Creates 5 fake tenants and ~30 charges across the last 6 months.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { computeZidCharge } from "../_shared/zid-billing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Plan code → price (must match zid_plan_map seeds)
const FIXTURES = [
  { plan: "trial",        price: 0,   status: "trial",     name: "متجر تجريبي زد" },
  { plan: "economy",      price: 99,  status: "active",    name: "متجر اقتصادي زد" },
  { plan: "basic",        price: 199, status: "active",    name: "متجر أساسي زد" },
  { plan: "professional", price: 399, status: "active",    name: "متجر احترافي زد" },
  { plan: "business",     price: 799, status: "cancelled", name: "متجر أعمال زد" },
];

async function getOrCreateTenant(name: string, index: number): Promise<string> {
  const fixtureName = `[MOCK-ZID] ${name}`;
  const { data: existing } = await supabase
    .from("settings_workspace").select("id").eq("name", fixtureName).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase.from("settings_workspace")
    .insert({ name: fixtureName, platform: "zid", status: "active", locale: "ar" })
    .select("id").single();
  if (error) throw new Error(`workspace create: ${error.message}`);
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require admin caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);
  const { data: canDo } = await supabase.rpc("admin_has_permission", { _user_id: user.id, _key: "admin_reports" });
  if (!canDo) return jsonResponse({ error: "forbidden" }, 403);

  // Wipe existing mock data (preserves real data — only fixture tenants)
  const { data: mockTenants } = await supabase
    .from("settings_workspace").select("id").ilike("name", "[MOCK-ZID]%");
  const mockIds = (mockTenants ?? []).map((t) => t.id);
  if (mockIds.length) {
    await supabase.from("zid_charges").delete().in("tenant_id", mockIds);
    await supabase.from("zid_subscriptions").delete().in("tenant_id", mockIds);
  }

  const now = new Date();
  const results: any[] = [];

  for (let i = 0; i < FIXTURES.length; i++) {
    const f = FIXTURES[i];
    const tenantId = await getOrCreateTenant(f.name, i);

    await supabase.from("zid_subscriptions").upsert({
      tenant_id: tenantId,
      zid_store_id: `mock-store-${i + 1}`,
      zid_plan_code: f.plan,
      status: f.status,
      started_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 180).toISOString(),
      current_period_end: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      cancelled_at: f.status === "cancelled" ? new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10).toISOString() : null,
      last_synced_at: now.toISOString(),
    }, { onConflict: "tenant_id" });

    if (f.price === 0) { results.push({ tenant: f.name, charges: 0 }); continue; }

    // 6 monthly charges, one per month back
    let chargeCount = 0;
    for (let m = 0; m < 6; m++) {
      const chargedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 15));
      const status = (m === 0 && i === 1) ? "pending" : (m === 5 && i === 3) ? "refunded" : "paid";
      const math = computeZidCharge(f.price, chargedAt);
      await supabase.from("zid_charges").upsert({
        tenant_id: tenantId,
        zid_charge_id: `mock-${i + 1}-${chargedAt.toISOString().slice(0, 7)}`,
        zid_plan_code: f.plan,
        charged_at: chargedAt.toISOString(),
        status,
        ...math,
        raw: { mock: true },
      }, { onConflict: "zid_charge_id" });
      chargeCount++;
    }
    results.push({ tenant: f.name, charges: chargeCount });
  }

  return jsonResponse({ ok: true, tenants: results });
});