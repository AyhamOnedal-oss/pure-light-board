import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeZidCharge, normalizeZidPlanCode } from "./zid-billing.ts";

Deno.test("computeZidCharge: 100 SAR follows KSA rule", () => {
  const m = computeZidCharge(100, new Date("2026-01-15T00:00:00Z"));
  assertEquals(m.gross_amount_sar, 100);
  assertEquals(m.vat_sar, 15);
  assertEquals(m.zid_commission_sar, 17);
  assertEquals(m.developer_net_sar, 68);
  assertEquals(m.is_below_minimum, true);          // 68 < 100 → deferred
  assertEquals(m.payout_month, "2026-02-10");
});

Deno.test("computeZidCharge: 399 SAR Professional plan", () => {
  const m = computeZidCharge(399, new Date("2026-03-01T00:00:00Z"));
  assertEquals(m.vat_sar, 59.85);
  assertEquals(m.zid_commission_sar, 67.83);
  assertEquals(m.developer_net_sar, 271.32);
  assertEquals(m.is_below_minimum, false);
  assertEquals(m.payout_month, "2026-04-10");
});

Deno.test("computeZidCharge: 199 SAR Basic plan exceeds minimum", () => {
  const m = computeZidCharge(199, new Date("2026-06-20T00:00:00Z"));
  // 199 - 29.85 = 169.15 ; 20% = 33.83 ; net = 135.32
  assertEquals(m.developer_net_sar, 135.32);
  assertEquals(m.is_below_minimum, false);
});

Deno.test("normalizeZidPlanCode", () => {
  assertEquals(normalizeZidPlanCode(null), "trial");
  assertEquals(normalizeZidPlanCode("PRO"), "professional");
  assertEquals(normalizeZidPlanCode("احترافي"), "professional");
  assertEquals(normalizeZidPlanCode("Business"), "business");
  assertEquals(normalizeZidPlanCode("anything-else"), "trial");
});

Deno.test("computeZidCharge: payout month wraps year-end", () => {
  const m = computeZidCharge(799, new Date("2026-12-15T00:00:00Z"));
  assertEquals(m.payout_month, "2027-01-10");
  assert(m.developer_net_sar > 500);
});