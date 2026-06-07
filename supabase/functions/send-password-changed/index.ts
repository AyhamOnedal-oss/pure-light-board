// Called from AccountSettings.tsx right after auth.updateUser({ password }).
// Uses caller JWT to identify the user; no extra body required.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail, formatRiyadhDate, formatRiyadhTime } from "../_shared/resend.ts";
import { passwordChangedHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userRes, error } = await admin.auth.getUser(token);
    if (error || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
    }
    const user = userRes.user;
    const recipient = user.email!;
    let storeName: string | null = null;
    const { data: acc } = await admin.from("settings_account").select("display_name").eq("user_id", user.id).maybeSingle();
    if (acc?.display_name) storeName = acc.display_name as string;
    if (!storeName) {
      const { data: member } = await admin.from("auth_tenant_members").select("tenant_id").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
      if (member?.tenant_id) {
        const { data: ws } = await admin.from("settings_workspace").select("name").eq("id", member.tenant_id).maybeSingle();
        if (ws?.name) storeName = ws.name as string;
      }
    }
    storeName = storeName ?? recipient.split("@")[0];

    const now = new Date();
    const html = passwordChangedHtml({
      store_name: storeName,
      change_date: formatRiyadhDate(now),
      change_time: formatRiyadhTime(now),
    });
    const send = await sendResendEmail({
      to: recipient,
      subject: "تم تغيير كلمة المرور بنجاح",
      html,
    });
    return new Response(JSON.stringify(send), { status: send.ok ? 200 : 500, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});