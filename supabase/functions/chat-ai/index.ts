// chat-ai — proxy from widget → n8n.
// Resolves tenant from (platform, store_id), enforces a per-minute rate limit,
// loads merchant context, forwards to n8n, persists message + reply.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveTenant } from "../_shared/resolve-tenant.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const N8N_WEBHOOK_URL = Deno.env.get("N8N_WEBHOOK_URL") ?? "";
const RATE_LIMIT_PER_MIN = 30;

async function checkRateLimit(tenantId: string): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);
  const ws = windowStart.toISOString();

  const { data: existing } = await supabase
    .from("widget_rate_limits")
    .select("count")
    .eq("tenant_id", tenantId)
    .eq("window_start", ws)
    .maybeSingle();

  const next = (existing?.count ?? 0) + 1;
  if (next > RATE_LIMIT_PER_MIN) return false;

  await supabase
    .from("widget_rate_limits")
    .upsert({ tenant_id: tenantId, window_start: ws, count: next });

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const { platform, store_id, store_uuid, visitor_id, message, history } = body;
    const domain: string | null = body.domain ?? null;
    const visitor = body.visitor && typeof body.visitor === "object" ? body.visitor : null;
    let conversation_id: string | null = body.conversation_id ?? null;

    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "missing_message" }, 400);
    }

    const { tenant_id, is_active } = await resolveTenant({
      platform,
      store_id,
      tenant_id: body.tenant_id,
      domain,
    });
    if (!tenant_id || !is_active) {
      return jsonResponse({ error: "tenant_not_found" }, 404);
    }

    if (!(await checkRateLimit(tenant_id))) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    // Conversation persistence: ensure a UUID conversation_id and a
    // conversations_main row so the dashboard can list it.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = !!conversation_id && UUID_RE.test(conversation_id);
    if (!isUuid) conversation_id = crypto.randomUUID();

    // Upsert customer (best-effort) keyed by visitor_id as external_id
    let customer_id: string | null = null;
    if (visitor_id) {
      try {
        const { data: existingCust } = await supabase
          .from("conversations_customers")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("external_id", visitor_id)
          .maybeSingle();
        if (existingCust?.id) {
          customer_id = existingCust.id;
        } else {
          const { data: newCust } = await supabase
            .from("conversations_customers")
            .insert({
              tenant_id,
              external_id: visitor_id,
              display_name: "Storefront visitor",
              locale: "ar",
            })
            .select("id")
            .single();
          customer_id = newCust?.id ?? null;
        }
      } catch (e) {
        console.log("customer upsert failed (non-fatal):", e);
      }
    }

    // Upsert conversations_main row
    try {
      const { data: existingConv } = await supabase
        .from("conversations_main")
        .select("id")
        .eq("id", conversation_id)
        .maybeSingle();
      if (!existingConv) {
        await supabase.from("conversations_main").insert({
          id: conversation_id,
          tenant_id,
          customer_id,
          channel_kind: "web",
          status: "new",
          language: "ar",
          ai_handled: true,
          last_message_at: new Date().toISOString(),
        });
      } else {
        await supabase
          .from("conversations_main")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation_id);
      }
    } catch (e) {
      console.log("conversation upsert failed (non-fatal):", e);
    }

    // Load merchant context for n8n
    const [{ data: workspace }, { data: training }] = await Promise.all([
      supabase
        .from("settings_workspace")
        .select("name, locale, domain, platform")
        .eq("id", tenant_id)
        .maybeSingle(),
      supabase
        .from("settings_train_ai")
        .select("mode, prompt, file_url")
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
    ]);

    // Load platform connection so n8n receives store_id / store_uuid / merchant_id
    const resolvedPlatform = workspace?.platform ?? platform ?? null;
    let storePlatformId: string | null = null;
    let storePlatformUuid: string | null = null;
    let storeMerchantId: string | number | null = null;
    if (resolvedPlatform === "zid") {
      const { data: zc } = await supabase
        .from("zid_connections")
        .select("store_id, store_uuid")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .maybeSingle();
      storePlatformId = zc?.store_id ?? null;
      storePlatformUuid = zc?.store_uuid ?? null;
      // Fallback to the value rendered by the storefront snippet
      // ({{store.id}} / {{store.uuid}}) when the DB row is missing it.
      const UUID_RE2 =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const incomingSid = store_id != null ? String(store_id).trim() : "";
      const incomingSuid = store_uuid != null ? String(store_uuid).trim() : "";
      if (!storePlatformId && incomingSid && !UUID_RE2.test(incomingSid)) {
        storePlatformId = incomingSid;
      }
      if (!storePlatformUuid) {
        if (incomingSuid && UUID_RE2.test(incomingSuid)) {
          storePlatformUuid = incomingSuid;
        } else if (incomingSid && UUID_RE2.test(incomingSid)) {
          storePlatformUuid = incomingSid;
        }
      }
      console.log("chat-ai zid store ids", {
        tenant_id,
        db_store_id: zc?.store_id ?? null,
        db_store_uuid: zc?.store_uuid ?? null,
        incoming_store_id: incomingSid || null,
        incoming_store_uuid: incomingSuid || null,
        resolved_id: storePlatformId,
        resolved_uuid: storePlatformUuid,
      });
    } else if (resolvedPlatform === "salla") {
      const { data: sc } = await supabase
        .from("salla_connections")
        .select("store_id, merchant_id")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .maybeSingle();
      storePlatformId = sc?.store_id ?? null;
      storeMerchantId = sc?.merchant_id ?? null;
      if (!storePlatformId && store_id != null) {
        storePlatformId = String(store_id);
      }
    }

    if (!N8N_WEBHOOK_URL) {
      return jsonResponse({ error: "n8n_not_configured" }, 503);
    }

    console.log("n8n webhook kind:", N8N_WEBHOOK_URL.includes("/webhook-test/") ? "TEST" : N8N_WEBHOOK_URL.includes("/webhook/") ? "PRODUCTION" : "UNKNOWN");

    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id,
        conversation_id,
        visitor_id,
        message,
        history: Array.isArray(history) ? history.slice(-10) : [],
        store: {
          id: storePlatformId,
          uuid: storePlatformUuid,
          merchant_id: storeMerchantId,
          name: workspace?.name,
          locale: workspace?.locale,
          domain: workspace?.domain,
          platform: workspace?.platform,
        },
        customer: visitor
          ? {
              id: visitor.id ?? null,
              name: visitor.name ?? null,
              email: visitor.email ?? null,
              mobile: visitor.mobile ?? null,
            }
          : null,
        ai: {
          mode: training?.mode,
          prompt: training?.mode === "file" ? null : (training?.prompt ?? null),
          file_url: training?.mode === "file" ? (training?.file_url ?? null) : null,
        },
      }),
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      console.error("n8n error", n8nRes.status, text);
      return jsonResponse({ error: "ai_upstream_error", status: n8nRes.status }, 502);
    }

    const aiData = await n8nRes.json().catch(() => ({}));
    const reply: string =
      aiData.reply ?? aiData.message ?? aiData.text ?? aiData.output ?? "";

    // Pass through structured attachments (product cards, etc.) from n8n.
    const attachments = Array.isArray(aiData.attachments) ? aiData.attachments : [];

    // Best-effort persistence (don't fail the response if this errors).
    // Insert sequentially with a small offset on the AI row so the dashboard
    // never shows the reply before the question when ordering by created_at.
    if (conversation_id) {
      try {
        const nowMs = Date.now();
        await supabase.from("conversations_messages").insert({
          tenant_id,
          conversation_id,
          sender: "customer",
          kind: "text",
          body: message,
          word_count: message.split(/\s+/).length,
          created_at: new Date(nowMs).toISOString(),
        });
        await supabase.from("conversations_messages").insert({
          tenant_id,
          conversation_id,
          sender: "ai",
          kind: "text",
          body: reply,
          word_count: reply.split(/\s+/).length,
          created_at: new Date(nowMs + 50).toISOString(),
        });
      } catch (e) {
        console.log("persist failed (non-fatal):", e);
      }
    }

    return jsonResponse({ reply, attachments, tenant_id, conversation_id });
  } catch (e) {
    console.error("chat-ai error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});