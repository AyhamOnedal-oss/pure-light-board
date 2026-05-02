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

function redirectToZidAuthorize(state: string | null) {
  const clientId = Deno.env.get("ZID_CLIENT_ID") ?? "";
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zid-oauth-callback`;
  const authorizeUrl = new URL("https://oauth.zid.sa/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  if (state) authorizeUrl.searchParams.set("state", state);
  return redirect(authorizeUrl.toString());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // tenant_id when present
  const error = url.searchParams.get("error");

  if (error) {
    await supabase.from("zid_events").insert({
      event_type: "oauth.callback_error",
      event_data: { error, query: Object.fromEntries(url.searchParams.entries()) },
    });
    return redirect(`${APP_BASE_URL}/dashboard/settings/store?zid_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    await supabase.from("zid_events").insert({
      event_type: "oauth.callback_no_code",
      event_data: {
        action: "redirected_to_authorize",
        query: Object.fromEntries(url.searchParams.entries()),
        ua: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
      },
    });
    return redirectToZidAuthorize(state);
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
    await supabase.from("zid_events").insert({
      event_type: "oauth.token_response_keys",
      event_data: { keys: Object.keys(t ?? {}) },
    });
    // Zid returns inconsistent casing; normalize
    const authorizationToken =
      t.authorization ?? t.authorization_token ?? t.Authorization ?? t.access_token ?? null;
    const managerToken =
      t.manager_token ??
      t.Manager_Token ??
      t.X_MANAGER_TOKEN ??
      t.access_token ??
      null;
    const refreshToken = t.refresh_token ?? null;
    const expiresIn = Number(t.expires_in ?? 0);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    // Fetch store profile to get store_uuid + name
    let storeUuid: string | null = null;
    let storeName: string | null = null;
    let storeUrl: string | null = null;
    let storeEmail: string | null = null;

    function findUuid(obj: unknown): string | null {
      if (!obj || typeof obj !== "object") return null;
      const o = obj as Record<string, unknown>;
      // Prefer keys that look like a store uuid
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (
          (k === "uuid" || k === "store_uuid" || k === "id") &&
          typeof v === "string" &&
          /^[0-9a-f-]{16,}$/i.test(v)
        ) {
          return v;
        }
      }
      for (const k of Object.keys(o)) {
        const found = findUuid(o[k]);
        if (found) return found;
      }
      return null;
    }

    async function tryEndpoint(path: string) {
      const r = await fetch(`https://api.zid.sa${path}`, {
        headers: {
          Authorization: `Bearer ${authorizationToken}`,
          "X-Manager-Token": managerToken ?? "",
          Accept: "application/json",
        },
      });
      let body: unknown = null;
      try {
        body = await r.json();
      } catch {
        body = await r.text().catch(() => null);
      }
      await supabase.from("zid_events").insert({
        event_type: "oauth.profile_response",
        event_data: {
          path,
          status: r.status,
          body_preview: JSON.stringify(body).slice(0, 4000),
        },
      });
      return { ok: r.ok, body };
    }

    if (authorizationToken && managerToken) {
      try {
        const endpoints = [
          "/v1/managers/account/profile",
          "/v1/managers/store/info",
          "/v1/store",
          "/v1/store/info",
        ];
        for (const ep of endpoints) {
          const { ok, body } = await tryEndpoint(ep);
          if (!ok || !body || typeof body !== "object") continue;
          const b = body as Record<string, any>;
          storeUuid =
            b?.user?.store?.uuid ??
            b?.data?.user?.store?.uuid ??
            b?.data?.store?.uuid ??
            b?.store?.uuid ??
            b?.data?.uuid ??
            b?.uuid ??
            findUuid(b);
          storeName =
            b?.user?.store?.name ??
            b?.data?.store?.name ??
            b?.store?.name ??
            b?.data?.name ??
            b?.name ??
            null;
          storeUrl =
            b?.user?.store?.store_url ??
            b?.data?.store?.store_url ??
            b?.store?.store_url ??
            b?.data?.store_url ??
            null;
          storeEmail = b?.user?.email ?? b?.data?.email ?? b?.email ?? null;
          if (storeUuid) break;
        }
      } catch (e) {
        console.error("zid-callback: profile fetch failed", e);
        await supabase.from("zid_events").insert({
          event_type: "oauth.profile_exception",
          event_data: { error: String(e) },
        });
      }
    } else {
      await supabase.from("zid_events").insert({
        event_type: "oauth.profile_skipped",
        event_data: {
          has_authorization_token: !!authorizationToken,
          has_manager_token: !!managerToken,
        },
      });
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