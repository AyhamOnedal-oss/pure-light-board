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
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const CLASSIFIER_MODEL_PRIMARY = "gpt-5.4-nano";
const CLASSIFIER_MODEL_FALLBACK = "gpt-5-nano";
const CLASSIFIER_TIMEOUT_MS = 800;
const CLASSIFIER_MIN_CONFIDENCE = 0.6;

// USD per 1M tokens. Update when official pricing is published.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.4-nano": { input: 0.05, output: 0.40 },
  "gpt-5-nano":   { input: 0.05, output: 0.40 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = MODEL_PRICING[model] ?? { input: 0.05, output: 0.40 };
  return (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
}

type ClassifierVerdict = {
  intent: "offer_ticket" | "offer_close" | "continue";
  confidence: number;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  ms: number;
  ok: boolean;
  error?: string;
};

async function callOpenAIClassifier(
  model: string,
  reply: string,
  lastUserMessage: string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You classify a customer-support AI reply (Arabic or English). " +
            "Return strict JSON: {\"intent\":\"offer_ticket\"|\"offer_close\"|\"continue\",\"confidence\":0-1}. " +
            "offer_ticket = reply offers/suggests connecting the user with a human agent, customer service, or raising a support ticket. " +
            "offer_close = reply is wrapping up and asking if the user needs anything else. " +
            "continue = anything else (normal answer, info, clarification, product help).",
        },
        {
          role: "user",
          content:
            `Last user message: ${lastUserMessage}\n\nAI reply: ${reply}\n\nReturn JSON only.`,
        },
      ],
    }),
  });
}

