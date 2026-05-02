import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Search, Filter, ChevronDown, Eye, LogIn, X } from 'lucide-react';
import { PlatformIcon } from './platformIcons';
import { loadCustomers, reconcileCustomers, PipelineCustomer } from './pipelineData';
import { fetchAdminCustomers, MOCK_CUSTOMERS, type AdminCustomerRow } from '../../services/adminCustomers';

type Customer = AdminCustomerRow;

export function AdminCustomers() {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineCustomers, setPipelineCustomers] = useState<PipelineCustomer[]>(
    () => reconcileCustomers(loadCustomers())
  );
  const [dbCustomers, setDbCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);

  useEffect(() => {
    let alive = true;
    fetchAdminCustomers()
      .then(rows => { if (alive) setDbCustomers(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Re-sync whenever the window regains focus so that changes made in the
  // Pipeline page (status transitions, new subscribers, cancellations) appear
  // automatically in this list.
  useEffect(() => {
    const sync = () => setPipelineCustomers(reconcileCustomers(loadCustomers()));
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const combined = useMemo<Customer[]>(() => {
    const mapped: Customer[] = pipelineCustomers
      .filter(p => p.status === 'subscribed' || p.status === 'subscription_expired' || p.status === 'cancelled')
      .map(p => {
        const platform: 'Zid' | 'Salla' =
          p.subscribedVia === 'salla' ? 'Salla'
            : p.subscribedVia === 'zid' ? 'Zid'
            : p.source === 'salla' ? 'Salla'
            : 'Zid';
        return { p, platform };
      })
      .map(({ p, platform }) => {
        const planKey = (p.subscriptionPlan || 'economy').toLowerCase();
        const planLabel: Record<string, { en: string; ar: string }> = {
          economy: { en: 'Economy', ar: 'اقتصادي' },
          basic: { en: 'Basic', ar: 'أساسي' },
          professional: { en: 'Professional', ar: 'احترافي' },
          business: { en: 'Business', ar: 'أعمال' },
        };
        const info = planLabel[planKey] || { en: p.subscriptionPlan || 'Economy', ar: p.subscriptionPlan || 'اقتصادي' };
        const status: Customer['status'] =
          p.status === 'subscribed' ? 'active'
            : p.status === 'subscription_expired' ? 'inactive'
            : 'cancelled';
        return {
          id: `pipe_${p.id}`,
          name: p.name,
          nameAr: p.name,
          email: p.email,
          phone: p.phone,
          platform,
          plan: info.en,
          planAr: info.ar,
          usagePercent: 0,
          words: 0,
          totalWords: 0,
          status,
          logo: p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CU',
        };
      });
    return [...mapped, ...dbCustomers];
  }, [pipelineCustomers, dbCustomers]);

  const filtered = combined.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.nameAr.includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q);
    const matchPlatform = filterPlatform === 'all' || c.platform === filterPlatform;
    const matchPlan = filterPlan === 'all' || c.plan === filterPlan;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchPlatform && matchPlan && matchStatus;
  });

  const statusColor = (s: string) => s === 'active' ? 'text-green-500 bg-green-500/10' : s === 'inactive' ? 'text-yellow-500 bg-yellow-500/10' : 'text-red-500 bg-red-500/10';
  const statusLabel = (s: string) => s === 'active' ? t('Active', 'نشط') : s === 'inactive' ? t('Inactive', 'غير نشط') : t('Cancelled', 'ملغي');

  const selectClass = "px-3 py-2 rounded-xl bg-card border border-border text-[12px] outline-none text-foreground";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 700 }}>{t('Customer Management', 'إدارة العملاء')}</h1>
        <p className="text-[13px] text-muted-foreground">{t('Manage and view all customer accounts', 'إدارة وعرض جميع حسابات العملاء')}</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('Search by name, email, or phone...', 'ابحث بالاسم أو البريد أو الهاتف...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-card border border-border focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 outline-none text-[13px] text-foreground transition-all" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-[13px]" style={{ fontWeight: 500 }}>
          <Filter className="w-4 h-4" /> {t('Filters', 'تصفية')}
        </button>
      </div>

      {showFilters && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-wrap gap-3">
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className={selectClass}>
            <option value="all">{t('All Platforms', 'جميع المنصات')}</option>
            <option value="Zid">{t('Zid', 'زد')}</option>
            <option value="Salla">{t('Salla', 'سلة')}</option>
          </select>
          <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className={selectClass}>
            <option value="all">{t('All Plans', 'جميع الخطط')}</option>
            <option value="Economy">{t('Economy', 'اقتصادي')}</option>
            <option value="Basic">{t('Basic', 'أساسي')}</option>
            <option value="Professional">{t('Professional', 'احترافي')}</option>
            <option value="Business">{t('Business', 'أعمال')}</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="all">{t('All Status', 'جميع الحالات')}</option>
            <option value="active">{t('Active', 'نشط')}</option>
            <option value="inactive">{t('Inactive', 'غير نشط')}</option>
            <option value="cancelled">{t('Cancelled', 'ملغي')}</option>
          </select>
        </motion.div>
      )}

      {/* Customer Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Store', 'المتجر')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden md:table-cell" style={{ fontWeight: 500 }}>{t('Platform', 'المنصة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden lg:table-cell" style={{ fontWeight: 500 }}>{t('Plan', 'الخطة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden xl:table-cell" style={{ fontWeight: 500 }}>{t('Usage', 'الاستخدام')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden lg:table-cell" style={{ fontWeight: 500 }}>{t('Words', 'الكلمات')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#043CC8] to-[#00FFF4] flex items-center justify-center text-white text-[10px] shrink-0" style={{ fontWeight: 700 }}>{c.logo}</div>
                      <div>
                        <p style={{ fontWeight: 600 }}>{language === 'ar' ? c.nameAr : c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span
                      className="inline-flex items-center justify-center"
                      title={language === 'ar' ? (c.platform === 'Zid' ? 'زد' : 'سلة') : c.platform}
                    >
                      <PlatformIcon id={c.platform.toLowerCase()} size={22} alt={c.platform} />
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell" style={{ fontWeight: 500 }}>{language === 'ar' ? c.planAr : c.plan}</td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.usagePercent}%`, backgroundColor: c.usagePercent > 80 ? '#ff4466' : c.usagePercent > 50 ? '#ffaa00' : '#22c55e' }} />
                      </div>
                      <span className="text-[11px]">{c.usagePercent}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell text-[12px]">{c.words.toLocaleString()} / {c.totalWords.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-lg text-[11px] ${statusColor(c.status)}`} style={{ fontWeight: 600 }}>{statusLabel(c.status)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => navigate(`/admin/customers/${c.id}`)} className="p-2 rounded-lg hover:bg-muted transition-colors" title={t('Details', 'التفاصيل')}>
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-[#043CC8]" title={t('Login as Customer', 'الدخول كعميل')}>
                        <LogIn className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-[14px]">{t('No customers found', 'لم يتم العثور على عملاء')}</div>
        )}
      </div>
    </div>
  );
}
