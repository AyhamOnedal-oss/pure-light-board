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
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zid-oauth-callback`;

  // Zid access tokens & refresh tokens expire after 1 year. Per the docs we
  // must refresh before ~10 months pass. We pick connections that either:
  //   - expire within the next 60 days, OR
  //   - haven't been refreshed in 270 days (≈ 9 months), OR
  //   - are already in refresh_failed state (retry).
  const cutoff = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const refreshAgeCutoff = new Date(Date.now() - 270 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("zid_connections")
    .select("tenant_id, refresh_token, token_expires_at, last_refreshed_at, connection_status")
    .eq("is_active", true)
    .or(
      `token_expires_at.lt.${cutoff},last_refreshed_at.lt.${refreshAgeCutoff},last_refreshed_at.is.null,connection_status.eq.refresh_failed`,
    );

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
        redirect_uri: redirectUri,
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
      const nowIso = new Date().toISOString();

      await supabase
        .from("zid_connections")
        .update({
          authorization_token: json.authorization,
          manager_token: json.access_token,
          refresh_token: json.refresh_token ?? row.refresh_token,
          token_expires_at: expiresAt,
          connection_status: "connected",
          updated_at: nowIso,
          last_refreshed_at: nowIso,
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