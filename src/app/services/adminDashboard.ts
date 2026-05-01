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
    const [
      kpiRes, wordsRes, subsMonthRes, planRes, platSubsRes,
      firstRes, sourceRes, uninstRes, newSubsRes, serversRes,
    ] = await Promise.all([
      supabase.from('admin_dash_kpi_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1),
      supabase.from('admin_dash_words_monthly').select('*').order('month'),
      supabase.from('admin_dash_new_subs_monthly').select('*').order('month'),
      supabase.from('admin_dash_plan_distribution').select('*'),
      supabase.from('admin_dash_platform_subs').select('*'),
      supabase.from('admin_dash_first_sub_type').select('*'),
      supabase.from('admin_dash_customer_source').select('*'),
      supabase.from('admin_dash_uninstalls').select('*'),
      supabase.from('admin_dash_new_subscribers').select('*').order('subscribed_on', { ascending: false }),
      supabase.from('admin_dash_servers').select('*').order('display_order'),
    ]);

    return {
      kpi: (kpiRes.data && kpiRes.data[0]) ? (kpiRes.data[0] as unknown as KpiSnapshot) : MOCK.kpi,
      wordsMonthly: pick(wordsRes.data as WordsMonthly[] | null, MOCK.wordsMonthly),
      newSubsMonthly: pick(subsMonthRes.data as NewSubsMonthly[] | null, MOCK.newSubsMonthly),
      planDistribution: pick(planRes.data as PlanDistribution[] | null, MOCK.planDistribution),
      platformSubs: pick(platSubsRes.data as PlatformSubs[] | null, MOCK.platformSubs),
      firstSubType: pick(firstRes.data as FirstSubType[] | null, MOCK.firstSubType),
      customerSource: pick(sourceRes.data as CustomerSource[] | null, MOCK.customerSource),
      uninstalls: pick(uninstRes.data as Uninstalls[] | null, MOCK.uninstalls),
      newSubscribers: pick(newSubsRes.data as NewSubscriber[] | null, MOCK.newSubscribers),
      servers: pick(serversRes.data as ServerRow[] | null, MOCK.servers),
    };
  } catch (err) {
    console.warn('[adminDashboard] Falling back to mock data:', err);
    return MOCK;
  }
}