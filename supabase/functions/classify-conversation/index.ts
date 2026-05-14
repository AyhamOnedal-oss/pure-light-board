// Classify a conversation after it is resolved.
// Triggered by Postgres `notify_classify_conversation()` via pg_net.
// Calls OpenAI with the full transcript, then writes
// { category, subject, close_reason } back into conversations_main.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-classify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function loadAcceptedSecrets(): Promise<string[]> {
  // Accept either the env-var secret or the row written by the migration.
  // The trigger uses the table value; the env var is a manual override path.
  const out: string[] = [];
  const env = Deno.env.get("CLASSIFY_WEBHOOK_SECRET");
  if (env && env.length > 0) out.push(env);
  const { data } = await supabase
    .from("_app_secrets")
    .select("value")
    .eq("key", "classify_webhook_secret")
    .maybeSingle();
  if (data?.value) out.push(data.value);
  return out;
}

/**
 * Authorize the request: either a valid `x-classify-secret` header (used by
 * the Postgres trigger) OR an authenticated user that is a member of the
 * tenant the conversation belongs to (used by the in-app "Re-analyze"
 * button). Returns true when authorized.
 */
async function isAuthorized(
  req: Request,
  tenantId: string,
): Promise<{ ok: boolean; force?: boolean }> {
  const provided = req.headers.get("x-classify-secret") ?? "";
  const accepted = await loadAcceptedSecrets();
  if (provided && accepted.includes(provided)) return { ok: true };

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false };
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return { ok: false };
  const { data: member } = await supabase
    .from("auth_tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return { ok: false };
  // In-app callers may force a re-analysis even if analysis_done=true.
  return { ok: true, force: true };
}

const ALLOWED_CATEGORIES = ["complaint", "inquiry", "request", "suggestion", "other"] as const;
type Category = typeof ALLOWED_CATEGORIES[number];
const ALLOWED_INTENTS = ["complaint", "inquiry", "request", "suggestion"] as const;
type Intent = typeof ALLOWED_INTENTS[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: { tenant_id?: string; conversation_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { tenant_id, conversation_id } = payload;
  if (!tenant_id || !conversation_id) {
    return json({ error: "missing_fields" }, 400);
  }

  const auth = await isAuthorized(req, tenant_id);
  if (!auth.ok) return json({ error: "unauthorized" }, 401);

  // For in-app "Re-analyze" calls, reset the analysis flag so the
  // idempotency guard below doesn't short-circuit.
  if (auth.force) {
    await supabase
      .from("conversations_main")
      .update({
        analysis_done: false,
        completion_score: null,
        intent_type: null,
        goal_met: null,
      })
      .eq("id", conversation_id)
      .eq("tenant_id", tenant_id);
  }

  // Idempotency guard: skip if already analyzed.
  const { data: convRow } = await supabase
    .from("conversations_main")
    .select("analysis_done")
    .eq("id", conversation_id)
    .eq("tenant_id", tenant_id)
    .maybeSingle();
  if (convRow?.analysis_done) {
    return json({ ok: true, skipped: "already_analyzed" });
  }

  // Load transcript
  const { data: messages, error: msgErr } = await supabase
    .from("conversations_messages")
    .select("sender, body, created_at")
    .eq("tenant_id", tenant_id)
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (msgErr) {
    console.error("classify-conversation: load messages failed", msgErr);
    return json({ error: "load_failed" }, 500);
  }
  if (!messages || messages.length === 0) {
    return json({ ok: true, skipped: "empty" });
  }

  const transcript = messages
    .map((m) => `${(m.sender ?? "user").toUpperCase()}: ${(m.body ?? "").trim()}`)
    .join("\n");

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("classify-conversation: OPENAI_API_KEY not set");
    return json({ error: "no_api_key" }, 500);
  }

  const systemPrompt = [
    "You analyze customer-support chat transcripts.",
    "The transcripts are usually in Arabic. Read carefully and classify the",
    "customer's PRIMARY intent based on what the customer actually wrote, not",
    "the agent replies.",
    "Arabic intent guidance:",
    " - 'اقتراح', 'أقترح', 'فكرة', 'ياليت تضيفون', 'تحسين', 'لو سمحتم تضيفون' => suggestion",
    " - 'شكوى', 'مشكلة', 'تأخر', 'سيء', 'غلط', 'ما وصل', 'ضايقني' => complaint",
    " - 'أبغى', 'أريد', 'ممكن ترجعون', 'استرجاع', 'إلغاء', 'تغيير', 'طلب' => request",
    " - 'وش', 'كم', 'متى', 'هل', 'استفسار', 'سؤال' => inquiry",
    "If the customer is sharing an idea or improvement (suggestion), do NOT",
    "label it as inquiry just because they greeted first. Pick suggestion.",
    "Reply ONLY in JSON with this exact shape:",
    `{ "category": "complaint" | "inquiry" | "request" | "suggestion" | "other",`,
    `  "intent_type": "complaint" | "inquiry" | "request" | "suggestion",`,
    `  "subject": string,           // <= 80 chars, in the conversation's language`,
    `  "close_reason": string,      // <= 120 chars, why the conversation ended`,
    `  "completion_score": number,  // 0-100, how completely the customer was helped`,
    `  "goal_met": boolean           // did the customer get what they came for?`,
    "}",
    "Scoring guide for completion_score:",
    " 90-100 = fully resolved, customer satisfied.",
    " 70-89  = mostly resolved, minor follow-up possible.",
    " 40-69  = partially resolved or escalated.",
    " 0-39   = unresolved, abandoned, or AI failed to help.",
  ].join("\n");

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini-2025-04-14",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript.slice(0, 12000) },
        ],
      }),
    });
  } catch (err) {
    console.error("classify-conversation: openai fetch failed", err);
    return json({ error: "openai_unreachable" }, 502);
  }

  if (!openaiRes.ok) {
    const text = await openaiRes.text().catch(() => "");
    console.error("classify-conversation: openai non-ok", openaiRes.status, text);
    return json({ error: "openai_failed", status: openaiRes.status }, 502);
  }

  const completion = await openaiRes.json();
  const raw = completion?.choices?.[0]?.message?.content ?? "{}";
  let parsed: {
    category?: string;
    intent_type?: string;
    subject?: string;
    close_reason?: string;
    completion_score?: number;
    goal_met?: boolean;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("classify-conversation: invalid JSON from openai", raw);
    return json({ error: "invalid_model_json" }, 502);
  }

  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(parsed.category ?? "")
    ? (parsed.category as Category)
    : "other";
  const intent_type: Intent = (ALLOWED_INTENTS as readonly string[]).includes(parsed.intent_type ?? "")
    ? (parsed.intent_type as Intent)
    : (category !== "other" ? (category as Intent) : "inquiry");
  const subject = (parsed.subject ?? "").toString().slice(0, 200) || null;
  let completion_score: number | null = null;
  if (typeof parsed.completion_score === "number" && Number.isFinite(parsed.completion_score)) {
    completion_score = Math.max(0, Math.min(100, Math.round(parsed.completion_score)));
  }
  const goal_met: boolean | null = typeof parsed.goal_met === "boolean" ? parsed.goal_met : null;

  const { error: updErr } = await supabase
    .from("conversations_main")
    .update({
      category,
      subject,
      intent_type,
      completion_score,
      goal_met,
      analysis_done: true,
    })
    .eq("id", conversation_id)
    .eq("tenant_id", tenant_id);

  if (updErr) {
    console.error("classify-conversation: update failed", updErr);
    return json({ error: "update_failed" }, 500);
  }

  return json({ ok: true, category, intent_type, subject, completion_score, goal_met });
});