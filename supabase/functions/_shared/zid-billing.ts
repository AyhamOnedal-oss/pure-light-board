// Shared Zid billing helpers — formula + plan code normalization.
// Used by zid-oauth-webhook, zid-sync-subscriptions, and seed-zid-mock-data
// so every charge stored in zid_charges goes through one auditable code path.

export const ZID_VAT_RATE = 0.15;
export const ZID_COMMISSION_RATE = 0.20; // Zid keeps 20% of post-VAT net
export const ZID_MIN_PAYOUT_SAR = 100;   // Below this, the transfer rolls to next month

export type ZidChargeMath = {
  gross_amount_sar: number;
  vat_sar: number;
  zid_commission_sar: number;
  developer_net_sar: number;
  is_below_minimum: boolean;
  payout_month: string; // YYYY-MM-10 — Zid pays on the 10th of the following month
};

/** KSA rule: VAT is 15% of gross (deducted first). After VAT, Zid takes 20%, we keep 80%. */
export function computeZidCharge(grossAmountSar: number, chargedAt: Date): ZidChargeMath {
  const gross = round2(grossAmountSar);
  const vat = round2(gross * ZID_VAT_RATE);
  const netAfterVat = round2(gross - vat);
  const commission = round2(netAfterVat * ZID_COMMISSION_RATE);
  const developerNet = round2(netAfterVat - commission);
  const isBelowMin = developerNet < ZID_MIN_PAYOUT_SAR;

  // Zid invoices on the 6th, transfers on the 10th of the following month.
  const next = new Date(Date.UTC(chargedAt.getUTCFullYear(), chargedAt.getUTCMonth() + 1, 10));
  const payoutMonth = next.toISOString().slice(0, 10);

  return {
    gross_amount_sar: gross,
    vat_sar: vat,
    zid_commission_sar: commission,
    developer_net_sar: developerNet,
    is_below_minimum: isBelowMin,
    payout_month: payoutMonth,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Map various Zid plan codes / names to our canonical zid_plan_map keys. */
export function normalizeZidPlanCode(raw: string | null | undefined): string {
  const p = (raw || "").toString().trim().toLowerCase();
  if (!p || p === "free") return "trial";
  if (p === "pro") return "professional";
  if (["trial", "economy", "basic", "professional", "business"].includes(p)) return p;
  // Arabic fallbacks
  if (p.includes("تجريب")) return "trial";
  if (p.includes("اقتصاد")) return "economy";
  if (p.includes("أساس") || p.includes("اساس")) return "basic";
  if (p.includes("احتراف")) return "professional";
  if (p.includes("أعمال") || p.includes("اعمال")) return "business";
  return "trial";
}

export function normalizeZidStatus(raw: string | null | undefined): string {
  const s = (raw || "").toString().trim().toLowerCase();
  if (["active", "subscribed", "paid"].includes(s)) return "active";
  if (["cancelled", "canceled", "uninstalled"].includes(s)) return "cancelled";
  if (["expired", "past_due"].includes(s)) return "expired";
  if (["trial", "trialing"].includes(s)) return "trial";
  return s || "trial";
}