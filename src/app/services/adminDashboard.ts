/**
 * Admin Dashboard data service
 *
 * Fetches every chart/card on /admin from Supabase. If Supabase is
 * unreachable or returns no rows (e.g. RLS blocks the user), each loader
 * falls back to the same mock numbers the dashboard shipped with so the
 * page never breaks.
 *
 * Tables (super_admin only):
 *   admin_dash_kpi_snapshots       → 6 KPI cards
 *   admin_dash_words_monthly       → Words/Tokens bar chart
 *   admin_dash_new_subs_monthly    → New Subscribers Over Time line chart
 *   admin_dash_plan_distribution   → Current Customer Plans pie + per-platform bars
 *   admin_dash_platform_subs       → Subscriptions by Platform (active/inactive/cancelled)
 *   admin_dash_first_sub_type      → First Subscription Type pie
 *   admin_dash_customer_source     → Customer Source Comparison pie
 *   admin_dash_uninstalls          → Uninstall Comparison bar
 *   admin_dash_new_subscribers     → New Subscribers list
 *   admin_dash_servers             → Server Status grid + Server Usage bars
 */

import { supabase } from '@/integrations/supabase/client';

export type Platform = 'zid' | 'salla';
export type PlanTier = 'trial' | 'economy' | 'basic' | 'professional' | 'business';

export interface KpiSnapshot {
  total_customers: number;
  inactive_customers: number;
  total_uninstalls: number;
  active_customers: number;
  total_bubble_clicks: number;
  avg_response_seconds: number;
  total_customers_change: number;
  inactive_customers_change: number;
  total_uninstalls_change: number;
  active_customers_change: number;
  total_bubble_clicks_change: number;
  avg_response_seconds_change: number;
}

export interface WordsMonthly { year: number; month: number; words: number; }
export interface NewSubsMonthly { year: number; month: number; platform: Platform; count: number; }
export interface PlanDistribution { platform: Platform | null; plan: PlanTier; subscribers: number; }
export interface PlatformSubs { status: 'active' | 'inactive' | 'cancelled'; platform: Platform; count: number; }
export interface FirstSubType { plan: PlanTier; count: number; }
export interface CustomerSource { platform: Platform; count: number; }
export interface Uninstalls { platform: Platform; count: number; }
export interface NewSubscriber {
  store_name: string;
  platform: Platform;
  subscribed_on: string;
  total_tokens: number;
  used_tokens: number;
  logo_initials: string;
}
export interface ServerRow {
  name: string;
  status: 'connected' | 'disconnected';
  usage_percent: number;
  color: string;
  display_order: number;
}

// --- Live KPI + health-check types ---
export interface AdminKpis {
  total_customers: number;
  prev_total_customers: number;
  total_uninstalls: number;
  prev_total_uninstalls: number;
  incomplete_customers: number;
  prev_incomplete_customers: number;
  total_bubble_clicks: number;
  prev_total_bubble_clicks: number;
  avg_response_seconds: number;
  prev_avg_response_seconds: number;
  has_range: boolean;
}

export type HealthStatus = 'up' | 'degraded' | 'down';
export interface HealthCheck {
  provider: string;
  status: HealthStatus;
  latency_ms: number | null;
  http_code: number | null;
  error: string | null;
  checked_at: string;
}

export interface AdminDashboardData {
  kpi: KpiSnapshot;
  wordsMonthly: WordsMonthly[];
  newSubsMonthly: NewSubsMonthly[];
  planDistribution: PlanDistribution[];
  platformSubs: PlatformSubs[];
  firstSubType: FirstSubType[];
  customerSource: CustomerSource[];
  uninstalls: Uninstalls[];
  newSubscribers: NewSubscriber[];
  servers: ServerRow[];
}

// ---------- Mock fallbacks (mirror the original dashboard mock) ----------

