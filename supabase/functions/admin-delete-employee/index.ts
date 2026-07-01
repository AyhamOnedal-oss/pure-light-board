// admin-delete-employee — super-admin-only delete for admin_team_members
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing_auth" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !callerId) return json({ error: "invalid_auth" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from("auth_user_roles").select("role").eq("user_id", callerId).eq("role", "super_admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const member_id = String(body?.member_id ?? "").trim();
    if (!member_id) return json({ error: "invalid_input" }, 400);
    // Fetch cached user_id first so we can revoke without an auth-admin round trip.
    const { data: row } = await admin
      .from("admin_team_members").select("email, user_id").eq("id", member_id).maybeSingle();
    const { error } = await admin.from("admin_team_members").delete().eq("id", member_id);
    if (error) return json({ error: "delete_failed", detail: error.message }, 500);

    // Background: resolve auth user (if not cached) and revoke the admin role.
    const cleanup = (async () => {
      let uid: string | null = (row as any)?.user_id ?? null;
      if (!uid && row?.email) {
        const lookup = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(row.email)}`,
          { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
        );
        if (lookup.ok) {
          const j = await lookup.json();
          const match = (j?.users ?? []).find((u: any) =>
            (u?.email ?? "").toLowerCase() === row.email.toLowerCase());
          if (match?.id) uid = match.id;
        }
      }
      if (uid) {
        await admin.from("auth_user_roles").delete()
          .eq("user_id", uid).eq("role", "admin");
      }
    })().catch((e) => console.error('admin-delete-employee cleanup failed', e));
    try {
      // @ts-ignore - EdgeRuntime is provided in Supabase edge runtime
      (globalThis as any).EdgeRuntime?.waitUntil?.(cleanup);
    } catch { /* ignore */ }
    return json({ ok: true });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});