// Daily Salla token refresh.
// Finds active connections whose access token expires within the next 48h,
// calls Salla's OAuth token endpoint with grant_type=refresh_token, and
// updates the row. On failure, logs and retries next day; only marks the
// connection as disconnected once token_expires_at < now().
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SALLA_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

interface SallaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number; // seconds (duration)
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function refreshOne(row: {
  id: string;
  merchant_id: number;
  refresh_token: string | null;
  token_expires_at: string | null;
}): Promise<{ id: string; merchant_id: number; ok: boolean; error?: string }> {
  if (!row.refresh_token) {
    return { id: row.id, merchant_id: row.merchant_id, ok: false, error: "no refresh_token" };
  }

  const clientId = Deno.env.get("SALLA_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("SALLA_CLIENT_SECRET") ?? "";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  let res: Response;
  try {
    res = await fetch(SALLA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (e) {
    return { id: row.id, merchant_id: row.merchant_id, ok: false, error: `network: ${String(e)}` };
  }

  const text = await res.text();
  let json: SallaTokenResponse = {};
  try { json = JSON.parse(text); } catch { /* keep raw */ }

  if (!res.ok || !json.access_token) {
    const err = json.error_description ?? json.error ?? `HTTP ${res.status}: ${text.slice(0, 200)}`;
    // If the token is already expired, mark disconnected. Otherwise retry tomorrow.
    const expired = row.token_expires_at && new Date(row.token_expires_at).getTime() < Date.now();
    if (expired) {
      await supabase
        .from("salla_connections")
        .update({ is_active: false, connection_status: "disconnected" })
        .eq("id", row.id);
    }
    await supabase.from("salla_events").insert({
      merchant_id: row.merchant_id,
      event_type: "token.refresh_failed",
      event_data: { error: err, expired_already: !!expired },
    });
    return { id: row.id, merchant_id: row.merchant_id, ok: false, error: err };
  }

  const expiresIn = Number(json.expires_in ?? 0);
  const expiresAt = expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // safe default 14d

  await supabase
    .from("salla_connections")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? row.refresh_token,
      token_expires_at: expiresAt,
      connection_status: "connected",
      is_active: true,
    })
    .eq("id", row.id);

  await supabase.from("salla_events").insert({
    merchant_id: row.merchant_id,
    event_type: "token.refreshed",
    event_data: { new_expires_at: expiresAt },
  });

  return { id: row.id, merchant_id: row.merchant_id, ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Find connections whose token expires within the next 48 hours
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("salla_connections")
    .select("id, merchant_id, refresh_token, token_expires_at")
    .eq("is_active", true)
    .lte("token_expires_at", cutoff);

  if (error) {
    console.error("salla-token-refresh: query failed", error);
    return jsonResponse({ error: error.message }, 500);
  }

  console.log(`salla-token-refresh: ${rows?.length ?? 0} connection(s) need refresh`);

  const results: Array<Awaited<ReturnType<typeof refreshOne>>> = [];
  for (const row of rows ?? []) {
    // deno-lint-ignore no-await-in-loop
    results.push(await refreshOne(row as Parameters<typeof refreshOne>[0]));
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  console.log(`salla-token-refresh: refreshed=${ok} failed=${failed}`);

  return jsonResponse({ checked: results.length, refreshed: ok, failed, results });
});