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
  const domain = (url.searchParams.get("domain") || "").trim().toLowerCase().replace(/^www\./, "");

  if (!platform || (!externalId && !domain)) {
    return jsonResponse({ error: "Missing platform or external_id" }, 400);
  }

  try {
    if (platform === "salla") {
      const merchantId = Number(externalId);
      let data: { tenant_id: string | null; is_active: boolean | null } | null = null;
      if (Number.isFinite(merchantId)) {
        const res = await supabase
          .from("salla_connections")
          .select("tenant_id, is_active")
          .eq("merchant_id", merchantId)
          .maybeSingle();
        data = res.data as typeof data;
      }
      if ((!data || !data.tenant_id) && domain) {
        const res = await supabase
          .from("settings_workspace")
          .select("id")
          .ilike("domain", domain)
          .maybeSingle();
        if (res.data?.id) data = { tenant_id: res.data.id, is_active: true };
      }
      return jsonResponse(
        { tenant_id: data?.tenant_id ?? null, is_active: !!data?.is_active },
        200,
        { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      );
    }
    if (platform === "zid") {
      // Zid storefronts may pass either the store UUID or the numeric store_id
      // (the only id exposed via {{store.id}} in Zid theme templates).
      // Prefer the active row so seed/test rows don't shadow real OAuth connections.
      let data: {
        tenant_id: string | null;
        is_active: boolean | null;
        store_id?: string | null;
        store_uuid?: string | null;
      } | null = null;
      if (externalId && externalId !== "default") {
        const res = await supabase
          .from("zid_connections")
          .select("tenant_id, is_active, store_id, store_uuid")
          .or(`store_uuid.eq.${externalId},store_id.eq.${externalId}`)
          .order("is_active", { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data as typeof data;
      }
      // Domain fallback — works even when {{store.id}}/{{store.uuid}} didn't render.
      if ((!data || !data.tenant_id) && domain) {
        const res = await supabase
          .from("settings_workspace")
          .select("id, zid_store_uuid")
          .ilike("domain", domain)
          .maybeSingle();
        if (res.data?.id) {
          let sid: string | null = null;
          let suid: string | null = res.data.zid_store_uuid ?? null;
          if (suid) {
            const z = await supabase
              .from("zid_connections")
              .select("store_id, store_uuid")
              .eq("store_uuid", suid)
              .maybeSingle();
            sid = z.data?.store_id ?? null;
            suid = z.data?.store_uuid ?? suid;
          }
          data = { tenant_id: res.data.id, is_active: true, store_id: sid, store_uuid: suid };
        }
      }
      return jsonResponse(
        {
          tenant_id: data?.tenant_id ?? null,
          is_active: !!data?.is_active,
          store_id: data?.store_id ?? null,
          store_uuid: data?.store_uuid ?? null,
        },
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