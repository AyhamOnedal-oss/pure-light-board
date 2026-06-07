import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../context/AppContext';
import {
  EMPTY_METRICS,
  fetchDashboardMetrics,
  fetchTopSubjectsByCategory,
  type TopSubject,
  type DashboardMetrics,
  type DateRange,
} from '../services/metrics';

/**
 * Live merchant dashboard metrics.
 *
 * - Fetches once on mount (and when tenant changes).
 * - Subscribes to Supabase Realtime for the four tables that drive every tile
 *   (conversations_main, conversations_messages, tickets_main, widget_events)
 *   and refetches the whole metric set, debounced, on any change.
 * - Returns the latest metrics + a loading flag.
 */
export function useDashboardMetrics(range?: DateRange) {
  const { tenantId } = useApp();
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [topSubjects, setTopSubjects] = useState<Record<string, TopSubject[]>>({
    complaint: [], inquiry: [], request: [], suggestion: [], other: [],
  });
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef<number | null>(null);
  const fromKey = range?.from.getTime();
  const toKey = range?.to.getTime();

  useEffect(() => {
    if (!tenantId) {
      setMetrics(EMPTY_METRICS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const [m, subs] = await Promise.all([
        fetchDashboardMetrics(tenantId, range),
        fetchTopSubjectsByCategory(tenantId, range),
      ]);
      if (!cancelled) {
        setMetrics(m);
        setTopSubjects(subs);
        setLoading(false);
      }
    };
    void load();

    const scheduleRefetch = () => {
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
      refetchTimer.current = window.setTimeout(() => {
        void load();
      }, 400);
    };

    const filter = `tenant_id=eq.${tenantId}`;
    const channel = supabase
      .channel(`dashboard-${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations_main', filter }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations_messages', filter }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets_main', filter }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'widget_events', filter }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_usage_daily', filter }, scheduleRefetch)
      .subscribe();

    return () => {
      cancelled = true;
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, fromKey, toKey]);

  return { metrics, topSubjects, loading };
}