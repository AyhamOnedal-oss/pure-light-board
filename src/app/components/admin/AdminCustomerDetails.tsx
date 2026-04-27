import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { AnimatedValue } from '../AnimatedNumber';
import {
  ArrowLeft, ArrowRight, LogIn, Store, Mail, Phone, User, Calendar, Star,
  MousePointerClick, Globe, CreditCard, Trash2, Shield, ShieldOff,
  Link, MessageSquare, Ticket, FileText, Plus, Send, RefreshCw, Ban, CheckCircle,
  XCircle, Clock, Edit, Key
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#043CC8', '#e2e8f0'];

export function AdminCustomerDetails() {
  const { t, language, dir, showToast, theme } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'subscriptions' | 'activity' | 'notes' | 'actions'>('info');
  const [noteText, setNoteText] = useState('');
  const [showAddWords, setShowAddWords] = useState(false);
  const [addWordsAmount, setAddWordsAmount] = useState('');

  // Mock customer data
  const customer = {
    id, name: 'Elegant Store', nameAr: 'متجر أنيق', logo: 'ES',
    email: 'info@elegant.sa', owner: 'Mohammed Ali', ownerAr: 'محمد علي',
    phone: '+966501234567', usagePercent: 72, regDate: '2025-08-15',
    trialWords: 5000, paidWords: 46800, rating: 4.5, bubbleClicks: 1245,
    platform: 'Zid', plan: 'Professional', planAr: 'احترافي',
    status: 'active', totalWords: 65000,
    subscription: {
      plan: 'Professional', planAr: 'احترافي', status: 'active',
      start: '2026-03-01', end: '2026-04-01', usedWords: 46800, trialWords: 5000,
    },
    previousSubs: [
      { plan: 'Trial', start: '2025-08-15', end: '2025-09-15', status: 'expired' },
      { plan: 'Economy', start: '2025-09-15', end: '2025-12-15', status: 'expired' },
      { plan: 'Basic', start: '2025-12-15', end: '2026-03-01', status: 'expired' },
    ],
    activity: [
      { date: '2026-04-16 10:30', event: 'Admin logged in as customer', eventAr: 'الأدمن دخل كعميل', type: 'admin' },
      { date: '2026-04-10 14:00', event: 'Subscription renewed', eventAr: 'تم تجديد الاشتراك', type: 'subscription' },
      { date: '2026-03-28 09:15', event: 'Words exhausted - 80% alert', eventAr: 'تنبيه استنفاد الكلمات - 80%', type: 'alert' },
      { date: '2026-03-01 00:00', event: 'Upgraded to Professional', eventAr: 'ترقية إلى احترافي', type: 'subscription' },
    ],
    notes: [
      { id: '1', staff: 'Ahmed', staffAr: 'أحمد', content: 'Customer requested additional words package', contentAr: 'العميل طلب حزمة كلمات إضافية', date: '2026-04-15' },
      { id: '2', staff: 'Sara', staffAr: 'سارة', content: 'Resolved billing issue', contentAr: 'تم حل مشكلة الفوترة', date: '2026-04-10' },
    ],
    tickets: [
      { id: 'T-101', subject: 'Billing Issue', subjectAr: 'مشكلة فوترة', status: 'resolved', date: '2026-04-10' },
      { id: 'T-098', subject: 'AI Training Request', subjectAr: 'طلب تدريب الذكاء', status: 'open', date: '2026-04-08' },
    ],
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

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    showToast(t('Note added successfully', 'تمت إضافة الملاحظة بنجاح'));
    setNoteText('');
  };

  const handleAction = (action: string) => {
    showToast(`${action} ${t('completed successfully', 'تم بنجاح')}`);
  };

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
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] transition-colors text-[13px]" style={{ fontWeight: 600 }}>
          <LogIn className="w-4 h-4" /> {t('Login as Customer', 'الدخول كعميل')}
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
              { icon: Star, label: t('Chat Rating', 'تقييم الشات'), value: `${customer.rating} / 5` },
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
        </motion.div>
      )}

      {activeTab === 'subscriptions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('Current Subscription', 'الاشتراك الحالي')}</h3>
              <span className="px-2.5 py-1 rounded-lg text-[11px] bg-green-500/10 text-green-500" style={{ fontWeight: 600 }}>{t('Active', 'نشط')}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Plan', 'الخطة')}</span><span style={{ fontWeight: 600 }}>{language === 'ar' ? customer.subscription.planAr : customer.subscription.plan}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Start Date', 'تاريخ البدء')}</span><span style={{ fontWeight: 500 }}>{customer.subscription.start}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('End Date', 'تاريخ الانتهاء')}</span><span style={{ fontWeight: 500 }}>{customer.subscription.end}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t('Used Words', 'الكلمات المستخدمة')}</span><span style={{ fontWeight: 600 }}>{customer.subscription.usedWords.toLocaleString()}</span></div>
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
              <button onClick={() => handleAction(t('End subscription', 'إنهاء الاشتراك'))} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[12px] transition-colors" style={{ fontWeight: 600 }}>
                <XCircle className="w-3.5 h-3.5 inline me-1" /> {t('End Subscription', 'إنهاء الاشتراك')}
              </button>
              <button onClick={() => setShowAddWords(true)} className="px-4 py-2 rounded-xl bg-[#043CC8]/10 text-[#043CC8] hover:bg-[#043CC8]/20 text-[12px] transition-colors" style={{ fontWeight: 600 }}>
                <Plus className="w-3.5 h-3.5 inline me-1" /> {t('Add Words', 'إضافة كلمات')}
              </button>
              <button onClick={() => handleAction(t('Renew trial', 'تجديد التجربة'))} className="px-4 py-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[12px] transition-colors" style={{ fontWeight: 600 }}>
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
                  <button onClick={() => { handleAction(t('Add words', 'إضافة كلمات')); setShowAddWords(false); setAddWordsAmount(''); }}
                    className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px]" style={{ fontWeight: 600 }}>{t('Add', 'إضافة')}</button>
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
            <button onClick={handleAddNote} className="mt-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] transition-colors" style={{ fontWeight: 600 }}>
              <Plus className="w-3.5 h-3.5 inline me-1" /> {t('Add Note', 'إضافة ملاحظة')}
            </button>
          </div>
          <div className="space-y-3">
            {customer.notes.map(n => (
              <div key={n.id} className="p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px]" style={{ fontWeight: 600 }}>{language === 'ar' ? n.staffAr : n.staff}</span>
                  <span className="text-[10px] text-muted-foreground">{n.date}</span>
                </div>
                <p className="text-[13px]">{language === 'ar' ? n.contentAr : n.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'actions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cardClass}>
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Account Actions', 'إجراءات الحساب')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Ban, label: t('Disable Account', 'تعطيل الحساب'), color: 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20' },
              { icon: CheckCircle, label: t('Enable Account', 'تفعيل الحساب'), color: 'text-green-500 bg-green-500/10 hover:bg-green-500/20' },
              { icon: Mail, label: t('Send Email Reset Link', 'إرسال رابط إعادة تعيين البريد'), color: 'text-[#043CC8] bg-[#043CC8]/10 hover:bg-[#043CC8]/20' },
              { icon: Key, label: t('Send Password Reset Link', 'إرسال رابط إعادة تعيين كلمة المرور'), color: 'text-[#a855f7] bg-[#a855f7]/10 hover:bg-[#a855f7]/20' },
              { icon: MousePointerClick, label: t('Enable Bubble', 'تفعيل الفقاعة'), color: 'text-[#00FFF4] bg-[#00FFF4]/10 hover:bg-[#00FFF4]/20' },
              { icon: ShieldOff, label: t('Disable Bubble', 'تعطيل الفقاعة'), color: 'text-orange-500 bg-orange-500/10 hover:bg-orange-500/20' },
              { icon: RefreshCw, label: t('Refresh Link', 'تحديث الرابط'), color: 'text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20' },
              { icon: Trash2, label: t('Delete Account', 'حذف الحساب'), color: 'text-red-500 bg-red-500/10 hover:bg-red-500/20' },
            ].map((action, i) => (
              <button key={i} onClick={() => handleAction(action.label)}
                className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${action.color}`}>
                <action.icon className="w-5 h-5 shrink-0" />
                <span className="text-[13px]" style={{ fontWeight: 600 }}>{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}