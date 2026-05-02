// Returns the tenant's chat design config + workspace branding (no PII).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  if (!tenantId) return jsonResponse({ error: "Missing tenant_id" }, 400);

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