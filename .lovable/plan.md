## Root cause (confirmed)

Queried `settings_train_ai` for tenant `1ed650e3-...`:

```
mode: prompt, prompt_len: 0, file_url: null
```

The DB row exists but `prompt` is empty. The dashboard's TrainAI screen shows a hardcoded `DEFAULT_PROMPT` constant client-side, but only writes to the DB when the merchant clicks Save. New tenants get the row from the `create_tenant_default_settings` trigger with an empty `prompt`, so `chat-ai` correctly sends `ai.prompt = null` to n8n.

This affects every tenant (Salla and Zid) that never saved Train AI. It just happens to be visible on Salla right now.

## Fix (two parts)

### 1. Backfill + new default in the DB

- Add a SQL constant function `public.default_train_ai_prompt()` returning the Arabic default prompt (the same text currently in `src/app/components/settings/TrainAI.tsx`).
- Migration also:
  - `UPDATE settings_train_ai SET prompt = public.default_train_ai_prompt() WHERE (prompt IS NULL OR length(btrim(prompt)) = 0) AND mode = 'prompt';`
  - Update `create_tenant_default_settings()` trigger to insert `prompt = public.default_train_ai_prompt()` for new tenants.

### 2. Server-side safety net in `chat-ai`

In `supabase/functions/chat-ai/index.ts`, when building the n8n payload:

```ts
const effectivePrompt =
  training?.mode === "file"
    ? null
    : (training?.prompt && training.prompt.trim().length > 0
        ? training.prompt
        : DEFAULT_TRAIN_AI_PROMPT);
```

Define `DEFAULT_TRAIN_AI_PROMPT` at the top of the file with the same text. This guarantees n8n always receives a non-empty `ai.prompt` even if the DB row hasn't been backfilled yet or a merchant clears the field.

### 3. Dashboard parity (small)

`TrainAI.tsx` currently treats an empty DB value as "show default". Leave the UI as is — the migration will populate the DB with the default text, so the textarea will simply show it on load and the merchant can edit/save normally.

## Scope
- New migration (function + UPDATE + trigger replacement).
- Edit `supabase/functions/chat-ai/index.ts` (add constant + fallback, remove the debug `n8n ai_payload` log added earlier since the diagnosis is done).
- No widget changes. No UI changes.

## Verification
- Re-run the Salla test message; the n8n webhook body should now contain `ai.prompt` starting with `أنت مساعد ذكاء اصطناعي...`.
- `SELECT length(prompt) FROM settings_train_ai WHERE tenant_id = '1ed650e3-...'` should be > 0.
