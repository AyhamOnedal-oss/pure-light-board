import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../context/AppContext';
import {
  EMPTY_METRICS,
  fetchDashboardMetrics,
  fetchTopSubjectsByCategory,
  fetchRecentAiFeedback,
  type TopSubject,
  type RecentAiFeedback,
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
export function useDashboardMetrics(range?: DateRange, frozen: boolean = false, snapshot?: any | null, frozenAt?: string | null) {
  const { tenantId } = useApp();
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [topSubjects, setTopSubjects] = useState<Record<string, TopSubject[]>>({
    complaint: [], inquiry: [], request: [], suggestion: [], other: [],
  });
  const [recentFeedback, setRecentFeedback] = useState<RecentAiFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef<number | null>(null);
  const fromKey = range?.from.getTime();
  const toKey = range?.to.getTime();

  useEffect(() => {
    // Frozen mode (disabled member): use the snapshot captured at disable time.
    // No fetches, no realtime — pure static data.
    if (frozen) {
      if (snapshot && typeof snapshot === 'object') {
        setMetrics((snapshot.metrics as DashboardMetrics) ?? EMPTY_METRICS);
        setTopSubjects(snapshot.topSubjects ?? { complaint: [], inquiry: [], request: [], suggestion: [], other: [] });
        setRecentFeedback(snapshot.recentFeedback ?? []);
        setLoading(false);
        return;
      }
      if (tenantId && frozenAt) {
        let cancelled = false;
        setLoading(true);
        const to = new Date(frozenAt);
        const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        const frozenRange = { from, to };
        void Promise.all([
          fetchDashboardMetrics(tenantId, frozenRange),
          fetchTopSubjectsByCategory(tenantId, frozenRange),
          fetchRecentAiFeedback(tenantId, frozenRange),
        ]).then(([m, subs, fb]) => {
          if (cancelled) return;
          setMetrics(m);
          setTopSubjects(subs);
          setRecentFeedback(fb);
          setLoading(false);
        });
        return () => { cancelled = true; };
      }
      setMetrics(EMPTY_METRICS);
      setTopSubjects({ complaint: [], inquiry: [], request: [], suggestion: [], other: [] });
      setRecentFeedback([]);
      setLoading(false);
      return;
    }

    if (!tenantId) {
      setMetrics(EMPTY_METRICS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const [m, subs, fb] = await Promise.all([
        fetchDashboardMetrics(tenantId, range),
        fetchTopSubjectsByCategory(tenantId, range),
        fetchRecentAiFeedback(tenantId, range),
      ]);
      if (!cancelled) {
        setMetrics(m);
        setTopSubjects(subs);
        setRecentFeedback(fb);
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
  }, [tenantId, fromKey, toKey, frozen, snapshot, frozenAt]);

  return { metrics, topSubjects, recentFeedback, loading };
}