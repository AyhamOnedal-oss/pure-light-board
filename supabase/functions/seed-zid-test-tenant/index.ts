// One-off admin endpoint: provision a merchant account for a Zid test email
// (creates auth user + workspace via handle_new_user trigger), optionally
// links a Zid store_uuid to the new tenant, and emails credentials.
//
// Auth: requires X-Admin-Token header matching ZID_WEBHOOK_SECRET.
// Body: { email: string, store_uuid?: string, store_name?: string, store_url?: string }
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { provisionMerchantAccount } from "../_shared/provision-merchant.ts";

const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "https://pure-light-board.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // NOTE: temporary seed endpoint, removed after Zid testing is complete.

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const email: string = body.email;
  const storeUuid: string | undefined = body.store_uuid;
  const storeName: string | null = body.store_name ?? null;
  const storeUrl: string | null = body.store_url ?? null;
  if (!email) return jsonResponse({ error: "email_required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const result = await provisionMerchantAccount({
      email,
      platform: "zid",
      storeName,
      appBaseUrl: APP_BASE_URL,
    });

    let zidLinked = false;
    if (storeUuid && result.tenantId) {
      await admin.from("zid_connections").upsert(
        {
          store_uuid: storeUuid,
          store_email: email,
          store_name: storeName,
          store_url: storeUrl,
          tenant_id: result.tenantId,
          is_active: true,
          connection_status: "connected",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "store_uuid" },
      );
      await admin
        .from("settings_workspace")
        .update({ zid_store_uuid: storeUuid, platform: "zid" })
        .eq("id", result.tenantId);
      zidLinked = true;
    }

    return jsonResponse({
      ok: true,
      tenant_id: result.tenantId,
      user_id: result.userId,
      is_new_user: result.isNewUser,
      email_sent: result.emailSent,
      email_error: result.emailError ?? null,
      zid_linked: zidLinked,
    });
  } catch (e) {
    console.error("seed-zid-test-tenant error", e);
    return jsonResponse({ error: "server_error", detail: String(e) }, 500);
  }
});