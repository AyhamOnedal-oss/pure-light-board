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

export interface TopSubject {
  id: string;
  subject: string;
  count: number;
  conversationId?: string;
  lastAt?: string;
}

export interface RecentAiFeedback {
  id: string;
  conversation_id: string;
  body: string;
  feedback: 'positive' | 'negative';
  created_at: string;
  conversation_code: string | null;
}

export async function fetchRecentAiFeedback(
  tenantId: string,
  range?: DateRange,
  limit = 20,
): Promise<RecentAiFeedback[]> {
  let q = supabase
    .from('conversations_messages')
    .select('id, conversation_id, body, feedback, created_at, conversation:conversations_main!messages_conversation_id_fkey(display_code)')
    .eq('tenant_id', tenantId)
    .in('sender', ['ai', 'agent'])
    .not('feedback', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (range) {
    q = q.gte('created_at', range.from.toISOString()).lte('created_at', range.to.toISOString());
  }
  const { data, error } = await q;
  if (error) {
    console.warn('metrics: recent feedback failed', error);
    return [];
  }
  return (data ?? [])
    .filter((r: any) => r.feedback === 'positive' || r.feedback === 'negative')
    .map((r: any) => ({
      id: String(r.id),
      conversation_id: String(r.conversation_id),
      body: String(r.body ?? ''),
      feedback: r.feedback as 'positive' | 'negative',
      created_at: String(r.created_at),
      conversation_code: r.conversation?.display_code ?? null,
    }));
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

/**
 * Fetches the top subjects (most frequent) grouped by category from
 * AI-analyzed closed conversations in the given window. Used by the
 * Dashboard "Most Frequent…" insight cards.
 *
 * Returns up to `limitPerCategory` items per bucket:
 *   complaint | inquiry | request | suggestion | other
 * Conversations with category=NULL fall into `other` (treated as
 * "Unknown" on the dashboard).
 */
export async function fetchTopSubjectsByCategory(
  tenantId: string,
  range?: DateRange,
  limitPerCategory = 8,
): Promise<Record<string, TopSubject[]>> {
  const buckets: Record<string, TopSubject[]> = {
    complaint: [], inquiry: [], request: [], suggestion: [], other: [],
  };
  if (!tenantId) return buckets;
  const day = 24 * 60 * 60 * 1000;
  const to = range?.to ?? new Date();
  const from = range?.from ?? new Date(to.getTime() - 30 * day);
  const { data, error } = await supabase
    .from('conversations_main')
    .select('id, category, subject, unanswered_question, last_message_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('is_test', false)
    .in('status', ['closed', 'resolved'])
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .limit(2000);
  if (error) {
    console.warn('metrics: top subjects fetch failed', error);
    return buckets;
  }
  // Normalize for grouping near-duplicates: lowercase, strip diacritics & trailing punctuation,
  // collapse whitespace. Keeps the most-recent original phrasing as the display string.
  const normalize = (s: string): string =>
    s
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic diacritics
      .replace(/[\s]+/g, ' ')
      .replace(/[؟?.!،,;:"'«»()\[\]]+$/g, '')
      .trim()
      .toLowerCase();

  type Agg = { display: string; count: number; conversationId: string; lastAt: string };
  const tallies: Record<string, Map<string, Agg>> = {
    complaint: new Map(), inquiry: new Map(), request: new Map(),
    suggestion: new Map(), other: new Map(),
  };
  for (const row of data ?? []) {
    const r = row as any;
    const cat = r.category as string | null;
    const unanswered = ((r.unanswered_question as string | null) ?? '').trim();
    // Unknown Questions card: every conversation with a real unanswered question
    // (set by the classifier only for genuine knowledge gaps) goes into `other`,
    // regardless of its main category. Other buckets keep the AI subject.
    const bucket = unanswered ? 'other' : (cat && tallies[cat] ? cat : 'other');
    const display = bucket === 'other'
      ? (unanswered || ((r.subject as string | null) ?? '').trim())
      : ((r.subject as string | null) ?? '').trim();
    if (!display) continue;
    // Extra safety: filter trivial strings from the Unknown bucket on read.
    if (bucket === 'other') {
      const stripped = display.replace(/[؟?.!،,;:"'«»()\[\]]+$/g, '').trim();
      if (stripped.length < 8 || stripped.split(/\s+/).length < 2) continue;
    }
    const key = normalize(display);
    if (!key) continue;
    const at = (r.last_message_at as string | null) ?? (r.created_at as string | null) ?? '';
    const m = tallies[bucket];
    const existing = m.get(key);
    if (existing) {
      existing.count += 1;
      if (at && at > existing.lastAt) {
        existing.lastAt = at;
        existing.display = display;
        existing.conversationId = r.id as string;
      }
    } else {
      m.set(key, { display, count: 1, conversationId: r.id as string, lastAt: at });
    }
  }
  for (const k of Object.keys(buckets)) {
    buckets[k] = Array.from(tallies[k].entries())
      .map(([key, agg], i) => ({
        id: `${k}-${i}-${key.slice(0, 24)}`,
        subject: agg.display,
        count: agg.count,
        conversationId: agg.conversationId,
        lastAt: agg.lastAt,
      }))
      .sort((a, b) => b.count - a.count || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
      .slice(0, limitPerCategory);
  }
  return buckets;
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

  // First try the security-definer RPC. This always returns the full
  // aggregated set, even for an invited employee whose RLS would block
  // the underlying tables (tickets/conversations). If it succeeds we
  // also fetch the (always-readable) usage trend rows for growth %.
  const rpc = await supabase.rpc('dashboard_metrics', {
    _tenant: tenantId,
    _from: fromIso,
    _to: toIso,
  });
  if (!rpc.error && rpc.data) {
    const m = rpc.data as any;
    const [{ data: trendRows }, { data: msgTimingRows }, completionRes] = await Promise.all([
      supabase
        .from('dashboard_usage_daily')
        .select('day, clicks, conversations_opened, conversations_resolved, messages_in, messages_out, ai_words_used, avg_response_seconds')
        .eq('tenant_id', tenantId)
        .gte('day', prevFromDate)
        .lte('day', toDate),
      supabase
        .from('conversations_messages')
        .select('conversation_id, sender, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', prevFromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .limit(5000),
      supabase
        .from('conversations_main')
        .select('completion_score')
        .eq('tenant_id', tenantId)
        .eq('is_test', false)
        .not('completion_score', 'is', null)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .limit(2000),
    ]);
    // Average per-conversation completion_score (0..100) → 0..1 for UI.
    let avgCompletion: number | null = null;
    if (!completionRes.error && completionRes.data && completionRes.data.length > 0) {
      const arr = completionRes.data as Array<{ completion_score: number | null }>;
      let s = 0, n = 0;
      for (const r of arr) {
        const v = Number(r.completion_score);
        if (Number.isFinite(v)) { s += v; n++; }
      }
      if (n > 0) avgCompletion = (s / n) / 100;
    }
    // Compute real avg response time from message timing (customer -> ai/agent gap)
    const computeAvgResp = (rows: any[], fromMs: number) => {
      const byConv: Record<string, Array<{ s: string; t: number }>> = {};
      for (const r of rows ?? []) {
        const t = new Date(r.created_at).getTime();
        if (t < fromMs) continue;
        const k = r.conversation_id as string;
        (byConv[k] ||= []).push({ s: r.sender, t });
      }
      let total = 0, pairs = 0;
      for (const arr of Object.values(byConv)) {
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i].s === 'customer' && (arr[i + 1].s === 'ai' || arr[i + 1].s === 'agent')) {
            const d = (arr[i + 1].t - arr[i].t) / 1000;
            if (d >= 0 && d < 3600) { total += d; pairs++; }
          }
        }
      }
      return pairs > 0 ? total / pairs : 0;
    };
    const curAvgResp = computeAvgResp(msgTimingRows ?? [], from.getTime());
    const prevAvgResp = computeAvgResp(
      (msgTimingRows ?? []).filter((r: any) => new Date(r.created_at).getTime() < from.getTime()),
      prevFrom.getTime(),
    );
    const pct = (cur: number, prev: number): number | null => {
      if (prev <= 0) return cur > 0 ? 100 : null;
      return ((cur - prev) / prev) * 100;
    };
    const sums = {
      cur: { opened: 0, resolved: 0, msgs: 0, words: 0, clicks: 0, respSum: 0, respDays: 0 },
      prev: { opened: 0, resolved: 0, msgs: 0, words: 0, clicks: 0, respSum: 0, respDays: 0 },
    };
    for (const r of trendRows ?? []) {
      const d = (r as any).day as string;
      const bucket = d >= fromDate ? sums.cur : sums.prev;
      bucket.opened += (r as any).conversations_opened ?? 0;
      bucket.resolved += (r as any).conversations_resolved ?? 0;
      bucket.msgs += ((r as any).messages_in ?? 0) + ((r as any).messages_out ?? 0);
      bucket.words += (r as any).ai_words_used ?? 0;
      bucket.clicks += (r as any).clicks ?? 0;
      const rs = (r as any).avg_response_seconds ?? 0;
      if (rs > 0) { bucket.respSum += rs; bucket.respDays += 1; }
    }
    const curRate = sums.cur.opened > 0 ? sums.cur.resolved / sums.cur.opened : 0;
    const prevRate = sums.prev.opened > 0 ? sums.prev.resolved / sums.prev.opened : 0;
    // Prefer real message-timing computation; fall back to the daily aggregate.
    const curResp = curAvgResp > 0 ? curAvgResp : (sums.cur.respDays > 0 ? sums.cur.respSum / sums.cur.respDays : 0);
    const prevResp = prevAvgResp > 0 ? prevAvgResp : (sums.prev.respDays > 0 ? sums.prev.respSum / sums.prev.respDays : 0);
    const respGrowthRaw = pct(curResp, prevResp);
    const respGrowth = respGrowthRaw == null ? null : -respGrowthRaw;
    // Tickets growth from RPC (needs separate trend query)
    const { data: ticketTrend } = await supabase
      .from('tickets_main')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', prevFromIso)
      .lte('created_at', toIso);
    let curTk = 0, prevTk = 0;
    for (const r of ticketTrend ?? []) {
      if ((r as any).created_at >= fromIso) curTk++; else prevTk++;
    }
    return {
      conversations: m.conversations ?? 0,
      messagesIn: m.messagesIn ?? 0,
      messagesOut: m.messagesOut ?? 0,
      wordsUsed: m.wordsUsed ?? 0,
      widgetClicks: m.widgetClicks ?? 0,
      avgResponseSeconds: curResp || 0,
      ticketsTotal: m.ticketsTotal ?? 0,
      ticketsOpen: m.ticketsOpen ?? 0,
      ticketsClosed: m.ticketsClosed ?? 0,
      csat: {
        1: m.csat?.['1'] ?? 0,
        2: m.csat?.['2'] ?? 0,
        3: m.csat?.['3'] ?? 0,
        4: m.csat?.['4'] ?? 0,
        5: m.csat?.['5'] ?? 0,
        total: m.csat?.total ?? 0,
        avg: Number(m.csat?.avg ?? 0),
      },
      completionRate: Number(m.completionRate ?? 0),
      classification: (m.classification ?? {}) as Record<string, number>,
      feedback: {
        positive: m.feedback?.positive ?? 0,
        negative: m.feedback?.negative ?? 0,
        total: m.feedback?.total ?? 0,
      },
      growth: {
        conversations: pct(sums.cur.opened, sums.prev.opened),
        completionRate:
          prevRate <= 0 ? (curRate > 0 ? 100 : null) : ((curRate - prevRate) / prevRate) * 100,
        ticketsTotal: pct(curTk, prevTk),
        wordsUsed: pct(sums.cur.words, sums.prev.words),
        widgetClicks: pct(sums.cur.clicks, sums.prev.clicks),
        avgResponseSeconds: respGrowth,
        messages: pct(sums.cur.msgs, sums.prev.msgs),
      },
    };
  }
  // Fallback below: legacy direct-query path (still works for owners/admins).

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
      .select('id, status, category, csat_rating, completion_score')
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
  let completionSum = 0;
  let completionCount = 0;
  for (const c of convRows.data ?? []) {
    if (c.status === 'resolved' || c.status === 'closed') resolved++;
    const cat = (c as any).category ?? null;
    if (cat) classification[cat] = (classification[cat] ?? 0) + 1;
    const cs = (c as any).completion_score;
    if (cs != null && Number.isFinite(Number(cs))) {
      completionSum += Number(cs);
      completionCount++;
    }
  }
  const totalConv = (convRows.data ?? []).length;
  // Average per-conversation completion_score (0..100). Stored as 0..1 for the UI.
  const completionRate = completionCount > 0 ? (completionSum / completionCount) / 100 : 0;

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