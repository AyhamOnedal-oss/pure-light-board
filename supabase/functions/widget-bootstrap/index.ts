// Single-round-trip loader bootstrap: resolves (platform, external_id) to a
// tenant_id AND returns the chat design config + branding in one response.
// Replaces the sequential widget-resolve → widget-config waterfall used by
// the storefront loader, cutting time-to-bubble roughly in half on cold start.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveTenant } from "../_shared/resolve-tenant.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");
  const externalId = url.searchParams.get("external_id");
  let domain = url.searchParams.get("domain");
  if (!domain) {
    // Fallback: derive from Origin/Referer so a snippet that forgot to pass
    // domain still gets domain-based resolution.
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    try {
      if (origin) {
        const u = new URL(origin);
        domain = u.hostname + (u.pathname && u.pathname !== "/" ? u.pathname : "");
      }
    } catch (_e) { /* ignore */ }
  }

  if (!platform && !domain && !externalId) {
    return jsonResponse({ error: "missing_context" }, 400);
  }

  try {
    const { tenant_id: tenantId, is_active } = await resolveTenant({
      platform,
      store_id: externalId,
      domain,
    });

    if (!tenantId) {
      console.warn("widget-bootstrap: no tenant resolved", {
        platform, externalId, domain,
        referer: req.headers.get("referer"),
      });
      return jsonResponse(
        { tenant_id: null, is_active: false, cfg: null },
        200,
        { "Cache-Control": "no-store" },
      );
    }

    const [{ data: design }, { data: workspace }, { data: train }, idsRes] = await Promise.all([
      supabase.from("settings_chat_design").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase
        .from("settings_workspace")
        .select("name, logo_url, icon_url, locale")
        .eq("id", tenantId)
        .maybeSingle(),
      supabase
        .from("settings_train_ai")
        .select("bubble_visible")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      (platform === "zid" || (!platform && tenantId))
        ? supabase
            .from("zid_connections")
            .select("store_id, store_uuid")
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : platform === "salla"
          ? supabase
              .from("salla_connections")
              .select("merchant_id")
              .eq("tenant_id", tenantId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
    ]);

    const ids = (idsRes as { data: Record<string, unknown> | null } | null)?.data ?? null;
    const storeIdOut =
      ids && "store_id" in ids && ids.store_id != null
        ? String(ids.store_id)
        : ids && "merchant_id" in ids && ids.merchant_id != null
          ? String(ids.merchant_id)
          : null;
    const storeUuidOut =
      ids && "store_uuid" in ids && ids.store_uuid != null
        ? String(ids.store_uuid)
        : null;

    const cfg = design
      ? {
          ...design,
          workspace_name: workspace?.name ?? null,
          logo_url: workspace?.logo_url ?? null,
          icon_url: workspace?.icon_url ?? null,
          locale: workspace?.locale ?? "ar",
          bubble_visible: train?.bubble_visible ?? true,
        }
      : null;

    const updatedAt = (design as { updated_at?: string } | null)?.updated_at ?? null;
    const etag = updatedAt ? `"${tenantId}:${updatedAt}"` : `"${tenantId}"`;

    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          ETag: etag,
          "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60",
        },
      });
    }

    return jsonResponse(
      {
        tenant_id: tenantId,
        is_active: !!is_active,
        updated_at: updatedAt,
        store_id: storeIdOut,
        store_uuid: storeUuidOut,
        cfg,
      },
      200,
      {
        ETag: etag,
        "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60",
      },
    );
  } catch (e) {
    console.error("widget-bootstrap error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});