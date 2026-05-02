// Zid OAuth authorization code callback.
// Browser redirects here after merchant approves the install.
// We exchange code for tokens, fetch store info, upsert zid_connections, then redirect.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "https://pure-light-board.lovable.app";

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to, ...corsHeaders } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // tenant_id when present
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(`${APP_BASE_URL}/dashboard/settings/store?zid_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return redirect(`${APP_BASE_URL}/dashboard/settings/store?zid_error=missing_code`);
  }

  const clientId = Deno.env.get("ZID_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("ZID_CLIENT_SECRET") ?? "";
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zid-oauth-callback`;

  try {
    const tokenRes = await fetch("https://oauth.zid.sa/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("zid-callback: token exchange failed", txt);
      return redirect(`${APP_BASE_URL}/dashboard/settings/store?zid_error=token_exchange`);
    }

    const t = await tokenRes.json();
    // Zid returns inconsistent casing; normalize
    const authorizationToken =
      t.authorization ?? t.authorization_token ?? t.Authorization ?? t.access_token ?? null;
    const managerToken = t.manager_token ?? t.Manager_Token ?? t.X_MANAGER_TOKEN ?? null;
    const refreshToken = t.refresh_token ?? null;
    const expiresIn = Number(t.expires_in ?? 0);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    // Fetch store profile to get store_uuid + name
    let storeUuid: string | null = null;
    let storeName: string | null = null;
    let storeUrl: string | null = null;
    let storeEmail: string | null = null;

    if (authorizationToken && managerToken) {
      try {
        const profRes = await fetch("https://api.zid.sa/v1/managers/account/profile", {
          headers: {
            Authorization: `Bearer ${authorizationToken}`,
            "X-Manager-Token": managerToken,
            Accept: "application/json",
          },
        });
        if (profRes.ok) {
          const prof = await profRes.json();
          storeUuid =
            prof?.user?.store?.uuid ??
            prof?.data?.store?.uuid ??
            prof?.store?.uuid ??
            null;
          storeName =
            prof?.user?.store?.name ?? prof?.data?.store?.name ?? prof?.store?.name ?? null;
          storeUrl =
            prof?.user?.store?.store_url ??
            prof?.data?.store?.store_url ??
            prof?.store?.store_url ??
            null;
          storeEmail = prof?.user?.email ?? prof?.data?.email ?? null;
        }
      } catch (e) {
        console.error("zid-callback: profile fetch failed", e);
      }
    }

    if (!storeUuid) {
      console.error("zid-callback: could not resolve store_uuid");
      return redirect(`${APP_BASE_URL}/dashboard/settings/store?zid_error=no_store_uuid`);
    }

    // Validate state as tenant_id
    let tenantId: string | null = null;
    if (state) {
      const { data: ws } = await supabase
        .from("settings_workspace")
        .select("id")
        .eq("id", state)
        .maybeSingle();
      if (ws) tenantId = ws.id;
    }

    const upsertRow: Record<string, unknown> = {
      store_uuid: storeUuid,
      store_name: storeName,
      store_url: storeUrl,
      store_email: storeEmail,
      authorization_token: authorizationToken,
      manager_token: managerToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      is_active: true,
      connection_status: "connected",
      connected_at: new Date().toISOString(),
    };
    if (tenantId) upsertRow.tenant_id = tenantId;

    await supabase.from("zid_connections").upsert(upsertRow, { onConflict: "store_uuid" });

    if (tenantId && storeUuid) {
      await supabase
        .from("settings_workspace")
        .update({ zid_store_uuid: storeUuid, platform: "zid" })
        .eq("id", tenantId);
    }

    await supabase.from("zid_events").insert({
      store_uuid: storeUuid,
      tenant_id: tenantId,
      event_type: "oauth.callback",
      event_data: { has_state: !!state, claimed: !!tenantId },
    });

    if (tenantId) {
      return redirect(`${APP_BASE_URL}/dashboard/settings/store?connected=zid`);
    }
    return redirect(
      `${APP_BASE_URL}/login?from=zid&store_uuid=${encodeURIComponent(storeUuid)}`,
    );
  } catch (e) {
    console.error("zid-callback: error", e);
    return redirect(`${APP_BASE_URL}/dashboard/settings/store?zid_error=server_error`);
  }
});