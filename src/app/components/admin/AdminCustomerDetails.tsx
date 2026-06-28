import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { AnimatedValue } from '../AnimatedNumber';
import {
  ArrowLeft, ArrowRight, LogIn, Store, Mail, Phone, User, Calendar, Star,
  MousePointerClick, Globe, CreditCard, Trash2, Shield, ShieldOff,
  Link, MessageSquare, Ticket, FileText, Plus, Send, RefreshCw, Ban, CheckCircle,
  XCircle, Clock, Edit, Key, Loader2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

const COLORS = ['#043CC8', '#e2e8f0'];

export function AdminCustomerDetails() {
  const { t, language, dir, showToast, theme } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'subscriptions' | 'activity' | 'notes' | 'actions'>('info');
  const [noteText, setNoteText] = useState('');
  const [showAddWords, setShowAddWords] = useState(false);
  const [addWordsAmount, setAddWordsAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Array<{ id: string; author_name: string | null; author_id: string | null; body: string; created_at: string }>>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [confirm, setConfirm] = useState<null | { action: string; title: string; message: string }>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const loadNotes = React.useCallback(async () => {
    if (!id) return;
    const { data: rows } = await supabase
      .from('admin_customer_notes' as any)
      .select('id,author_name,author_id,body,created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false });
    const list = ((rows as any[]) || []).slice();
    // Resolve real display names for any legacy notes that stored the email
    // as the author_name. Look them up by author_id in settings_account.
    const idsToResolve = Array.from(new Set(
      list
        .filter((n) => !n.author_name || /@/.test(String(n.author_name)))
        .map((n) => n.author_id)
        .filter((x): x is string => !!x)
    ));
    if (idsToResolve.length > 0) {
      const { data: accs } = await supabase
        .from('settings_account')
        .select('user_id, display_name')
        .in('user_id', idsToResolve);
      const nameMap = new Map<string, string>();
      (accs || []).forEach((a: any) => {
        if (a.display_name) nameMap.set(a.user_id, a.display_name);
      });
      list.forEach((n) => {
        if (!n.author_name || /@/.test(String(n.author_name))) {
          const resolved = n.author_id ? nameMap.get(n.author_id) : null;
          if (resolved) n.author_name = resolved;
        }
      });
    }
    setNotes(list);
  }, [id]);

  const loadCustomer = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [{ data: zid }, { data: salla }, { data: ws }, { data: plan }, { data: clicks }, { data: ratings }, { data: tokens }, { data: events }, { data: design }] = await Promise.all([
          supabase.from('zid_connections').select('store_name,store_email,store_url,is_active,connected_at,created_at').eq('tenant_id', id).maybeSingle(),
          supabase.from('salla_connections').select('store_name,store_email,store_url,is_active,connected_at,created_at').eq('tenant_id', id).maybeSingle(),
          supabase.from('settings_workspace').select('name,plan,status,platform,created_at').eq('id', id).maybeSingle(),
          supabase.from('settings_plans').select('monthly_word_quota,monthly_words_used,period_start,subscription_end_date').eq('tenant_id', id).maybeSingle(),
          supabase.from('dashboard_usage_daily').select('clicks').eq('tenant_id', id),
          supabase.from('conversations_main').select('csat_rating').eq('tenant_id', id).not('csat_rating', 'is', null),
          supabase.from('ai_classifier_usage').select('prompt_tokens,completion_tokens').eq('tenant_id', id),
          supabase.from('admin_activity_events').select('event_type,actor_name,metadata,created_at').eq('tenant_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('settings_train_ai').select('bubble_visible, bubble_admin_locked').eq('tenant_id', id).maybeSingle(),
        ]);
        const conn = salla || zid;
        const platform: 'Zid' | 'Salla' = salla ? 'Salla' : zid ? 'Zid' : (ws?.platform === 'salla' ? 'Salla' : 'Zid');
        const name = conn?.store_name || ws?.name || 'Unnamed Store';
        const email = conn?.store_email || '—';
        const totalWords = Number(plan?.monthly_word_quota || 0);
        const words = Number(plan?.monthly_words_used || 0);
        const usagePercent = totalWords > 0 ? Math.min(100, Math.round((words / totalWords) * 100)) : 0;
        const bubbleClicks = (clicks || []).reduce((s: number, r: any) => s + Number(r.clicks || 0), 0);
        const ratingRows = (ratings || []).filter((r: any) => r.csat_rating != null);
        const ratingCount = ratingRows.length;
        const avgRating = ratingCount > 0
          ? Math.round((ratingRows.reduce((s: number, r: any) => s + Number(r.csat_rating || 0), 0) / ratingCount) * 10) / 10
          : 0;
        const inputTokens = (tokens || []).reduce((s: number, r: any) => s + Number(r.prompt_tokens || 0), 0);
        const outputTokens = (tokens || []).reduce((s: number, r: any) => s + Number(r.completion_tokens || 0), 0);
        // Split the already-billed total (`monthly_words_used`) proportionally
        // by the input/output token ratio so that inputWords + outputWords
        // always equals الكلمات المستخدمة — works for both Arabic text and
        // image traffic without picking a fragile per-language constant.
        const totalTok = inputTokens + outputTokens;
        const ratioIn = totalTok > 0 ? inputTokens / totalTok : 0.9;
        const inputWords = words > 0 ? Math.round(words * ratioIn) : 0;
        const outputWords = words > 0 ? Math.max(0, words - inputWords) : 0;
        const initials = name.split(/\s+/).map((p: string) => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'CU';
        const planLabels: Record<string, { en: string; ar: string }> = {
          free: { en: 'Trial', ar: 'تجريبي' }, trial: { en: 'Trial', ar: 'تجريبي' },
          economy: { en: 'Economy', ar: 'اقتصادي' }, basic: { en: 'Basic', ar: 'أساسي' },
          professional: { en: 'Professional', ar: 'احترافي' }, business: { en: 'Business', ar: 'أعمال' },
          pro: { en: 'Pro', ar: 'احترافي' },
        };
        const planKey = (ws?.plan || 'free').toString().toLowerCase();
        const planLabel = planLabels[planKey] || { en: ws?.plan || 'Trial', ar: ws?.plan || 'تجريبي' };
        const regDate = (conn?.connected_at || conn?.created_at || ws?.created_at || '').toString().slice(0, 10);
        const wsStatus = (ws?.status || '').toString();
        const statusActive = wsStatus === 'suspended' ? false : (conn?.is_active ?? (wsStatus === 'active' || wsStatus === 'trial'));
        const isTrialPlan = planKey === 'free' || planKey === 'trial' || planKey === '';

        const planArMap: Record<string, string> = {
          free: 'تجريبي', trial: 'تجريبي', economy: 'اقتصادي', basic: 'أساسي',
          professional: 'احترافي', pro: 'احترافي', business: 'أعمال',
        };
        const fmtDate = (iso: string) => {
          const d = new Date(iso);
          const pad = (n: number) => n.toString().padStart(2, '0');
          return `${pad(d.getHours())}:${pad(d.getMinutes())} ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        };
        const activity = (events || []).map((e: any) => {
          const m = e.metadata || {};
          const date = fmtDate(e.created_at);
          if (e.event_type === 'plan_change') {
            const to = String(m.to_plan || '').toLowerCase();
            const toAr = planArMap[to] || m.to_plan || '';
            const toEn = (m.to_plan || '').toString();
            return { type: 'success', event: `Upgrade to ${toEn}`, eventAr: `ترقية إلى ${toAr}`, date };
          }
          if (e.event_type === 'usage_80') {
            return { type: 'alert', event: 'Word usage alert - 80%', eventAr: 'تنبيه استنفاد الكلمات - 80%', date };
          }
          if (e.event_type === 'resubscribe') {
            return { type: 'success', event: 'Subscription renewed', eventAr: 'تم تجديد الاشتراك', date };
          }
          if (e.event_type === 'impersonation') {
            const first = (e.actor_name || '').toString().trim().split(/\s+/)[0] || 'Admin';
            return { type: 'admin', event: `${first} logged in as customer`, eventAr: `${first} دخل كعميل`, date };
          }
          return { type: 'success', event: e.event_type, eventAr: e.event_type, date };
        });

        setData({
          id, name, nameAr: name, logo: initials,
          email, owner: '—', ownerAr: '—',
          phone: '—', usagePercent, regDate,
          trialWords: 0, paidWords: words, rating: avgRating, ratingCount, bubbleClicks,
          platform, plan: planLabel.en, planAr: planLabel.ar,
          status: statusActive ? 'active' : 'inactive', totalWords,
          storeUrl: conn?.store_url || '',
          isTrialPlan,
          bubbleEnabled: (design as any)?.bubble_visible !== false,
          bubbleAdminLocked: (design as any)?.bubble_admin_locked === true,
          inputTokens, outputTokens,
          inputWords,
          outputWords,
          totalTokenWords: words,
          subscription: {
            plan: planLabel.en, planAr: planLabel.ar, status: statusActive ? 'active' : 'inactive',
            start: (plan?.period_start || '').toString().slice(0, 10) || '—',
            end: (plan?.subscription_end_date || '').toString().slice(0, 10) || '—',
            usedWords: words, trialWords: 0,
          },
          previousSubs: [],
          activity,
          notes: [],
          tickets: [],
        });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  if (loading || !data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  const customer = data;

  const impersonate = async () => {
    setImpersonating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-impersonate', { body: { tenantId: id } });
      if (error || !res?.url) throw new Error((error as any)?.message || res?.error || 'Failed');
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      showToast(t('Login as customer failed: ', 'تعذر الدخول كعميل: ') + (e?.message || ''));
    } finally {
      setImpersonating(false);
    }
  };

  const usageData = [
    { name: 'Used', value: customer.subscription.usedWords },
    { name: 'Remaining', value: customer.totalWords - customer.subscription.usedWords },
  ];

  const tabs = [
    { key: 'info', label: t('Store Info', 'معلومات المتجر'), icon: Store },
    { key: 'subscriptions', label: t('Subscriptions', 'الاشتراكات'), icon: CreditCard },
    { key: 'activity', label: t('Activity', 'النشاط'), icon: Clock },
    { key: 'notes', label: t('Notes', 'الملاحظات'), icon: FileText },
    { key: 'actions', label: t('Actions', 'الإجراءات'), icon: Shield },
  ];

  const cardClass = "bg-card rounded-2xl border border-border p-5 shadow-sm";

  const callAction = async (action: 'end' | 'add_words' | 'renew_trial', extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-subscription-actions', {
        body: { tenantId: id, action, ...extra },
      });
      if (error || (res && (res as any).error)) {
        throw new Error((error as any)?.message || (res as any)?.error || 'failed');
      }
      showToast(t('Done', 'تم بنجاح'));
      await loadCustomer();
    } catch (e: any) {
      const msg = e?.message === 'trial_only'
        ? t('Renew Trial is for the free trial plan only', 'تجديد التجربة متاح للخطة التجريبية فقط')
        : (e?.message || t('Action failed', 'فشل تنفيذ الإجراء'));
      showToast(msg);
    } finally {
      setBusy(null);
    }
  };

  const handleAddNote = async () => {
    const body = noteText.trim();
    if (!body || !id) return;
    setSavingNote(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const meta = (u.user?.user_metadata || {}) as any;
      let authorName: string = meta.full_name || meta.name || '';
      if (!authorName && u.user?.id) {
        const { data: acc } = await supabase
          .from('settings_account')
          .select('display_name')
          .eq('user_id', u.user.id)
          .maybeSingle();
        if (acc?.display_name) authorName = acc.display_name;
      }
      if (!authorName) authorName = 'Admin';
      const { error } = await supabase.from('admin_customer_notes' as any).insert({
        tenant_id: id,
        author_id: u.user?.id ?? null,
        author_name: authorName,
        body,
      });
      if (error) throw error;
      setNoteText('');
      await loadNotes();
      showToast(t('Note added successfully', 'تمت إضافة الملاحظة بنجاح'));
    } catch (e: any) {
      showToast(t('Failed to add note: ', 'تعذرت إضافة الملاحظة: ') + (e?.message || ''));
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from('admin_customer_notes' as any).delete().eq('id', noteId);
    if (error) { showToast(error.message); return; }
    await loadNotes();
  };

  const runAccountAction = async (action: string) => {
    setBusy(action);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-subscription-actions', {
        body: { tenantId: id, action },
      });
      if (error || (res && (res as any).error)) {
        throw new Error((error as any)?.message || (res as any)?.error || 'failed');
      }
      showToast(t('Done', 'تم بنجاح'));
      if (action === 'delete_account') {
        navigate('/admin/customers');
        return;
      }
      await loadCustomer();
    } catch (e: any) {
      showToast(t('Action failed: ', 'فشل تنفيذ الإجراء: ') + (e?.message || ''));
    } finally {
      setBusy(null);
    }
  };

  const ACCOUNT_ACTIONS = (() => {
    const isActive = data?.status === 'active';
    const bubbleOn = data?.bubbleEnabled !== false;
    return [
      { key: 'disable_account', icon: Ban, label: t('Disable Account', 'تعطيل الحساب'),
        color: 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20',
        disabled: !isActive, confirm: true,
        confirmTitle: t('Disable account?', 'تعطيل الحساب؟'),
        confirmMsg: t('User will not be able to sign in until re-enabled.', 'لن يتمكن المستخدم من الدخول حتى تتم إعادة تفعيل الحساب.') },
      { key: 'enable_account', icon: CheckCircle, label: t('Enable Account', 'تفعيل الحساب'),
        color: 'text-green-500 bg-green-500/10 hover:bg-green-500/20',
        disabled: isActive },
      { key: 'send_password_reset', icon: Key, label: t('Send Password Reset Link', 'إرسال رابط إعادة تعيين كلمة المرور'),
        color: 'text-[#a855f7] bg-[#a855f7]/10 hover:bg-[#a855f7]/20' },
      { key: 'enable_bubble', icon: MousePointerClick, label: t('Enable Bubble', 'تفعيل الفقاعة'),
        color: 'text-[#00FFF4] bg-[#00FFF4]/10 hover:bg-[#00FFF4]/20',
        disabled: bubbleOn },
      { key: 'disable_bubble', icon: ShieldOff, label: t('Disable Bubble', 'تعطيل الفقاعة'),
        color: 'text-orange-500 bg-orange-500/10 hover:bg-orange-500/20',
        disabled: !bubbleOn },
      { key: 'delete_account', icon: Trash2, label: t('Delete Account', 'حذف الحساب'),
        color: 'text-red-500 bg-red-500/10 hover:bg-red-500/20',
        confirm: true,
        confirmTitle: t('Delete account permanently?', 'حذف الحساب نهائياً؟'),
        confirmMsg: t('All data for this customer will be removed and cannot be recovered.', 'سيتم حذف جميع بيانات هذا العميل ولا يمكن استعادتها.') },
    ];
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/customers')} className="p-2 rounded-xl hover:bg-muted transition-colors">
            {dir === 'rtl' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#043CC8] to-[#00FFF4] flex items-center justify-center text-white text-[14px]" style={{ fontWeight: 700 }}>{customer.logo}</div>
          <div>
            <h1 className="text-[20px]" style={{ fontWeight: 700 }}>{language === 'ar' ? customer.nameAr : customer.name}</h1>
            <p className="text-[12px] text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <button onClick={impersonate} disabled={impersonating} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] disabled:opacity-50 transition-colors text-[13px]" style={{ fontWeight: 600 }}>
          {impersonating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} {t('Login as Customer', 'الدخول كعميل')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] whitespace-nowrap transition-all ${
              activeTab === tab.key ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20' : 'bg-card border border-border hover:bg-muted'
            }`} style={{ fontWeight: 500 }}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cardClass}>
          <h3 className="text-[15px] mb-5" style={{ fontWeight: 600 }}>{t('Store Information', 'معلومات المتجر')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Store, label: t('Store Name', 'اسم المتجر'), value: language === 'ar' ? customer.nameAr : customer.name },
              { icon: User, label: t('Owner', 'المالك'), value: language === 'ar' ? customer.ownerAr : customer.owner },
              { icon: Mail, label: t('Email', 'البريد'), value: customer.email },
              { icon: Phone, label: t('Phone', 'الهاتف'), value: customer.phone },
              { icon: Globe, label: t('Platform', 'المنصة'), value: language === 'ar' ? (customer.platform === 'Zid' ? 'زد' : 'سلة') : customer.platform },
              { icon: CreditCard, label: t('Plan', 'الخطة'), value: language === 'ar' ? customer.planAr : customer.plan },
              { icon: Calendar, label: t('Registration', 'التسجيل'), value: customer.regDate },
              { icon: Star, label: t('Chat Rating', 'تقييم الشات'), value: customer.ratingCount > 0 ? `${customer.rating} / 5` : '—' },
              { icon: MousePointerClick, label: t('Bubble Clicks', 'نقرات الفقاعة'), value: customer.bubbleClicks.toLocaleString() },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <item.icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="text-[13px]" style={{ fontWeight: 600 }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">{t('Trial Words', 'كلمات تجريبية')}</p>
              <p className="text-[18px]" style={{ fontWeight: 700 }}><AnimatedValue value={customer.trialWords} /></p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">{t('Paid Words', 'كلمات مدفوعة')}</p>
              <p className="text-[18px]" style={{ fontWeight: 700 }}><AnimatedValue value={customer.paidWords} /></p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">{t('Usage', 'الاستخدام')}</p>
              <p className="text-[18px]" style={{ fontWeight: 700 }}>{customer.usagePercent}%</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">{t('Input Words', 'كلمات المدخلات')}</p>
              <p className="text-[18px]" style={{ fontWeight: 700 }}><AnimatedValue value={customer.inputWords} /></p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">{t('Output Words', 'كلمات المخرجات')}</p>
              <p className="text-[18px]" style={{ fontWeight: 700 }}><AnimatedValue value={customer.outputWords} /></p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'subscriptions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('Current Subscription', 'الاشتراك الحالي')}</h3>
              {customer.status === 'active' ? (
                <span className="px-2.5 py-1 rounded-lg text-[11px] bg-green-500/10 text-green-500" style={{ fontWeight: 600 }}>{t('Active', 'نشط')}</span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-[11px] bg-red-500/10 text-red-500" style={{ fontWeight: 600 }}>{t('Unsubscribed', 'ملغي')}</span>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Plan', 'الخطة')}</span><span style={{ fontWeight: 600 }}>{language === 'ar' ? customer.subscription.planAr : customer.subscription.plan}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Start Date', 'تاريخ البدء')}</span><span style={{ fontWeight: 500 }}>{customer.subscription.start}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('End Date', 'تاريخ الانتهاء')}</span><span style={{ fontWeight: 500 }}>{customer.subscription.end}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Used Words', 'الكلمات المستخدمة')}</span><span style={{ fontWeight: 600 }}>{customer.subscription.usedWords.toLocaleString()}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Input Words', 'كلمات المدخلات')}</span><span style={{ fontWeight: 600 }}>{customer.inputWords.toLocaleString()}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Output Words', 'كلمات المخرجات')}</span><span style={{ fontWeight: 600 }}>{customer.outputWords.toLocaleString()}</span></div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={usageData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        {usageData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[20px]" style={{ fontWeight: 700 }}>{customer.usagePercent}%</p>
                    <p className="text-[10px] text-muted-foreground">{t('Used', 'مستخدم')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border">
              <button onClick={() => callAction('end')} disabled={busy !== null} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[12px] transition-colors disabled:opacity-50" style={{ fontWeight: 600 }}>
                <XCircle className="w-3.5 h-3.5 inline me-1" /> {t('End Subscription', 'إنهاء الاشتراك')}
              </button>
              <button onClick={() => setShowAddWords(true)} disabled={busy !== null} className="px-4 py-2 rounded-xl bg-[#043CC8]/10 text-[#043CC8] hover:bg-[#043CC8]/20 text-[12px] transition-colors disabled:opacity-50" style={{ fontWeight: 600 }}>
                <Plus className="w-3.5 h-3.5 inline me-1" /> {t('Add Words', 'إضافة كلمات')}
              </button>
              <button
                onClick={() => callAction('renew_trial')}
                disabled={busy !== null || !customer.isTrialPlan}
                title={!customer.isTrialPlan ? t('Available for the free trial plan only', 'متاح للخطة التجريبية فقط') : ''}
                className="px-4 py-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontWeight: 600 }}
              >
                <RefreshCw className="w-3.5 h-3.5 inline me-1" /> {t('Renew Trial', 'تجديد التجربة')}
              </button>
            </div>
          </div>
          {/* Add Words Modal */}
          {showAddWords && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
                <h3 className="text-[16px] mb-4" style={{ fontWeight: 600 }}>{t('Add Words', 'إضافة كلمات')}</h3>
                <input type="number" value={addWordsAmount} onChange={e => setAddWordsAmount(e.target.value)} placeholder={t('Number of words', 'عدد الكلمات')}
                  className="w-full px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[14px] text-foreground" />
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowAddWords(false)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
                  <button
                    onClick={async () => {
                      const n = Math.floor(Number(addWordsAmount));
                      if (!n || n <= 0) { showToast(t('Enter a valid number', 'أدخل رقماً صحيحاً')); return; }
                      setShowAddWords(false);
                      setAddWordsAmount('');
                      await callAction('add_words', { words: n });
                    }}
                    disabled={busy !== null}
                    className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] disabled:opacity-50" style={{ fontWeight: 600 }}>{t('Add', 'إضافة')}</button>
                </div>
              </div>
            </div>
          )}
          {/* Previous Subscriptions */}
          <div className={cardClass}>
            <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Previous Subscriptions', 'الاشتراكات السابقة')}</h3>
            <div className="space-y-2">
              {customer.previousSubs.map((sub, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-[13px]" style={{ fontWeight: 600 }}>{sub.plan}</p>
                    <p className="text-[11px] text-muted-foreground">{sub.start} → {sub.end}</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg text-[10px] bg-muted text-muted-foreground" style={{ fontWeight: 600 }}>{t('Expired', 'منتهي')}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'activity' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cardClass}>
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Activity Log', 'سجل النشاط')}</h3>
          <div className="space-y-3">
            {customer.activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  a.type === 'admin' ? 'bg-[#043CC8]/10 text-[#043CC8]' : a.type === 'alert' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'
                }`}>
                  {a.type === 'admin' ? <LogIn className="w-3.5 h-3.5" /> : a.type === 'alert' ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1">
                  <p className="text-[13px]" style={{ fontWeight: 500 }}>{language === 'ar' ? a.eventAr : a.event}</p>
                  <p className="text-[11px] text-muted-foreground">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'notes' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cardClass}>
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Customer Notes', 'ملاحظات العميل')}</h3>
          <div className="mb-4">
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder={t('Add a note...', 'أضف ملاحظة...')}
              className="w-full h-20 px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[13px] text-foreground resize-none" />
            <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
              className="mt-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] transition-colors disabled:opacity-50" style={{ fontWeight: 600 }}>
              {savingNote ? <Loader2 className="w-3.5 h-3.5 inline me-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 inline me-1" />}
              {t('Add Note', 'إضافة ملاحظة')}
            </button>
          </div>
          <div className="space-y-3">
            {notes.length === 0 && (
              <p className="text-[12px] text-muted-foreground">{t('No notes yet', 'لا توجد ملاحظات بعد')}</p>
            )}
            {notes.map(n => (
              <div key={n.id} className="p-3 rounded-xl bg-muted/30">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ fontWeight: 600 }}>{n.author_name || '—'}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB')}
                    </span>
                  </div>
                  {currentUserId === n.author_id && (
                    <button onClick={() => setDeleteNoteId(n.id)} className="text-red-500 hover:text-red-600 p-1" title={t('Delete', 'حذف')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[13px] whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
          </div>
          {deleteNoteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
                <h3 className="text-[16px] mb-2" style={{ fontWeight: 700 }}>{t('Delete note?', 'حذف الملاحظة؟')}</h3>
                <p className="text-[13px] text-muted-foreground mb-5">{t('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteNoteId(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
                  <button onClick={async () => { const nid = deleteNoteId; setDeleteNoteId(null); if (nid) await deleteNote(nid); }}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[13px]" style={{ fontWeight: 600 }}>{t('Delete', 'حذف')}</button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'actions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cardClass}>
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Account Actions', 'إجراءات الحساب')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACCOUNT_ACTIONS.map((a) => (
              <button key={a.key}
                onClick={() => {
                  if (a.confirm) setConfirm({ action: a.key, title: a.confirmTitle!, message: a.confirmMsg! });
                  else runAccountAction(a.key);
                }}
                disabled={a.disabled || busy !== null}
                className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${a.color} disabled:opacity-40 disabled:cursor-not-allowed`}>
                {busy === a.key ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <a.icon className="w-5 h-5 shrink-0" />}
                <span className="text-[13px]" style={{ fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
          </div>
          {confirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
                <h3 className="text-[16px] mb-2" style={{ fontWeight: 700 }}>{confirm.title}</h3>
                <p className="text-[13px] text-muted-foreground mb-5">{confirm.message}</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
                  <button onClick={async () => { const a = confirm.action; setConfirm(null); await runAccountAction(a); }}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[13px]" style={{ fontWeight: 600 }}>{t('Confirm', 'تأكيد')}</button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}