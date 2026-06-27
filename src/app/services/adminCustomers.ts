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

export const MOCK_CUSTOMERS: AdminCustomerRow[] = [
  { id: 'mock-1', name: 'Elegant Store', nameAr: 'متجر أنيق', email: 'info@elegant.sa', phone: '+966501234567', platform: 'Zid', plan: 'Professional', planAr: 'احترافي', usagePercent: 72, words: 46800, totalWords: 65000, status: 'active', logo: 'ES' },
  { id: 'mock-2', name: 'Fashion Hub', nameAr: 'مركز الموضة', email: 'hello@fashion.sa', phone: '+966507654321', platform: 'Salla', plan: 'Basic', planAr: 'أساسي', usagePercent: 45, words: 14400, totalWords: 32000, status: 'active', logo: 'FH' },
  { id: 'mock-3', name: 'Tech Galaxy', nameAr: 'مجرة التقنية', email: 'support@tech.sa', phone: '+966509876543', platform: 'Zid', plan: 'Business', planAr: 'أعمال', usagePercent: 88, words: 105600, totalWords: 120000, status: 'active', logo: 'TG' },
  { id: 'mock-4', name: 'Home Decor', nameAr: 'ديكور المنزل', email: 'info@homedecor.sa', phone: '+966502345678', platform: 'Salla', plan: 'Economy', planAr: 'اقتصادي', usagePercent: 30, words: 4500, totalWords: 15000, status: 'active', logo: 'HD' },
  { id: 'mock-5', name: 'Sweet Treats', nameAr: 'حلويات لذيذة', email: 'order@sweet.sa', phone: '+966503456789', platform: 'Zid', plan: 'Professional', planAr: 'احترافي', usagePercent: 0, words: 0, totalWords: 65000, status: 'inactive', logo: 'ST' },
  { id: 'mock-6', name: 'Auto Parts', nameAr: 'قطع غيار', email: 'sales@auto.sa', phone: '+966504567890', platform: 'Salla', plan: 'Basic', planAr: 'أساسي', usagePercent: 15, words: 4800, totalWords: 32000, status: 'cancelled', logo: 'AP' },
  { id: 'mock-7', name: 'Book World', nameAr: 'عالم الكتب', email: 'contact@book.sa', phone: '+966505678901', platform: 'Zid', plan: 'Economy', planAr: 'اقتصادي', usagePercent: 92, words: 13800, totalWords: 15000, status: 'active', logo: 'BW' },
  { id: 'mock-8', name: 'Pet Care', nameAr: 'عناية الحيوانات', email: 'info@petcare.sa', phone: '+966506789012', platform: 'Salla', plan: 'Business', planAr: 'أعمال', usagePercent: 55, words: 66000, totalWords: 120000, status: 'active', logo: 'PC' },
];

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'CU';
}

function platformFromTenant(platform: string | null | undefined): 'Zid' | 'Salla' {
  const p = (platform || '').toLowerCase();
  if (p === 'salla') return 'Salla';
  return 'Zid';
}

function statusFromTenant(status: string | null | undefined): AdminCustomerRow['status'] {
  const s = (status || '').toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'inactive' || s === 'expired' || s === 'paused') return 'inactive';
  return 'active';
}

/**
 * Real customers = tenants in `settings_workspace`.
 * Falls back to seeded mock rows from `admin_customers_seed`, then to
 * the in-memory MOCK_CUSTOMERS so the UI always has something to show.
 */
export async function fetchAdminCustomers(): Promise<AdminCustomerRow[]> {
  // 1. Real tenants enriched with plan + connection + usage
  try {
    const [{ data: tenants }, { data: plans }, { data: zid }, { data: salla }, { data: members }] = await Promise.all([
      supabase.from('settings_workspace').select('id,name,platform,status,plan,domain').order('created_at', { ascending: false }),
      supabase.from('settings_plans').select('tenant_id,monthly_word_quota,monthly_words_used'),
      supabase.from('zid_connections').select('tenant_id,store_email,store_name,is_active'),
      supabase.from('salla_connections').select('tenant_id,store_email,store_name,is_active'),
      supabase.from('auth_tenant_members').select('tenant_id'),
    ]);

    if (tenants && tenants.length > 0) {
      // Only keep tenants that have at least one real auth user linked.
      const memberTenantIds = new Set<string>((members || []).map((m: any) => m.tenant_id));
      const realTenants = tenants.filter((t: any) => memberTenantIds.has(t.id));
      if (realTenants.length === 0) return [];

      const planMap = new Map<string, any>();
      (plans || []).forEach((p: any) => planMap.set(p.tenant_id, p));
      const zidMap = new Map<string, any>();
      (zid || []).forEach((c: any) => zidMap.set(c.tenant_id, c));
      const sallaMap = new Map<string, any>();
      (salla || []).forEach((c: any) => sallaMap.set(c.tenant_id, c));

      const planLabels: Record<string, { en: string; ar: string }> = {
        free: { en: 'Trial', ar: 'تجريبي' },
        trial: { en: 'Trial', ar: 'تجريبي' },
        economy: { en: 'Economy', ar: 'اقتصادي' },
        basic: { en: 'Basic', ar: 'أساسي' },
        professional: { en: 'Professional', ar: 'احترافي' },
        business: { en: 'Business', ar: 'أعمال' },
        pro: { en: 'Pro', ar: 'احترافي' },
      };

      const real: AdminCustomerRow[] = realTenants.map((t: any) => {
        const z = zidMap.get(t.id);
        const s = sallaMap.get(t.id);
        const conn = s || z;
        let platform: 'Zid' | 'Salla' = platformFromTenant(t.platform);
        if (s) platform = 'Salla'; else if (z) platform = 'Zid';

        const planRaw = (t.plan || 'free').toString().toLowerCase();
        const labels = planLabels[planRaw] || { en: t.plan || 'Trial', ar: t.plan || 'تجريبي' };

        const p = planMap.get(t.id);
        const words = Number(p?.monthly_words_used || 0);
        const totalWords = Number(p?.monthly_word_quota || 0);
        const usagePercent = totalWords > 0 ? Math.min(100, Math.round((words / totalWords) * 100)) : 0;

        let status: AdminCustomerRow['status'] = statusFromTenant(t.status);
        if ((t.status || '').toLowerCase() === 'cancelled') status = 'cancelled';
        else if (z?.is_active || s?.is_active) status = 'active';

        const displayName = conn?.store_name || t.name || 'Unnamed Workspace';
        const email = conn?.store_email || t.domain || '—';

        return {
          id: t.id,
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
      });
      return real;
    }
  } catch { /* fall through */ }

  return [];
}