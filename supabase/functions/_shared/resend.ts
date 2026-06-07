// Shared Resend helper. Always sends from the verified Fuqah domain.
// Footer in every template uses support@fuqah.ai + fuqah.ai.

export const RESEND_FROM = "Fuqah AI <support@fuqah.net>";

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `${r.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Format a Date in Asia/Riyadh using Arabic-Saudi locale.
export function formatRiyadhDate(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    year: "numeric", month: "long", day: "numeric",
  }).format(d);
}

export function formatRiyadhTime(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}