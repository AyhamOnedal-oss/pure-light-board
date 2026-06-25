// Canonical admin-panel permission keys + tree.
// Mirrors PERMISSION_TREE in AdminTeam.tsx so both UI and access checks agree.

export type AdminPermKey =
  | 'admin_dashboard'
  | 'team_management'
  | 'lists_management'
  | 'customer_management'
  | 'pipeline'
  | 'customers'
  | 'reports' | 'reports_all' | 'reports_zid' | 'reports_salla'
  | 'billing' | 'billing_subscriptions' | 'billing_servers' | 'billing_other'
  | 'ad_automation' | 'ad_automation_add' | 'ad_automation_delete' | 'ad_automation_sync';

export type AdminPermNode = {
  key: AdminPermKey;
  en: string;
  ar: string;
  children?: AdminPermNode[];
};

export const ADMIN_PERMISSION_TREE: AdminPermNode[] = [
  { key: 'admin_dashboard', en: 'Admin Dashboard', ar: 'لوحة تحكم الأدمين' },
  { key: 'team_management', en: 'Team Management', ar: 'إدارة الفريق' },
  {
    key: 'ad_automation', en: 'Ad Automation', ar: 'أتمتة الإعلانات',
    children: [
      { key: 'ad_automation_add',    en: 'Add Automation',    ar: 'إضافة أتمتة' },
      { key: 'ad_automation_delete', en: 'Delete Automation', ar: 'حذف الأتمتة' },
      { key: 'ad_automation_sync',   en: 'Sync Automation',   ar: 'مزامنة الأتمتة' },
    ],
  },
  {
    key: 'lists_management', en: 'Lists Management', ar: 'إدارة القوائم',
    children: [
      {
        key: 'customer_management', en: 'Customer Management', ar: 'إدارة العملاء',
        children: [
          { key: 'pipeline',  en: 'Customer Pipeline', ar: 'سير العميل' },
          { key: 'customers', en: 'Customers List',    ar: 'قائمة العملاء' },
        ],
      },
      {
        key: 'reports', en: 'Reports', ar: 'التقارير',
        children: [
          { key: 'reports_all',   en: 'All Reports', ar: 'الكل' },
          { key: 'reports_zid',   en: 'Zid Reports', ar: 'تقارير زد' },
          { key: 'reports_salla', en: 'Salla Reports', ar: 'تقارير سلة' },
        ],
      },
      {
        key: 'billing', en: 'Invoices & Payments', ar: 'الفواتير والمدفوعات',
        children: [
          { key: 'billing_subscriptions', en: 'Subscription Payments', ar: 'مدفوعات الاشتراكات' },
          { key: 'billing_servers',       en: 'Server Invoices',       ar: 'فواتير الخوادم' },
          { key: 'billing_other',         en: 'Other Invoices',        ar: 'فواتير أخرى' },
        ],
      },
    ],
  },
];

export const ADMIN_ALL_PERM_KEYS: AdminPermKey[] = (() => {
  const out: AdminPermKey[] = [];
  const walk = (nodes: AdminPermNode[]) =>
    nodes.forEach(n => { out.push(n.key); if (n.children) walk(n.children); });
  walk(ADMIN_PERMISSION_TREE);
  return out;
})();

export function adminLabel(key: string, language: 'en' | 'ar'): string {
  const walk = (nodes: AdminPermNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.key === key) return language === 'ar' ? n.ar : n.en;
      if (n.children) { const r = walk(n.children); if (r) return r; }
    }
  };
  return walk(ADMIN_PERMISSION_TREE) || key;
}

/** Default landing path inside /admin for a given permission set. */
export function firstAllowedAdminPath(can: (k: AdminPermKey) => boolean): string {
  if (can('admin_dashboard')) return '/admin';
  if (can('team_management')) return '/admin/team';
  if (can('ad_automation'))   return '/admin/ad-automation';
  if (can('pipeline'))        return '/admin/pipeline';
  if (can('customers'))       return '/admin/customers';
  if (can('reports_all'))     return '/admin/reports/all';
  if (can('reports_zid'))     return '/admin/reports/zid';
  if (can('reports_salla'))   return '/admin/reports/salla';
  if (can('billing_subscriptions')) return '/admin/invoices/subscriptions';
  if (can('billing_servers'))       return '/admin/invoices/server';
  if (can('billing_other'))         return '/admin/invoices/other';
  return '/admin';
}