async function classifyIntent(
  reply: string,
  lastUserMessage: string,
): Promise<ClassifierVerdict> {
  const started = Date.now();
  const base: ClassifierVerdict = {
    intent: "continue",
    confidence: 0,
    model: CLASSIFIER_MODEL_PRIMARY,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    ms: 0,
    ok: false,
  };
  if (!OPENAI_API_KEY) return { ...base, ms: Date.now() - started, error: "no_openai_key" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLASSIFIER_TIMEOUT_MS);
  try {
    let model = CLASSIFIER_MODEL_PRIMARY;
    let res = await callOpenAIClassifier(model, reply, lastUserMessage, ctrl.signal);
    if (res.status === 404 || res.status === 400) {
      // Fallback if the nano model id isn't enabled on this account.
      model = CLASSIFIER_MODEL_FALLBACK;
      res = await callOpenAIClassifier(model, reply, lastUserMessage, ctrl.signal);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ...base, model, ms: Date.now() - started, error: `http_${res.status}:${txt.slice(0, 120)}` };
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { intent?: string; confidence?: number } = {};
    try { parsed = JSON.parse(content); } catch { /* leave empty */ }
    const intent =
      parsed.intent === "offer_ticket" || parsed.intent === "offer_close"
        ? parsed.intent
        : "continue";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    const pt = Number(data?.usage?.prompt_tokens ?? 0) || 0;
    const ct = Number(data?.usage?.completion_tokens ?? 0) || 0;
    const tt = Number(data?.usage?.total_tokens ?? pt + ct) || pt + ct;
    return {
      intent,
      confidence,
      model,
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: tt,
      cost_usd: estimateCost(model, pt, ct),
      ms: Date.now() - started,
      ok: true,
    };
  } catch (e) {
    return { ...base, ms: Date.now() - started, error: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}
const RATE_LIMIT_PER_MIN = 30;

type ActionType = "offer_ticket" | "offer_close" | "none";

function normalizeAr(text: string): string {
  return (text ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[.!؟?،,؛:]/g, "")
    .replace(/\s+/g, " ");
}

function isCloseOfferText(text: string): boolean {
  const n = normalizeAr(text);
  return (
    n.includes("هل تحتاج اي مساعده اخري") ||
    n.includes("هل تحتاج اي مساعده اخرى") ||
    n.includes("هل تحتاج مساعده اضافيه") ||
    n.includes("هل تحتاج اي مساعده") ||
    n.includes("do you need any other help") ||
    n.includes("anything else")
  );
}

function isTicketOfferText(text: string): boolean {
  const n = normalizeAr(text);
  return (
    n.includes("يتواصل معك احد موظفي خدمه العملاء") ||
    n.includes("اكلم خدمه العملاء") ||
    (n.includes("customer service") && n.includes("contact"))
  );
}

function isShortNegative(text: string): boolean {
  const n = normalizeAr(text);
  return /^(لا|لا شكرا|لاشكرا|لأ|مشكور|شكرا|شكرا لك|تمام شكرا|no|nope|nothing|that'?s all|im good|i'?m good)$/.test(n);
}

// Extracts the n8n agent envelope from whatever shape the webhook returns.
// Supports: direct object, { output: {...} }, arrays of either, and the
// parser sometimes returning a JSON string. Falls back to { reply: <text> }.
function extractEnvelope(raw: unknown): {
  reply: string;
  next_action: ActionType;
  next_action_reason: string;
  attempt_state: string;
  consecutive_failures: number;
  attachments: unknown[];
} {
  const fallback = (reply = "") => ({
    reply,
    next_action: "none" as ActionType,
    next_action_reason: "",
    attempt_state: "",
    consecutive_failures: 0,
    attachments: [],
  });

  let node: any = raw;
  if (Array.isArray(node)) node = node[0];
  if (!node) return fallback();

  // Unwrap common LangChain wrappers.
  for (const key of ["output", "json", "data"]) {
    if (node && typeof node === "object" && key in node && node[key] != null) {
      // If output is a string that looks like JSON, parse it.
      if (typeof node[key] === "string") {
        const s = node[key].trim();
        if (s.startsWith("{") || s.startsWith("[")) {
          try { node = JSON.parse(s); break; } catch { /* fall through */ }
        }
      } else if (typeof node[key] === "object") {
        node = node[key];
        break;
      }
    }
  }
  if (Array.isArray(node)) node = node[0];

  if (!node || typeof node !== "object") {
    return fallback(typeof raw === "string" ? raw : "");
  }

  const reply =
    node.reply ?? node.message ?? node.text ?? node.output ?? "";
  const na = node.next_action;
  const next_action: ActionType =
    na === "offer_ticket" || na === "offer_close" || na === "none" ? na : "none";

  return {
    reply: typeof reply === "string" ? reply : String(reply ?? ""),
    next_action,
    next_action_reason: String(node.next_action_reason ?? ""),
    attempt_state: String(node.attempt_state ?? ""),
    consecutive_failures: Number(node.consecutive_failures ?? 0) || 0,
    attachments: Array.isArray(node.attachments) ? node.attachments : [],
  };
}

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
      // Soft fallback: never surface a hard error to the widget — return a
      // friendly retry reply with HTTP 200 so the chat stays usable.
      return jsonResponse({
        reply: "لحظة من فضلك… حصل خلل بسيط، حاول مرة ثانية 🌷",
        attachments: [],
        action: { type: "none", reason: "upstream_error" },
        tenant_id,
        conversation_id,
      });
    }

    const rawText = await n8nRes.text();
    let aiData: unknown;
    try { aiData = JSON.parse(rawText); } catch { aiData = rawText; }
    // Tolerant parser: if n8n returned non-JSON text (e.g. structured parser
    // failed and the agent emitted free-form text), treat the raw body as the
    // reply with next_action="none" instead of bubbling an error.
    const env = extractEnvelope(aiData);
    let reply: string = env.reply;
    const attachments = env.attachments;
    console.log("n8n envelope:", {
      next_action: env.next_action,
      next_action_reason: env.next_action_reason,
      attempt_state: env.attempt_state,
      consecutive_failures: env.consecutive_failures,
      has_reply: !!reply,
    });

    // ── Hard end-of-conversation short-circuit ────────────────────────────
    // If the previous AI message already asked "هل تحتاج أي مساعدة أخرى؟"
    // and the user replied with a short negative, end gracefully and stop.
    const histArr = Array.isArray(history) ? history : [];
    const lastAiMsg = [...histArr].reverse().find(
      (h: any) => h?.sender === "ai" || h?.sender === "store",
    );
    const prevAiText: string = lastAiMsg?.text ?? lastAiMsg?.body ?? "";
    const prevWasCloseOffer = isCloseOfferText(prevAiText);
    const prevWasTicketOffer = isTicketOfferText(prevAiText);

    let action: { type: ActionType | "offer_close_done"; reason?: string } = { type: "none" };

    if (prevWasCloseOffer && isShortNegative(message)) {
      reply = "شكراً لتواصلك معنا 🌷 يومك سعيد.";
      action = { type: "offer_close_done", reason: "user_declined_after_close_offer" };
      console.log("chat-ai end-of-convo short-circuit fired");
    } else {
      // Pure Option 1: always call the GPT-5.4-nano classifier on the current
      // AI reply. n8n's next_action is logged for comparison but not trusted.
      let decidedIntent: "offer_ticket" | "offer_close" | "none" = "none";
      let source: "classifier" | "low_confidence" | "anti_loop" | "fallback" = "fallback";
      let verdict: ClassifierVerdict | null = null;

      if (reply && reply.trim().length > 0) {
        verdict = await classifyIntent(reply, message);
        if (
          verdict.ok &&
          verdict.confidence >= CLASSIFIER_MIN_CONFIDENCE &&
          verdict.intent !== "continue"
        ) {
          decidedIntent = verdict.intent;
          source = "classifier";
        } else if (verdict.ok) {
          source = "low_confidence";
        }
      }

      // Anti-loop guard: don't re-offer what the previous AI turn already offered.
      const isLoop =
        (decidedIntent === "offer_close" && prevWasCloseOffer) ||
        (decidedIntent === "offer_ticket" && prevWasTicketOffer);
      if (isLoop) {
        console.log("chat-ai anti-loop: dropped", decidedIntent);
        decidedIntent = "none";
        source = "anti_loop";
      }

      if (decidedIntent !== "none") {
        action = { type: decidedIntent, reason: source };
      }

      console.log("classifier", {
        intent: verdict?.intent ?? decidedIntent,
        confidence: verdict?.confidence ?? null,
        source,
        model: verdict?.model ?? null,
        prompt_tokens: verdict?.prompt_tokens ?? 0,
        completion_tokens: verdict?.completion_tokens ?? 0,
        cost_usd: verdict?.cost_usd ?? 0,
        ms: verdict?.ms ?? 0,
        n8n_next_action: env.next_action,
        error: verdict?.error,
      });

      // Best-effort usage log for the admin dashboard.
      try {
        await supabase.from("ai_classifier_usage").insert({
          tenant_id,
          conversation_id,
          model: verdict?.model ?? CLASSIFIER_MODEL_PRIMARY,
          intent: verdict?.intent ?? decidedIntent,
          confidence: verdict?.confidence ?? 0,
          source,
          prompt_tokens: verdict?.prompt_tokens ?? 0,
          completion_tokens: verdict?.completion_tokens ?? 0,
          total_tokens: verdict?.total_tokens ?? 0,
          cost_usd: verdict?.cost_usd ?? 0,
          latency_ms: verdict?.ms ?? 0,
        });
      } catch (e) {
        console.log("classifier usage insert failed (non-fatal):", e);
      }
    }

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

    return jsonResponse({ reply, attachments, action, tenant_id, conversation_id });
  } catch (e) {
    console.error("chat-ai error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});