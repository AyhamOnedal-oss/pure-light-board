// Zid lifecycle webhook (uninstall, subscription changes).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse, hmacSha256Hex, timingSafeEqualHex } from "../_shared/cors.ts";
import { sendResendEmail, formatRiyadhDate } from "../_shared/resend.ts";
import { storeDisconnectedHtml } from "../_shared/email-templates-ar.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-zid-signature") ?? "";
  const secret = Deno.env.get("ZID_WEBHOOK_SECRET") ?? "";

  if (secret) {
    const expected = await hmacSha256Hex(secret, rawBody);
    if (!signature || !timingSafeEqualHex(signature.toLowerCase(), expected.toLowerCase())) {
      console.error("zid-webhook: invalid signature");
      return jsonResponse({ error: "Invalid signature" }, 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const eventType: string = payload.event ?? payload.type ?? "unknown";
  const storeUuid: string | null =
    payload.store_uuid ?? payload.data?.store_uuid ?? payload.store?.uuid ?? null;

  await supabase.from("zid_events").insert({
    store_uuid: storeUuid,
    event_type: eventType,
    event_data: payload,
  });

  try {
    if (eventType === "app.uninstalled" || eventType === "uninstall") {
      await supabase
        .from("zid_connections")
        .update({ is_active: false, connection_status: "disconnected" })
        .eq("store_uuid", storeUuid);
      try {
        const { data: conn } = await supabase
          .from("zid_connections")
          .select("tenant_id, store_name")
          .eq("store_uuid", storeUuid).maybeSingle();
        if (conn?.tenant_id) {
          const { data: ws } = await supabase.from("settings_workspace")
            .select("name").eq("id", conn.tenant_id).maybeSingle();
          const { data: member } = await supabase.from("auth_tenant_members")
            .select("user_id").eq("tenant_id", conn.tenant_id).eq("role", "owner")
            .order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (member?.user_id) {
            const { data: userRes } = await supabase.auth.admin.getUserById(member.user_id);
            const recipient = userRes?.user?.email;
            if (recipient) {
              await sendResendEmail({
                to: recipient,
                subject: "تم إلغاء ربط متجرك مع زد",
                html: storeDisconnectedHtml({
                  store_name: conn.store_name ?? ws?.name ?? "متجرك",
                  platform_name: "زد",
                  disconnect_date: formatRiyadhDate(new Date()),
                }),
              });
            }
          }
        }
      } catch (e) {
        console.error("zid-webhook: disconnect email failed", e);
      }
    } else if (eventType.startsWith("subscription.") || eventType.startsWith("app.subscription.")) {
      const { data: existing } = await supabase
        .from("zid_connections")
        .select("metadata")
        .eq("store_uuid", storeUuid)
        .maybeSingle();
      const metadata = { ...(existing?.metadata ?? {}), subscription: payload };
      await supabase.from("zid_connections").update({ metadata }).eq("store_uuid", storeUuid);
    }
  } catch (e) {
    console.error("zid-webhook: handler error", e);
    return jsonResponse({ error: "Handler failed" }, 500);
  }

  return jsonResponse({ ok: true });
});