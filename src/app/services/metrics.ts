/**
 * Live merchant dashboard metrics.
 *
 * Every function reads directly from Supabase (RLS scopes results to the
 * authenticated tenant). No edge functions, no n8n. Combine with
 * `useDashboardMetrics` for realtime updates.
 */
import { supabase } from '../../integrations/supabase/client';

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

export async function fetchDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
  if (!tenantId) return EMPTY_METRICS;

  const [
    conversations,
    messagesIn,
    messagesOut,
    widgetClicks,
    ticketsTotal,
    ticketsOpen,
    ticketsClosed,
    wordsRows,
    convRows,
    msgRows,
    csatRows,
  ] = await Promise.all([
    count('conversations_main', (q) => q.eq('tenant_id', tenantId)),
    count('conversations_messages', (q) => q.eq('tenant_id', tenantId).eq('sender', 'customer')),
    count('conversations_messages', (q) => q.eq('tenant_id', tenantId).in('sender', ['ai', 'agent'])),
    count('widget_events', (q) => q.eq('tenant_id', tenantId).eq('type', 'widget_open')),
    count('tickets_main', (q) => q.eq('tenant_id', tenantId)),
    count('tickets_main', (q) => q.eq('tenant_id', tenantId).in('status', ['open', 'in_progress', 'pending'])),
    count('tickets_main', (q) => q.eq('tenant_id', tenantId).in('status', ['resolved', 'closed'])),
    supabase
      .from('conversations_messages')
      .select('word_count')
      .eq('tenant_id', tenantId)
      .in('sender', ['ai', 'agent']),
    supabase
      .from('conversations_main')
      .select('id, status, category, csat_rating')
      .eq('tenant_id', tenantId)
      .limit(2000),
    supabase
      .from('conversations_messages')
      .select('conversation_id, sender, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase
      .from('conversations_main')
      .select('csat_rating')
      .eq('tenant_id', tenantId)
      .not('csat_rating', 'is', null),
  ]);

  const wordsUsed = (wordsRows.data ?? []).reduce(
    (sum, r: any) => sum + (r.word_count ?? 0),
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
  };
}