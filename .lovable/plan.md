# Trigger rating + ticket box reliably — server-only fix

## Current state (verified)

**Widget `widget-4.7.11-hostinger.js` (155 KB) is already correct:**
- `action.type === "offer_ticket"` → pushes the inline phone box (skips if a ticket already exists or a form is open)
- `action.type === "offer_close"` → marks conversation ended, shows rating after 1200 ms
- `action.type === "offer_close_done"` → same, after 700 ms
- After user submits phone → `ticket-created` screen → auto rating after 3500 ms
- User clicks X → modal → "raise ticket" or "close → rating"
- User explicitly types "أريد تذكرة" → handled today only if classifier flags it (it doesn't)

**Server `supabase/functions/chat-ai/index.ts` is the problem:**
- Classifier only looks at the **AI reply**, never at the **user message**.
- End-of-conversation short-circuit only fires when the previous AI bubble matches a narrow Arabic regex (`isCloseOfferText`). If the AI phrased the close-offer any other way, "لا شكراً" does nothing.
- No path for "user explicitly asks for a ticket" → classifier returns `continue` on AI replies that just answer the question.

## What we'll change

All changes in `supabase/functions/chat-ai/index.ts` only. No widget rebuild, no DB changes.

### 1. New: classify the **user message** first

Before anything else, run a tiny classifier (same gpt-5.4-nano, JSON mode) on the **user's incoming message**:

```
user_intent ∈ { "end_conversation", "request_ticket", "normal" }
```

Definitions in the prompt:
- `end_conversation` = short negative/farewell ("لا شكراً", "تمام شكراً", "خلاص", "no thanks", "that's all", "bye")
- `request_ticket` = explicit ask to escalate ("أبي تذكرة", "كلموني على خدمة العملاء", "اتصلوا فيني", "raise a ticket", "talk to support")
- `normal` = everything else (questions, info, complaints that don't explicitly request escalation)

### 2. Decision tree (replaces the current block)

```
A. If user_intent == "end_conversation":
     reply  = friendly goodbye ("شكراً لتواصلك معنا 🌷 يومك سعيد.")
     action = { type: "offer_close_done", reason: "user_end_conversation" }
     skip n8n entirely (no point calling it)

B. Else if user_intent == "request_ticket":
     reply  = "تمام، يرجى إدخال رقم هاتفك ليتم فتح تذكرة دعم لك:"
     action = { type: "offer_ticket", reason: "user_request_ticket" }
     skip n8n entirely

C. Else (normal):
     call n8n as today → get AI reply
     classify the AI reply on { offer_ticket | offer_close | continue } (existing classifier)
     • offer_ticket (high confidence) → action.type = "offer_ticket"
     • offer_close  (high confidence) → action.type = "offer_close"
     • else → action.type = "none"
     Keep the anti-loop guard (don't re-offer what previous AI turn already offered).
```

### 3. Remove the brittle regex short-circuit

Delete `isCloseOfferText` / `isTicketOfferText` / `isShortNegative` / `normalizeAr`. The classifier handles all of this in both languages, no regex maintenance.

### 4. Logging stays

Still insert into `ai_classifier_usage` for every classifier call. Add a second row for the user-message classifier (or a `stage` column — see Technical details). Keep the existing `console.log("classifier", ...)`.

## Cost & latency impact

- **Path A / B (user ends or asks for ticket):** one nano call (~50 ms, ~$0.00003), n8n skipped → **faster and cheaper than today**.
- **Path C (normal):** two nano calls (user-intent + reply-intent) ≈ +50 ms, +$0.00005 vs today.

Hard timeout per call stays at 800 ms; on timeout we fall back to `normal` and behave like today.

## Verification

After deploy, send each of these in the widget and confirm:

| Test | Expected `action.type` | Expected UI |
|---|---|---|
| "لا شكراً" | `offer_close_done` | goodbye bubble → rating after 700 ms |
| "خلاص" / "تمام شكراً" | `offer_close_done` | same |
| "أبي تذكرة" / "كلموني خدمة العملاء" | `offer_ticket` | phone box appears |
| Normal question ("كم سعر…") | `none` | normal answer, no rating, no phone box |
| AI organically wraps up ("هل تحتاج أي شيء آخر؟") | `offer_close` | rating after 1200 ms |
| AI suggests escalation | `offer_ticket` | phone box |

Check Supabase Edge logs and `ai_classifier_usage` for confidence scores.

## Out of scope

- No widget changes (your 155 KB Hostinger `widget-4.7.11-hostinger.js` stays as-is).
- No DB changes (`ai_classifier_usage` table already exists).
- n8n workflow untouched — its `next_action` is still logged for comparison but ignored.

---

## Technical details (for reference)

- New function `classifyUserIntent(message)` mirrors `classifyIntent` shape: same model, same timeout, same fallback chain (`gpt-5.4-nano` → `gpt-5-nano`).
- Single prompt, strict JSON: `{"intent":"end_conversation"|"request_ticket"|"normal","confidence":0..1}`. Threshold reused (`CLASSIFIER_MIN_CONFIDENCE = 0.6`).
- For Path A / B we still upsert the conversation, persist the user + canned-reply messages, and return the standard envelope `{ reply, attachments: [], action, tenant_id, conversation_id }` so the widget code path is unchanged.
- `ai_classifier_usage` insert gets a `stage` field with values `"user_intent"` or `"reply_intent"`. If the column doesn't exist yet, add it via migration as `text` nullable (separate small migration in the same change).
- Anti-loop guard kept for Path C only (Paths A/B are user-driven so no loop risk).
