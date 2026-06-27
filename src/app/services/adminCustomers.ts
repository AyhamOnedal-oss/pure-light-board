import { supabase } from '@/integrations/supabase/client';

export interface AdminCustomerRow {
  id: string;
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  platform: 'Zid' | 'Salla';
  plan: string;
  planAr: string;
  usagePercent: number;
  words: number;
  totalWords: number;
  status: 'active' | 'inactive' | 'cancelled';
  logo: string;
}

export const MOCK_CUSTOMERS: AdminCustomerRow[] = [];

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'CU';
}

const PLAN_LABELS: Record<string, { en: string; ar: string }> = {
  free: { en: 'Trial', ar: 'تجريبي' },
  trial: { en: 'Trial', ar: 'تجريبي' },
  economy: { en: 'Economy', ar: 'اقتصادي' },
  basic: { en: 'Basic', ar: 'أساسي' },
  professional: { en: 'Professional', ar: 'احترافي' },
  business: { en: 'Business', ar: 'أعمال' },
  pro: { en: 'Pro', ar: 'احترافي' },
};

/**
 * Real customers = stores that actually installed the app (zid_connections + salla_connections).
 * settings_workspace/settings_plans are used only as enrichment, never as the source of truth.
 */
export async function fetchAdminCustomers(): Promise<AdminCustomerRow[]> {
  try {
    const [{ data: zid }, { data: salla }, { data: workspaces }, { data: plans }] = await Promise.all([
      supabase
        .from('zid_connections')
        .select('tenant_id,store_name,store_email,is_active,created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('salla_connections')
        .select('tenant_id,store_name,store_email,is_active,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('settings_workspace').select('id,plan,status'),
      supabase.from('settings_plans').select('tenant_id,monthly_word_quota,monthly_words_used'),
    ]);

    const wsMap = new Map<string, any>();
    (workspaces || []).forEach((w: any) => wsMap.set(w.id, w));
    const planMap = new Map<string, any>();
    (plans || []).forEach((p: any) => planMap.set(p.tenant_id, p));

    const build = (
      conn: any,
      platform: 'Zid' | 'Salla',
    ): AdminCustomerRow => {
      const ws = wsMap.get(conn.tenant_id);
      const p = planMap.get(conn.tenant_id);
      const words = Number(p?.monthly_words_used || 0);
      const totalWords = Number(p?.monthly_word_quota || 0);
      const usagePercent = totalWords > 0 ? Math.min(100, Math.round((words / totalWords) * 100)) : 0;

      const planRaw = (ws?.plan || 'free').toString().toLowerCase();
      const labels = PLAN_LABELS[planRaw] || { en: ws?.plan || 'Trial', ar: ws?.plan || 'تجريبي' };

      const wsStatus = (ws?.status || '').toLowerCase();
      let status: AdminCustomerRow['status'];
      if (wsStatus === 'cancelled' || wsStatus === 'canceled') status = 'cancelled';
      else if (conn.is_active) status = 'active';
      else status = 'inactive';

      const displayName = conn.store_name || 'Unnamed Store';
      const email = conn.store_email || '—';

      return {
        id: conn.tenant_id,
        name: displayName,
        nameAr: displayName,
        email,
        phone: '',
        platform,
        plan: labels.en,
        planAr: labels.ar,
        usagePercent,
        words,
        totalWords,
        status,
        logo: initials(displayName),
      };
    };

    const rows: AdminCustomerRow[] = [
      ...(zid || []).map((c: any) => build(c, 'Zid')),
      ...(salla || []).map((c: any) => build(c, 'Salla')),
    ];
    return rows;
  } catch {
    return [];
  }
}