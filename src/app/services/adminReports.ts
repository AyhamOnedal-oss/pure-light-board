import { supabase } from '@/integrations/supabase/client';

export interface ReportPlanRow {
  name: string;
  nameAr: string;
  price: number;
  subscribers: number;
  total: number;
}

export interface RevenueMonth {
  name: string;   // English short month
  nameAr: string;
  zid: number;
  salla: number;
}

export interface AdminReportsData {
  zidPlans: ReportPlanRow[];
  sallaPlans: ReportPlanRow[];
  revenueByMonth: RevenueMonth[];
  // New fields powered by zid_charges (Zid only for now; Salla pending)
  zidRevenue: number;       // SUM(developer_net_sar) status='paid'
  zidPending: number;       // SUM(gross_amount_sar) status='pending' OR deferred
  zidVat: number;           // SUM(vat_sar)
  zidCommission: number;    // SUM(zid_commission_sar)
  zidLastSyncedAt: string | null;
}

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export async function fetchAdminReports(): Promise<AdminReportsData> {
  return computeFromZidTables();
}

// ---------------------------------------------------------------------------
// Live computation from real tenants + connections.
// Never returns mock data — returns zeroed buckets when nothing exists yet.
// ---------------------------------------------------------------------------

const PLAN_DEFS: Array<{ key: string; name: string; nameAr: string; price: number }> = [
  { key: 'trial',        name: 'Trial',        nameAr: 'تجريبي',  price: 0 },
  { key: 'economy',      name: 'Economy',      nameAr: 'اقتصادي', price: 99 },
  { key: 'basic',        name: 'Basic',        nameAr: 'أساسي',   price: 199 },
  { key: 'professional', name: 'Professional', nameAr: 'احتراف',  price: 399 },
  { key: 'business',     name: 'Business',     nameAr: 'أعمال',   price: 799 },
];

function normalizePlan(raw: string | null | undefined): string {
  const p = (raw || '').toString().trim().toLowerCase();
  if (!p || p === 'free') return 'trial';
  if (p === 'pro') return 'professional';
  if (PLAN_DEFS.find(d => d.key === p)) return p;
  return 'trial';
}

const emptyPlans = (): ReportPlanRow[] =>
  PLAN_DEFS.map(d => ({ name: d.name, nameAr: d.nameAr, price: d.price, subscribers: 0, total: 0 }));
const emptyMonths = (): RevenueMonth[] =>
  MONTHS_EN.map((m, i) => ({ name: m, nameAr: MONTHS_AR[i], zid: 0, salla: 0 }));

/**
 * Compute Zid reports from the dedicated ledger tables:
 *  - zid_subscriptions  → subscribers per plan
 *  - zid_charges        → revenue / vat / commission / pending / monthly
 *
 * Salla side is still derived from settings_workspace + salla_connections
 * until the same ledger is implemented for Salla.
 */
async function computeFromZidTables(): Promise<AdminReportsData> {
  const zidPlans = emptyPlans();
  const sallaPlans = emptyPlans();
  const months = emptyMonths();
  const currentYear = new Date().getFullYear();

  let zidRevenue = 0, zidPending = 0, zidVat = 0, zidCommission = 0;
  let zidLastSyncedAt: string | null = null;

  try {
    const [subsRes, chargesRes, sallaTenantsRes, sallaConnRes, membersRes] = await Promise.all([
      supabase.from('zid_subscriptions').select('tenant_id,zid_plan_code,status,last_synced_at'),
      supabase.from('zid_charges')
        .select('zid_plan_code,charged_at,status,gross_amount_sar,vat_sar,zid_commission_sar,developer_net_sar,is_below_minimum'),
      supabase.from('settings_workspace').select('id,platform,plan,created_at'),
      supabase.from('salla_connections').select('tenant_id,is_active'),
      supabase.from('auth_tenant_members').select('tenant_id'),
    ]);

    // ----- Zid subscribers per plan -----
    for (const s of (subsRes.data || []) as any[]) {
      if (s.status === 'cancelled' || s.status === 'expired') continue;
      const planKey = normalizePlan(s.zid_plan_code);
      const def = PLAN_DEFS.find(d => d.key === planKey)!;
      const row = zidPlans.find(r => r.name === def.name)!;
      row.subscribers += 1;
      if (s.last_synced_at && (!zidLastSyncedAt || s.last_synced_at > zidLastSyncedAt)) {
        zidLastSyncedAt = s.last_synced_at;
      }
    }

    // ----- Zid money from charges ledger -----
    for (const c of (chargesRes.data || []) as any[]) {
      const planKey = normalizePlan(c.zid_plan_code);
      const def = PLAN_DEFS.find(d => d.key === planKey)!;
      const row = zidPlans.find(r => r.name === def.name)!;
      const charged = c.charged_at ? new Date(c.charged_at) : null;
      const net = Number(c.developer_net_sar) || 0;
      const gross = Number(c.gross_amount_sar) || 0;

      if (c.status === 'paid') {
        zidRevenue += net;
        zidVat += Number(c.vat_sar) || 0;
        zidCommission += Number(c.zid_commission_sar) || 0;
        row.total += net;
        if (charged && charged.getFullYear() === currentYear) {
          months[charged.getMonth()].zid += net;
        }
      } else if (c.status === 'pending' || c.is_below_minimum) {
        zidPending += gross;
      }
    }

    // ----- Salla side (legacy estimate until ledger ships) -----
    const memberSet = new Set<string>(((membersRes.data || []) as any[]).map(m => m.tenant_id));
    const sallaSet = new Set<string>(((sallaConnRes.data || []) as any[]).map(c => c.tenant_id));
    for (const t of (sallaTenantsRes.data || []) as any[]) {
      if (!memberSet.has(t.id)) continue;
      const isSalla = sallaSet.has(t.id) || (t.platform || '').toLowerCase() === 'salla';
      if (!isSalla) continue;
      const planKey = normalizePlan(t.plan);
      const def = PLAN_DEFS.find(d => d.key === planKey)!;
      const row = sallaPlans.find(r => r.name === def.name)!;
      row.subscribers += 1;
      row.total += def.price;
      const created = t.created_at ? new Date(t.created_at) : null;
      if (created && created.getFullYear() === currentYear) {
        months[created.getMonth()].salla += def.price;
      }
    }

    return {
      zidPlans, sallaPlans, revenueByMonth: months,
      zidRevenue: round2(zidRevenue),
      zidPending: round2(zidPending),
      zidVat: round2(zidVat),
      zidCommission: round2(zidCommission),
      zidLastSyncedAt,
    };
  } catch {
    return {
      zidPlans: emptyPlans(), sallaPlans: emptyPlans(), revenueByMonth: emptyMonths(),
      zidRevenue: 0, zidPending: 0, zidVat: 0, zidCommission: 0, zidLastSyncedAt: null,
    };
  }
}

function round2(n: number) { return Math.round(n * 100) / 100; }

/** Trigger the hourly sync function on demand from the "Refresh" button. */
export async function triggerZidSync(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('zid-sync-subscriptions', { body: {} });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Re-seed deterministic mock Zid data so admins can verify the page end-to-end. */
export async function seedZidMockData(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('seed-zid-mock-data', { body: {} });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}