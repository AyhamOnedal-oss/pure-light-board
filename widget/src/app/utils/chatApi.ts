/**
 * chatApi — sends a user message to the `chat-ai` Supabase edge function,
 * which proxies to n8n and returns the AI reply.
 */
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, getStoreContext } from "../config/supabase";

const VISITOR_KEY = "fuqah_visitor_id";

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export interface ChatHistoryEntry {
  sender: "customer" | "store" | "ai";
  text: string;
}

export interface SendMessageResult {
  reply: string;
  rateLimited?: boolean;
  error?: string;
}

export async function sendMessage(
  conversationId: string,
  text: string,
  history: ChatHistoryEntry[] = [],
): Promise<SendMessageResult> {
  const ctx = getStoreContext();
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/chat-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        platform: ctx.platform,
        store_id: ctx.store_id,
        tenant_id: ctx.tenant_id,
        conversation_id: conversationId,
        visitor_id: getVisitorId(),
        message: text,
        history,
      }),
    });

    if (res.status === 429) {
      return { reply: "", rateLimited: true, error: "rate_limited" };
    }
    if (!res.ok) {
      console.log("[FuqahChat] chat-ai error", res.status);
      return { reply: "", error: `http_${res.status}` };
    }
    const data = await res.json();
    return { reply: data.reply ?? "" };
  } catch (err) {
    console.log("[FuqahChat] chat-ai threw:", err);
    return { reply: "", error: "network" };
  }
}