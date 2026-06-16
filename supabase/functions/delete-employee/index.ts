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

    // Authorize caller — must be a tenant owner/admin OR a super admin.
    const [{ data: caller }, { data: superRole }] = await Promise.all([
      admin
        .from("auth_tenant_members")
        .select("role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", callerId)
        .maybeSingle(),
      admin
        .from("auth_user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "super_admin")
        .maybeSingle(),
    ]);
    const isTenantAdmin = !!caller && (caller.role === "owner" || caller.role === "admin");
    const isSuperAdmin = !!superRole;
    if (!isTenantAdmin && !isSuperAdmin) {
      console.error("delete-employee forbidden", { callerId, tenant_id, callerRole: caller?.role ?? null });
      return json({ error: "forbidden", detail: "caller is not tenant owner/admin or super_admin" }, 403);
    }

    // Fetch the team_members row to get user_id
    const { data: member, error: memberErr } = await admin
      .from("team_members")
      .select("id, user_id, email")
      .eq("id", member_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    if (memberErr) {
      console.error("delete-employee member lookup failed", memberErr);
      return json({ error: "member_lookup_failed", detail: memberErr.message }, 500);
    }
    if (!member) return json({ error: "not_found", detail: "team_members row not found for tenant" }, 404);

    const targetUserId: string | null = member.user_id ?? null;
    const nowIso = new Date().toISOString();

    // Soft-delete: keep the team_members row (and all FK history) but
    // mark it deleted so the UI hides it and the login page can detect it.
    const { error: softDelErr } = await admin
      .from("team_members")
      .update({
        deleted_at: nowIso,
        auth_revoked_at: nowIso,
        status: "inactive",
      })
      .eq("id", member_id);
    if (softDelErr) {
      console.error("delete-employee soft-delete failed", softDelErr);
      return json({ error: "soft_delete_failed", detail: softDelErr.message }, 500);
    }

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
    // Run the (slow) auth-account cleanup in the background so the client
    // gets an instant response. The user's tenant access is already revoked
    // above; this step just nukes the underlying auth.users row when they
    // have no remaining memberships anywhere.
    if (targetUserId) {
      const cleanup = (async () => {
        try {
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
            await admin.auth.admin.deleteUser(targetUserId);
          }
        } catch (e) {
          console.error("delete-employee background auth cleanup failed", e);
        }
      })();
      // @ts-ignore - EdgeRuntime is provided by Supabase Edge Functions runtime
      try { EdgeRuntime.waitUntil(cleanup); } catch { /* ignore in non-edge envs */ }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});