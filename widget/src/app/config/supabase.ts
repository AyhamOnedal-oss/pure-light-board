/**
 * Supabase project config for the widget bundle.
 *
 * These values are baked in at build time. They MUST be the publishable
 * (anon) key — never the service role key.
 */
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  "https://kdrcgusinkqgwaafcgnw.supabase.co";

export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcmNndXNpbmtxZ3dhYWZjZ253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDg1NzEsImV4cCI6MjA5Mjg4NDU3MX0.90d40LUVe1yqZMtHlDCq6RDlSLYpyrdrTb-On4zsfg0";

export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

export interface StoreContext {
  platform?: string;
  store_id?: string;
  tenant_id?: string;
}

/**
 * Resolves how this widget instance identifies itself to Supabase.
 * Priority:
 *   1. window.__FUQAH_STORE_CTX  (set by widget-loader from Salla/Zid context)
 *   2. window.__FUQAH_TENANT_ID  (set by widget-loader after widget-resolve)
 *   3. URL ?platform=&store_id=  or  ?tenant_id=  (dashboard preview)
 */
export function getStoreContext(): StoreContext {
  const ctx: StoreContext = {};
  try {
    const w = window as any;
    if (w.__FUQAH_STORE_CTX?.platform) ctx.platform = String(w.__FUQAH_STORE_CTX.platform);
    if (w.__FUQAH_STORE_CTX?.store_id) ctx.store_id = String(w.__FUQAH_STORE_CTX.store_id);
    if (w.__FUQAH_TENANT_ID) ctx.tenant_id = String(w.__FUQAH_TENANT_ID);

    const sp = new URLSearchParams(window.location.search);
    if (!ctx.platform) ctx.platform = sp.get("platform") ?? undefined;
    if (!ctx.store_id) ctx.store_id = sp.get("store_id") ?? undefined;
    if (!ctx.tenant_id) ctx.tenant_id = sp.get("tenant_id") ?? undefined;
  } catch {}
  return ctx;
}

export function buildContextQuery(ctx: StoreContext): string {
  const p = new URLSearchParams();
  if (ctx.tenant_id) p.set("tenant_id", ctx.tenant_id);
  if (ctx.platform) p.set("platform", ctx.platform);
  if (ctx.store_id) p.set("store_id", ctx.store_id);
  return p.toString();
}

export function hasContext(ctx: StoreContext): boolean {
  return !!(ctx.tenant_id || (ctx.platform && ctx.store_id));
}

/**
 * @deprecated use getStoreContext() — kept for backwards compatibility.
 */
export function getTenantId(): string | null {
  return getStoreContext().tenant_id ?? null;
}