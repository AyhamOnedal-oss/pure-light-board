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

/**
 * Resolves the active tenant_id for this widget instance.
 *
 * Priority:
 *   1. window.__FUQAH_TENANT_ID  (set by the loader after widget-resolve)
 *   2. URL ?tenant_id=...        (used by dashboard iframe preview)
 */
export function getTenantId(): string | null {
  try {
    const w = window as any;
    if (w.__FUQAH_TENANT_ID) return String(w.__FUQAH_TENANT_ID);
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get("tenant_id");
    if (fromUrl) return fromUrl;
  } catch {}
  return null;
}