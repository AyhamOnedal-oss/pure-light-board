// Swallow benign "connection closed before message completed" errors raised
// by the Deno runtime when clients disconnect mid-response.
const BENIGN_HTTP_RX = /connection closed|broken pipe|error writing a body|message completed/i;
const isBenignHttp = (err: any) => {
  const name = err?.name || "";
  const msg = err?.message || String(err || "");
  return name === "Http" || BENIGN_HTTP_RX.test(msg);
};
globalThis.addEventListener("unhandledrejection", (e: any) => {
  if (isBenignHttp(e?.reason)) e.preventDefault();
});
globalThis.addEventListener("error", (e: any) => {
  if (isBenignHttp(e?.error) || BENIGN_HTTP_RX.test(e?.message || "")) e.preventDefault();
});
// Filter benign Http log lines that Deno prints directly via console.error.
const _origErr = console.error.bind(console);
console.error = (...args: any[]) => {
  const joined = args.map((a) => (a?.message || a?.name || String(a || ""))).join(" ");
  if (BENIGN_HTTP_RX.test(joined) || /name:\s*"Http"/.test(joined)) return;
  _origErr(...args);
};

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
const app = new Hono();

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ATTACH_BUCKET = "make-fc841b6e-attachments";

// Ensure bucket exists (idempotent, runs on first request)
let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === ATTACH_BUCKET);
    if (!exists) await supabaseAdmin.storage.createBucket(ATTACH_BUCKET, { public: false });
    bucketReady = true;
  } catch (e) {
    console.log(`Bucket setup error: ${e}`);
  }
}

// ---------- helpers ----------
const todayStr = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
const monthStr = () => new Date().toISOString().slice(0, 7).replace("-", "");
const nowISO = () => new Date().toISOString();

async function incCounter(key: string, field: string, by = 1) {
  const cur = (await kv.get(key)) as Record<string, number> | null || {};
  cur[field] = (cur[field] || 0) + by;
  await kv.set(key, cur);
}

function clampStr(v: any, max: number, def = "") {
  return typeof v === "string" ? v.slice(0, max) : def;
}

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-fc841b6e/health", (c) => {
  return c.json({ status: "ok" });
});

// ===== Chat Settings API =====

// Save chat settings (from dashboard)
app.post("/make-server-fc841b6e/chat-settings", async (c) => {
  try {
    const body = await c.req.json();
    const { storeId, settings } = body;
    if (!storeId || !settings) {
      return c.json({ error: "Missing storeId or settings" }, 400);
    }
    const key = `chat_settings:${storeId}`;

    // Validate + normalize welcome bubble + inactivity fields
    const s: any = { ...settings };
    if (typeof s.welcomeBubbleEnabled !== 'boolean') s.welcomeBubbleEnabled = true;
    s.welcomeBubbleLine1 = typeof s.welcomeBubbleLine1 === 'string'
      ? s.welcomeBubbleLine1.slice(0, 24) : 'مرحباً 👋';
    s.welcomeBubbleLine2 = typeof s.welcomeBubbleLine2 === 'string'
      ? s.welcomeBubbleLine2.slice(0, 36) : 'كيف يمكنني مساعدتك؟';

    const prevSettings = (await kv.get(key)) as any || {};
    const wasDisabled = prevSettings?.inactivityEnabled === false;
    if (typeof s.inactivityEnabled !== 'boolean') s.inactivityEnabled = true;

    const clamp = (v: any, lo: number, hi: number, def: number) => {
      const n = typeof v === 'number' && !isNaN(v) ? Math.round(v) : NaN;
      if (isNaN(n)) return def;
      return Math.max(lo, Math.min(hi, n));
    };

    if (s.inactivityEnabled) {
      const becameEnabled = wasDisabled && s.inactivityEnabled;
      if (becameEnabled && (s.inactivityPromptSeconds == null || s.inactivityCloseSeconds == null)) {
        s.inactivityPromptSeconds = 90;
        s.inactivityCloseSeconds = 60;
      } else {
        s.inactivityPromptSeconds = clamp(s.inactivityPromptSeconds, 30, 300, 90);
        s.inactivityCloseSeconds = clamp(s.inactivityCloseSeconds, 15, 180, 60);
      }
    } else {
      if (s.inactivityPromptSeconds != null) s.inactivityPromptSeconds = clamp(s.inactivityPromptSeconds, 30, 300, 90);
      if (s.inactivityCloseSeconds != null) s.inactivityCloseSeconds = clamp(s.inactivityCloseSeconds, 15, 180, 60);
    }

    s.ratingInactivitySeconds = clamp(s.ratingInactivitySeconds, 30, 3600, 900);

    await kv.set(key, { ...s, updatedAt: new Date().toISOString() });
    console.log(`Chat settings saved for store: ${storeId}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Error saving chat settings: ${err}`);
    return c.json({ error: `Failed to save chat settings: ${err}` }, 500);
  }
});

// Get chat settings (public - used by chat widget)
app.get("/make-server-fc841b6e/chat-settings/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const key = `chat_settings:${storeId}`;
    const settings = await kv.get(key);
    if (!settings) {
      return c.json({ error: "Settings not found", storeId }, 404);
    }
    console.log(`Chat settings fetched for store: ${storeId}`);
    return c.json({ success: true, settings });
  } catch (err) {
    console.log(`Error fetching chat settings: ${err}`);
    return c.json({ error: `Failed to fetch chat settings: ${err}` }, 500);
  }
});

// ===== Widget Events =====

