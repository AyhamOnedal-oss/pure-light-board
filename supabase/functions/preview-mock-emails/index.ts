// Temporary: send mock low-balance + renewal emails for preview.
import { sendResendEmail } from "../_shared/resend.ts";
import {
  lowBalanceWarningHtml,
  renewalConfirmationHtml,
  subscriptionExpiredHtml,
  subscriptionExpiryWarningHtml,
  storeDisconnectedHtml,
} from "../_shared/email-templates-ar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const to = "w8jkkchmfb@zam-partner.email";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await sleep(600);
  const expired = await sendResendEmail({
    to,
    subject: "انتهى اشتراكك في فقاعة AI",
    html: subscriptionExpiredHtml({
      store_name: "متجر التجربة",
      expiry_date: "14 Jun 2026",
      renewal_link: "https://fuqah.ai/?settings=plans",
    }),
  });

  await sleep(600);
  const warn = await sendResendEmail({
    to,
    subject: "باقتك تنتهي خلال 5 يوم",
    html: subscriptionExpiryWarningHtml({
      store_name: "متجر التجربة",
      days_remaining: "5",
      package_name: "الاحترافية",
      renewal_link: "https://fuqah.ai/?settings=plans",
    }),
  });

  await sleep(600);
  const sallaDisc = await sendResendEmail({
    to,
    subject: "تم إلغاء ربط متجرك مع سلة",
    html: storeDisconnectedHtml({
      store_name: "متجر التجربة",
      platform_name: "سلة",
      disconnect_date: "14 Jun 2026",
    }),
  });

  await sleep(600);
  const zidDisc = await sendResendEmail({
    to,
    subject: "تم إلغاء ربط متجرك مع زد",
    html: storeDisconnectedHtml({
      store_name: "متجر التجربة",
      platform_name: "زد",
      disconnect_date: "14 Jun 2026",
    }),
  });

  return new Response(JSON.stringify({ expired, warn, sallaDisc, zidDisc }), {
    headers: { ...cors, "content-type": "application/json" },
  });

  // Unreachable: legacy mocks kept for reference
  // deno-lint-ignore no-unreachable
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
      plan_name: "الاحترافية",
      new_end_date: "14 Jul 2026",
      monthly_quota: "100,000",
    }),
  });

  const expired = await sendResendEmail({
    to,
    subject: "انتهى اشتراكك في فقاعة AI",
    html: subscriptionExpiredHtml({
      store_name: "متجر التجربة",
      expiry_date: "14 Jun 2026",
      renewal_link: "https://fuqah.ai/?settings=plans",
    }),
  });

  const warn = await sendResendEmail({
    to,
    subject: "باقتك تنتهي خلال 5 يوم",
    html: subscriptionExpiryWarningHtml({
      store_name: "متجر التجربة",
      days_remaining: "5",
      package_name: "الاحترافية",
      renewal_link: "https://fuqah.ai/?settings=plans",
    }),
  });

  const sallaDisc = await sendResendEmail({
    to,
    subject: "تم إلغاء ربط متجرك مع سلة",
    html: storeDisconnectedHtml({
      store_name: "متجر التجربة",
      platform_name: "سلة",
      disconnect_date: "14 Jun 2026",
    }),
  });

  const zidDisc = await sendResendEmail({
    to,
    subject: "تم إلغاء ربط متجرك مع زد",
    html: storeDisconnectedHtml({
      store_name: "متجر التجربة",
      platform_name: "زد",
      disconnect_date: "14 Jun 2026",
    }),
  });

  return new Response(JSON.stringify({ low, renew, expired, warn, sallaDisc, zidDisc }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});