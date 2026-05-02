import { supabase } from '@/integrations/supabase/client';

export interface ReportPlanRow {
  name: string;
  nameAr: string;
  price: number;
  subscribers: number;
  total: number;
}

export interface RevenueMonth {
  name: string;   // English short month
  nameAr: string;
  zid: number;
  salla: number;
}

export interface AdminReportsData {
  zidPlans: ReportPlanRow[];
  sallaPlans: ReportPlanRow[];
  revenueByMonth: RevenueMonth[];
}

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export const MOCK_REPORTS: AdminReportsData = {
  zidPlans: [
    { name: 'Trial', nameAr: 'تجريبي', price: 0, subscribers: 120, total: 0 },
    { name: 'Economy', nameAr: 'اقتصادي', price: 99, subscribers: 185, total: 18315 },
    { name: 'Basic', nameAr: 'أساسي', price: 199, subscribers: 165, total: 32835 },
    { name: 'Professional', nameAr: 'احترافي', price: 399, subscribers: 112, total: 44688 },
    { name: 'Business', nameAr: 'أعمال', price: 799, subscribers: 58, total: 46342 },
  ],
  sallaPlans: [
    { name: 'Trial', nameAr: 'تجريبي', price: 0, subscribers: 95, total: 0 },
    { name: 'Economy', nameAr: 'اقتصادي', price: 99, subscribers: 127, total: 12573 },
    { name: 'Basic', nameAr: 'أساسي', price: 199, subscribers: 120, total: 23880 },
    { name: 'Professional', nameAr: 'احترافي', price: 399, subscribers: 86, total: 34314 },
    { name: 'Business', nameAr: 'أعمال', price: 799, subscribers: 39, total: 31161 },
  ],
  revenueByMonth: MONTHS_EN.map((m, i) => ({
    name: m, nameAr: MONTHS_AR[i],
    zid: [28000,31000,35000,38000,42000,45000,48000,46000,50000,52000,55000,58000][i],
    salla: [22000,24000,27000,29000,32000,35000,37000,36000,39000,41000,43000,45000][i],
  })),
};

export async function fetchAdminReports(): Promise<AdminReportsData> {
  try {
    const [plansRes, revRes] = await Promise.all([
      supabase.from('admin_reports_plans')
        .select('platform,plan_name,plan_name_ar,price,subscribers,total,display_order')
        .order('display_order', { ascending: true }),
      supabase.from('admin_reports_revenue_monthly')
        .select('year,month,zid,salla')
        .order('year', { ascending: true })
        .order('month', { ascending: true }),
    ]);

    const data: AdminReportsData = {
      zidPlans: [],
      sallaPlans: [],
      revenueByMonth: [],
    };

    if (!plansRes.error && plansRes.data) {
      for (const r of plansRes.data as any[]) {
        const row: ReportPlanRow = {
          name: r.plan_name, nameAr: r.plan_name_ar,
          price: r.price, subscribers: r.subscribers, total: r.total,
        };
        if (r.platform === 'zid') data.zidPlans.push(row);
        else if (r.platform === 'salla') data.sallaPlans.push(row);
      }
    }
    if (!revRes.error && revRes.data) {
      for (const r of revRes.data as any[]) {
        const idx = Math.min(11, Math.max(0, (r.month as number) - 1));
        data.revenueByMonth.push({
          name: MONTHS_EN[idx], nameAr: MONTHS_AR[idx],
          zid: r.zid, salla: r.salla,
        });
      }
    }

    if (data.zidPlans.length === 0) data.zidPlans = MOCK_REPORTS.zidPlans;
    if (data.sallaPlans.length === 0) data.sallaPlans = MOCK_REPORTS.sallaPlans;
    if (data.revenueByMonth.length === 0) data.revenueByMonth = MOCK_REPORTS.revenueByMonth;
    return data;
  } catch {
    return MOCK_REPORTS;
  }
}