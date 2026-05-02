// Telemetry endpoint for widget events (bubble shown / clicked).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { event, tenant_id } = await req.json();
    if (!event || !tenant_id) return jsonResponse({ error: "missing fields" }, 400);

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("dashboard_usage_daily")
      .select("id, clicks")
      .eq("tenant_id", tenant_id)
      .eq("day", today)
      .maybeSingle();

    if (event === "bubble.click") {
      if (existing) {
        await supabase
          .from("dashboard_usage_daily")
          .update({ clicks: (existing.clicks ?? 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("dashboard_usage_daily")
          .insert({ tenant_id, day: today, clicks: 1 });
      }
    } else if (event === "bubble.shown") {
      if (!existing) {
        await supabase
          .from("dashboard_usage_daily")
          .insert({ tenant_id, day: today });
      }
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("widget-events error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});