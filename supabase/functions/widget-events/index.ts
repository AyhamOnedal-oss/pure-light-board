// Telemetry endpoint for widget events (bubble shown / clicked).
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveTenant } from "../_shared/resolve-tenant.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      console.error("widget-events: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ error: "service_role_missing" }, 503);
    }
    const body = await req.json();
    const { event, platform, store_id, conversation_id, payload } = body;
    const { tenant_id } = await resolveTenant({
      tenant_id: body.tenant_id,
      platform,
      store_id,
    });
    if (!event || !tenant_id) return jsonResponse({ error: "missing fields" }, 400);

    // ── Conversation closed by widget (manual / inactivity / ai / rating_skip)
    if (event === "conversation.closed" && conversation_id) {
      const rawReason = String(payload?.reason ?? "manual");
      const reasonMap: Record<string, string> = {
        manual: "customer_manual",
        ai: "ai_request",
        inactivity: "idle",
        rating_skip: "idle",
      };
      const close_reason = reasonMap[rawReason] ?? "customer_manual";
      const { error } = await supabase
        .from("conversations_main")
        .update({
          status: "closed",
          close_reason,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation_id)
        .eq("tenant_id", tenant_id)
        .in("status", ["new", "open", "pending"]);
      if (error) console.error("widget-events: close conv failed", error);
      return jsonResponse({ ok: true });
    }

    // ── Customer submitted CSAT rating (also closes the conversation)
    if (event === "rating.submitted" && conversation_id) {
      const stars = Number(payload?.stars ?? payload?.rating ?? 0);
      const comment = payload?.comment ? String(payload.comment).slice(0, 1000) : null;
      if (!stars || stars < 1 || stars > 5) {
        return jsonResponse({ ok: false, error: "invalid_rating" }, 400);
      }
      const { error } = await supabase
        .from("conversations_main")
        .update({
          csat_rating: stars,
          rating_comment: comment,
          status: "closed",
          close_reason: "customer_manual",
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation_id)
        .eq("tenant_id", tenant_id);
      if (error) {
        console.error("widget-events: rating update failed", error);
        return jsonResponse({ ok: false, error: "rating_update_failed", message: error.message }, 500);
      }
      return jsonResponse({ ok: true });
    }

    // ── Message feedback (thumbs up/down) from widget
    if (event === "message.feedback") {
      const messageId = payload?.messageId ? String(payload.messageId) : null;
      const raw = payload?.feedback as "up" | "down" | null | undefined;
      const fb = raw === "up" ? "positive" : raw === "down" ? "negative" : null;
      if (!messageId) return jsonResponse({ ok: false, error: "missing_message_id" }, 400);
      const { error } = await supabase
        .from("conversations_messages")
        .update({ feedback: fb })
        .eq("id", messageId)
        .eq("tenant_id", tenant_id);
      if (error) console.error("widget-events: feedback update failed", error);
      return jsonResponse({ ok: !error });
    }

    // ── Ticket created from widget (inline form or modal)
    if (event === "ticket.created") {
      const subject = String(payload?.subject ?? payload?.message ?? "تذكرة جديدة من المحادثة").slice(0, 200);
      const description = payload?.message ? String(payload.message) : null;
      const customer_phone = payload?.phone ? String(payload.phone) : null;

      // Resolve customer info from conversation if available
      let customer_id: string | null = null;
      let customer_name: string | null = null;
      if (conversation_id) {
        const { data: conv } = await supabase
          .from("conversations_main")
          .select("customer_id")
          .eq("id", conversation_id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        if (conv?.customer_id) {
          customer_id = conv.customer_id;
          const { data: cust } = await supabase
            .from("conversations_customers")
            .select("display_name")
            .eq("id", customer_id)
            .maybeSingle();
          customer_name = cust?.display_name ?? null;
        }
      }

      const { data: inserted, error } = await supabase
        .from("tickets_main")
        .insert({
          tenant_id,
          conversation_id: conversation_id ?? null,
          subject,
          description,
          status: "open",
          priority: "medium",
          customer_phone,
          customer_id,
          customer_name,
        })
        .select("id, number, display_code")
        .single();
      if (error || !inserted) {
        console.error("widget-events: ticket insert failed", error);
        return jsonResponse(
          {
            ok: false,
            error: "ticket_insert_failed",
            message: error?.message ?? "unknown",
            code: (error as { code?: string } | null)?.code ?? null,
          },
          500,
        );
      }

      // Mark the conversation as having an open ticket and close it so the
      // post-resolve classify trigger fires for AI analysis.
      if (conversation_id) {
        await supabase
          .from("conversations_main")
          .update({
            ticket_status: "open",
            status: "closed",
            close_reason: null,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation_id)
          .eq("tenant_id", tenant_id);
      }

      // Timeline entry for the ticket
      await supabase.from("tickets_activities").insert({
        tenant_id,
        ticket_id: inserted.id,
        type: "status",
        status: "created",
        author_name: customer_name ?? "Customer",
        author_role: "agent",
      });

      return jsonResponse({
        ok: true,
        ticket_id: inserted.id,
        ticket_number: inserted.number,
        display_code: inserted.display_code ?? `TKT-${inserted.number}`,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (event === "bubble.click") {
      const { error } = await supabase.rpc("increment_widget_click", {
        p_tenant_id: tenant_id,
        p_day: today,
      });
      if (error) {
        console.error("widget-events: click increment failed", error);
        return jsonResponse({ error: "click_increment_failed" }, 500);
      }
    } else if (event === "bubble.shown") {
      await supabase
        .from("dashboard_usage_daily")
        .upsert({ tenant_id, day: today }, { onConflict: "tenant_id,day", ignoreDuplicates: true });
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("widget-events error", e);
    return jsonResponse({ error: "server_error" }, 500);
  }
});