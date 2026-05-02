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
  // 1. Try real tenants
  try {
    const { data: tenants, error } = await supabase
      .from('settings_workspace')
      .select('id,name,platform,status,plan,domain')
      .order('created_at', { ascending: false });
    if (!error && tenants && tenants.length > 0) {
      const real: AdminCustomerRow[] = tenants.map((t: any) => {
        const planRaw = (t.plan || 'free').toString();
        const planLabels: Record<string, { en: string; ar: string }> = {
          free: { en: 'Trial', ar: 'تجريبي' },
          economy: { en: 'Economy', ar: 'اقتصادي' },
          basic: { en: 'Basic', ar: 'أساسي' },
          professional: { en: 'Professional', ar: 'احترافي' },
          business: { en: 'Business', ar: 'أعمال' },
        };
        const labels = planLabels[planRaw.toLowerCase()] || { en: planRaw, ar: planRaw };
        return {
          id: t.id,
          name: t.name || 'Unnamed Workspace',
          nameAr: t.name || 'مساحة عمل',
          email: t.domain || '—',
          phone: '',
          platform: platformFromTenant(t.platform),
          plan: labels.en,
          planAr: labels.ar,
          usagePercent: 0,
          words: 0,
          totalWords: 0,
          status: statusFromTenant(t.status),
          logo: initials(t.name || 'CU'),
        };
      });
      return real;
    }
  } catch { /* fall through */ }

  // 2. Try DB-seeded mock rows
  try {
    const { data, error } = await supabase
      .from('admin_customers_seed')
      .select('id,store_name,store_name_ar,email,phone,platform,plan,plan_ar,usage_percent,words,total_words,status,logo_initials')
      .order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      return data.map((r: any) => ({
        id: r.id,
        name: r.store_name,
        nameAr: r.store_name_ar,
        email: r.email,
        phone: r.phone || '',
        platform: r.platform as 'Zid' | 'Salla',
        plan: r.plan,
        planAr: r.plan_ar,
        usagePercent: r.usage_percent,
        words: r.words,
        totalWords: r.total_words,
        status: r.status as AdminCustomerRow['status'],
        logo: r.logo_initials,
      }));
    }
  } catch { /* fall through */ }

  return MOCK_CUSTOMERS;
}