/**
 * Token → conversation conversion used across the user dashboard.
 *
 * Per product spec: one customer conversation consumes approximately
 *   50,000 input tokens + 5,000 output tokens.
 *
 * We compute conversations from a token bucket using the *larger* of the
 * two ratios so we never undercount usage against a quota.
 */
export const INPUT_TOKENS_PER_CONVO = 50_000;
export const OUTPUT_TOKENS_PER_CONVO = 5_000;

/** Average tokens per conversation used to convert legacy word quotas. */
const AVG_TOKENS_PER_CONVO = (INPUT_TOKENS_PER_CONVO + OUTPUT_TOKENS_PER_CONVO) / 2;

/** Rough words-per-token ratio matching the OpenAI usage sync helper. */
const WORDS_PER_TOKEN = 0.75;

export function tokensToConversations(inputTokens: number, outputTokens: number): number {
  const i = Math.max(0, Number(inputTokens) || 0);
  const o = Math.max(0, Number(outputTokens) || 0);
  if (i === 0 && o === 0) return 0;
  const byInput = i / INPUT_TOKENS_PER_CONVO;
  const byOutput = o / OUTPUT_TOKENS_PER_CONVO;
  return Math.ceil(Math.max(byInput, byOutput));
}

/**
 * Convert a legacy monthly word quota (stored as `monthly_word_quota`) into
 * an approximate conversation quota so the Plans UI can show conversations
 * without a schema change.
 */
export function wordsToConversationsQuota(words: number): number {
  const w = Math.max(0, Number(words) || 0);
  if (w === 0) return 0;
  const tokens = w / WORDS_PER_TOKEN;
  return Math.max(1, Math.round(tokens / AVG_TOKENS_PER_CONVO));
}