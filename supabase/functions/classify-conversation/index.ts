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

async function loadSecret(): Promise<string | null> {
  // Prefer the env var; fall back to the row written by the migration.
  const env = Deno.env.get("CLASSIFY_WEBHOOK_SECRET");
  if (env && env.length > 0) return env;
  const { data } = await supabase
    .from("_app_secrets")
    .select("value")
    .eq("key", "classify_webhook_secret")
    .maybeSingle();
  return data?.value ?? null;
}

const ALLOWED_CATEGORIES = ["complaint", "inquiry", "request", "suggestion", "other"] as const;
type Category = typeof ALLOWED_CATEGORIES[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Verify shared secret from the trigger
  const provided = req.headers.get("x-classify-secret") ?? "";
  const expected = await loadSecret();
  if (!expected || provided !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

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
    "You classify customer-support chat transcripts.",
    "Reply ONLY in JSON with this exact shape:",
    `{ "category": "complaint" | "inquiry" | "request" | "suggestion" | "other",`,
    `  "subject": string,  // <= 80 chars, in the conversation's language`,
    `  "close_reason": string  // <= 120 chars, why the conversation ended`,
    "}",
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
        model: "gpt-4o-mini",
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
  let parsed: { category?: string; subject?: string; close_reason?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("classify-conversation: invalid JSON from openai", raw);
    return json({ error: "invalid_model_json" }, 502);
  }

  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(parsed.category ?? "")
    ? (parsed.category as Category)
    : "other";
  const subject = (parsed.subject ?? "").toString().slice(0, 200) || null;
  const close_reason = (parsed.close_reason ?? "").toString().slice(0, 500) || null;

  const { error: updErr } = await supabase
    .from("conversations_main")
    .update({ category, subject, close_reason })
    .eq("id", conversation_id)
    .eq("tenant_id", tenant_id);

  if (updErr) {
    console.error("classify-conversation: update failed", updErr);
    return json({ error: "update_failed" }, 500);
  }

  return json({ ok: true, category, subject, close_reason });
});