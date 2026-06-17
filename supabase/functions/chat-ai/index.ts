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
const CLASSIFIER_MODEL = "gpt-4o-mini";
const CLASSIFIER_TIMEOUT_MS = 3500;
const CLASSIFIER_MIN_CONFIDENCE = 0.5;

// USD per 1M tokens. Update when official pricing changes.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":  { input: 0.15, output: 0.60 },
  "gpt-4.1-nano": { input: 0.10, output: 0.40 },
  "gpt-4o":       { input: 2.50, output: 10.00 },
  "gpt-4.1":      { input: 2.00, output: 8.00 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = MODEL_PRICING[model] ?? { input: 0.10, output: 0.40 };
  return (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
}

type ReplyIntent = "offer_ticket" | "offer_close" | "continue";
type UserIntent = "end_conversation" | "request_ticket" | "normal";

type ClassifierVerdict<I extends string = ReplyIntent> = {
  intent: I;
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

async function callOpenAI(
  model: string,
  systemPrompt: string,
  userPrompt: string,
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
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
    }),
  });
}

const REPLY_SYS_PROMPT =
  "You classify a customer-support AI reply (Arabic or English). " +
  "Return strict JSON: {\"intent\":\"offer_ticket\"|\"offer_close\"|\"continue\",\"confidence\":0-1}. " +
  "offer_ticket = reply offers/suggests connecting the user with a human agent, customer service, or raising a support ticket. " +
  "offer_close = reply is wrapping up and asking if the user needs anything else. " +
  "continue = anything else (normal answer, info, clarification, product help).";

const USER_SYS_PROMPT =
  "You classify the LATEST customer message in a support chat (Arabic or English). " +
  "Return strict JSON: {\"intent\":\"end_conversation\"|\"request_ticket\"|\"normal\",\"confidence\":0-1}. " +
  "end_conversation = the customer signals they're done: short negatives or farewells like \"لا شكراً\", \"شكراً\", \"تمام شكراً\", \"خلاص\", \"كفاية\", \"بس كذا\", \"يعطيك العافية\", \"مع السلامه\", \"no thanks\", \"that's all\", \"i'm good\", \"bye\". " +
  "request_ticket = the customer explicitly asks to escalate to a human/support/ticket: \"أبي تذكرة\", \"افتح لي تذكرة\", \"كلموني\", \"اتصلوا فيني\", \"أبي أكلم خدمة العملاء\", \"موظف\", \"raise a ticket\", \"talk to support\", \"contact me\", \"speak to a human\". " +
  "normal = anything else: questions, requests for info, product questions, complaints that do NOT explicitly ask for a ticket, greetings, ambiguous messages. " +
  "Be conservative: only use end_conversation or request_ticket when the signal is clear.";

