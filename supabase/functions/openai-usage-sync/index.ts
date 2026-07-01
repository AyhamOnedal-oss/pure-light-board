// openai-usage-sync — polls OpenAI Usage API every 15 min (via pg_cron) and
// upserts exact per-tenant token/cost rows into public.merchant_token_daily.
//
// Attribution model:
// - For each call we make, `user` (Chat Completions) / `safety_identifier`
//   (Responses API in n8n) carries the tenant UUID — optionally suffixed
//   `:iqtest` for IQ-test conversations.
// - Usage API returns daily buckets grouped by {project_id, user_id, model}.
// - We parse user_id back into (tenant_id, scope).
//
// Auth: requires OPENAI_ADMIN_KEY (admin key with Usage read scope).
// All other config (prices, tokens/word factor) comes from admin_openai_keys.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const OPENAI_ADMIN_KEY = Deno.env.get("OPENAI_ADMIN_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type KeyRow = {
  slot: string;
  project_id: string | null;
  input_price_per_1m: number;
  output_price_per_1m: number;
  tokens_per_word: number;
};

type VersionRow = {
  key_id: string;
  slot: string;
  project_id: string | null;
  input_price_per_1m: number;
  output_price_per_1m: number;
  tokens_per_word: number;
  effective_from: string; // ISO
  effective_to: string | null;
};

function pickVersionForDay(
  versions: VersionRow[],
  projectId: string,
  dayIso: string, // YYYY-MM-DD
): VersionRow | null {
  // Use the end-of-day timestamp so a full-day bucket attributes to the
  // version active at the end of that day (the new version after a cutover).
  const endOfDay = new Date(`${dayIso}T23:59:59.999Z`).getTime();
  let best: VersionRow | null = null;
  for (const v of versions) {
    if ((v.project_id ?? "") !== projectId) continue;
    const from = new Date(v.effective_from).getTime();
    const to = v.effective_to ? new Date(v.effective_to).getTime() : Infinity;
    if (from <= endOfDay && endOfDay < to) {
      if (!best || from > new Date(best.effective_from).getTime()) best = v;
    }
  }
  return best;
}

type ParsedUser = { tenant: string | null; scope: "chat" | "iqtest" | "other" };

function parseUser(userId: string | null | undefined): ParsedUser {
  if (!userId) return { tenant: null, scope: "other" };
  const [tenant, suffix] = userId.split(":");
  const uuidRe = /^[0-9a-f-]{36}$/i;
  if (!uuidRe.test(tenant)) return { tenant: null, scope: "other" };
  if (suffix === "iqtest") return { tenant, scope: "iqtest" };
  return { tenant, scope: "chat" };
}

async function getLastStart(): Promise<number> {
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "openai_usage_last_start_time")
    .maybeSingle();
  const raw = (data?.value as any) ?? null;
  const n = Number(typeof raw === "string" ? raw : raw?.toString?.());
  if (Number.isFinite(n) && n > 0) return n;
  // Default: 2 days ago
  return Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 2;
}

