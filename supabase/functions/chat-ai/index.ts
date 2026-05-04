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
    const { platform, store_id, conversation_id, visitor_id, message, history } = body;

    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "missing_message" }, 400);
    }

    const { tenant_id, is_active } = await resolveTenant({
      platform,
      store_id,
      tenant_id: body.tenant_id,
    });
    if (!tenant_id || !is_active) {
      return jsonResponse({ error: "tenant_not_found" }, 404);
    }

    if (!(await checkRateLimit(tenant_id))) {
      return jsonResponse({ error: "rate_limited" }, 429);
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

    if (!N8N_WEBHOOK_URL) {
      return jsonResponse({ error: "n8n_not_configured" }, 503);
    }

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
          name: workspace?.name,
          locale: workspace?.locale,
          domain: workspace?.domain,
          platform: workspace?.platform,
        },
        ai: {
          mode: training?.mode,
          prompt: training?.prompt,
          file_url: training?.file_url,
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

    // Best-effort persistence (don't fail the response if this errors)
    if (conversation_id) {
      try {
        await supabase.from("conversations_messages").insert([
          {
            tenant_id,
            conversation_id,
            sender: "customer",
            kind: "text",
            body: message,
            word_count: message.split(/\s+/).length,
          },
          {
            tenant_id,
            conversation_id,
            sender: "ai",
            kind: "text",
            body: reply,
            word_count: reply.split(/\s+/).length,
          },
        ]);
      } catch (e) {
        console.log("persist failed (non-fatal):", e);
      }
    }

    return jsonResponse({ reply, tenant_id });
  } catch (e) {
    console.error("chat-ai error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});