// Temporary: send mock low-balance + renewal emails for preview.
import { sendResendEmail } from "../_shared/resend.ts";
import { lowBalanceWarningHtml, renewalConfirmationHtml } from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const to = "w8jkkchmfb@zam-partner.email";

  const low = await sendResendEmail({
    to,
    subject: "وصلت إلى 80% من رصيدك في فقاعة AI",
    html: lowBalanceWarningHtml({
      store_name: "متجر التجربة",
      used_percent: "80",
      used_words: "80,000",
      total_words: "100,000",
      remaining_words: "20,000",
      renewal_link: "https://fuqah.ai/?settings=plans",
    }),
  });

  const renew = await sendResendEmail({
    to,
    subject: "تم تجديد اشتراكك في فقاعة AI بنجاح",
    html: renewalConfirmationHtml({
      store_name: "متجر التجربة",
      plan_name: "Growth",
      new_end_date: "14 Jul 2026",
      monthly_quota: "100,000",
    }),
  });

  return new Response(JSON.stringify({ low, renew }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});