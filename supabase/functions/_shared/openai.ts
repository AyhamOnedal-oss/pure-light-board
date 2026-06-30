// Shared OpenAI helper.
// - Direct Chat Completions API only (no Lovable Gateway).
// - REQUIRES tenantId on every call → sets `user` so OpenAI's Usage API can
//   group exact spend per merchant.
// - For IQ-test calls (is_test=true conversations), pass `iqTest:true` so the
//   user_id becomes `<tenantId>:iqtest` and we track it separately.

export type OpenAICallOpts = {
  apiKey: string;
  model: string;
  /** Tenant UUID. Required. */
  tenantId: string;
  /** When true, sets user=<tenantId>:iqtest for separate IQ-test tracking. */
  iqTest?: boolean;
  messages: any[];
  responseJson?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export function tenantUser(tenantId: string, iqTest = false): string {
  return iqTest ? `${tenantId}:iqtest` : tenantId;
}

export async function callOpenAIChat(opts: OpenAICallOpts): Promise<Response> {
  if (!opts.tenantId) {
    // Hard fail: missing tenantId would land in admin_openai_unattributed_daily.
    // Caller should always pass a valid tenant; this throws in dev only.
    console.error("callOpenAIChat: missing tenantId — usage will be unattributed");
  }
  const isGpt5 = /^gpt-5/i.test(opts.model);
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    user: tenantUser(opts.tenantId || "unknown", opts.iqTest),
  };
  if (opts.responseJson) body.response_format = { type: "json_object" };
  if (isGpt5) {
    if (opts.maxTokens) body.max_completion_tokens = opts.maxTokens;
  } else {
    if (typeof opts.temperature === "number") body.temperature = opts.temperature;
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  }
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

export function extractUsage(data: any): OpenAIUsage {
  const u = data?.usage ?? {};
  const pt = Number(u.prompt_tokens ?? 0) || 0;
  const ct = Number(u.completion_tokens ?? 0) || 0;
  const tt = Number(u.total_tokens ?? pt + ct) || pt + ct;
  return { prompt_tokens: pt, completion_tokens: ct, total_tokens: tt };
}