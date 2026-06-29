// Zid lifecycle webhook (uninstall, subscription changes).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse, hmacSha256Hex, timingSafeEqualHex } from "../_shared/cors.ts";
import { sendResendEmail, formatRiyadhDate } from "../_shared/resend.ts";
import { storeDisconnectedHtml } from "../_shared/email-templates-ar.ts";
import { computeZidCharge, normalizeZidPlanCode, normalizeZidStatus } from "../_shared/zid-billing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-zid-signature") ?? "";
  const secret = Deno.env.get("ZID_WEBHOOK_SECRET") ?? "";

  if (secret) {
    const expected = await hmacSha256Hex(secret, rawBody);
    if (!signature || !timingSafeEqualHex(signature.toLowerCase(), expected.toLowerCase())) {
      console.error("zid-webhook: invalid signature");
      return jsonResponse({ error: "Invalid signature" }, 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const eventType: string = payload.event ?? payload.type ?? "unknown";
  const storeUuid: string | null =
    payload.store_uuid ?? payload.data?.store_uuid ?? payload.store?.uuid ?? null;

  await supabase.from("zid_events").insert({
    store_uuid: storeUuid,
    event_type: eventType,
    event_data: payload,
  });

  try {
    if (eventType === "app.uninstalled" || eventType === "uninstall") {
      await supabase
        .from("zid_connections")
        .update({ is_active: false, connection_status: "disconnected" })
        .eq("store_uuid", storeUuid);
      // Mark subscription cancelled for the same tenant
      try {
        const { data: conn0 } = await supabase
          .from("zid_connections").select("tenant_id").eq("store_uuid", storeUuid).maybeSingle();
        if (conn0?.tenant_id) {
          await supabase.from("zid_subscriptions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString(), last_synced_at: new Date().toISOString() })
            .eq("tenant_id", conn0.tenant_id);
        }
      } catch (e) { console.error("zid-webhook: cancel sub failed", e); }
      try {
        const { data: conn } = await supabase
          .from("zid_connections")
          .select("tenant_id, store_name")
          .eq("store_uuid", storeUuid).maybeSingle();
        if (conn?.tenant_id) {
          const { data: ws } = await supabase.from("settings_workspace")
            .select("name").eq("id", conn.tenant_id).maybeSingle();
          const { data: member } = await supabase.from("auth_tenant_members")
            .select("user_id").eq("tenant_id", conn.tenant_id).eq("role", "owner")
            .order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (member?.user_id) {
            const { data: userRes } = await supabase.auth.admin.getUserById(member.user_id);
            const recipient = userRes?.user?.email;
            if (recipient) {
              await sendResendEmail({
                to: recipient,
                subject: "تم إلغاء ربط متجرك مع زد",
                html: storeDisconnectedHtml({
                  store_name: conn.store_name ?? ws?.name ?? "متجرك",
                  platform_name: "زد",
                  disconnect_date: formatRiyadhDate(new Date()),
                }),
              });
            }
          }
        }
      } catch (e) {
        console.error("zid-webhook: disconnect email failed", e);
      }
    } else if (
      eventType.startsWith("subscription.") ||
      eventType.startsWith("app.subscription.") ||
      eventType.startsWith("app.store.subscription.")
    ) {
      const { data: existing } = await supabase
        .from("zid_connections")
        .select("tenant_id,metadata")
        .eq("store_uuid", storeUuid)
        .maybeSingle();
      const metadata = { ...(existing?.metadata ?? {}), subscription: payload };
      await supabase.from("zid_connections").update({ metadata }).eq("store_uuid", storeUuid);
      if (existing?.tenant_id) {
        const data = payload.data ?? payload.subscription ?? payload;
        const planRaw = data.plan_code ?? data.plan?.code ?? data.plan?.name ?? data.plan_name;
        const status = normalizeZidStatus(data.status ?? eventType.split(".").pop());
        const periodEnd = data.current_period_end ?? data.expires_at ?? data.end_at ?? null;
        const startedAt = data.started_at ?? data.created_at ?? new Date().toISOString();
        await supabase.from("zid_subscriptions").upsert({
          tenant_id: existing.tenant_id,
          zid_store_id: storeUuid,
          zid_plan_code: normalizeZidPlanCode(planRaw),
          status,
          started_at: startedAt,
          current_period_end: periodEnd,
          cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });
      }
    } else if (
      eventType.startsWith("charge.") ||
      eventType.startsWith("app.charge.") ||
      eventType.startsWith("app.store.charge.") ||
      eventType.startsWith("payment.")
    ) {
      const { data: conn } = await supabase
        .from("zid_connections").select("tenant_id").eq("store_uuid", storeUuid).maybeSingle();
      if (conn?.tenant_id) {
        const data = payload.data ?? payload.charge ?? payload;
        const zidChargeId = String(data.id ?? data.charge_id ?? data.uuid ?? `${storeUuid}-${Date.now()}`);
        const gross = Number(data.amount ?? data.price ?? data.total ?? 0);
        const planRaw = data.plan_code ?? data.plan?.code ?? data.plan?.name;
        const chargedAtIso = data.paid_at ?? data.charged_at ?? data.created_at ?? new Date().toISOString();
        const chargedAt = new Date(chargedAtIso);
        const status = eventType.includes("refund") ? "refunded"
          : eventType.includes("pending") ? "pending" : "paid";
        const math = computeZidCharge(gross, chargedAt);
        await supabase.from("zid_charges").upsert({
          tenant_id: conn.tenant_id,
          zid_charge_id: zidChargeId,
          zid_plan_code: normalizeZidPlanCode(planRaw),
          charged_at: chargedAt.toISOString(),
          status,
          ...math,
          raw: payload,
        }, { onConflict: "zid_charge_id" });
      }
    }
  } catch (e) {
    console.error("zid-webhook: handler error", e);
    return jsonResponse({ error: "Handler failed" }, 500);
  }

  return jsonResponse({ ok: true });
});