const MOCK: AdminDashboardData = {
  kpi: {
    total_customers: 1247, inactive_customers: 355, total_uninstalls: 89,
    active_customers: 892, total_bubble_clicks: 45230, avg_response_seconds: 1.2,
    total_customers_change: 12.5, inactive_customers_change: 3.2, total_uninstalls_change: 8.1,
    active_customers_change: 15.3, total_bubble_clicks_change: 22.7, avg_response_seconds_change: 5.4,
  },
  wordsMonthly: [
    165000,173000,190000,197000,208000,223000,235000,220000,252000,271000,287000,308000,
  ].map((words, i) => ({ year: new Date().getFullYear(), month: i + 1, words })),
  newSubsMonthly: [
    [35,28],[42,31],[38,35],[50,40],[55,43],[48,46],[60,50],[52,47],[65,55],[70,58],[68,62],[75,65],
  ].flatMap(([z, s], i) => [
    { year: new Date().getFullYear(), month: i + 1, platform: 'zid' as Platform, count: z },
    { year: new Date().getFullYear(), month: i + 1, platform: 'salla' as Platform, count: s },
  ]),
  planDistribution: [
    { platform: null, plan: 'economy', subscribers: 312 },
    { platform: null, plan: 'basic', subscribers: 285 },
    { platform: null, plan: 'professional', subscribers: 198 },
    { platform: null, plan: 'business', subscribers: 97 },
    { platform: 'zid', plan: 'economy', subscribers: 185 },
    { platform: 'zid', plan: 'basic', subscribers: 165 },
    { platform: 'zid', plan: 'professional', subscribers: 112 },
    { platform: 'zid', plan: 'business', subscribers: 58 },
    { platform: 'salla', plan: 'economy', subscribers: 127 },
    { platform: 'salla', plan: 'basic', subscribers: 120 },
    { platform: 'salla', plan: 'professional', subscribers: 86 },
    { platform: 'salla', plan: 'business', subscribers: 39 },
  ],
  platformSubs: [
    { status: 'active', platform: 'zid', count: 520 }, { status: 'active', platform: 'salla', count: 372 },
    { status: 'inactive', platform: 'zid', count: 180 }, { status: 'inactive', platform: 'salla', count: 175 },
    { status: 'cancelled', platform: 'zid', count: 45 }, { status: 'cancelled', platform: 'salla', count: 44 },
  ],
  firstSubType: [
    { plan: 'trial', count: 580 }, { plan: 'economy', count: 210 }, { plan: 'basic', count: 185 },
    { plan: 'professional', count: 165 }, { plan: 'business', count: 107 },
  ],
  customerSource: [{ platform: 'zid', count: 745 }, { platform: 'salla', count: 502 }],
  uninstalls: [{ platform: 'zid', count: 42 }, { platform: 'salla', count: 47 }],
  newSubscribers: [
    { store_name: 'Elegant Store', platform: 'zid',   subscribed_on: '2026-04-15', total_tokens: 50000,  used_tokens: 12000, logo_initials: 'ES' },
    { store_name: 'Fashion Hub',   platform: 'salla', subscribed_on: '2026-04-14', total_tokens: 100000, used_tokens: 5000,  logo_initials: 'FH' },
    { store_name: 'Tech Galaxy',   platform: 'zid',   subscribed_on: '2026-04-13', total_tokens: 50000,  used_tokens: 31000, logo_initials: 'TG' },
    { store_name: 'Home Decor',    platform: 'salla', subscribed_on: '2026-04-12', total_tokens: 200000, used_tokens: 89000, logo_initials: 'HD' },
    { store_name: 'Sweet Treats',  platform: 'zid',   subscribed_on: '2026-04-11', total_tokens: 50000,  used_tokens: 2000,  logo_initials: 'ST' },
    { store_name: 'Auto Parts',    platform: 'salla', subscribed_on: '2026-04-10', total_tokens: 100000, used_tokens: 67000, logo_initials: 'AP' },
    { store_name: 'Book World',    platform: 'zid',   subscribed_on: '2026-04-09', total_tokens: 50000,  used_tokens: 44000, logo_initials: 'BW' },
  ],
  servers: [
    { name: 'Supabase',  status: 'connected',    usage_percent: 72, color: '#22c55e', display_order: 1 },
    { name: 'Hostinger', status: 'connected',    usage_percent: 45, color: '#043CC8', display_order: 2 },
    { name: 'Resend',    status: 'disconnected', usage_percent: 38, color: '#a855f7', display_order: 3 },
    { name: 'OpenAI',    status: 'connected',    usage_percent: 85, color: '#ff4466', display_order: 4 },
  ],
};

export const ADMIN_DASHBOARD_MOCK = MOCK;

