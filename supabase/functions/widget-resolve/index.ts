// Resolves a platform external id (Salla merchant_id or Zid store_uuid) → tenant_id.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");
  const externalId = url.searchParams.get("external_id");

  if (!platform || !externalId) {
    return jsonResponse({ error: "Missing platform or external_id" }, 400);
  }

  try {
    if (platform === "salla") {
      const merchantId = Number(externalId);
      if (!Number.isFinite(merchantId)) return jsonResponse({ error: "Bad merchant_id" }, 400);
      const { data } = await supabase
        .from("salla_connections")
        .select("tenant_id, is_active")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      return jsonResponse(
        { tenant_id: data?.tenant_id ?? null, is_active: !!data?.is_active },
        200,
        { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      );
    }
    if (platform === "zid") {
      const { data } = await supabase
        .from("zid_connections")
        .select("tenant_id, is_active")
        .eq("store_uuid", externalId)
        .maybeSingle();
      return jsonResponse(
        { tenant_id: data?.tenant_id ?? null, is_active: !!data?.is_active },
        200,
        { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      );
    }
    return jsonResponse({ error: "Unknown platform" }, 400);
  } catch (e) {
    console.error("widget-resolve error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});