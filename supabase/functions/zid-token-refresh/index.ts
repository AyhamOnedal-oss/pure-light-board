import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZID_TOKEN_URL = "https://oauth.zid.sa/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const clientId = Deno.env.get("ZID_CLIENT_ID")!;
  const clientSecret = Deno.env.get("ZID_CLIENT_SECRET")!;

  // Tenants whose access token expires within 30 days
  const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("zid_connections")
    .select("tenant_id, refresh_token, token_expires_at")
    .eq("is_active", true)
    .lt("token_expires_at", cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ tenant_id: string; ok: boolean; status?: number }> = [];

  for (const row of rows ?? []) {
    if (!row.refresh_token) {
      results.push({ tenant_id: row.tenant_id, ok: false, status: 0 });
      continue;
    }
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const resp = await fetch(ZID_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body,
      });
      const json = await resp.json().catch(() => ({}));

      if (!resp.ok || !json.access_token) {
        await supabase.from("zid_token_refresh_errors").insert({
          tenant_id: row.tenant_id,
          http_status: resp.status,
          response_body: json,
        });
        await supabase
          .from("zid_connections")
          .update({ connection_status: "refresh_failed", updated_at: new Date().toISOString() })
          .eq("tenant_id", row.tenant_id);
        results.push({ tenant_id: row.tenant_id, ok: false, status: resp.status });
        continue;
      }

      const expiresAt = new Date(
        Date.now() + (Number(json.expires_in) || 31536000) * 1000,
      ).toISOString();

      await supabase
        .from("zid_connections")
        .update({
          authorization_token: json.authorization,
          manager_token: json.access_token,
          refresh_token: json.refresh_token ?? row.refresh_token,
          token_expires_at: expiresAt,
          connection_status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", row.tenant_id);

      results.push({ tenant_id: row.tenant_id, ok: true, status: 200 });
    } catch (e) {
      await supabase.from("zid_token_refresh_errors").insert({
        tenant_id: row.tenant_id,
        http_status: 0,
        response_body: { error: String(e) },
      });
      results.push({ tenant_id: row.tenant_id, ok: false, status: 0 });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});