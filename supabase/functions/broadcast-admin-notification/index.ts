// Super-admin broadcasts an in-app notification to every tenant.
// Inserts one row into public.app_notifications per active tenant.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const uid = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify super_admin
    const { data: roleRow } = await admin
      .from("auth_user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => null) as { title?: string; message?: string } | null;
    const title = String(body?.title ?? "").trim();
    const message = String(body?.message ?? "").trim();
    if (!title || !message) return json({ error: "missing title or message" }, 400);
    if (title.length > 200 || message.length > 2000) return json({ error: "too long" }, 400);

    const { data: tenants, error: tErr } = await admin
      .from("settings_workspace")
      .select("id");
    if (tErr) return json({ error: tErr.message }, 500);

    const rows = (tenants ?? []).map((t) => ({
      tenant_id: t.id,
      kind: "admin_message" as const,
      title_en: title,
      title_ar: title,
      message_en: message,
      message_ar: message,
    }));
    if (rows.length === 0) return json({ ok: true, sent: 0 });

    const { error: insErr } = await admin.from("app_notifications").insert(rows);
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, sent: rows.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});