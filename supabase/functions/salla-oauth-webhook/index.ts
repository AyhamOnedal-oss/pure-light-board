// Salla OAuth + lifecycle webhook (Easy Mode).
// Salla pushes app.store.authorize / app.uninstalled / app.subscription.* events.
// We verify the HMAC signature, log to salla_events, then upsert salla_connections.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse, hmacSha256Hex, timingSafeEqualHex } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-salla-signature") ?? "";
  const secret = Deno.env.get("SALLA_WEBHOOK_SECRET") ?? "";

  if (secret) {
    const expected = await hmacSha256Hex(secret, rawBody);
    if (!signature || !timingSafeEqualHex(signature.toLowerCase(), expected.toLowerCase())) {
      console.error("salla-webhook: invalid signature");
      return jsonResponse({ error: "Invalid signature" }, 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const eventType: string = payload.event ?? "unknown";
  const merchantId: number | null = payload.merchant ?? payload.data?.merchant ?? null;

  // Always log to audit table
  await supabase.from("salla_events").insert({
    merchant_id: merchantId,
    event_type: eventType,
    event_data: payload,
  });

  try {
    if (eventType === "app.store.authorize") {
      const data = payload.data ?? {};
      const accessToken = data.access_token ?? null;
      const refreshToken = data.refresh_token ?? null;
      const expiresIn = Number(data.expires ?? data.expires_in ?? 0);
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

      let storeName: string | null = null;
      let storeUrl: string | null = null;
      let storeEmail: string | null = null;
      let storeId: string | null = null;

      // Fetch store info to get human-readable details
      if (accessToken) {
        try {
          const infoRes = await fetch("https://api.salla.dev/admin/v2/store/info", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (infoRes.ok) {
            const info = await infoRes.json();
            storeName = info?.data?.name ?? null;
            storeUrl = info?.data?.domain ?? info?.data?.url ?? null;
            storeEmail = info?.data?.email ?? null;
            storeId = info?.data?.id ? String(info.data.id) : null;
          }
        } catch (e) {
          console.error("salla-webhook: store/info fetch failed", e);
        }
      }

      // Try to claim a pending connection (most-recent pending row)
      let tenantId: string | null = null;
      const { data: pending } = await supabase
        .from("pending_salla_connections")
        .select("id, user_id, tenant_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pending) {
        tenantId = pending.tenant_id ?? null;
        // If no tenant_id, find the user's owned workspace
        if (!tenantId && pending.user_id) {
          const { data: membership } = await supabase
            .from("auth_tenant_members")
            .select("tenant_id")
            .eq("user_id", pending.user_id)
            .eq("role", "owner")
            .limit(1)
            .maybeSingle();
          tenantId = membership?.tenant_id ?? null;
        }
        await supabase
          .from("pending_salla_connections")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", pending.id);
      }

      const upsertRow: Record<string, unknown> = {
        merchant_id: merchantId,
        store_id: storeId,
        store_name: storeName,
        store_url: storeUrl,
        store_email: storeEmail,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        is_active: true,
        connection_status: "connected",
        connected_at: new Date().toISOString(),
        metadata: { scope: data.scope ?? null, plan: data.plan ?? null },
      };
      if (tenantId) upsertRow.tenant_id = tenantId;

      await supabase.from("salla_connections").upsert(upsertRow, { onConflict: "merchant_id" });

      if (tenantId && merchantId) {
        await supabase
          .from("settings_workspace")
          .update({ salla_merchant_id: merchantId, platform: "salla" })
          .eq("id", tenantId);
      }
    } else if (eventType === "app.uninstalled") {
      await supabase
        .from("salla_connections")
        .update({
          is_active: false,
          connection_status: "disconnected",
        })
        .eq("merchant_id", merchantId);
    } else if (eventType.startsWith("app.subscription.")) {
      // Update subscription metadata
      const { data: existing } = await supabase
        .from("salla_connections")
        .select("metadata")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      const metadata = { ...(existing?.metadata ?? {}), subscription: payload.data };
      await supabase.from("salla_connections").update({ metadata }).eq("merchant_id", merchantId);
    }
  } catch (e) {
    console.error("salla-webhook: handler error", e);
    return jsonResponse({ error: "Handler failed" }, 500);
  }

  return jsonResponse({ ok: true });
});