function pick<T>(rows: T[] | null | undefined, fallback: T[]): T[] {
  return rows && rows.length > 0 ? rows : fallback;
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  try {
    const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [
      kpiRes, wordsRes, subsMonthRes, planRes, platSubsRes,
      firstRes, sourceRes, uninstRes, zidSubsRes, sallaSubsRes, serversRes,
    ] = await Promise.all([
      supabase.from('admin_dash_kpi_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1),
      supabase.from('admin_dash_words_monthly').select('*').order('month'),
      (supabase.rpc as any)('admin_new_subs_monthly', { _year: new Date().getFullYear() }),
      supabase.from('admin_dash_plan_distribution').select('*'),
      (supabase.rpc as any)('admin_platform_subs'),
      (supabase.rpc as any)('admin_first_sub_type'),
      supabase.from('admin_dash_customer_source').select('*'),
      (supabase.rpc as any)('admin_uninstalls_compare'),
      supabase.from('zid_connections').select('tenant_id, store_name, created_at').gte('created_at', weekAgoIso).order('created_at', { ascending: false }),
      supabase.from('salla_connections').select('tenant_id, store_name, created_at').gte('created_at', weekAgoIso).order('created_at', { ascending: false }),
      supabase.from('admin_dash_servers').select('*').order('display_order'),
    ]);

    // Build live "New Subscribers" list from real zid/salla connections (last 7 days).
    type ConnRow = { tenant_id: string; store_name: string | null; created_at: string };
    const zidRows = ((zidSubsRes.data ?? []) as ConnRow[]).map(r => ({ ...r, platform: 'zid' as Platform }));
    const sallaRows = ((sallaSubsRes.data ?? []) as ConnRow[]).map(r => ({ ...r, platform: 'salla' as Platform }));
    const allRows = [...zidRows, ...sallaRows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const tenantIds = Array.from(new Set(allRows.map(r => r.tenant_id).filter(Boolean)));
    let plansMap = new Map<string, { used: number; quota: number }>();
    if (tenantIds.length > 0) {
      const { data: plansRows } = await supabase
        .from('settings_plans')
        .select('tenant_id, monthly_word_quota, monthly_words_used')
        .in('tenant_id', tenantIds);
      (plansRows ?? []).forEach((p: any) => {
        plansMap.set(p.tenant_id, { used: p.monthly_words_used ?? 0, quota: p.monthly_word_quota ?? 0 });
      });
    }
    const initials = (name: string): string => {
      const parts = (name || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return '—';
      const first = parts[0]?.[0] ?? '';
      const second = parts[1]?.[0] ?? '';
      return (first + second).toUpperCase() || '—';
    };
    const liveNewSubscribers: NewSubscriber[] = allRows.map(r => {
      const p = plansMap.get(r.tenant_id) ?? { used: 0, quota: 0 };
      const name = r.store_name || (r.platform === 'zid' ? 'Zid Store' : 'Salla Store');
      return {
        store_name: name,
        platform: r.platform,
        subscribed_on: r.created_at.slice(0, 10),
        total_tokens: p.quota,
        used_tokens: p.used,
        logo_initials: initials(name),
      };
    });

    // --- Live: Customer Source (distinct tenants per platform) ---
    const zidTenantSet = new Set<string>();
    const sallaTenantSet = new Set<string>();
    {
      const [{ data: zAll }, { data: sAll }] = await Promise.all([
        supabase.from('zid_connections').select('tenant_id'),
        supabase.from('salla_connections').select('tenant_id'),
      ]);
      (zAll ?? []).forEach((r: any) => r.tenant_id && zidTenantSet.add(r.tenant_id));
      (sAll ?? []).forEach((r: any) => r.tenant_id && sallaTenantSet.add(r.tenant_id));
    }
    const liveCustomerSource: CustomerSource[] = [
      { platform: 'zid',   count: zidTenantSet.size },
      { platform: 'salla', count: sallaTenantSet.size },
    ];

    // --- Live: Plan Distribution per platform (settings_workspace.platform + plan) ---
    // Tenants currently store plan='free'; tiers (economy/basic/professional/business)
    // will populate as you add them. Unknown plans collapse to 0 per tier (intentional).
    const liveplanDist: PlanDistribution[] = [];
    {
      const { data: wsRows } = await supabase
        .from('settings_workspace')
        .select('platform, plan');
      const counts = new Map<string, number>(); // key = `${platform}|${plan}`
      (wsRows ?? []).forEach((r: any) => {
        const pf = r.platform as string | null;
        const pl = r.plan as string | null;
        if (!pf || !pl) return;
        if (pf !== 'zid' && pf !== 'salla') return;
        const key = `${pf}|${pl}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      counts.forEach((subscribers, key) => {
        const [platform, plan] = key.split('|');
        liveplanDist.push({ platform: platform as Platform, plan: plan as PlanTier, subscribers });
      });
    }

    return {
      kpi: (kpiRes.data && kpiRes.data[0]) ? (kpiRes.data[0] as unknown as KpiSnapshot) : MOCK.kpi,
      wordsMonthly: pick(wordsRes.data as WordsMonthly[] | null, MOCK.wordsMonthly),
      newSubsMonthly: (() => {
        const rows = (subsMonthRes.data as Array<{ month: number; platform: string; count: number }> | null) ?? [];
        if (rows.length === 0) return [];
        const year = new Date().getFullYear();
        return rows.map(r => ({
          year,
          month: r.month,
          platform: r.platform as Platform,
          count: r.count,
        }));
      })(),
      // Real per-platform plan counts from settings_workspace; no mock fallback.
      planDistribution: liveplanDist,
      platformSubs: ((platSubsRes.data as PlatformSubs[] | null) ?? []),
      firstSubType: ((firstRes.data as FirstSubType[] | null) ?? []),
      // Real distinct-tenant counts per platform; no mock fallback.
      customerSource: liveCustomerSource,
      uninstalls: ((uninstRes.data as Uninstalls[] | null) ?? []),
      // Real new Zid/Salla subscribers in the last 7 days; empty array if none.
      newSubscribers: liveNewSubscribers,
      servers: pick(serversRes.data as ServerRow[] | null, MOCK.servers),
    };
  } catch (err) {
    console.warn('[adminDashboard] Falling back to mock data:', err);
    return MOCK;
  }
}

/** Live KPI numbers. `from`/`to` null => all time. */
export async function fetchAdminKpis(
  from: string | null,
  to: string | null,
): Promise<AdminKpis | null> {
  try {
    const { data, error } = await supabase.rpc('admin_kpis', { _from: from, _to: to });
    if (error) throw error;
    return data as unknown as AdminKpis;
  } catch (err) {
    console.warn('[adminDashboard] fetchAdminKpis failed:', err);
    return null;
  }
}

/** Latest health check per provider. */
export async function fetchServerHealth(): Promise<HealthCheck[]> {
  try {
    const { data, error } = await supabase
      .from('admin_health_checks')
      .select('provider,status,latency_ms,http_code,error,checked_at')
      .order('checked_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const latest = new Map<string, HealthCheck>();
    for (const row of (data ?? []) as HealthCheck[]) {
      if (!latest.has(row.provider)) latest.set(row.provider, row);
    }
    return Array.from(latest.values());
  } catch (err) {
    console.warn('[adminDashboard] fetchServerHealth failed:', err);
    return [];
  }
}

/**
 * Live Supabase DB size vs Pro-plan included disk (8 GB).
 * Returns null on error so the UI can fall back to the seeded value.
 */
export async function fetchSupabaseUsage(): Promise<{ bytes: number; included_bytes: number; percent: number } | null> {
  try {
    const { data, error } = await (supabase.rpc as any)('admin_db_usage');
    if (error) throw error;
    if (!data) return null;
    return {
      bytes: Number((data as any).bytes ?? 0),
      included_bytes: Number((data as any).included_bytes ?? 8 * 1024 ** 3),
      percent: Number((data as any).percent ?? 0),
    };
  } catch (err) {
    console.warn('[adminDashboard] fetchSupabaseUsage failed:', err);
    return null;
  }
}

// --- Live server-usage bars (Supabase + Resend + OpenAI) ---
export interface AdminServerUsage {
  supabase: { bytes: number; included_bytes: number; percent: number } | null;
  resend:   { sent: number; cap: number; percent: number; ok: boolean } | null;
  openai:   { budget_words: number; used_tokens: number; used_words: number; percent: number } | null;
  hostinger: null;
}

export async function fetchAdminServerUsage(): Promise<AdminServerUsage | null> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-server-usage', { method: 'GET' });
    if (error) throw error;
    return data as AdminServerUsage;
  } catch (err) {
    console.warn('[adminDashboard] fetchAdminServerUsage failed:', err);
    return null;
  }
}

export async function setOpenAiWordBudget(words: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('admin_set_openai_word_budget' as any, { _words: words });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[adminDashboard] setOpenAiWordBudget failed:', err);
    return false;
  }
}