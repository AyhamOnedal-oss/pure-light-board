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

  const domain = (input.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const domainHost = domain.split("/")[0] || "";
  const platform = (input.platform || "").toLowerCase();
  const sid = input.store_id != null ? String(input.store_id).trim() : "";

  // Try Salla by merchant_id
  async function trySalla(): Promise<ResolveResult | null> {
    if (!sid) return null;
    const merchantId = Number(sid);
    if (!Number.isFinite(merchantId)) return null;
    const { data } = await client()
      .from("salla_connections")
      .select("tenant_id, is_active")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    if (data?.tenant_id) return { tenant_id: data.tenant_id, is_active: !!data.is_active };
    return null;
  }

  // Try Zid by store_uuid or store_id
  async function tryZid(): Promise<ResolveResult | null> {
    if (!sid) return null;
    // PostgREST .or() values cannot contain commas/parens unsanitized; sid is a token here.
    const safe = sid.replace(/[(),]/g, "");
    const { data } = await client()
      .from("zid_connections")
      .select("tenant_id, is_active")
      .or(`store_uuid.eq.${safe},store_id.eq.${safe}`)
      .maybeSingle();
    if (data?.tenant_id) return { tenant_id: data.tenant_id, is_active: !!data.is_active };
    return null;
  }

  // Try domain across salla_connections.store_url, zid_connections.store_url, settings_workspace.domain.
  async function tryDomain(): Promise<ResolveResult | null> {
    if (!domainHost) return null;
    const c = client();
    const like = `%${domainHost}%`;
    const [sallaRes, zidRes, wsRes] = await Promise.all([
      c.from("salla_connections").select("tenant_id, is_active, store_url").ilike("store_url", like).limit(5),
      c.from("zid_connections").select("tenant_id, is_active, store_url").ilike("store_url", like).limit(5),
      c.from("settings_workspace").select("id, domain").ilike("domain", `%${domainHost}%`).limit(5),
    ]);
    const matchHost = (u: string | null | undefined) => {
      if (!u) return false;
      const h = String(u).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").split("/")[0];
      return h === domainHost;
    };
    const salla = (sallaRes.data || []).find((r) => matchHost(r.store_url));
    if (salla?.tenant_id) return { tenant_id: salla.tenant_id, is_active: !!salla.is_active };
    const zid = (zidRes.data || []).find((r) => matchHost(r.store_url));
    if (zid?.tenant_id) return { tenant_id: zid.tenant_id, is_active: !!zid.is_active };
    const ws = (wsRes.data || []).find((r) => {
      const d = String(r.domain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").split("/")[0];
      return d === domainHost;
    });
    if (ws?.id) return { tenant_id: ws.id, is_active: true };
    return null;
  }

  // 1. Try the explicit platform first.
  if (platform === "salla") {
    const r = await trySalla();
    if (r) return r;
  } else if (platform === "zid") {
    const r = await tryZid();
    if (r) return r;
  }

  // 2. Cross-platform fallback: snippet may have the wrong/missing data-platform.
  if (sid) {
    if (platform !== "salla") {
      const r = await trySalla();
      if (r) return r;
    }
    if (platform !== "zid") {
      const r = await tryZid();
      if (r) return r;
    }
  }

  // 3. Domain fallback against connection store_url + workspace domain.
  const d = await tryDomain();
  if (d) return d;

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