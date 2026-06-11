// Closes conversations that have been idle for too long so the post-resolve
// classify trigger can fire. Intended to be invoked by pg_cron every 5 min.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const IDLE_MINUTES = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "service_role_missing" }, 503);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60_000).toISOString();

  const { data, error } = await supabase
    .from("conversations_main")
    .update({
      status: "closed",
      close_reason: "idle",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("status", ["new", "open", "pending"])
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    console.error("auto-close-stale-conversations failed", error);
    return jsonResponse({ error: "update_failed", message: error.message }, 500);
  }

  return jsonResponse({ ok: true, closed: data?.length ?? 0, cutoff });
});