async function runClassifier<I extends string>(
  systemPrompt: string,
  userPrompt: string,
  defaultIntent: I,
  allowedIntents: readonly I[],
): Promise<ClassifierVerdict<I>> {
  const started = Date.now();
  const base: ClassifierVerdict<I> = {
    intent: defaultIntent,
    confidence: 0,
    model: CLASSIFIER_MODEL,
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
    const model = CLASSIFIER_MODEL;
    const res = await callOpenAI(model, systemPrompt, userPrompt, ctrl.signal);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("classifier_http_error", { status: res.status, body: txt });
      return { ...base, model, ms: Date.now() - started, error: `http_${res.status}:${txt.slice(0, 200)}` };
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { intent?: string; confidence?: number } = {};
    try { parsed = JSON.parse(content); } catch { /* leave empty */ }
    const intent: I = (allowedIntents as readonly string[]).includes(parsed.intent ?? "")
      ? (parsed.intent as I)
      : defaultIntent;
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

function classifyReplyIntent(reply: string, lastUserMessage: string) {
  return runClassifier<ReplyIntent>(
    REPLY_SYS_PROMPT,
    `Last user message: ${lastUserMessage}\n\nAI reply: ${reply}\n\nReturn JSON only.`,
    "continue",
    ["offer_ticket", "offer_close", "continue"] as const,
  );
}

/**
 * Deterministic Arabic/English wrap-up detector used as a fallback when the
 * LLM classifier returns "continue" with low confidence. Matches farewells,
 * "anything else?" style closers, and explicit goodbyes. Intentionally
 * conservative so it doesn't fire on opening greetings.
 */
const CLOSING_PHRASE_RE = new RegExp(
  [
    "في\\s*أمان\\s*الله",
    "مع\\s*الس?لامة",
    "مع\\s*الس?لامه",
    "سعدنا\\s*بخدمتك",
    "نتشرف\\s*بخدمتك",
    "شكر[اًا]?\\s*لتواصلك",
    "هل\\s*(لديك|تحتاج|عندك)\\s*(أي\\s*)?(شيء|إستفسار|استفسار|سؤال)\\s*(آخر|ثاني|اخر)",
    "أتمنى\\s*لك\\s*يوم[اًا]?\\s*(سعيد|طيب)",
    "إذا\\s*احتجت\\s*أي\\s*شيء\\s*(آخر|ثاني)",
    "have\\s+a\\s+(great|nice|good)\\s+day",
    "anything\\s+else\\s+i\\s+can\\s+help",
    "glad\\s+i\\s+could\\s+help",
  ].join("|"),
  "i",
);

function detectClosingPhrase(reply: string): boolean {
  if (!reply) return false;
  return CLOSING_PHRASE_RE.test(reply);
}

function classifyUserIntent(message: string) {
  return runClassifier<UserIntent>(
    USER_SYS_PROMPT,
    `Customer message: ${message}\n\nReturn JSON only.`,
    "normal",
    ["end_conversation", "request_ticket", "normal"] as const,
  );
}
const RATE_LIMIT_PER_MIN = 30;

type ActionType = "offer_ticket" | "offer_close" | "offer_close_done" | "none";

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
    // Capture the moment the customer's message hit the server. Used as
    // the customer message's created_at so the (customer → ai) gap in
    // conversations_messages reflects real AI/pipeline latency rather
    // than the post-insert wallclock.
    const userArrivedAtMs = Date.now();
    const body = await req.json();
    const { platform, store_id, store_uuid, visitor_id, history } = body;
    let message: string = typeof body.message === "string" ? body.message : "";
    const domain: string | null = body.domain ?? null;
    const visitor = body.visitor && typeof body.visitor === "object" ? body.visitor : null;
    let conversation_id: string | null = body.conversation_id ?? null;
    const is_test: boolean = body.is_test === true;

    // Image attachments (optional). Each item: { url, name, content_type, size, storage_path }
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX_FILE_BYTES = 5 * 1024 * 1024;
    const MAX_ATTACHMENTS = 4;
    let attachmentsIn: Array<{ url: string; name?: string; content_type: string; size?: number; storage_path?: string }> = [];
    if (Array.isArray(body.attachments)) {
      attachmentsIn = body.attachments
        .filter((a: any) => a && typeof a === "object" && typeof a.url === "string" && typeof a.content_type === "string")
        .slice(0, MAX_ATTACHMENTS)
        .map((a: any) => ({
          url: a.url,
          name: typeof a.name === "string" ? a.name : null,
          content_type: a.content_type,
          size: typeof a.size === "number" ? a.size : null,
          storage_path: typeof a.storage_path === "string" ? a.storage_path : null,
        }));
      for (const a of attachmentsIn) {
        if (!ALLOWED_MIME.includes(a.content_type)) {
          return jsonResponse({ error: "invalid_attachment_type", content_type: a.content_type }, 400);
        }
        if (a.size && a.size > MAX_FILE_BYTES) {
          return jsonResponse({ error: "attachment_too_large", max_bytes: MAX_FILE_BYTES }, 400);
        }
      }
    }
    const hasAttachments = attachmentsIn.length > 0;
    console.log("attachments_in", {
      count: attachmentsIn.length,
      types: attachmentsIn.map((a) => a.content_type),
      sizes: attachmentsIn.map((a) => a.size ?? null),
      url_kinds: attachmentsIn.map((a) =>
        a.url?.startsWith("data:") ? "data" : a.url?.startsWith("blob:") ? "blob" : a.url?.startsWith("http") ? "http" : "other"
      ),
    });

    if (!message && !hasAttachments) {
      return jsonResponse({ error: "missing_message" }, 400);
    }
    // Track whether the customer actually typed text (before we default it).
    const customerSentText = !!message && message.trim().length > 0;
    if (!message && hasAttachments) {
      message = "صِف الصورة المرفقة أو أجب عن سؤال العميل عنها.";
    }
    let userText: string = message;

    // Short-circuit reply: set when the image is clearly not a real product
    // photo AND the customer didn't type any text. We send this back directly
    // after tenant resolution, skipping the n8n agent so it can't hallucinate
    // "yes we have this product" from an icon/emoji/clipart.
    let nonProductShortCircuit: string | null = null;

    // === Vision pre-processing (image-first analysis) ===
    // Analyze the image BEFORE the n8n text agent runs and EXTRACT every
    // searchable signal (description, visible text, brand/logo, depicted
    // object, colors, suggested search query). We pass this to n8n so the
    // agent can search the merchant catalog by what the image depicts,
    // even when the image is a logo/icon/drawing rather than a real photo.
    if (hasAttachments && OPENAI_API_KEY) {
      try {
        const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            max_tokens: 700,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You analyze customer-attached images for a shopping support agent. " +
                  "ANALYZE THE IMAGE FIRST. Your job is to EXTRACT every searchable detail so the agent can find the matching product in the merchant catalog. " +
                  "Do NOT refuse just because the image is not a photograph: a logo, icon, sticker, drawing, or cartoon that depicts an object is still useful — describe what it depicts. " +
                  "LOOK FOR DISTINCTIVE PRODUCT CUES to name the SPECIFIC model/variant: phone camera layout & count, MagSafe ring / Dynamic Island / Camera Control button, body material/finish, sneaker silhouette/logo, perfume cap shape, watch dial. Combine these cues with any visible text/logo/retailer badge to pin down the exact model. " +
                  "If you are at least ~70% confident of the specific model/variant, set product_guess to the full model name in English (e.g. 'iPhone 17 Pro Max', 'Nike Air Force 1 Low White', 'Dior Sauvage EDP'). If unsure, leave product_guess empty and rely on category + brand + color. " +
                  "Never invent specifications you cannot see (storage size, RAM, release year). Only name what visual cues support. " +
                  "ALWAYS produce search_queries in BOTH English AND Arabic when the product has a recognizable international name. For Arabic queries containing numbers, include BOTH ASCII digits (1,2,3) AND Eastern-Arabic digits (١,٢,٣) as SEPARATE variants — Saudi catalogs use both. Order queries from MOST specific to least specific. " +
                  "Example 1: iPhone 17 Pro Max in orange on a SmartBuy listing → image_kind='product_photo', category='smartphone', brand_or_logo='Apple', product_guess='iPhone 17 Pro Max', product_guess_confidence=0.85, color='orange', retailer_or_source_text='SmartBuy', search_queries=['iPhone 17 Pro Max Orange','Apple iPhone 17 Pro Max','ايفون 17 برو ماكس برتقالي','آيفون ١٧ برو ماكس','iphone pro max orange'], has_useful_signal=true. " +
                  "Example 2: cartoon gift box with wordmark 'Fuqah' → image_kind='logo', depicted_object='gift box', brand_or_logo='Fuqah', readable_text='Fuqah', product_guess='', category='gift', color='', search_queries=['علبة هدية فقاهة','Fuqah gift box','هدية فقاهة'], has_useful_signal=true. " +
                  "Example 3: real perfume bottle, no readable brand → image_kind='product_photo', category='perfume', depicted_object='perfume bottle', search_queries=['عطر','perfume bottle'], has_useful_signal=true. " +
                  "Example 4: a single 🤔 emoji or random scribble with no recognizable object → has_useful_signal=false, search_queries=[]. " +
                  "Return ONLY a JSON object with this exact schema: " +
                  "{ " +
                  "\"image_kind\": one of [\"product_photo\",\"screenshot\",\"icon_or_clipart\",\"emoji\",\"logo\",\"receipt_or_document\",\"drawing_or_sketch\",\"person_or_selfie\",\"unclear\"], " +
                  "\"description\": string (1-2 short objective sentences in Arabic if customer wrote Arabic else English; describe what you SEE — do not call it a product unless image_kind=product_photo), " +
                  "\"readable_text\": string (literal transcription of any text inside the image including brand/logo wordmarks, or \"\"), " +
                  "\"depicted_object\": string (the main object/subject the image represents, even for icons/logos/drawings, e.g. \"gift box\", \"sneaker\", \"perfume bottle\"; \"\" only if truly nothing identifiable), " +
                  "\"brand_or_logo\": string (any brand/logo name visible, or \"\"), " +
                  "\"product_guess\": string (specific model/variant name in English when ≥~70% confident from visual cues, e.g. \"iPhone 17 Pro Max\"; otherwise \"\"), " +
                  "\"product_guess_confidence\": number between 0 and 1 (0 when product_guess is \"\"), " +
                  "\"category\": string (short product category, e.g. \"smartphone\", \"sneaker\", \"perfume\", \"watch\"; \"\" if unknown), " +
                  "\"color\": string (primary color in English, single word, e.g. \"orange\", \"black\"; \"\" if not applicable), " +
                  "\"retailer_or_source_text\": string (any retailer/store badge, price, or source text visible like \"SmartBuy\", \"299 SAR\"; \"\"), " +
                  "\"dominant_colors\": array of 1-3 short color names in the user's language (e.g. [\"ذهبي\",\"أخضر داكن\"], or []), " +
                  "\"search_queries\": array of 3-6 query variants ordered most-specific first, covering full product name in English, full product name in Arabic (BOTH digit systems if it contains a number), brand+category+color, and generic category+color fallbacks. Empty array [] only when has_useful_signal=false. " +
                  "\"has_useful_signal\": boolean (true when ANY of description, readable_text, depicted_object, brand_or_logo, or search_query is non-empty and meaningful) " +
                  "}. " +
                  "Never refuse. Always fill what you can.",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: customerSentText ? `Customer caption: ${message}` : "No caption from the customer." },
                  ...attachmentsIn.map((a: any) => ({
                    type: "image_url",
                    image_url: { url: a.url, detail: "high" },
                  })),
                ],
              },
            ],
          }),
        });
        if (visionRes.ok) {
          const vdata = await visionRes.json();
          const raw: string = vdata?.choices?.[0]?.message?.content?.trim() ?? "";
          const usage = vdata?.usage ?? {};
          console.log("vision_usage", {
            attachments: attachmentsIn.length,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            cost_usd: estimateCost("gpt-4o-mini", usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0),
          });
          let parsed: any = null;
          try { parsed = JSON.parse(raw); } catch { /* leave null */ }
          if (parsed && typeof parsed === "object") {
            const kind: string = String(parsed.image_kind ?? "unclear");
            const isProduct: boolean = kind === "product_photo";
            const desc: string = String(parsed.description ?? "").trim();
            const readable: string = String(parsed.readable_text ?? "").trim();
            const depicted: string = String(parsed.depicted_object ?? "").trim();
            const brand: string = String(parsed.brand_or_logo ?? "").trim();
            const colors: string[] = Array.isArray(parsed.dominant_colors)
              ? parsed.dominant_colors.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 3)
              : [];
            const productGuess: string = String(parsed.product_guess ?? "").trim();
            const productGuessConf: number = (() => {
              const n = Number(parsed.product_guess_confidence);
              return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
            })();
            const category: string = String(parsed.category ?? "").trim();
            const color: string = String(parsed.color ?? "").trim();
            const retailerText: string = String(parsed.retailer_or_source_text ?? "").trim();
            const searchQueriesRaw: string[] = Array.isArray(parsed.search_queries)
              ? parsed.search_queries.map((q: unknown) => String(q).trim()).filter(Boolean)
              : (parsed.search_query ? [String(parsed.search_query).trim()] : []);
            // De-dupe (case-insensitive) and cap at 6.
            const seen = new Set<string>();
            const searchQueries: string[] = [];
            for (const q of searchQueriesRaw) {
              const k = q.toLowerCase();
              if (!seen.has(k)) { seen.add(k); searchQueries.push(q); }
              if (searchQueries.length >= 6) break;
            }
            const usefulSignal: boolean =
              parsed.has_useful_signal === true ||
              !!(desc || readable || depicted || brand || productGuess || searchQueries.length);
            // Strong identity gate: only allow catalog search when the image
            // gives us a specific, high-confidence product identity. With weak
            // signals (just a brand logo, just a color, generic category) the
            // agent must NOT search the catalog — it should ask the customer
            // to type the product name instead, to avoid dumping unrelated
            // products.
            const hasStrongIdentity: boolean =
              (!!productGuess && productGuessConf >= 0.7) ||
              (!!brand && !!category && !!readable && readable.length >= 3);
            console.log("vision_verdict", {
              kind, isProduct, has_readable: !!readable,
              has_depicted: !!depicted, has_brand: !!brand,
              product_guess: productGuess || null,
              product_guess_confidence: productGuessConf,
              query_count: searchQueries.length,
              useful: usefulSignal,
              strong_identity: hasStrongIdentity,
            });

            const kindAr: Record<string, string> = {
              product_photo: "صورة منتج",
              screenshot: "لقطة شاشة",
              icon_or_clipart: "أيقونة/رسمة",
              emoji: "إيموجي",
              logo: "شعار",
              receipt_or_document: "إيصال/مستند",
              drawing_or_sketch: "رسم يدوي",
              person_or_selfie: "صورة شخصية",
              unclear: "غير واضحة",
            };

            const fmtLine = (label: string, value: string) =>
              value ? `${label}: ${value}\n` : "";
            const colorsLine = colors.length ? `الألوان البارزة: ${colors.join("، ")}\n` : "";
            const guessLine = productGuess
              ? `المنتج (تخمين بصري): ${productGuess}  (ثقة ${productGuessConf.toFixed(2)})\n`
              : "";
            const queriesBlock = searchQueries.length
              ? `استعلامات بحث مقترحة (جرّبها بالترتيب حتى تجد تطابقاً):\n` +
                searchQueries.map((q, i) => `  ${i + 1}) ${q}`).join("\n") + "\n"
              : "";
            const searchInstruction =
              `التعليمة:\n` +
              `  - ابحث في كتالوج المتجر باستخدام كل استعلام بالترتيب حتى تجد تطابقاً فعلياً.\n` +
              `  - إذا وجدت تطابقاً، أكّد للعميل اسم المنتج كما هو في الكتالوج واسأله إن كان هذا ما يقصد.\n` +
              `  - إذا لم تجد تطابقاً واضحاً بعد تجربة كل الاستعلامات، لا تعرض منتجات قريبة أو بديلة من الكتالوج. قل بأدب أنك لم تجد المنتج، اذكر التخمين البصري إن وُجد (مثال: "يبدو لي أنه ${productGuess || "هذا المنتج"}") واطلب من العميل تأكيد الاسم أو إرسال الرابط.\n` +
              `  - لا تقترح على العميل قائمة موديلات قديمة عشوائية إذا الصورة تشير لموديل محدد.\n` +
              `  - لا تؤكد التوفر إلا إذا وجدت تطابقاً فعلياً في الكتالوج.`;

            // Used when the image has SOME signal but no specific product
            // identity. Tells n8n: do NOT search catalog, ask the customer.
            const askForNameInstruction =
              `التعليمة الصارمة:\n` +
              `  - الصورة لا تحدد منتجاً بعينه بثقة كافية.\n` +
              `  - ممنوع البحث في الكتالوج أو اقتراح أو عرض أي منتج بناءً على هذه الصورة وحدها.\n` +
              `  - اطلب من العميل بأدب اسم المنتج كما هو مكتوب، أو وصفاً أوضح (الموديل، الحجم، اللون)، أو رابطاً للمنتج.\n` +
              `  - يمكنك الإشارة باختصار لما رأيته في الصورة (مثلاً: "أرى علامة ${brand || "—"}${color ? ` باللون ${color}` : ""}") لكن بدون عرض أي منتج من الكتالوج.`;

            let block: string;
            if (isProduct && hasStrongIdentity) {
              block =
                `[تحليل الصورة المرفقة]\n` +
                `النوع: صورة منتج\n` +
                fmtLine("الفئة", category) +
                fmtLine("العلامة", brand) +
                guessLine +
                fmtLine("اللون", color) +
                fmtLine("الوصف", desc) +
                fmtLine("الشيء الظاهر", depicted) +
                fmtLine("نص ظاهر داخل الصورة", readable) +
                fmtLine("نص بائع/مصدر", retailerText) +
                colorsLine +
                queriesBlock +
                searchInstruction;
            } else if (hasStrongIdentity) {
              // Non-product_photo kind (e.g. screenshot, logo) but identity is strong → still allow catalog search.
              block =
                `[تحليل الصورة المرفقة]\n` +
                `النوع: ${kindAr[kind] ?? kind} (ليست صورة منتج فوتوغرافية، لكنها تحمل معلومات مفيدة)\n` +
                fmtLine("الفئة", category) +
                fmtLine("العلامة", brand) +
                guessLine +
                fmtLine("اللون", color) +
                fmtLine("الوصف", desc) +
                fmtLine("الشيء الذي تمثله الصورة", depicted) +
                fmtLine("نص ظاهر داخل الصورة", readable) +
                fmtLine("نص بائع/مصدر", retailerText) +
                colorsLine +
                queriesBlock +
                searchInstruction;
            } else if (usefulSignal) {
              // Weak signal: brand/color/category only. NEVER search the catalog;
              // ask the customer for the product name instead.
              block =
                `[تحليل الصورة المرفقة]\n` +
                `النوع: ${kindAr[kind] ?? kind}\n` +
                fmtLine("الفئة", category || "غير محددة") +
                fmtLine("العلامة", brand) +
                fmtLine("اللون", color) +
                fmtLine("الوصف", desc) +
                fmtLine("الشيء الذي تمثله الصورة", depicted) +
                fmtLine("نص ظاهر داخل الصورة", readable) +
                colorsLine +
                askForNameInstruction;
            } else if (kind === "unclear" || !usefulSignal) {
              // No useful signal extracted at all.
              if (customerSentText) {
                block =
                  `[تحليل الصورة المرفقة]\n` +
                  `النوع: ${kindAr[kind] ?? kind} — لم يتم استخراج معلومات واضحة\n` +
                  `التعليمة: تجاهل الصورة وأجب عن سؤال العميل النصي بشكل طبيعي.`;
              } else {
                block =
                  `[تحليل الصورة المرفقة]\n` +
                  `النوع: ${kindAr[kind] ?? kind} — لم يتم استخراج معلومات واضحة\n` +
                  `التعليمة: اطلب من العميل اسم المنتج أو رابطه.`;
                nonProductShortCircuit =
                  `وصلتني صورتك لكن ما قدرت أستخرج منها معلومات واضحة عن منتج. ` +
                  `ابعث لي اسم المنتج أو رابطه أو صورته الفعلية وأخدمك 🌷`;
              }
            } else {
              block = `[تحليل الصورة المرفقة]\nالوصف: ${desc || "(بدون وصف)"}`;
            }

            userText = customerSentText ? `${message}\n\n${block}` : block;
          } else if (raw) {
            // Model returned non-JSON despite response_format — fall back to
            // injecting the raw text as a plain description.
            userText = customerSentText
              ? `${message}\n\n[وصف الصورة المرفقة: ${raw}]`
              : `[وصف الصورة المرفقة: ${raw}]`;
          }
        } else {
          const errTxt = await visionRes.text().catch(() => "");
          console.error("vision_http_error", { status: visionRes.status, body: errTxt.slice(0, 300) });
        }
      } catch (e) {
        console.error("vision_failed", String((e as any)?.message ?? e));
      }
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

    // Skip rate limit for merchant test-chat sessions
    if (!is_test && !(await checkRateLimit(tenant_id))) {
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
          is_test,
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

    // ── Helper: log a classifier verdict (best-effort) ────────────────────
    const logClassifier = async (
      stage: "user_intent" | "reply_intent",
      v: ClassifierVerdict<string> | null,
      decidedIntent: string,
      source: string,
    ) => {
      try {
        await supabase.from("ai_classifier_usage").insert({
          tenant_id,
          conversation_id,
          stage,
          model: v?.model ?? CLASSIFIER_MODEL,
          intent: v?.intent ?? decidedIntent,
          confidence: v?.confidence ?? 0,
          source,
          prompt_tokens: v?.prompt_tokens ?? 0,
          completion_tokens: v?.completion_tokens ?? 0,
          total_tokens: v?.total_tokens ?? 0,
          cost_usd: v?.cost_usd ?? 0,
          latency_ms: v?.ms ?? 0,
        });
      } catch (e) {
        console.log("classifier usage insert failed (non-fatal):", e);
      }
    };

    // ── Helper: persist user + AI messages (best-effort) ──────────────────
    const persistMessages = async (userText: string, aiText: string): Promise<{ ai_message_id: string | null }> => {
      if (!conversation_id) return { ai_message_id: null };
      try {
        await supabase.from("conversations_messages").insert({
          tenant_id,
          conversation_id,
          sender: "customer",
          kind: "text",
          body: userText,
          word_count: userText.split(/\s+/).length,
          attachments: attachmentsIn,
          // When the request actually arrived at the edge function.
          created_at: new Date(userArrivedAtMs).toISOString(),
        });
        const { data: aiRow } = await supabase.from("conversations_messages").insert({
          tenant_id,
          conversation_id,
          sender: "ai",
          kind: "text",
          body: aiText,
          word_count: aiText.split(/\s+/).length,
          // Real wallclock at persistence — after the model + pipeline
          // finished. This is what makes avg-response time meaningful.
          created_at: new Date().toISOString(),
        }).select("id").single();
        return { ai_message_id: (aiRow?.id as string | undefined) ?? null };
      } catch (e) {
        console.log("persist failed (non-fatal):", e);
        return { ai_message_id: null };
      }
    };

    // ── Stage 1: classify the USER message before doing anything heavy ────
    // Detects clear end-of-conversation or explicit ticket requests and
    // short-circuits the response without calling n8n.
    const userVerdict = await classifyUserIntent(message);
    const userIntent =
      userVerdict.ok && userVerdict.confidence >= CLASSIFIER_MIN_CONFIDENCE
        ? userVerdict.intent
        : "normal";
    console.log("user_intent", {
      intent: userVerdict.intent,
      confidence: userVerdict.confidence,
      decided: userIntent,
      ms: userVerdict.ms,
      error: userVerdict.error,
    });

    if (userIntent === "end_conversation") {
      const reply = "شكراً لتواصلك معنا 🌷 يومك سعيد.";
      const action = { type: "offer_close_done" as ActionType, reason: "user_end_conversation" };
      await logClassifier("user_intent", userVerdict, userIntent, "classifier");
      const persisted = await persistMessages(message, reply);
      try {
        await supabase
          .from("conversations_main")
          .update({
            status: "closed",
            resolved_at: new Date().toISOString(),
            close_reason: "user_end_conversation",
          })
          .eq("id", conversation_id);
      } catch (e) {
        console.log("conversation close update failed (non-fatal):", e);
      }
      return jsonResponse({ reply, attachments: [], action, intent: "closed", tenant_id, conversation_id, ai_message_id: persisted.ai_message_id });
    }

    if (userIntent === "request_ticket") {
      const reply = "تمام، يرجى إدخال رقم هاتفك ليتم فتح تذكرة دعم لك:";
      const action = { type: "offer_ticket" as ActionType, reason: "user_request_ticket" };
      await logClassifier("user_intent", userVerdict, userIntent, "classifier");
      const persisted = await persistMessages(message, reply);
      return jsonResponse({ reply, attachments: [], action, intent: "offer_ticket", tenant_id, conversation_id, ai_message_id: persisted.ai_message_id });
    }

    // Log the user-intent verdict even when it was "normal" so we can see
    // confidence distributions and tune the threshold.
    await logClassifier(
      "user_intent",
      userVerdict,
      userIntent,
      userVerdict.ok ? (userIntent === "normal" ? "classifier" : "low_confidence") : "fallback",
    );

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

    // Short-circuit: image was clearly not a real product photo and the
    // customer didn't type a question. Reply directly and skip n8n so the
    // agent can't claim "yes we have this product" from an icon/emoji.
    if (nonProductShortCircuit) {
      const reply = nonProductShortCircuit;
      const action = { type: "none" as ActionType, reason: "non_product_image" };
      const persisted = await persistMessages(message, reply);
      return jsonResponse({
        reply,
        attachments: [],
        action,
        intent: "continue",
        tenant_id,
        conversation_id,
        ai_message_id: persisted.ai_message_id,
      });
    }

    console.log("n8n webhook kind:", N8N_WEBHOOK_URL.includes("/webhook-test/") ? "TEST" : N8N_WEBHOOK_URL.includes("/webhook/") ? "PRODUCTION" : "UNKNOWN");

    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id,
        conversation_id,
        visitor_id,
        message: userText,
        attachments: attachmentsIn.map((a) => ({
          url: a.url,
          content_type: a.content_type,
          name: a.name,
        })),
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
        intent: "continue",
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
    const reply: string = env.reply;
    const attachments = env.attachments;
    console.log("n8n envelope:", {
      next_action: env.next_action,
      next_action_reason: env.next_action_reason,
      attempt_state: env.attempt_state,
      consecutive_failures: env.consecutive_failures,
      has_reply: !!reply,
    });

    // ── Stage 2: classify the AI reply ────────────────────────────────────
    // Drives offer_ticket / offer_close when the AI naturally escalates or
    // wraps up. n8n's next_action is logged for comparison but not trusted.
    let action: { type: ActionType; reason?: string } = { type: "none" };
    let decidedIntent: "offer_ticket" | "offer_close" | "none" = "none";
    let source: "classifier" | "low_confidence" | "fallback" = "fallback";
    let replyVerdict: ClassifierVerdict<ReplyIntent> | null = null;

    if (reply && reply.trim().length > 0) {
      replyVerdict = await classifyReplyIntent(reply, message);
      if (
        replyVerdict.ok &&
        replyVerdict.confidence >= CLASSIFIER_MIN_CONFIDENCE &&
        replyVerdict.intent !== "continue"
      ) {
        decidedIntent = replyVerdict.intent;
        source = "classifier";
      } else if (replyVerdict.ok) {
        source = "low_confidence";
      }
    }

    // Fallback: deterministic Arabic/English wrap-up phrase detector. Only
    // fires when the LLM classifier didn't already commit to an intent.
    if (decidedIntent === "none" && detectClosingPhrase(reply)) {
      decidedIntent = "offer_close";
      source = "fallback";
    }

    if (decidedIntent !== "none") {
      action = { type: decidedIntent, reason: source };
    }

    console.log("reply_intent", {
      intent: replyVerdict?.intent ?? decidedIntent,
      confidence: replyVerdict?.confidence ?? null,
      source,
      ms: replyVerdict?.ms ?? 0,
      n8n_next_action: env.next_action,
      error: replyVerdict?.error,
    });

    await logClassifier("reply_intent", replyVerdict, decidedIntent, source);

    const persisted = await persistMessages(message, reply);

    // Map internal action → public widget intent.
    // offer_ticket  → ask for phone form
    // offer_close   → AI is wrapping up. Mark conversation closed server-side
    //                 so the post-resolve classify trigger fires, and tell the
    //                 widget to advance to the rating screen.
    let intent: "offer_ticket" | "closed" | "continue" = "continue";
    if (action.type === "offer_ticket") {
      intent = "offer_ticket";
    } else if (action.type === "offer_close") {
      intent = "closed";
      try {
        await supabase
          .from("conversations_main")
          .update({
            status: "closed",
            resolved_at: new Date().toISOString(),
            close_reason: "ai_offer_close",
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation_id)
          .in("status", ["new", "open", "pending"]);
      } catch (e) {
        console.log("conversation close-on-offer_close failed (non-fatal):", e);
      }
    }

    return jsonResponse({ reply, attachments, action, intent, tenant_id, conversation_id, ai_message_id: persisted.ai_message_id });
  } catch (e) {
    console.error("chat-ai error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});