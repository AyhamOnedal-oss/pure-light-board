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
}

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export async function fetchAdminReports(): Promise<AdminReportsData> {
  // Always compute from live tenants + connections. The legacy
  // `admin_reports_plans` / `admin_reports_revenue_monthly` tables only ever
  // held seed/mock numbers and would shadow real data, so we ignore them.
  return computeLiveReports();
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

async function computeLiveReports(): Promise<AdminReportsData> {
  const empty = (): ReportPlanRow[] =>
    PLAN_DEFS.map(d => ({ name: d.name, nameAr: d.nameAr, price: d.price, subscribers: 0, total: 0 }));
  const emptyMonths = (): RevenueMonth[] =>
    MONTHS_EN.map((m, i) => ({ name: m, nameAr: MONTHS_AR[i], zid: 0, salla: 0 }));

  try {
    const [tenantsRes, zidRes, sallaRes, membersRes] = await Promise.all([
      supabase.from('settings_workspace').select('id,platform,plan,status,created_at'),
      supabase.from('zid_connections').select('tenant_id,is_active'),
      supabase.from('salla_connections').select('tenant_id,is_active'),
      supabase.from('auth_tenant_members').select('tenant_id'),
    ]);

    const tenants = (tenantsRes.data || []) as any[];
    const memberSet = new Set<string>(((membersRes.data || []) as any[]).map(m => m.tenant_id));
    const zidSet = new Set<string>(((zidRes.data || []) as any[]).map(c => c.tenant_id));
    const sallaSet = new Set<string>(((sallaRes.data || []) as any[]).map(c => c.tenant_id));

    const zidPlans = empty();
    const sallaPlans = empty();
    const months = emptyMonths();
    const currentYear = new Date().getFullYear();

    for (const t of tenants) {
      if (!memberSet.has(t.id)) continue; // skip tenants with no real auth user
      const platform: 'zid' | 'salla' | null =
        sallaSet.has(t.id) ? 'salla'
          : zidSet.has(t.id) ? 'zid'
          : ((t.platform || '').toLowerCase() === 'salla' ? 'salla'
            : (t.platform || '').toLowerCase() === 'zid' ? 'zid' : null);
      if (!platform) continue;

      const planKey = normalizePlan(t.plan);
      const def = PLAN_DEFS.find(d => d.key === planKey)!;
      const bucket = platform === 'salla' ? sallaPlans : zidPlans;
      const row = bucket.find(r => r.name === def.name)!;
      row.subscribers += 1;
      row.total += def.price;

      const created = t.created_at ? new Date(t.created_at) : null;
      if (created && created.getFullYear() === currentYear) {
        const m = months[created.getMonth()];
        if (platform === 'salla') m.salla += def.price;
        else m.zid += def.price;
      }
    }

    return { zidPlans, sallaPlans, revenueByMonth: months };
  } catch {
    return { zidPlans: empty(), sallaPlans: empty(), revenueByMonth: emptyMonths() };
  }
}