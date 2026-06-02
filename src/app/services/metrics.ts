/**
 * Live merchant dashboard metrics.
 *
 * Every function reads directly from Supabase (RLS scopes results to the
 * authenticated tenant). No edge functions, no n8n. Combine with
 * `useDashboardMetrics` for realtime updates.
 */
import { supabase } from '../../integrations/supabase/client';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DashboardMetrics {
  conversations: number;
  messagesIn: number;
  messagesOut: number;
  wordsUsed: number;
  widgetClicks: number;
  avgResponseSeconds: number;
  ticketsTotal: number;
  ticketsOpen: number;
  ticketsClosed: number;
  csat: { 1: number; 2: number; 3: number; 4: number; 5: number; total: number; avg: number };
  completionRate: number; // 0..1
  classification: Record<string, number>;
  feedback: { positive: number; negative: number; total: number };
  /**
   * Growth % per KPI comparing the last 7 days against the previous 7 days.
   * Positive number = up, negative = down, null = no prior data to compare.
   */
  growth: {
    conversations: number | null;
    completionRate: number | null;
    ticketsTotal: number | null;
    wordsUsed: number | null;
    widgetClicks: number | null;
    avgResponseSeconds: number | null;
    messages: number | null;
  };
}

export const EMPTY_METRICS: DashboardMetrics = {
  conversations: 0,
  messagesIn: 0,
  messagesOut: 0,
  wordsUsed: 0,
  widgetClicks: 0,
  avgResponseSeconds: 0,
  ticketsTotal: 0,
  ticketsOpen: 0,
  ticketsClosed: 0,
  csat: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0, avg: 0 },
  completionRate: 0,
  classification: {},
  feedback: { positive: 0, negative: 0, total: 0 },
  growth: {
    conversations: null,
    completionRate: null,
    ticketsTotal: null,
    wordsUsed: null,
    widgetClicks: null,
    avgResponseSeconds: null,
    messages: null,
  },
};

async function count(table: string, build: (q: any) => any): Promise<number> {
  const { count, error } = await build(
    supabase.from(table).select('*', { count: 'exact', head: true }),
  );
  if (error) {
    console.warn(`metrics: count ${table} failed`, error);
    return 0;
  }
  return count ?? 0;
}

