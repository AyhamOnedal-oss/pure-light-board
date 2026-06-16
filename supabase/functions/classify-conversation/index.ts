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

/**
 * Filter out trivial/empty "unanswered questions" so the AI Insights "Unknown
 * Questions" card only shows real knowledge gaps the shop owner can act on.
 * Rejects greetings, thanks, single words, and very short non-question text.
 */
function sanitizeUnansweredQuestion(raw: unknown): string | null {
  const s = (raw ?? "").toString().trim().replace(/\s+/g, " ");
  if (!s) return null;
  // Strip trailing punctuation for matching
  const stripped = s.replace(/[?؟.!،,;:"'«»()\[\]]+$/g, "").trim();
  if (stripped.length < 12) return null;
  // Must contain at least 3 words — real topics need substance
  if (stripped.split(" ").length < 3) return null;
  // Reject echoes of the AI asking the customer to clarify a vague message.
  // These are not customer questions; they are the bot's clarification prompt.
  const CLARIFY_PATTERNS = [
    /ما\s*المقصود/, /يرجى\s*التوضيح/, /يرجى\s*توضيح/, /هل\s*يمكنك\s*توضيح/,
    /لم\s*أفهم\s*ما\s*تقصد/, /وضّ?ح\s*أكثر/, /وضح\s*اكثر/, /ايش\s*تقصد/,
    /وش\s*تقصد/, /please\s+clarify/i, /what\s+do\s+you\s+mean/i,
    /could\s+you\s+clarify/i, /can\s+you\s+clarify/i,
  ];
  if (CLARIFY_PATTERNS.some((re) => re.test(s))) return null;
  // Reject when the text quotes a tiny gibberish token like 'dd', "xx", «؟؟».
  // Heuristic: any quoted substring ≤3 chars => the rephrasing is just
  // echoing the customer's unintelligible token.
  if (/['"«“”‘’`](.{1,3})['"«“”‘’`]/.test(s)) return null;
  const lower = stripped.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, ""); // strip Arabic diacritics
  const TRIVIAL = [
    "السلام عليكم", "وعليكم السلام", "مرحبا", "مرحبتين", "هلا", "هلا والله",
    "اهلا", "أهلا", "صباح الخير", "مساء الخير", "شكرا", "شكرا لك", "مشكور",
    "تسلم", "يعطيك العافيه", "يعطيك العافية", "تمام", "اوكي", "اوك", "ok",
    "okay", "hi", "hello", "hey", "thanks", "thank you", "good morning",
    "good evening", "bye", "مع السلامه", "مع السلامة",
  ];
  for (const t of TRIVIAL) {
    if (lower === t || lower.startsWith(t + " ") && stripped.length - t.length < 6) return null;
  }
  // Require at least one meaningful word (Arabic ≥3 chars with a vowel,
  // or Latin ≥4 chars with a vowel) so single-token / keystroke garbage
  // ("dslv ce fe", "asdf qwer") never reaches the card.
  const ARABIC = /[\u0600-\u06FF]/;
  const VOWEL = /[aeiouAEIOUيواىآأإؤئ]/;
  const tokens = stripped.split(" ").filter((t) => t.length >= 2);
  const hasRealWord = tokens.some((t) => {
    if (ARABIC.test(t)) return t.length >= 3 && VOWEL.test(t);
    return /^[A-Za-z]{4,}$/.test(t) && VOWEL.test(t);
  });
  if (!hasRealWord) return null;
  return s.slice(0, 200);
}
type Category = typeof ALLOWED_CATEGORIES[number];
const ALLOWED_INTENTS = ["complaint", "inquiry", "request", "suggestion"] as const;
type Intent = typeof ALLOWED_INTENTS[number];
const ALLOWED_PRIORITIES = ["low", "medium", "high"] as const;
type Priority = typeof ALLOWED_PRIORITIES[number];

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
    .select("analysis_done, csat_rating, rating_comment")
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

  const ratingHeader = typeof convRow?.csat_rating === "number"
    ? `CUSTOMER_RATING: ${convRow.csat_rating}/5${convRow.rating_comment ? ` — ${String(convRow.rating_comment).slice(0, 200)}` : ""}\n\n`
    : "";
  const transcript = ratingHeader + messages
    .map((m) => `${(m.sender ?? "user").toUpperCase()}: ${(m.body ?? "").trim()}`)
    .join("\n");

  // Customer-only view of the transcript. Intent MUST come from these lines
  // only — never from assistant/agent/bot replies.
  const customerSenders = new Set(["user", "customer", "visitor", "client", "guest"]);
  const customerMessages = messages
    .filter((m) => customerSenders.has((m.sender ?? "user").toString().toLowerCase()))
    .map((m) => (m.body ?? "").trim())
    .filter((s) => s.length > 0);
  const customerOnlyBlock = customerMessages.length > 0
    ? customerMessages.map((b) => `CUSTOMER: ${b}`).join("\n")
    : "(no customer messages)";

  // Deterministic gibberish / no-intent guard. If every customer message is
 // empty, a pure greeting/thanks, emoji-only, or random keystrokes with no
 // real word, short-circuit to `other` and skip the model entirely.
  function isMeaningfulCustomerText(raw: string): boolean {
    const s = (raw ?? "").toString().trim();
    if (!s) return false;
    // Strip emojis, punctuation, digits -> what's left should be letters.
    const lettersOnly = s
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
      .replace(/[^\p{L}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (lettersOnly.length < 3) return false;
    const tokens = lettersOnly.split(" ").filter((t) => t.length >= 2);
    if (tokens.length === 0) return false;
    const ARABIC = /[\u0600-\u06FF]/;
    const VOWEL = /[aeiouAEIOUيواىآأإؤئ]/;
    const hasRealWord = tokens.some((t) => {
      if (ARABIC.test(t)) {
        // Arabic token must be ≥3 chars AND contain at least one common
        // Arabic vowel/long-vowel letter, otherwise it's likely keystrokes
        // like "ىؤتيراهاالر" (which DOES contain ي/ا — so also require it
        // not be in the trivial greeting list, handled below).
        return t.length >= 3 && VOWEL.test(t);
      }
      // Latin token: ≥3 chars and must contain a vowel (filters "dslv", "ce", "fe", "rv").
      return /^[A-Za-z]{3,}$/.test(t) && VOWEL.test(t);
    });
    if (!hasRealWord) return false;
    // Trivial greetings/thanks alone don't count as real intent.
    const norm = lettersOnly.toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "");
    const TRIVIAL = new Set([
      "السلام عليكم","وعليكم السلام","مرحبا","مرحبتين","هلا","هلا والله",
      "اهلا","أهلا","صباح الخير","مساء الخير","شكرا","شكرا لك","مشكور",
      "تسلم","يعطيك العافيه","يعطيك العافية","تمام","اوكي","اوك",
      "ok","okay","hi","hello","hey","thanks","thank you","bye",
      "مع السلامه","مع السلامة",
    ]);
    if (TRIVIAL.has(norm)) return false;
    return true;
  }
  const anyMeaningful = customerMessages.some(isMeaningfulCustomerText);
  if (!anyMeaningful) {
    await supabase
      .from("conversations_main")
      .update({
        category: "other",
        intent_type: "inquiry",
        subject: "محادثة بدون محتوى",
        completion_score: 0,
        goal_met: false,
        analysis_done: true,
      })
      .eq("id", conversation_id)
      .eq("tenant_id", tenant_id);
    return json({ ok: true, category: "other", short_circuit: "no_meaningful_customer_text" });
  }

  // Use Lovable AI Gateway with openai/gpt-5-mini for cheap, accurate classification.
  // Falls back to OPENAI_API_KEY direct call if the gateway key is missing.
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!lovableKey && !openaiKey) {
    console.error("classify-conversation: neither LOVABLE_API_KEY nor OPENAI_API_KEY set");
    return json({ error: "no_api_key" }, 500);
  }

  const systemPrompt = [
    "You analyze customer-support chat transcripts.",
    "ONLY the customer's own words determine the category. The assistant's",
    "replies are context for `subject` / `close_reason` only and MUST NEVER",
    "drive `category` or `intent_type`.",
    "",
    "User-only intent rule (CRITICAL):",
    " - Intent is determined EXCLUSIVELY from lines prefixed `USER:` or",
    "   `CUSTOMER:` in the transcript, and from the separate",
    "   `CUSTOMER_MESSAGES_ONLY:` block at the end of the user message.",
    " - NEVER infer intent from `ASSISTANT:`, `AI:`, `AGENT:`, or `BOT:`",
    "   lines. Those are replies to the customer, not customer intent.",
    " - If you mentally remove every non-user line and nothing meaningful",
    "   remains (gibberish, pure greeting, emojis only, empty), the category",
    "   is `other`.",
    "",
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
    "",
    "Dominant-intent rule (CRITICAL):",
    " - Read the ENTIRE transcript. Classify by the customer's DOMINANT /",
    "   most impactful intent across the whole conversation, NOT the last",
    "   message. The strongest, most substantive customer turn wins.",
    " - When multiple intents appear (e.g. inquiry -> side suggestion ->",
    "   'raise a ticket'), pick the one with the most substance / clearest",
    "   customer goal.",
    " - IGNORE these as category signals — they are internal system actions,",
    "   not customer intent, and must NEVER decide the category:",
    "     * Asking to raise / open / submit a ticket:",
    "       'ارفع تذكرة', 'أبغى أتواصل مع موظف', 'حولني لموظف', 'سجل تذكرة'",
    "     * Asking to end / close the conversation:",
    "       'أنهي المحادثة', 'خلاص شكراً انهِ', 'انهِ المحادثة'",
    "",
    "When to use 'other' (STRICT):",
    " Use category = 'other' ONLY when the conversation has NO real customer",
    " intent among the 4 (inquiry / complaint / request / suggestion). This",
    " covers:",
    "  - Gibberish or random keystrokes: 'ىؤتيراهاالر', 'asdfgh', 'يسهتارخقا'",
    "  - Empty / whitespace-only messages, test pings",
    "  - Pure greetings, thanks, or chit-chat with NO follow-up question,",
    "    complaint, request, or suggestion: only 'السلام عليكم', only 'مرحبا',",
    "    only 'هلا', only 'شكراً', only 'تمام', only emojis.",
    " If a greeting is FOLLOWED by a real question / complaint / request /",
    " suggestion, classify by that real intent — NOT 'other'.",
    "",
    "Examples (study these — they show how to weigh intent in context):",
    "",
    "Example 1:",
    "CUSTOMER: السلام عليكم، عندي اقتراح بغير متجركم",
    "→ category: suggestion, intent_type: suggestion",
    "(Customer is sharing an idea, even though they greeted first.)",
    "",
    "Example 2:",
    "CUSTOMER: ياليت تضيفون خيار الدفع عند الاستلام",
    "→ category: suggestion, intent_type: suggestion",
    "",
    "Example 3:",
    "CUSTOMER: طلبي تأخر من أسبوع وما وصل، هذا غير مقبول",
    "→ category: complaint, intent_type: complaint",
    "",
    "Example 4:",
    "CUSTOMER: ليش طلبي ما وصل لين الحين؟",
    "→ category: complaint, intent_type: complaint",
    "(Phrased as a question but the real intent is a complaint about delay.)",
    "",
    "Example 5:",
    "CUSTOMER: أبغى أرجع المنتج، ما عجبني المقاس",
    "→ category: request, intent_type: request",
    "",
    "Example 6:",
    "CUSTOMER: ممكن تلغون طلبي رقم 1234؟",
    "→ category: request, intent_type: request",
    "(Starts with 'ممكن' but the action requested is cancellation — request, not inquiry.)",
    "",
    "Example 7:",
    "CUSTOMER: كم سعر الشحن للرياض؟",
    "→ category: inquiry, intent_type: inquiry",
    "",
    "Example 8:",
    "CUSTOMER: هل عندكم مقاس XL متوفر؟",
    "→ category: inquiry, intent_type: inquiry",
    "",
    "Example 9:",
    "CUSTOMER: مرحبا، حاب أعرف كيف أرجع المنتج",
    "→ category: request, intent_type: request",
    "(Asking 'how to return' is a return request, not a pure inquiry.)",
    "",
    "Example 10:",
    "CUSTOMER: لو سمحتم تحسنون سرعة التوصيل، تأخر علي مرتين",
    "→ category: suggestion, intent_type: suggestion",
    "(Mentions delay but the framing is an improvement suggestion, not a complaint about a specific order.)",
    "",
    "Example 11:",
    "CUSTOMER: أبي المنتج الفلاني",
    "→ category: request, intent_type: request",
    "(Customer wants a specific product — purchase/order request.)",
    "",
    "Example 12:",
    "CUSTOMER: وين طلبي؟",
    "→ category: inquiry, intent_type: inquiry",
    "(Short status question about an existing order — inquiry, not complaint, unless they explicitly express frustration or delay.)",
    "",
    "Example 13:",
    "CUSTOMER: ليش ما يكون التوصيل خلال 24 ساعة؟",
    "→ category: suggestion, intent_type: suggestion",
    "(Phrased as 'why not' — it's a proposal to improve delivery speed, not a complaint about a specific order.)",
    "",
    "Example 14:",
    "CUSTOMER: المنتج وصل تالف",
    "→ category: complaint, intent_type: complaint",
    "(Damaged product on arrival — complaint.)",
    "",
    "Example 15:",
    "CUSTOMER: ىؤتيراهاالر",
    "CUSTOMER: يسهتارخقا",
    "→ category: other, intent_type: inquiry",
    "(Gibberish — no real intent.)",
    "",
    "Example 16:",
    "CUSTOMER: السلام عليكم",
    "→ category: other, intent_type: inquiry",
    "(Greeting only, no follow-up — no real intent.)",
    "",
    "Example 17:",
    "CUSTOMER: شكراً",
    "CUSTOMER: 🌹",
    "→ category: other, intent_type: inquiry",
    "(Thanks + emoji only — no real intent.)",
    "",
    "Example 18:",
    "CUSTOMER: السلام عليكم، أبغى أعرف هل عندكم توصيل للدمام؟",
    "CUSTOMER: بالمناسبة ياليت تضيفون طرق دفع أكثر",
    "CUSTOMER: طيب ارفعوا لي تذكرة عشان أتابع",
    "→ category: inquiry, intent_type: inquiry",
    "(Dominant intent is shipping inquiry. The suggestion is a side note;",
    " 'raise a ticket' is a system action — both ignored.)",
    "",
    "Example 19:",
    "CUSTOMER: dslv,ed,ve",
    "CUSTOMER: ce,fe,v,,r,v",
    "ASSISTANT: هلا حياك الله 👋 أنا مساعد متجر … هل تبحث عن **منتج** ولا **تي تعرف حالة طلب**؟",
    "→ category: other, intent_type: inquiry",
    "(Random keystrokes only from the customer. IGNORE the assistant's",
    " helpful reply — it does not make this an inquiry.)",
    "",
    "Negative examples for unanswered_question (MUST be \"\"):",
    "",
    "Example N1:",
    "CUSTOMER: dd",
    "ASSISTANT: ما المقصود بـ 'dd'؟ يرجى توضيح طلبك.",
    "→ unanswered_question: \"\"  (customer's message is unintelligible; AI",
    " correctly asked to clarify — NOT a training gap.)",
    "",
    "Example N2:",
    "CUSTOMER: xx",
    "CUSTOMER: ؟؟",
    "ASSISTANT: لم أفهم، هل يمكنك التوضيح؟",
    "→ unanswered_question: \"\"  (no real question from the customer.)",
    "",
    "Example N3:",
    "CUSTOMER: السلام عليكم",
    "ASSISTANT: وعليكم السلام، كيف أساعدك؟",
    "→ unanswered_question: \"\"  (greeting only — no need to record.)",
    "",
    "Example N4 (POSITIVE — IS a gap):",
    "CUSTOMER: هل تدعمون الشحن المبرد للأدوية؟",
    "ASSISTANT: لا أملك معلومات عن هذا الموضوع، سأحوّلك لموظف.",
    "→ unanswered_question: \"هل تدعمون الشحن المبرد للأدوية؟\"  (clear",
    " informational need the AI couldn't answer — record it.)",
    "",
    "Example N5 (POSITIVE — IS a gap):",
    "CUSTOMER: الموقع يعلّق كل ما أضيف منتج للسلة، ما أقدر أكمّل الطلب",
    "ASSISTANT: لم أفهم مشكلتك، يرجى التوضيح.",
    "→ unanswered_question: \"العميل يشتكي أن الموقع يعلّق عند إضافة منتج للسلة\"",
    " (customer message is clear; AI failed to understand — record it.)",
    "",
    "Reply ONLY in JSON with this exact shape:",
    `{ "category": "complaint" | "inquiry" | "request" | "suggestion" | "other",`,
    `  "intent_type": "complaint" | "inquiry" | "request" | "suggestion",`,
    `  "subject": string,           // <= 80 chars, in the conversation's language`,
    `  "close_reason": string,      // <= 120 chars, why the conversation ended`,
    `  "completion_score": number,  // 0-100, how completely the customer was helped`,
    `  "goal_met": boolean,          // did the customer get what they came for?`,
    `  "priority": "low" | "medium" | "high",  // urgency, see guide below`,
    `  "unanswered_question": string,  // A SHORT, CLEAR REPHRASING (<=140 chars, in the conversation's language) of the REAL informational need the AI failed to satisfy. Set this ONLY when the customer expressed a clear, understandable need (question / complaint / request / suggestion) AND the AI failed to handle it because: (a) it said it doesn't know / lacks info / "سأحوّلك لموظف" / "لا أملك معلومات"; (b) it gave an irrelevant or off-topic reply; (c) it didn't understand a clearly-written question; (d) the customer was clearly not helped (low CSAT, complaint about the bot, repeated rephrasing). Good examples: "هل تدعمون الشحن المبرد؟", "العميل اشتكى أن الموقع يعلّق ولم يتفاهم معه الذكاء", "طلب تعديل خاص على المنتج قبل الشحن". MUST be "" (empty string) in ALL of these cases: the customer message was itself unintelligible / random letters / a single token / a meaningless abbreviation (e.g. "dd", "xx", "asdf", "؟؟"); the AI's reply was itself a clarification request ("ما المقصود؟", "يرجى التوضيح") to a vague customer message; greeting-only ("السلام عليكم", "مرحبا"); thanks-only ("شكرا"); emoji-only; or the AI clearly answered correctly. The rephrasing must describe a real topic a shop owner could add to the knowledge base — never copy the customer's gibberish, never echo the AI's clarification prompt, never use a quoted ≤3-char token. Must be ≥3 words and contain a real noun/verb.`,
    `  "ticket_title": string,        // Arabic, <= 60 chars. Short label for the ticket email title. Examples: "طلب رفع تذكرة", "شكوى في تأخر الشحن", "استفسار عن سياسة الإرجاع", "طلب استرجاع منتج". Pick based on the dominant intent/category.`,
    `  "ticket_description": string   // Arabic, <= 180 chars, ONE sentence describing what happened: the customer's situation + what they want. Example: "العميل يشتكي من عدم وصول طلبه بعد ١٠ أيام ويطلب التحدث مع موظف بشري."`,
    "}",
    "Scoring guide for completion_score:",
    " 90-100 = fully resolved, customer satisfied.",
    " 70-89  = mostly resolved, minor follow-up possible.",
    " 40-69  = partially resolved or escalated.",
    " 0-39   = unresolved, abandoned, or AI failed to help.",
    "",
    "If the transcript begins with a CUSTOMER_RATING line, that rating is the",
    "ground truth and MUST dominate completion_score and goal_met:",
    "  1/5 => completion_score <= 15, goal_met = false",
    "  2/5 => completion_score <= 35, goal_met = false",
    "  3/5 => completion_score <= 60",
    "  4/5 => completion_score <= 85",
    "  5/5 => no cap.",
    "",
    "Priority guide (urgency + sentiment):",
    " high   = angry/frustrated tone, damaged or lost order, payment problems,",
    "          explicit refund/cancellation demands, repeated complaints,",
    "          threats to leave, urgent time-sensitive request.",
    " medium = clear complaint or actionable request without strong urgency cues.",
    " low    = simple inquiry, suggestion, casual question, greeting only.",
  ].join("\n");

  // Fallback writer: ensure تصنيف is always set and any linked ticket gets
  // enough subject/description for the email trigger to fire, even when
  // OpenAI is unreachable / fails / returns garbage.
  async function writeFallback(reason: string) {
    await supabase
      .from("conversations_main")
      .update({
        category: "other",
        intent_type: "inquiry",
        subject: "محادثة من الويدجت",
        analysis_done: true,
      })
      .eq("id", conversation_id)
      .eq("tenant_id", tenant_id);
    await supabase
      .from("tickets_main")
      .update({
        subject: "طلب رفع تذكرة من المحادثة",
        description: "تم استلام طلب جديد من محادثة الويدجت.",
      })
      .eq("conversation_id", conversation_id)
      .eq("tenant_id", tenant_id);
    console.error("classify-conversation: fallback applied:", reason);
  }

  const useGateway = !!lovableKey;
  const url = useGateway
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (useGateway) {
    headers["Lovable-API-Key"] = lovableKey!;
  } else {
    headers["Authorization"] = `Bearer ${openaiKey}`;
  }
  const requestBody: Record<string, unknown> = {
    model: useGateway ? "openai/gpt-5-mini" : "gpt-4.1-mini-2025-04-14",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          transcript.slice(0, 10000) +
          "\n\nCUSTOMER_MESSAGES_ONLY:\n" +
          customerOnlyBlock.slice(0, 2000),
      },
    ],
  };
  // gpt-5-mini does not accept a custom temperature; only the legacy model does.
  if (!useGateway) requestBody.temperature = 0.2;

  let openaiRes: Response;
  try {
    openaiRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error("classify-conversation: openai fetch failed", err);
    await writeFallback("openai_unreachable");
    return json({ error: "openai_unreachable" }, 502);
  }

  if (!openaiRes.ok) {
    const text = await openaiRes.text().catch(() => "");
    console.error("classify-conversation: openai non-ok", openaiRes.status, text);
    await writeFallback(`openai_failed_${openaiRes.status}`);
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
    priority?: string;
    unanswered_question?: string;
    ticket_title?: string;
    ticket_description?: string;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("classify-conversation: invalid JSON from openai", raw);
    await writeFallback("invalid_model_json");
    return json({ error: "invalid_model_json" }, 502);
  }

  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(parsed.category ?? "")
    ? (parsed.category as Category)
    : "other";
  const intent_type: Intent = (ALLOWED_INTENTS as readonly string[]).includes(parsed.intent_type ?? "")
    ? (parsed.intent_type as Intent)
    : (category !== "other" ? (category as Intent) : "inquiry");
  const subject = (parsed.subject ?? "").toString().slice(0, 200) || null;
  const ticket_title = (parsed.ticket_title ?? "").toString().trim().slice(0, 120) || null;
  const ticket_description = (parsed.ticket_description ?? "").toString().trim().slice(0, 400) || null;
  const unanswered_question = sanitizeUnansweredQuestion(parsed.unanswered_question);
  let completion_score: number | null = null;
  if (typeof parsed.completion_score === "number" && Number.isFinite(parsed.completion_score)) {
    completion_score = Math.max(0, Math.min(100, Math.round(parsed.completion_score)));
  }
  let goal_met: boolean | null = typeof parsed.goal_met === "boolean" ? parsed.goal_met : null;

  // Defence in depth: enforce the CSAT-based cap even if the model ignored it.
  // (A DB trigger also re-applies this on every write.)
  const rating = typeof convRow?.csat_rating === "number" ? convRow.csat_rating : null;
  if (rating !== null) {
    const cap = rating === 1 ? 15 : rating === 2 ? 35 : rating === 3 ? 60 : rating === 4 ? 85 : 100;
    if (completion_score !== null) completion_score = Math.min(completion_score, cap);
    if (rating <= 2) goal_met = false;
  }
  const priority: Priority = (ALLOWED_PRIORITIES as readonly string[]).includes(parsed.priority ?? "")
    ? (parsed.priority as Priority)
    : "medium";

  const { error: updErr } = await supabase
    .from("conversations_main")
    .update({
      category,
      subject,
      intent_type,
      completion_score,
      goal_met,
      unanswered_question,
      analysis_done: true,
    })
    .eq("id", conversation_id)
    .eq("tenant_id", tenant_id);

  if (updErr) {
    console.error("classify-conversation: update failed", updErr);
    return json({ error: "update_failed" }, 500);
  }

  // Propagate priority (+ category) to any tickets linked to this conversation.
  const { error: tkErr } = await supabase
    .from("tickets_main")
    .update({
      priority,
      category: category === "other" ? null : category,
      // Fill ticket title + 1-line scenario description used by the
      // ticket-received email. The DB trigger fires the email as soon as
      // both subject and description are populated.
      subject: ticket_title ?? subject ?? "طلب رفع تذكرة من المحادثة",
      description: ticket_description ?? "تم استلام طلب جديد من محادثة الويدجت.",
    })
    .eq("conversation_id", conversation_id)
    .eq("tenant_id", tenant_id);
  if (tkErr) {
    console.error("classify-conversation: ticket priority update failed", tkErr);
  }

  return json({ ok: true, category, intent_type, subject, ticket_title, ticket_description, completion_score, goal_met, priority });
});