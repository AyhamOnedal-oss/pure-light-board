// widget-context — read-only endpoint that returns the merchant's current
// AI training prompt, training file URL, and store metadata for a tenant.
// Designed for n8n HTTP Request nodes that want to pull the latest prompt
// on every run without depending on chat-ai's payload shape.
//
// GET /functions/v1/widget-context?tenant_id=<uuid>
//   → { mode, prompt, file_url, store: { name, locale, domain, platform } }
//
// Also accepts ?platform=salla|zid&store_id=... for storefront callers.
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
    const [{ data: workspace }, { data: train }] = await Promise.all([
      supabase
        .from("settings_workspace")
        .select("name, locale, domain, platform")
        .eq("id", tenantId)
        .maybeSingle(),
      supabase
        .from("settings_train_ai")
        .select("mode, prompt, file_url, file_name")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    const mode = train?.mode ?? "prompt";
    return jsonResponse(
      {
        tenant_id: tenantId,
        mode,
        prompt: mode === "file" ? null : (train?.prompt ?? null),
        file_url: mode === "file" ? (train?.file_url ?? null) : null,
        file_name: mode === "file" ? (train?.file_name ?? null) : null,
        store: {
          name: workspace?.name ?? null,
          locale: workspace?.locale ?? "ar",
          domain: workspace?.domain ?? null,
          platform: workspace?.platform ?? null,
        },
      },
      200,
      { "Cache-Control": "no-store" },
    );
  } catch (e) {
    console.error("widget-context error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});