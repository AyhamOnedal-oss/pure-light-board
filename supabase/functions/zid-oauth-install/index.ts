// Zid OAuth install entry point.
// Set this URL as the "App URL" in the Zid Partner Dashboard.
// When a merchant clicks Subscribe in Zid's App Market, Zid opens this URL.
// We immediately 302-redirect to Zid's /oauth/authorize so the merchant grants
// permissions and Zid sends ?code back to zid-oauth-callback.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const stateParam = url.searchParams.get("state") ?? "";

  const clientId = Deno.env.get("ZID_CLIENT_ID") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const redirectUri = `${supabaseUrl}/functions/v1/zid-oauth-callback`;

  if (!clientId) {
    console.error("zid-install: ZID_CLIENT_ID not configured");
    return new Response("ZID_CLIENT_ID not configured", { status: 500, headers: corsHeaders });
  }

  // Log the install initiation for debugging
  try {
    await supabase.from("zid_events").insert({
      event_type: "oauth.install_initiated",
      event_data: {
        has_state: !!stateParam,
        query: Object.fromEntries(url.searchParams.entries()),
        ua: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
      },
    });
  } catch (e) {
    console.error("zid-install: failed to log event", e);
  }

  const authorizeUrl = new URL("https://oauth.zid.sa/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  if (stateParam) authorizeUrl.searchParams.set("state", stateParam);

  return new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl.toString(), ...corsHeaders },
  });
});