async function setLastStart(epochSeconds: number): Promise<void> {
  await supabase
    .from("admin_settings")
    .upsert(
      { key: "openai_usage_last_start_time", value: String(epochSeconds) as any, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
}

/**
 * Fetch one Usage API page. Endpoint:
 *   GET /v1/organization/usage/completions
 *     ?start_time=...&end_time=...&bucket_width=1d
 *     &group_by[]=project_id&group_by[]=user_id&group_by[]=model
 *     &limit=180 (one page)
 */
async function fetchUsagePage(startTime: number, projectId: string | null, page: string | null) {
  const url = new URL("https://api.openai.com/v1/organization/usage/completions");
  url.searchParams.set("start_time", String(startTime));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.append("group_by", "project_id");
  url.searchParams.append("group_by", "user_id");
  url.searchParams.append("group_by", "model");
  url.searchParams.set("limit", "31");
  if (projectId) url.searchParams.append("project_ids", projectId);
  if (page) url.searchParams.set("page", page);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${OPENAI_ADMIN_KEY}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`usage_api_${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!OPENAI_ADMIN_KEY) return json({ error: "missing_admin_key" }, 500);

  const { data: keys, error: keysErr } = await supabase
    .from("admin_openai_keys")
    .select("slot, project_id, input_price_per_1m, output_price_per_1m, tokens_per_word");
  if (keysErr) return json({ error: "keys_load_failed", detail: keysErr.message }, 500);

  const { data: versions, error: versErr } = await supabase
    .from("admin_openai_key_versions")
    .select("key_id, slot, project_id, input_price_per_1m, output_price_per_1m, tokens_per_word, effective_from, effective_to");
  if (versErr) return json({ error: "versions_load_failed", detail: versErr.message }, 500);
  const versionRows = (versions ?? []) as VersionRow[];

  const startTime = await getLastStart();
  const newStart = Math.floor(Date.now() / 1000);

  // Map project_id → current key row (fallback when no version covers a day).
  const keyByProject: Record<string, KeyRow> = {};
  for (const k of (keys ?? []) as KeyRow[]) {
    if (k.project_id) keyByProject[k.project_id] = k;
  }

  const todayRiyadh = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }),
  ).toISOString().slice(0, 10);

  // If projects are configured, query each one. Otherwise query org-wide.
  const projectsToPoll: (string | null)[] = (keys ?? [])
    .map((k: any) => k.project_id)
    .filter((p: string | null) => !!p);
  if (projectsToPoll.length === 0) projectsToPoll.push(null);

  type DailyBucket = {
    tenant_id: string | null;
    day: string;
    project_id: string;
    model: string;
    scope: string;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  };
  const merchantRows: Map<string, DailyBucket> = new Map();
  const orphanRows: Map<string, Omit<DailyBucket, "tenant_id" | "scope">> = new Map();

  for (const projectId of projectsToPoll) {
    let page: string | null = null;
    let pages = 0;
    do {
      const resp = await fetchUsagePage(startTime, projectId, page);
      const buckets: any[] = resp?.data ?? [];
      for (const bucket of buckets) {
        const startSec = Number(bucket.start_time);
        if (!Number.isFinite(startSec)) continue;
        const day = new Date(startSec * 1000).toISOString().slice(0, 10);
        const results: any[] = bucket?.results ?? [];
        for (const r of results) {
          const proj = String(r.project_id ?? projectId ?? "unknown");
          const model = String(r.model ?? "unknown");
          const inputTok = Number(r.input_tokens ?? 0) || 0;
          const outputTok = Number(r.output_tokens ?? 0) || 0;
          const reqs = Number(r.num_model_requests ?? 0) || 0;
          const parsed = parseUser(r.user_id);
          if (parsed.tenant) {
            const key = `${parsed.tenant}|${day}|${proj}|${model}|${parsed.scope}`;
            const cur = merchantRows.get(key);
            if (cur) {
              cur.input_tokens += inputTok;
              cur.output_tokens += outputTok;
              cur.requests += reqs;
            } else {
              merchantRows.set(key, {
                tenant_id: parsed.tenant, day, project_id: proj, model,
                scope: parsed.scope, input_tokens: inputTok, output_tokens: outputTok, requests: reqs,
              });
            }
          } else {
            const key = `${day}|${proj}|${model}`;
            const cur = orphanRows.get(key);
            if (cur) {
              cur.input_tokens += inputTok;
              cur.output_tokens += outputTok;
              cur.requests += reqs;
            } else {
              orphanRows.set(key, {
                day, project_id: proj, model,
                input_tokens: inputTok, output_tokens: outputTok, requests: reqs,
              });
            }
          }
        }
      }
      page = resp?.next_page ?? null;
      pages++;
    } while (page && pages < 40);
  }

  // Upsert merchant rows with cost + word approximations.
  // Past days (< todayRiyadh): insert only if missing (don't rewrite history).
  // Today: upsert so partial-day data keeps refreshing.
  let upserted = 0;
  for (const row of merchantRows.values()) {
    if (!row.tenant_id) continue;
    const v = pickVersionForDay(versionRows, row.project_id, row.day);
    const k = keyByProject[row.project_id];
    const inPx = v?.input_price_per_1m ?? k?.input_price_per_1m ?? 0;
    const outPx = v?.output_price_per_1m ?? k?.output_price_per_1m ?? 0;
    const tpw = v?.tokens_per_word ?? k?.tokens_per_word ?? 3.3;
    const cost = (row.input_tokens / 1_000_000) * inPx + (row.output_tokens / 1_000_000) * outPx;
    const words = (row.input_tokens + row.output_tokens) / Math.max(0.1, tpw);
    const payload = {
      tenant_id: row.tenant_id,
      day: row.day,
      project_id: row.project_id,
      model: row.model,
      scope: row.scope,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      requests: row.requests,
      cost_usd: Number(cost.toFixed(6)),
      words_approx: Math.round(words),
      attribution: "exact",
      updated_at: new Date().toISOString(),
    };
    let error;
    if (row.day < todayRiyadh) {
      // Insert-if-missing for past days
      const ins = await supabase
        .from("merchant_token_daily")
        .upsert(payload, { onConflict: "tenant_id,day,project_id,model,scope", ignoreDuplicates: true });
      error = ins.error;
    } else {
      const ups = await supabase
        .from("merchant_token_daily")
        .upsert(payload, { onConflict: "tenant_id,day,project_id,model,scope" });
      error = ups.error;
    }
    if (error) console.error("upsert merchant_token_daily failed", error.message);
    else upserted++;
  }

  // Upsert unattributed rows so total org spend is never lost.
  let upsertedOrphan = 0;
  for (const row of orphanRows.values()) {
    const v = pickVersionForDay(versionRows, row.project_id, row.day);
    const k = keyByProject[row.project_id];
    const inPx = v?.input_price_per_1m ?? k?.input_price_per_1m ?? 0;
    const outPx = v?.output_price_per_1m ?? k?.output_price_per_1m ?? 0;
    const cost = (row.input_tokens / 1_000_000) * inPx + (row.output_tokens / 1_000_000) * outPx;
    const payload = {
      day: row.day,
      project_id: row.project_id,
      model: row.model,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      requests: row.requests,
      cost_usd: Number(cost.toFixed(6)),
      updated_at: new Date().toISOString(),
    };
    let error;
    if (row.day < todayRiyadh) {
      const ins = await supabase
        .from("admin_openai_unattributed_daily")
        .upsert(payload, { onConflict: "day,project_id,model", ignoreDuplicates: true });
      error = ins.error;
    } else {
      const ups = await supabase
        .from("admin_openai_unattributed_daily")
        .upsert(payload, { onConflict: "day,project_id,model" });
      error = ups.error;
    }
    if (error) console.error("upsert orphan failed", error.message);
    else upsertedOrphan++;
  }

  // Advance the watermark only on success; back off 1h to allow OpenAI delay.
  await setLastStart(newStart - 60 * 60);

  return json({
    ok: true,
    upserted_merchant_rows: upserted,
    upserted_unattributed_rows: upsertedOrphan,
    polled_from: startTime,
    next_start: newStart - 60 * 60,
  });
});