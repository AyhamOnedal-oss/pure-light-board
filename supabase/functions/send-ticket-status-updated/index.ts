// Triggered by AFTER UPDATE OF status on tickets_main via pg_net.
// Header x-ticket-status-secret must match _app_secrets.ticket_status_webhook_secret.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail } from "../_shared/resend.ts";
import { ticketStatusUpdatedHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ticket-status-secret",
};

const PRIORITY_AR: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };
const STATUS_AR: Record<string, string> = { open: "مفتوحة", in_progress: "قيد المعالجة", pending: "معلّقة", resolved: "تم الحل", closed: "مغلقة" };
const CATEGORY_AR: Record<string, string> = { product: "منتج", payment: "دفع", shipping: "شحن", account: "حساب", other: "أخرى", complaint: "شكوى", question: "سؤال", refund: "استرجاع" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secretRow } = await admin.from("_app_secrets").select("value").eq("key", "ticket_status_webhook_secret").maybeSingle();
    const expected = secretRow?.value as string | undefined;
    if (!expected || req.headers.get("x-ticket-status-secret") !== expected) return json({ error: "unauthorized" }, 401);

    const { tenant_id, ticket_id } = await req.json();
    if (!tenant_id || !ticket_id) return json({ error: "missing tenant_id or ticket_id" }, 400);

    const { data: ticket } = await admin.from("tickets_main")
      .select("display_code, number, subject, category, priority, status").eq("id", ticket_id).maybeSingle();
    if (!ticket) return json({ error: "ticket not found" }, 404);

    const { data: ws } = await admin.from("settings_workspace").select("name").eq("id", tenant_id).maybeSingle();
    const { data: member } = await admin.from("auth_tenant_members")
      .select("user_id").eq("tenant_id", tenant_id).eq("role", "owner")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!member?.user_id) return json({ error: "no owner" }, 404);
    const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
    const recipient = userRes?.user?.email;
    if (!recipient) return json({ error: "owner has no email" }, 404);

    const ticketNumber = ticket.display_code ?? `TKT-${ticket.number}`;
    const html = ticketStatusUpdatedHtml({
      store_name: ws?.name ?? "متجرك",
      ticket_number: ticketNumber,
      new_status: STATUS_AR[String(ticket.status ?? "")] ?? String(ticket.status ?? "—"),
      ticket_title: ticket.subject ?? "—",
      ticket_category: CATEGORY_AR[String(ticket.category ?? "")] ?? String(ticket.category ?? "—"),
      ticket_priority: PRIORITY_AR[String(ticket.priority ?? "")] ?? String(ticket.priority ?? "—"),
      ticket_link: `https://fuqah.ai/tickets/${ticket_id}`,
    });

    const send = await sendResendEmail({
      to: recipient,
      subject: `تحديث حالة التذكرة ${ticketNumber}`,
      html,
    });
    return json(send, send.ok ? 200 : 500);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});