app.post("/make-server-fc841b6e/events/bubble-shown", async (c) => {
  try {
    const { storeId } = await c.req.json();
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    await incCounter(`bubble_daily:${storeId}:${todayStr()}`, "shown");
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "bubbleShown");
    return c.json({ success: true });
  } catch (err) {
    console.log(`bubble-shown error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/events/bubble-click", async (c) => {
  try {
    const { storeId } = await c.req.json();
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    await incCounter(`bubble_daily:${storeId}:${todayStr()}`, "clicks");
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "bubbleClicks");
    return c.json({ success: true });
  } catch (err) {
    console.log(`bubble-click error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Conversations =====

app.post("/make-server-fc841b6e/conversations", async (c) => {
  try {
    const body = await c.req.json();
    const { storeId, visitor } = body;
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    const cid = genId("cv");
    const conv = {
      id: cid,
      storeId,
      visitor: visitor || {},
      status: "open",
      category: null,
      closeReason: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      closedAt: null,
      messageCount: 0,
      ticketId: null,
      rating: null,
    };
    await kv.set(`conversation:${storeId}:${cid}`, conv);
    await kv.set(`store:${storeId}:conv:${cid}`, conv);
    await incCounter(`metric_daily:${storeId}:${todayStr()}`, "conversations");
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "conversations");
    await v2IncStoreCounter(storeId, "conversations");
    return c.json({ success: true, conversation: conv });
  } catch (err) {
    console.log(`conv create error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/conversations/:cid/messages", async (c) => {
  try {
    const cid = c.req.param("cid");
    const body = await c.req.json();
    const { storeId } = body;
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    // Spec aliases: sender ('customer'|'store'), messageId, timestamp, attachment(singular)
    const senderRaw = body.sender || body.role;
    const role = senderRaw === "store" ? "ai" : senderRaw; // legacy field
    const sender = senderRaw === "ai" ? "store" : senderRaw;
    const text = body.text || "";
    if (!role || !text) return c.json({ error: "Missing fields" }, 400);
    const attachments = body.attachment ? [body.attachment] : (body.attachments || []);
    const aiResponseMs = body.aiResponseMs;
    const messageId = body.messageId || null;
    const convKeyNew = `store:${storeId}:conv:${cid}`;
    const convKeyLegacy = `conversation:${storeId}:${cid}`;
    const conv: any = (await kv.get(convKeyNew)) || (await kv.get(convKeyLegacy));
    if (!conv) return c.json({ error: "Conversation not found" }, 404);
    const seq = (conv.messageCount || 0) + 1;
    const msg = {
      id: messageId || `${cid}-${seq}`,
      cid, seq, role, sender,
      text: clampStr(text, 5000),
      attachments,
      aiResponseMs: aiResponseMs || null,
      createdAt: body.timestamp || nowISO(),
    };
    const padded = String(seq).padStart(6, "0");
    await kv.set(`store:${storeId}:msg:${cid}:${padded}`, msg);
    await kv.set(`message:${storeId}:${cid}:${padded}`, msg); // legacy mirror
    conv.messageCount = seq;
    conv.updatedAt = nowISO();
    await kv.set(convKeyNew, conv);
    await kv.set(convKeyLegacy, conv);

    const words = text.trim().split(/\s+/).filter(Boolean).length;
    await incCounter(`usage_month:${storeId}:${monthStr()}`, "words", words);
    await v2IncStoreCounter(storeId, role === "customer" ? "msgCustomer" : "msgStore");

    if (role === "ai" && typeof aiResponseMs === "number") {
      const rtKey = `response_times:${storeId}:${monthStr()}`;
      const cur: any = (await kv.get(rtKey)) || { total: 0, count: 0 };
      cur.total += aiResponseMs;
      cur.count += 1;
      cur.avg = Math.round(cur.total / cur.count);
      await kv.set(rtKey, cur);
    }
    return c.json({ success: true, message: msg });
  } catch (err) {
    console.log(`append message error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/conversations/:cid/close", async (c) => {
  try {
    const cid = c.req.param("cid");
    const { storeId, reason, category, closedAt } = await c.req.json();
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    const convKeyNew = `store:${storeId}:conv:${cid}`;
    const convKeyLegacy = `conversation:${storeId}:${cid}`;
    const conv: any = (await kv.get(convKeyNew)) || (await kv.get(convKeyLegacy));
    if (!conv) return c.json({ error: "Not found" }, 404);
    const normalized = normalizeCloseReason(reason);
    conv.status = "closed";
    conv.closeReason = normalized;
    if (category) conv.category = category;
    conv.closedAt = closedAt || nowISO();
    conv.updatedAt = nowISO();
    await kv.set(convKeyNew, conv);
    await kv.set(convKeyLegacy, conv);
    await incCounter(`metric_daily:${storeId}:${todayStr()}`, "closed");
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "closed");
    if (conv.category) {
      await incCounter(`metric_monthly:${storeId}:${monthStr()}`, `cat_${conv.category}`);
    }
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, `close_${normalized}`);
    await v2IncStoreCounter(storeId, "closed");
    if (conv.category) await v2IncStoreCounter(storeId, `cat_${conv.category}`);
    await v2IncStoreCounter(storeId, `close_${normalized}`);
    return c.json({ success: true, conversation: conv });
  } catch (err) {
    console.log(`close error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/conversations/:cid/rate", async (c) => {
  try {
    const cid = c.req.param("cid");
    const { storeId, stars, comment } = await c.req.json();
    if (!storeId || !stars) return c.json({ error: "Missing fields" }, 400);
    const s = Math.max(1, Math.min(5, Math.round(stars)));
    await kv.set(`rating:${storeId}:${cid}`, { cid, stars: s, comment: clampStr(comment, 500), createdAt: nowISO() });
    const convKey = `conversation:${storeId}:${cid}`;
    const conv: any = await kv.get(convKey);
    if (conv) { conv.rating = s; await kv.set(convKey, conv); }
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, `rating_${s}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`rate error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/conversations/:cid/feedback", async (c) => {
  try {
    const cid = c.req.param("cid");
    const { storeId, messageId, value } = await c.req.json();
    if (!storeId || !messageId || !value) return c.json({ error: "Missing fields" }, 400);
    const v = value === "up" ? "up" : "down";
    await kv.set(`feedback:${storeId}:${cid}:${messageId}`, { cid, messageId, value: v, createdAt: nowISO() });
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, `thumbs_${v}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`feedback error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/unknown-questions", async (c) => {
  try {
    const { storeId, cid, text } = await c.req.json();
    if (!storeId || !text) return c.json({ error: "Missing fields" }, 400);
    const id = genId("uq");
    await kv.set(`unknown_q:${storeId}:${id}`, { id, cid, text: clampStr(text, 1000), createdAt: nowISO(), resolved: false });
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "unknownQuestions");
    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/conversations/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const list = await kv.getByPrefix(`conversation:${storeId}:`);
    return c.json({ success: true, conversations: list });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/conversations/:storeId/:cid/messages", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const cid = c.req.param("cid");
    const list = await kv.getByPrefix(`message:${storeId}:${cid}:`);
    return c.json({ success: true, messages: list });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Tickets =====

app.post("/make-server-fc841b6e/tickets", async (c) => {
  try {
    const body = await c.req.json();
    const { storeId, cid, conversationId, subject, priority, category, customer, phone, dialCode, source, notes, ticketId } = body;
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    const effectiveCid = cid || conversationId || null;
    const tid = ticketId || genId("tk");
    const ticket = {
      id: tid, storeId, cid: effectiveCid,
      subject: clampStr(subject, 200, "Untitled"),
      priority: priority || "medium",
      category: category || null,
      customer: customer || {},
      phone: clampStr(phone, 40) || null,
      dialCode: clampStr(dialCode, 10) || null,
      source: source === "form" ? "form" : source === "inline" ? "inline" : null,
      notes: clampStr(notes, 4000) || null,
      status: "open",
      createdAt: body.createdAt || nowISO(), updatedAt: nowISO(), closedAt: null,
    };
    await kv.set(`store:${storeId}:ticket:${tid}`, ticket);
    await kv.set(`ticket:${storeId}:${tid}`, ticket);
    if (effectiveCid) {
      const convKeyNew = `store:${storeId}:conv:${effectiveCid}`;
      const convKeyLegacy = `conversation:${storeId}:${effectiveCid}`;
      const conv: any = (await kv.get(convKeyNew)) || (await kv.get(convKeyLegacy));
      if (conv) {
        conv.ticketId = tid;
        await kv.set(convKeyNew, conv);
        await kv.set(convKeyLegacy, conv);
      }
    }
    await incCounter(`metric_daily:${storeId}:${todayStr()}`, "tickets");
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "tickets");
    await incCounter(`metric_monthly:${storeId}:${monthStr()}`, `ticket_open`);
    return c.json({ success: true, ticket });
  } catch (err) {
    console.log(`ticket create error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.patch("/make-server-fc841b6e/tickets/:tid", async (c) => {
  try {
    const tid = c.req.param("tid");
    const { storeId, status, priority, assignee, notes } = await c.req.json();
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    const keyNew = `store:${storeId}:ticket:${tid}`;
    const keyLegacy = `ticket:${storeId}:${tid}`;
    const t: any = (await kv.get(keyNew)) || (await kv.get(keyLegacy));
    if (!t) return c.json({ error: "Not found" }, 404);
    if (status && ["open", "in_progress", "pending", "closed"].includes(status)) {
      t.status = status;
      if (status === "closed") t.closedAt = nowISO();
      await incCounter(`metric_monthly:${storeId}:${monthStr()}`, `ticket_${status}`);
      await v2IncStoreCounter(storeId, `ticket_${status}`);
    }
    if (priority) t.priority = priority;
    if (assignee !== undefined) t.assignee = assignee;
    if (notes !== undefined) t.notes = clampStr(notes, 4000);
    t.updatedAt = nowISO();
    await kv.set(keyNew, t);
    await kv.set(keyLegacy, t);
    return c.json({ success: true, ticket: t });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/tickets/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const list = await kv.getByPrefix(`ticket:${storeId}:`);
    return c.json({ success: true, tickets: list });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Attachments =====

app.post("/make-server-fc841b6e/attachments", async (c) => {
  try {
    await ensureBucket();
    const form = await c.req.formData();
    const file = form.get("file") as File | null;
    const storeId = form.get("storeId") as string | null;
    const cid = form.get("cid") as string | null;
    if (!file || !storeId) return c.json({ error: "Missing file or storeId" }, 400);
    const fid = genId("at");
    const path = `${storeId}/${cid || "misc"}/${fid}-${file.name}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage.from(ATTACH_BUCKET).upload(path, buf, {
      contentType: file.type, upsert: false,
    });
    if (upErr) {
      console.log(`upload error: ${upErr.message}`);
      return c.json({ error: upErr.message }, 500);
    }
    const { data: signed } = await supabaseAdmin.storage.from(ATTACH_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    const meta = {
      id: fid, storeId, cid, path, name: file.name, size: file.size,
      contentType: file.type, signedUrl: signed?.signedUrl || null, createdAt: nowISO(),
    };
    await kv.set(`attach:${storeId}:${fid}`, meta);
    return c.json({ success: true, attachment: meta });
  } catch (err) {
    console.log(`attachment error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/attachments/:storeId/:fid/url", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const fid = c.req.param("fid");
    const meta: any = await kv.get(`attach:${storeId}:${fid}`);
    if (!meta) return c.json({ error: "Not found" }, 404);
    const { data } = await supabaseAdmin.storage.from(ATTACH_BUCKET).createSignedUrl(meta.path, 60 * 60);
    return c.json({ success: true, url: data?.signedUrl });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Metrics / Overview =====

app.get("/make-server-fc841b6e/overview/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const month = c.req.query("month") || monthStr();
    const day = c.req.query("day") || todayStr();
    const [monthly, daily, bubbleToday, usage, rt] = await Promise.all([
      kv.get(`metric_monthly:${storeId}:${month}`),
      kv.get(`metric_daily:${storeId}:${day}`),
      kv.get(`bubble_daily:${storeId}:${day}`),
      kv.get(`usage_month:${storeId}:${month}`),
      kv.get(`response_times:${storeId}:${month}`),
    ]);
    const m: any = monthly || {};
    const conversations = m.conversations || 0;
    const closed = m.closed || 0;
    const completionRate = conversations > 0 ? Math.round((closed / conversations) * 100) : 0;
    return c.json({
      success: true,
      overview: {
        month, day,
        conversations, closed, completionRate,
        tickets: m.tickets || 0,
        ticketStates: {
          open: m.ticket_open || 0,
          pending: m.ticket_pending || 0,
          closed: m.ticket_closed || 0,
        },
        bubble: { shown: (bubbleToday as any)?.shown || 0, clicks: (bubbleToday as any)?.clicks || 0 },
        wordsConsumed: (usage as any)?.words || 0,
        avgResponseMs: (rt as any)?.avg || 0,
        categories: {
          inquiry: m.cat_inquiry || 0,
          complaint: m.cat_complaint || 0,
          request: m.cat_request || 0,
          suggestion: m.cat_suggestion || 0,
        },
        closeReasons: {
          customer_manual: m.close_customer_manual || 0,
          ai_request: m.close_ai_request || 0,
          idle: m.close_idle || 0,
        },
        ratings: {
          1: m.rating_1 || 0, 2: m.rating_2 || 0, 3: m.rating_3 || 0,
          4: m.rating_4 || 0, 5: m.rating_5 || 0,
        },
        thumbs: { up: m.thumbs_up || 0, down: m.thumbs_down || 0 },
        unknownQuestions: m.unknownQuestions || 0,
        daily: daily || {},
      },
    });
  } catch (err) {
    console.log(`overview error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== AI Training =====

app.post("/make-server-fc841b6e/ai-training/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const { entries, files } = await c.req.json();
    await kv.set(`ai_training:${storeId}`, { entries: entries || [], files: files || [], updatedAt: nowISO() });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/ai-training/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const data = await kv.get(`ai_training:${storeId}`);
    return c.json({ success: true, data: data || { entries: [], files: [] } });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Store Info / Account / Plan =====

app.post("/make-server-fc841b6e/store-info/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const info = await c.req.json();
    await kv.set(`store:${storeId}`, { ...info, updatedAt: nowISO() });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/store-info/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const info = await kv.get(`store:${storeId}`);
    return c.json({ success: true, info: info || null });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/account/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const data = await c.req.json();
    await kv.set(`account:${userId}`, { ...data, updatedAt: nowISO() });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/account/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const data = await kv.get(`account:${userId}`);
    return c.json({ success: true, account: data || null });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.post("/make-server-fc841b6e/plan/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const data = await c.req.json();
    await kv.set(`plan:${storeId}`, { ...data, updatedAt: nowISO() });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/plan/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const data = await kv.get(`plan:${storeId}`);
    return c.json({ success: true, plan: data || null });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Team =====

app.post("/make-server-fc841b6e/team/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const body = await c.req.json();
    const mid = body.id || genId("mb");
    await kv.set(`team_member:${storeId}:${mid}`, { ...body, id: mid, updatedAt: nowISO() });
    return c.json({ success: true, id: mid });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/team/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const list = await kv.getByPrefix(`team_member:${storeId}:`);
    return c.json({ success: true, members: list });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ===== Store Branding API =====

// Save store branding (logo + icon + name + domain)
app.post("/make-server-fc841b6e/store-branding", async (c) => {
  try {
    const body = await c.req.json();
    const { storeId, branding } = body;
    if (!storeId || !branding) {
      return c.json({ error: "Missing storeId or branding" }, 400);
    }
    const key = `store_branding:${storeId}`;
    await kv.set(key, { ...branding, updatedAt: new Date().toISOString() });
    console.log(`Store branding saved for store: ${storeId}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Error saving store branding: ${err}`);
    return c.json({ error: `Failed to save store branding: ${err}` }, 500);
  }
});

// Get store branding (public - used by chat widget)
app.get("/make-server-fc841b6e/store-branding/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const key = `store_branding:${storeId}`;
    const branding = await kv.get(key);
    if (!branding) {
      return c.json({ error: "Branding not found", storeId }, 404);
    }
    console.log(`Store branding fetched for store: ${storeId}`);
    return c.json({ success: true, branding });
  } catch (err) {
    console.log(`Error fetching store branding: ${err}`);
    return c.json({ error: `Failed to fetch store branding: ${err}` }, 500);
  }
});

// ============================================================================
// ===== Fuqah AI v2 endpoints (spec: widget <-> dashboard contract) ==========
// ============================================================================
//
// Key scheme (new, enforced tenancy): store:{storeId}:...
//   store:{storeId}:meta                         — tenancy marker + owners
//   store:{storeId}:conv:{cid}                   — conversation record
//   store:{storeId}:msg:{cid}:{seq}              — message in conversation
//   store:{storeId}:ticket:{tid}                 — ticket record
//   store:{storeId}:rating:{cid}                 — conversation rating
//   store:{storeId}:event:{ts}:{rand}            — generic telemetry event
//   store:{storeId}:feedback:{cid}:{mid}         — message thumbs up/down
//   store:{storeId}:unknown:{id}                 — unanswered question
//   store:{storeId}:attach:{fid}                 — uploaded file metadata
//   store:{storeId}:metric:monthly:{YYYYMM}      — monthly counters
//   store:{storeId}:metric:daily:{YYYYMMDD}      — daily counters
//   store:{storeId}:bubble:daily:{YYYYMMDD}      — welcome bubble counters
//   user_store:{userId}                          — { storeIds: [...] } auth → store
//
// Legacy routes/keys below remain as aliases to avoid breaking current widgets.

async function v2IncStoreCounter(storeId: string, field: string, by = 1) {
  await incCounter(`store:${storeId}:metric:monthly:${monthStr()}`, field, by);
  await incCounter(`store:${storeId}:metric:daily:${todayStr()}`, field, by);
}

async function requireStoreExists(storeId: string): Promise<boolean> {
  if (!storeId) return false;
  const meta = await kv.get(`store:${storeId}:meta`);
  return !!meta;
}

// Resolve the caller (dashboard) to a storeId from their Supabase Auth token.
// storeId is NEVER taken from the body for dashboard routes.
async function resolveStoreFromAuth(c: any): Promise<{ userId: string; storeId: string } | null> {
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user?.id) return null;
    const map: any = await kv.get(`user_store:${user.id}`);
    const storeId = (map?.storeIds || [])[0];
    if (!storeId) return null;
    return { userId: user.id, storeId };
  } catch {
    return null;
  }
}

// Register/activate a store and map an owner user to it.
// The frontend should call this right after sign-up/sign-in so the dashboard
// can resolve storeId from the Supabase session.
app.post("/make-server-fc841b6e/stores/register", async (c) => {
  try {
    const auth = c.req.header("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const { storeId, name } = await c.req.json();
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    const metaKey = `store:${storeId}:meta`;
    const existing: any = (await kv.get(metaKey)) || { storeId, owners: [], createdAt: nowISO() };
    if (name) existing.name = clampStr(name, 120);
    if (!existing.owners.includes(user.id)) existing.owners.push(user.id);
    existing.updatedAt = nowISO();
    await kv.set(metaKey, existing);
    const mapKey = `user_store:${user.id}`;
    const map: any = (await kv.get(mapKey)) || { storeIds: [] };
    if (!map.storeIds.includes(storeId)) map.storeIds.push(storeId);
    await kv.set(mapKey, map);
    return c.json({ success: true, store: existing });
  } catch (err) {
    console.log(`stores/register error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/stores/me", async (c) => {
  const ctx = await resolveStoreFromAuth(c);
  if (!ctx) return c.json({ error: "Unauthorized" }, 401);
  const meta = await kv.get(`store:${ctx.storeId}:meta`);
  return c.json({ success: true, userId: ctx.userId, storeId: ctx.storeId, meta });
});

// ---------------- Widget-facing v2 routes ----------------
// All widget routes MUST find store:{storeId}:meta; otherwise 403.

app.post("/make-server-fc841b6e/conversations/start", async (c) => {
  try {
    const { storeId, conversationId, startedAt, visitor } = await c.req.json();
    if (!storeId || !conversationId) return c.json({ error: "Missing storeId or conversationId" }, 400);
    if (!(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    const key = `store:${storeId}:conv:${conversationId}`;
    const existing: any = await kv.get(key);
    if (existing) return c.json({ success: true, conversation: existing });
    const conv = {
      id: conversationId, storeId, visitor: visitor || {},
      status: "open", category: null, closeReason: null,
      startedAt: startedAt || nowISO(), createdAt: nowISO(), updatedAt: nowISO(),
      closedAt: null, messageCount: 0, ticketId: null, rating: null,
    };
    await kv.set(key, conv);
    await v2IncStoreCounter(storeId, "conversations");
    return c.json({ success: true, conversation: conv });
  } catch (err) {
    console.log(`v2 conv start error (storeId=${(await safeJson(c))?.storeId}): ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

async function safeJson(c: any) { try { return await c.req.json(); } catch { return null; } }

// Normalize close reasons (spec ↔ legacy)
function normalizeCloseReason(r: string | null | undefined) {
  if (!r) return "manual";
  const map: Record<string, string> = {
    customer_manual: "manual",
    ai_request: "ai",
    idle: "inactivity",
  };
  return map[r] || r;
}
// NOTE: Both POST /conversations/:cid/messages and POST /conversations/:cid/close
// are handled by the legacy registrations earlier in this file. Those have been
// extended in-place (normalize sender↔role, accept messageId/timestamp, accept
// rating_skip/rating_submit close reasons, dual-write to store:{storeId}:...).
// Re-registering them here would be shadowed by Hono's first-match routing.

// Spec: PATCH /messages/:messageId/feedback { storeId, conversationId, feedback: 'up'|'down'|null }
app.patch("/make-server-fc841b6e/messages/:messageId/feedback", async (c) => {
  try {
    const messageId = c.req.param("messageId");
    const { storeId, conversationId, feedback } = await c.req.json();
    if (!storeId || !conversationId) return c.json({ error: "Missing storeId or conversationId" }, 400);
    if (!(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    const key = `store:${storeId}:feedback:${conversationId}:${messageId}`;
    if (feedback == null) {
      await kv.del(key);
      return c.json({ success: true, cleared: true });
    }
    const v = feedback === "up" ? "up" : "down";
    await kv.set(key, { cid: conversationId, messageId, value: v, createdAt: nowISO() });
    // mirror to legacy key
    await kv.set(`feedback:${storeId}:${conversationId}:${messageId}`, { cid: conversationId, messageId, value: v, createdAt: nowISO() });
    await v2IncStoreCounter(storeId, `thumbs_${v}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`v2 feedback error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// ---------------- Ratings ----------------
app.post("/make-server-fc841b6e/ratings", async (c) => {
  try {
    const { storeId, conversationId, stars, feedback, skipped, submittedAt } = await c.req.json();
    if (!storeId || !conversationId) return c.json({ error: "Missing fields" }, 400);
    if (!(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    const s = typeof stars === "number" ? Math.max(0, Math.min(5, Math.round(stars))) : 0;
    const record = {
      cid: conversationId, stars: s, feedback: clampStr(feedback, 1000),
      skipped: !!skipped, submittedAt: submittedAt || nowISO(),
    };
    await kv.set(`store:${storeId}:rating:${conversationId}`, record);
    await kv.set(`rating:${storeId}:${conversationId}`, record); // legacy mirror
    const convKey = `store:${storeId}:conv:${conversationId}`;
    const conv: any = (await kv.get(convKey)) || (await kv.get(`conversation:${storeId}:${conversationId}`));
    if (conv) { conv.rating = s; conv.ratingSkipped = !!skipped; await kv.set(convKey, conv); }
    if (skipped) await v2IncStoreCounter(storeId, "rating_skipped");
    else if (s > 0) await v2IncStoreCounter(storeId, `rating_${s}`);
    return c.json({ success: true, rating: record });
  } catch (err) {
    console.log(`ratings POST error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

function daysForRange(range?: string): number {
  if (range === "30d") return 30;
  if (range === "all") return 365 * 5;
  return 7;
}
function dayStrOffset(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

app.get("/make-server-fc841b6e/ratings", async (c) => {
  try {
    const ctx = await resolveStoreFromAuth(c);
    // Dashboard path uses auth. For back-compat we also accept storeId in query
    // (used by older clients) — but only if no auth is present.
    const storeId = ctx?.storeId || c.req.query("storeId");
    if (!storeId) return c.json({ error: "Unauthorized" }, 401);
    const range = c.req.query("range") || "7d";
    const list: any[] = await kv.getByPrefix(`store:${storeId}:rating:`);
    const cutoff = Date.now() - daysForRange(range) * 24 * 3600 * 1000;
    const filtered = list.filter((r) => new Date(r.submittedAt || r.createdAt || 0).getTime() >= cutoff);
    const withStars = filtered.filter((r) => !r.skipped && r.stars > 0);
    const avg = withStars.length ? withStars.reduce((s, r) => s + r.stars, 0) / withStars.length : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    withStars.forEach((r) => { (distribution as any)[r.stars] = ((distribution as any)[r.stars] || 0) + 1; });
    return c.json({
      success: true,
      total: filtered.length,
      submitted: withStars.length,
      skipped: filtered.length - withStars.length,
      average: Number(avg.toFixed(2)),
      distribution,
      ratings: filtered,
    });
  } catch (err) {
    console.log(`ratings GET error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// ---------------- Generic events / telemetry ----------------
const ALLOWED_EVENTS = new Set([
  "widget.opened", "widget.closed",
  "welcome_bubble.shown", "welcome_bubble.clicked",
  "message.sent", "message.received",
  "attachment.uploaded", "message.feedback",
  "ticket.form_shown", "ticket.form_submitted", "ticket.created",
  "rating.submitted", "rating.skipped",
  "inactivity.prompt_shown", "inactivity.continued", "inactivity.ended",
  "chat.exported",
]);

app.post("/make-server-fc841b6e/events", async (c) => {
  try {
    const { storeId, conversationId, ticketId, type, payload, ts, ua, tz } = await c.req.json();
    if (!storeId || !type) return c.json({ error: "Missing storeId or type" }, 400);
    if (!(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    if (!ALLOWED_EVENTS.has(type)) return c.json({ error: `Unknown event type: ${type}` }, 400);
    const now = ts || nowISO();
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `store:${storeId}:event:${now}:${rand}`;
    await kv.set(key, { storeId, conversationId, ticketId, type, payload: payload || {}, ts: now, ua, tz });
    // roll up counters under events.<type>
    await v2IncStoreCounter(storeId, `evt_${type.replace(/\./g, "_")}`);
    // Convenience: mirror legacy bubble counters so the existing dashboard keeps working.
    if (type === "welcome_bubble.shown") {
      await incCounter(`bubble_daily:${storeId}:${todayStr()}`, "shown");
      await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "bubbleShown");
    }
    if (type === "welcome_bubble.clicked") {
      await incCounter(`bubble_daily:${storeId}:${todayStr()}`, "clicks");
      await incCounter(`metric_monthly:${storeId}:${monthStr()}`, "bubbleClicks");
    }
    return c.json({ success: true });
  } catch (err) {
    console.log(`events error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/analytics/:storeId", async (c) => {
  try {
    const storeId = c.req.param("storeId");
    const ctx = await resolveStoreFromAuth(c);
    // tenancy: if auth present, must match; otherwise must exist
    if (ctx && ctx.storeId !== storeId) return c.json({ error: "Forbidden" }, 403);
    if (!ctx && !(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    const range = c.req.query("range") || "7d";
    const days = daysForRange(range);
    const daily: Record<string, any> = {};
    for (let i = 0; i < Math.min(days, 90); i++) {
      const d = dayStrOffset(i);
      daily[d] = (await kv.get(`store:${storeId}:metric:daily:${d}`)) || {};
    }
    const events: any[] = await kv.getByPrefix(`store:${storeId}:event:`);
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    const filteredEvents = events.filter((e) => new Date(e.ts || 0).getTime() >= cutoff);
    const byType: Record<string, number> = {};
    filteredEvents.forEach((e) => { byType[e.type] = (byType[e.type] || 0) + 1; });
    return c.json({ success: true, range, days, daily, events: { total: filteredEvents.length, byType } });
  } catch (err) {
    console.log(`analytics error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// ---------------- Tickets v2 ----------------
// Spec: POST /tickets { storeId, conversationId, ticketId, phone, dialCode, source, createdAt }
// Keep legacy POST /tickets intact above; add a dedicated /tickets/create that accepts the new shape.
app.post("/make-server-fc841b6e/tickets/create", async (c) => {
  try {
    const body = await c.req.json();
    const { storeId, conversationId, ticketId, phone, dialCode, source, createdAt, subject, priority, category, notes, assignee } = body;
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    if (!(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    const tid = ticketId || genId("tk");
    const ticket = {
      id: tid, storeId, cid: conversationId || null,
      phone: clampStr(phone, 40) || null,
      dialCode: clampStr(dialCode, 10) || null,
      source: source === "form" ? "form" : source === "inline" ? "inline" : null,
      subject: clampStr(subject, 200, "Untitled"),
      priority: priority || "medium",
      category: category || null,
      notes: clampStr(notes, 4000) || null,
      assignee: assignee || null,
      status: "open",
      customer: body.customer || {},
      createdAt: createdAt || nowISO(),
      updatedAt: nowISO(), closedAt: null,
    };
    await kv.set(`store:${storeId}:ticket:${tid}`, ticket);
    await kv.set(`ticket:${storeId}:${tid}`, ticket); // legacy mirror
    if (conversationId) {
      const convKey = `store:${storeId}:conv:${conversationId}`;
      const conv: any = (await kv.get(convKey)) || (await kv.get(`conversation:${storeId}:${conversationId}`));
      if (conv) {
        conv.ticketId = tid;
        await kv.set(convKey, conv);
        await kv.set(`conversation:${storeId}:${conversationId}`, conv);
      }
    }
    await v2IncStoreCounter(storeId, "tickets");
    await v2IncStoreCounter(storeId, "ticket_open");
    return c.json({ success: true, ticket });
  } catch (err) {
    console.log(`tickets/create error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// Spec: PATCH /tickets/:tid supports status open|in_progress|closed + notes + assignee
// The legacy PATCH above already covers most fields; add an enhanced version that
// also accepts `notes` and `in_progress`. Hono honors first-registered handler,
// so we also intercept `notes` inside the legacy handler path via dual-write below.
// For the new-key ticket record, we expose a separate route:
app.patch("/make-server-fc841b6e/tickets/:tid/v2", async (c) => {
  try {
    const tid = c.req.param("tid");
    const { storeId, status, priority, assignee, notes } = await c.req.json();
    if (!storeId) return c.json({ error: "Missing storeId" }, 400);
    if (!(await requireStoreExists(storeId))) return c.json({ error: "Unknown store" }, 403);
    const primaryKey = `store:${storeId}:ticket:${tid}`;
    const legacyKey = `ticket:${storeId}:${tid}`;
    const t: any = (await kv.get(primaryKey)) || (await kv.get(legacyKey));
    if (!t) return c.json({ error: "Not found" }, 404);
    if (status && ["open", "in_progress", "closed"].includes(status)) {
      t.status = status;
      if (status === "closed") t.closedAt = nowISO();
      await v2IncStoreCounter(storeId, `ticket_${status}`);
    }
    if (priority) t.priority = priority;
    if (assignee !== undefined) t.assignee = assignee;
    if (notes !== undefined) t.notes = clampStr(notes, 4000);
    t.updatedAt = nowISO();
    await kv.set(primaryKey, t);
    await kv.set(legacyKey, t);
    return c.json({ success: true, ticket: t });
  } catch (err) {
    console.log(`tickets PATCH v2 error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// Spec: GET /tickets/:ticketId (single, auth-scoped) and GET /tickets?storeId=&status=&page=
app.get("/make-server-fc841b6e/tickets-query", async (c) => {
  try {
    const ctx = await resolveStoreFromAuth(c);
    const storeId = ctx?.storeId || c.req.query("storeId");
    if (!storeId) return c.json({ error: "Unauthorized" }, 401);
    const status = c.req.query("status");
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const perPage = 20;
    let list: any[] = await kv.getByPrefix(`store:${storeId}:ticket:`);
    if (list.length === 0) list = await kv.getByPrefix(`ticket:${storeId}:`); // fallback to legacy
    if (status) list = list.filter((t) => t.status === status);
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const slice = list.slice((page - 1) * perPage, page * perPage);
    return c.json({ success: true, total, page, pages, perPage, tickets: slice });
  } catch (err) {
    console.log(`tickets-query error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

app.get("/make-server-fc841b6e/ticket/:tid", async (c) => {
  try {
    const tid = c.req.param("tid");
    const ctx = await resolveStoreFromAuth(c);
    const storeId = ctx?.storeId || c.req.query("storeId");
    if (!storeId) return c.json({ error: "Unauthorized" }, 401);
    const t: any = (await kv.get(`store:${storeId}:ticket:${tid}`)) || (await kv.get(`ticket:${storeId}:${tid}`));
    if (!t) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true, ticket: t });
  } catch (err) {
    console.log(`ticket single error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

// ---------------- Admin migration ----------------
// POST /admin/migrate-kv — walks legacy keys and copies them into store:{storeId}:*
// Requires the Supabase service role key as a bearer token to prevent abuse.
app.post("/make-server-fc841b6e/admin/migrate-kv", async (c) => {
  try {
    const auth = c.req.header("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!token || token !== serviceKey) return c.json({ error: "Forbidden" }, 403);

    const dryRun = c.req.query("dryRun") === "1";
    const report: Record<string, number> = {};
    const touched = (k: string) => { report[k] = (report[k] || 0) + 1; };

    const legacyPrefixes: { from: string; to: (storeId: string, rest: string) => string; parse: (key: string) => { storeId: string; rest: string } | null }[] = [
      { from: "conversation:",  to: (s, r) => `store:${s}:conv:${r}`,     parse: (k) => { const m = k.match(/^conversation:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
      { from: "message:",       to: (s, r) => `store:${s}:msg:${r}`,      parse: (k) => { const m = k.match(/^message:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
      { from: "ticket:",        to: (s, r) => `store:${s}:ticket:${r}`,   parse: (k) => { const m = k.match(/^ticket:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
      { from: "rating:",        to: (s, r) => `store:${s}:rating:${r}`,   parse: (k) => { const m = k.match(/^rating:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
      { from: "feedback:",      to: (s, r) => `store:${s}:feedback:${r}`, parse: (k) => { const m = k.match(/^feedback:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
      { from: "unknown_q:",     to: (s, r) => `store:${s}:unknown:${r}`,  parse: (k) => { const m = k.match(/^unknown_q:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
      { from: "attach:",        to: (s, r) => `store:${s}:attach:${r}`,   parse: (k) => { const m = k.match(/^attach:([^:]+):(.+)$/); return m ? { storeId: m[1], rest: m[2] } : null; } },
    ];

    // kv module exposes getByPrefix but not raw listing; walk every legacy prefix bucket-wide.
    for (const entry of legacyPrefixes) {
      const items: any[] = await kv.getByPrefix(entry.from);
      for (const v of items) {
        // We need the raw key — kv_store returns values only. Reconstruct key from object shape.
        // Conversations & tickets carry storeId + id; messages carry cid + seq; etc.
        let oldKey: string | null = null;
        let storeId: string | null = v?.storeId || null;
        if (entry.from === "conversation:" && storeId && v.id) oldKey = `conversation:${storeId}:${v.id}`;
        else if (entry.from === "ticket:" && storeId && v.id) oldKey = `ticket:${storeId}:${v.id}`;
        else if (entry.from === "rating:" && storeId && v.cid) oldKey = `rating:${storeId}:${v.cid}`;
        else if (entry.from === "feedback:" && storeId && v.cid && v.messageId) oldKey = `feedback:${storeId}:${v.cid}:${v.messageId}`;
        else if (entry.from === "unknown_q:" && storeId && v.id) oldKey = `unknown_q:${storeId}:${v.id}`;
        else if (entry.from === "attach:" && storeId && v.id) oldKey = `attach:${storeId}:${v.id}`;
        else if (entry.from === "message:" && storeId && v.cid && typeof v.seq === "number") {
          oldKey = `message:${storeId}:${v.cid}:${String(v.seq).padStart(6, "0")}`;
        }
        if (!oldKey) { touched(`${entry.from}__unreconstructed`); continue; }
        const parsed = entry.parse(oldKey);
        if (!parsed) { touched(`${entry.from}__unparseable`); continue; }
        const newKey = entry.to(parsed.storeId, parsed.rest);
        if (dryRun) { touched(`${entry.from}__would_copy`); continue; }
        const already = await kv.get(newKey);
        if (!already) await kv.set(newKey, v);
        // ensure store meta exists so tenancy checks pass for existing stores
        const metaKey = `store:${parsed.storeId}:meta`;
        const meta: any = await kv.get(metaKey);
        if (!meta) await kv.set(metaKey, { storeId: parsed.storeId, owners: [], migrated: true, createdAt: nowISO() });
        touched(`${entry.from}__copied`);
      }
    }
    return c.json({ success: true, dryRun, report });
  } catch (err) {
    console.log(`migrate-kv error: ${err}`);
    return c.json({ error: `${err}` }, 500);
  }
});

Deno.serve({
  onError: (err) => {
    if (err instanceof Error && (err.name === "Http" || /connection closed|broken pipe|error writing a body|message completed/i.test(err.message))) {
      return new Response(null, { status: 499 });
    }
    console.log(`Unhandled server error: ${err}`);
    return new Response("Internal Server Error", { status: 500 });
  },
}, app.fetch);