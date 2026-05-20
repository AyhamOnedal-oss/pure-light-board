// Shared helper: resolve a (platform, store_id) pair to an internal tenant_id.
// Used by widget-config, widget-events, and chat-ai.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2.49.8";

export type Platform = "salla" | "zid";

export interface ResolveInput {
  platform?: string | null;
  store_id?: string | null;
  tenant_id?: string | null;
  domain?: string | null;
}

export interface ResolveResult {
  tenant_id: string | null;
  is_active: boolean;
}

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  return _client;
}

export async function resolveTenant(input: ResolveInput): Promise<ResolveResult> {
  // Direct tenant_id (dashboard preview path) — trust it, but still verify it exists.
  if (input.tenant_id) {
    const { data } = await client()
      .from("settings_workspace")
      .select("id, status")
      .eq("id", input.tenant_id)
      .maybeSingle();
    return { tenant_id: data?.id ?? null, is_active: !!data };
  }

  const domain = (input.domain || "").trim().toLowerCase().replace(/^www\./, "");

  if (!input.platform || !input.store_id) {
    // Domain-only fallback path.
    if (domain) {
      const { data } = await client()
        .from("settings_workspace")
        .select("id")
        .ilike("domain", domain)
        .maybeSingle();
      if (data?.id) return { tenant_id: data.id, is_active: true };
    }
    return { tenant_id: null, is_active: false };
  }

  if (input.platform === "salla") {
    const merchantId = Number(input.store_id);
    if (!Number.isFinite(merchantId)) return { tenant_id: null, is_active: false };
    const { data } = await client()
      .from("salla_connections")
      .select("tenant_id, is_active")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    if (data?.tenant_id) return { tenant_id: data.tenant_id, is_active: !!data.is_active };
  }

  if (input.platform === "zid") {
    const sid = String(input.store_id);
    // Zid storefronts can pass either the store UUID or the numeric store_id
    // (the only identifier exposed via {{store.id}} in Zid theme templates).
    const { data } = await client()
      .from("zid_connections")
      .select("tenant_id, is_active")
      .or(`store_uuid.eq.${sid},store_id.eq.${sid}`)
      .maybeSingle();
    if (data?.tenant_id) return { tenant_id: data.tenant_id, is_active: !!data.is_active };
  }

  // Final domain fallback for either platform.
  if (domain) {
    const { data } = await client()
      .from("settings_workspace")
      .select("id")
      .ilike("domain", domain)
      .maybeSingle();
    if (data?.id) return { tenant_id: data.id, is_active: true };
  }

  return { tenant_id: null, is_active: false };
}

export function readContextFromUrl(url: URL): ResolveInput {
  return {
    platform: url.searchParams.get("platform"),
    store_id: url.searchParams.get("store_id"),
    tenant_id: url.searchParams.get("tenant_id"),
    domain: url.searchParams.get("domain"),
  };
}