// Triggered by AFTER INSERT on tickets_main via pg_net.
// Header x-ticket-secret must match _app_secrets.ticket_email_webhook_secret.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendResendEmail } from "../_shared/resend.ts";
import { ticketReceivedHtml } from "../_shared/email-templates-ar.ts";
import { formatRiyadhDate, formatRiyadhTime } from "../_shared/resend.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ticket-secret",
};

const PRIORITY_AR: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };
const STATUS_AR: Record<string, string> = { open: "مفتوحة", in_progress: "قيد المعالجة", pending: "معلّقة", resolved: "تم الحل", closed: "مغلقة" };
const CATEGORY_AR: Record<string, string> = { product: "منتج", payment: "دفع", shipping: "شحن", account: "حساب", other: "أخرى", complaint: "شكوى", question: "سؤال", refund: "استرجاع" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secretRow } = await admin.from("_app_secrets").select("value").eq("key", "ticket_email_webhook_secret").maybeSingle();
    const expected = secretRow?.value as string | undefined;
    if (!expected || req.headers.get("x-ticket-secret") !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
    }
    const { tenant_id, ticket_id } = await req.json();
    if (!tenant_id || !ticket_id) {
      return new Response(JSON.stringify({ error: "missing tenant_id or ticket_id" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const { data: ticket, error: tErr } = await admin
      .from("tickets_main")
      .select("display_code, number, subject, description, category, priority, status, customer_name, customer_phone, created_at")
      .eq("id", ticket_id).maybeSingle();
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "ticket not found" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });
    }

    const { data: ws } = await admin.from("settings_workspace").select("name").eq("id", tenant_id).maybeSingle();

    // Owner email lookup
    const { data: member } = await admin
      .from("auth_tenant_members").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!member?.user_id) {
      return new Response(JSON.stringify({ error: "no owner" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });
    }
    const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
    const recipient = userRes?.user?.email;
    if (!recipient) {
      return new Response(JSON.stringify({ error: "owner has no email" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });
    }

    const createdAt = new Date(ticket.created_at as string);
    const html = ticketReceivedHtml({
      store_name: ws?.name ?? "متجرك",
      ticket_number: ticket.display_code ?? `TKT-${ticket.number}`,
      ticket_date: formatRiyadhDate(createdAt),
      ticket_time: formatRiyadhTime(createdAt),
      ticket_title: ticket.subject ?? "—",
      ticket_description: ticket.description ?? "—",
      ticket_category: CATEGORY_AR[String(ticket.category ?? "")] ?? String(ticket.category ?? "—"),
      ticket_priority: PRIORITY_AR[String(ticket.priority ?? "")] ?? String(ticket.priority ?? "—"),
      ticket_status: STATUS_AR[String(ticket.status ?? "")] ?? String(ticket.status ?? "—"),
      customer_phone: ticket.customer_phone ?? "—",
    });

    const send = await sendResendEmail({
      to: recipient,
      subject: `تم استلام تذكرتك ${ticket.display_code ?? `#${ticket.number}`}`,
      html,
    });
    return new Response(JSON.stringify(send), { status: send.ok ? 200 : 500, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});