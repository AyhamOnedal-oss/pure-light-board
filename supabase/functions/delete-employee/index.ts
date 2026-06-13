// delete-employee — fully remove a team member: team_members row,
// auth_tenant_members row, and the auth.users account (if it has no
// other tenant memberships).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing_auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "invalid_auth" }, 401);
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body?.tenant_id ?? "").trim();
    const member_id = String(body?.member_id ?? "").trim();
    if (!tenant_id || !member_id) return json({ error: "invalid_input" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize caller — must be a tenant member with admin+ role
    const { data: caller } = await admin
      .from("auth_tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
      return json({ error: "forbidden" }, 403);
    }

    // Fetch the team_members row to get user_id
    const { data: member } = await admin
      .from("team_members")
      .select("id, user_id, email")
      .eq("id", member_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    if (!member) return json({ error: "not_found" }, 404);

    const targetUserId: string | null = member.user_id ?? null;
    const nowIso = new Date().toISOString();

    // Soft-delete: keep the team_members row (and all FK history) but
    // mark it deleted so the UI hides it and the login page can detect it.
    await admin
      .from("team_members")
      .update({
        deleted_at: nowIso,
        auth_revoked_at: nowIso,
        status: "inactive",
      })
      .eq("id", member_id);

    // Revoke tenant access immediately.
    if (targetUserId) {
      await admin
        .from("auth_tenant_members")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("user_id", targetUserId);
    }

    // If the user has no other tenant memberships and no other
    // non-deleted team_members rows, destroy the auth account so they
    // can never sign in again.
    let authDeleted = false;
    if (targetUserId) {
      const [{ count: tenantsLeft }, { count: teamsLeft }] = await Promise.all([
        admin
          .from("auth_tenant_members")
          .select("user_id", { head: true, count: "exact" })
          .eq("user_id", targetUserId),
        admin
          .from("team_members")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", targetUserId)
          .is("deleted_at", null),
      ]);
      if ((tenantsLeft ?? 0) === 0 && (teamsLeft ?? 0) === 0) {
        try {
          await admin.auth.admin.deleteUser(targetUserId);
          authDeleted = true;
        } catch (_) { /* best-effort */ }
      }
    }

    return json({ ok: true, auth_deleted: authDeleted });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});