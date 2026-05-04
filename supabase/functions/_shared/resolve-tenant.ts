// Shared helper: resolve a (platform, store_id) pair to an internal tenant_id.
// Used by widget-config, widget-events, and chat-ai.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2.49.8";

export type Platform = "salla" | "zid";

export interface ResolveInput {
  platform?: string | null;
  store_id?: string | null;
  tenant_id?: string | null;
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

  if (!input.platform || !input.store_id) return { tenant_id: null, is_active: false };

  if (input.platform === "salla") {
    const merchantId = Number(input.store_id);
    if (!Number.isFinite(merchantId)) return { tenant_id: null, is_active: false };
    const { data } = await client()
      .from("salla_connections")
      .select("tenant_id, is_active")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    return { tenant_id: data?.tenant_id ?? null, is_active: !!data?.is_active };
  }

  if (input.platform === "zid") {
    const { data } = await client()
      .from("zid_connections")
      .select("tenant_id, is_active")
      .eq("store_uuid", String(input.store_id))
      .maybeSingle();
    return { tenant_id: data?.tenant_id ?? null, is_active: !!data?.is_active };
  }

  return { tenant_id: null, is_active: false };
}

export function readContextFromUrl(url: URL): ResolveInput {
  return {
    platform: url.searchParams.get("platform"),
    store_id: url.searchParams.get("store_id"),
    tenant_id: url.searchParams.get("tenant_id"),
  };
}