export async function fetchDashboardMetrics(
  tenantId: string,
  range?: DateRange,
): Promise<DashboardMetrics> {
  if (!tenantId) return EMPTY_METRICS;

  // Default = last 30 days.
  const day = 24 * 60 * 60 * 1000;
  const to = range?.to ?? new Date();
  const from = range?.from ?? new Date(to.getTime() - 30 * day);
  const windowMs = Math.max(day, to.getTime() - from.getTime());
  const prevFrom = new Date(from.getTime() - windowMs);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const prevFromIso = prevFrom.toISOString();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);
  const prevFromDate = prevFromIso.slice(0, 10);

  const inRange = (q: any, col = 'created_at') =>
    q.gte(col, fromIso).lte(col, toIso);
  const inTrend = (q: any, col = 'created_at') =>
    q.gte(col, prevFromIso).lte(col, toIso);

  const [
    conversations,
    messagesIn,
    messagesOut,
    ticketsTotal,
    ticketsOpen,
    ticketsClosed,
    wordsRows,
    convRows,
    msgRows,
    csatRows,
    usageRows,
    feedbackRows,
    usageTrendRows,
    ticketTrendRows,
  ] = await Promise.all([
    count('conversations_main', (q) => inRange(q.eq('tenant_id', tenantId).eq('is_test', false))),
    count('conversations_messages', (q) => inRange(q.eq('tenant_id', tenantId).eq('sender', 'customer'))),
    count('conversations_messages', (q) => inRange(q.eq('tenant_id', tenantId).in('sender', ['ai', 'agent']))),
    count('tickets_main', (q) => inRange(q.eq('tenant_id', tenantId))),
    count('tickets_main', (q) => inRange(q.eq('tenant_id', tenantId).in('status', ['open', 'in_progress', 'pending']))),
    count('tickets_main', (q) => inRange(q.eq('tenant_id', tenantId).in('status', ['resolved', 'closed']))),
    supabase
      .from('conversations_messages')
      .select('word_count')
      .eq('tenant_id', tenantId)
      .in('sender', ['ai', 'agent'])
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('conversations_main')
      .select('id, status, category, csat_rating')
      .eq('tenant_id', tenantId)
      .eq('is_test', false)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .limit(2000),
    supabase
      .from('conversations_messages')
      .select('conversation_id, sender, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase
      .from('conversations_main')
      .select('csat_rating')
      .eq('tenant_id', tenantId)
      .eq('is_test', false)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .not('csat_rating', 'is', null),
    supabase
      .from('dashboard_usage_daily')
      .select('clicks')
      .eq('tenant_id', tenantId)
      .gte('day', fromDate)
      .lte('day', toDate),
    supabase
      .from('conversations_messages')
      .select('feedback')
      .eq('tenant_id', tenantId)
      .in('sender', ['ai', 'agent'])
      .not('feedback', 'is', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('dashboard_usage_daily')
      .select('day, clicks, conversations_opened, conversations_resolved, messages_in, messages_out, ai_words_used, avg_response_seconds')
      .eq('tenant_id', tenantId)
      .gte('day', prevFromDate)
      .lte('day', toDate),
    supabase
      .from('tickets_main')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', prevFromIso)
      .lte('created_at', toIso),
  ]);

  const wordsUsed = (wordsRows.data ?? []).reduce(
    (sum, r: any) => sum + (r.word_count ?? 0),
    0,
  );

  const widgetClicks = (usageRows.data ?? []).reduce(
    (sum, r: any) => sum + (r.clicks ?? 0),
    0,
  );

  // Completion + classification from conversations_main
  let resolved = 0;
  const classification: Record<string, number> = {};
  for (const c of convRows.data ?? []) {
    if (c.status === 'resolved' || c.status === 'closed') resolved++;
    const cat = (c as any).category ?? null;
    if (cat) classification[cat] = (classification[cat] ?? 0) + 1;
  }
  const totalConv = (convRows.data ?? []).length;
  const completionRate = totalConv > 0 ? resolved / totalConv : 0;

  // Avg response time: per conversation, average gap between a customer
  // message and the next ai/agent message.
  const byConv: Record<string, Array<{ s: string; t: number }>> = {};
  for (const m of msgRows.data ?? []) {
    const k = (m as any).conversation_id as string;
    if (!byConv[k]) byConv[k] = [];
    byConv[k].push({
      s: (m as any).sender,
      t: new Date((m as any).created_at).getTime(),
    });
  }
  let totalDelta = 0;
  let pairs = 0;
  for (const arr of Object.values(byConv)) {
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i].s === 'customer' && (arr[i + 1].s === 'ai' || arr[i + 1].s === 'agent')) {
        const d = (arr[i + 1].t - arr[i].t) / 1000;
        if (d >= 0 && d < 60 * 60) {
          totalDelta += d;
          pairs++;
        }
      }
    }
  }
  const avgResponseSeconds = pairs > 0 ? totalDelta / pairs : 0;

  // CSAT distribution
  const csat = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0, avg: 0 } as DashboardMetrics['csat'];
  let sum = 0;
  for (const r of csatRows.data ?? []) {
    const v = (r as any).csat_rating as number;
    if (v >= 1 && v <= 5) {
      (csat as any)[v]++;
      csat.total++;
      sum += v;
    }
  }
  csat.avg = csat.total > 0 ? sum / csat.total : 0;

  // Feedback (thumbs up/down on AI messages)
  let positive = 0;
  let negative = 0;
  for (const r of feedbackRows.data ?? []) {
    const v = (r as any).feedback as string;
    if (v === 'positive') positive++;
    else if (v === 'negative') negative++;
  }
  const feedback = { positive, negative, total: positive + negative };

  // ---- Growth: last 7 days vs prior 7 days ----
  const pct = (cur: number, prev: number): number | null => {
    if (prev <= 0) return cur > 0 ? 100 : null;
    return ((cur - prev) / prev) * 100;
  };
  const sums = {
    cur: { opened: 0, resolved: 0, msgs: 0, words: 0, clicks: 0, respSum: 0, respDays: 0 },
    prev: { opened: 0, resolved: 0, msgs: 0, words: 0, clicks: 0, respSum: 0, respDays: 0 },
  };
  for (const r of usageTrendRows.data ?? []) {
    const d = (r as any).day as string;
    const bucket = d >= fromDate ? sums.cur : sums.prev;
    bucket.opened += (r as any).conversations_opened ?? 0;
    bucket.resolved += (r as any).conversations_resolved ?? 0;
    bucket.msgs += ((r as any).messages_in ?? 0) + ((r as any).messages_out ?? 0);
    bucket.words += (r as any).ai_words_used ?? 0;
    bucket.clicks += (r as any).clicks ?? 0;
    const rs = (r as any).avg_response_seconds ?? 0;
    if (rs > 0) {
      bucket.respSum += rs;
      bucket.respDays += 1;
    }
  }
  let curTickets = 0;
  let prevTickets = 0;
  for (const r of ticketTrendRows.data ?? []) {
    const t = (r as any).created_at as string;
    if (t >= fromIso) curTickets++;
    else prevTickets++;
  }
  const curRate = sums.cur.opened > 0 ? sums.cur.resolved / sums.cur.opened : 0;
  const prevRate = sums.prev.opened > 0 ? sums.prev.resolved / sums.prev.opened : 0;
  const curResp = sums.cur.respDays > 0 ? sums.cur.respSum / sums.cur.respDays : 0;
  const prevResp = sums.prev.respDays > 0 ? sums.prev.respSum / sums.prev.respDays : 0;
  // For response time, "down" (faster) is good — invert the sign so green = improvement.
  const respGrowthRaw = pct(curResp, prevResp);
  const respGrowth = respGrowthRaw == null ? null : -respGrowthRaw;

  const growth = {
    conversations: pct(sums.cur.opened, sums.prev.opened),
    completionRate:
      prevRate <= 0 ? (curRate > 0 ? 100 : null) : ((curRate - prevRate) / prevRate) * 100,
    ticketsTotal: pct(curTickets, prevTickets),
    wordsUsed: pct(sums.cur.words, sums.prev.words),
    widgetClicks: pct(sums.cur.clicks, sums.prev.clicks),
    avgResponseSeconds: respGrowth,
    messages: pct(sums.cur.msgs, sums.prev.msgs),
  };

  return {
    conversations,
    messagesIn,
    messagesOut,
    wordsUsed,
    widgetClicks,
    avgResponseSeconds,
    ticketsTotal,
    ticketsOpen,
    ticketsClosed,
    csat,
    completionRate,
    classification,
    feedback,
    growth,
  };
}