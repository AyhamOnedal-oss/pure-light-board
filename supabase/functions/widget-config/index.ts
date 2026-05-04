// Returns the tenant's chat design config + workspace branding (no PII).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveTenant, readContextFromUrl } from "../_shared/resolve-tenant.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const ctx = readContextFromUrl(url);
  const { tenant_id: tenantId, is_active } = await resolveTenant(ctx);
  if (!tenantId) return jsonResponse({ error: "tenant_not_found" }, 404);
  if (!is_active) return jsonResponse({ error: "tenant_inactive" }, 403);

  try {
    const [{ data: design }, { data: workspace }] = await Promise.all([
      supabase.from("settings_chat_design").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase
        .from("settings_workspace")
        .select("name, logo_url, icon_url, locale")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    if (!design) return jsonResponse({ error: "not_found" }, 404);

    return jsonResponse(
      {
        ...design,
        tenant_id: tenantId,
        workspace_name: workspace?.name ?? null,
        logo_url: workspace?.logo_url ?? null,
        icon_url: workspace?.icon_url ?? null,
        locale: workspace?.locale ?? "ar",
      },
      200,
      { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    );
  } catch (e) {
    console.error("widget-config error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});