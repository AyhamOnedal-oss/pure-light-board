import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { ToastContainer } from '../ToastContainer';
import {
  LayoutDashboard, Users, FileText, Receipt, Server,
  ChevronDown, ChevronRight, Globe, Moon, Sun, Bell, Menu, X,
  LogOut, ChevronUp, Send, UserCog, Megaphone, GitBranch
} from 'lucide-react';
import { loadCustomers, countNewLeads } from './pipelineData';
import logoDark from '../../../imports/FUQAH-AI-Logo-01@2x.png';
import logoLight from '../../../imports/FUQAH-AI-Logo-02@2x.png';

export function AdminLayout() {
  const { t, theme, setTheme, language, setLanguage, dir, showToast, pushNotification, signOut, user } = useApp();
  const [reportsOpen, setReportsOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [newLeads, setNewLeads] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sendNotifOpen, setSendNotifOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifText, setNotifText] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isReports = location.pathname.includes('/admin/reports');
  const isInvoices = location.pathname.includes('/admin/invoices');
  const isCustomers = location.pathname.includes('/admin/customers') || location.pathname.includes('/admin/pipeline');

  useEffect(() => {
    if (isReports && !reportsOpen) setReportsOpen(true);
    if (isInvoices && !invoicesOpen) setInvoicesOpen(true);
    if (isCustomers && !customersOpen) setCustomersOpen(true);
  }, [isReports, isInvoices, isCustomers]);

  // Refresh new-lead count on every nav change + every 20s
  useEffect(() => {
    const refresh = () => setNewLeads(countNewLeads(loadCustomers()));
    refresh();
    const id = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(id);
  }, [location.pathname]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const logo = theme === 'dark' ? logoDark : logoLight;

  const handleLogout = async () => {
    setUserMenuOpen(false);
    try { await signOut(); } catch {}
    navigate('/login', { replace: true });
  };

  const handleSendNotification = () => {
    const title = notifTitle.trim();
    const body = notifText.trim();
    if (!title || !body) return;
    pushNotification({ title, titleAr: title, message: body, messageAr: body });
    showToast(t('Notification sent successfully', 'تم إرسال الإشعار بنجاح'));
    setNotifTitle('');
    setNotifText('');
    setSendNotifOpen(false);
  };

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: t('Admin Dashboard', 'لوحة تحكم الأدمن'), end: true },
    { to: '/admin/team', icon: UserCog, label: t('Team Management', 'إدارة الفريق') },
    { to: '/admin/ad-automation', icon: Megaphone, label: t('Ad Automation', 'أتمتة الإعلانات') },
  ];

  const customersItems = [
    { to: '/admin/pipeline', label: t('Customer Pipeline', 'سير العملاء'), icon: GitBranch, showBadge: true },
    { to: '/admin/customers', label: t('Customers', 'العملاء'), icon: Users, showBadge: false },
  ];

  const reportsItems = [
    { to: '/admin/reports/all', label: t('All', 'الكل') },
    { to: '/admin/reports/zid', label: t('Zid', 'زد') },
    { to: '/admin/reports/salla', label: t('Salla', 'سلة') },
  ];

  const invoicesItems = [
    { to: '/admin/invoices/subscriptions', label: t('Subscription Payments', 'مدفوعات الاشتراكات') },
    { to: '/admin/invoices/server', label: t('Server Invoices', 'فواتير الخوادم') },
    { to: '/admin/invoices/other', label: t('Other Invoices', 'فواتير أخرى') },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-center">
        <img src={logo} alt="Fuqah AI" className="h-14 w-auto object-contain max-w-[220px]" />
      </div>
      <div className="px-4 py-2">
        <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-500 uppercase tracking-wider" style={{ fontWeight: 700 }}>
          {t('Admin Panel', 'لوحة الأدمن')}
        </span>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[14px] ${
                isActive ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}>
            <item.icon className="w-[18px] h-[18px]" />
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}

        {/* Customer Management (collapsible: Pipeline + Customers) */}
        <button onClick={() => setCustomersOpen(!customersOpen)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[14px] ${
            isCustomers ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          }`}>
          <Users className="w-[18px] h-[18px]" />
          <span style={{ fontWeight: 500 }}>{t('Customer Management', 'إدارة العملاء')}</span>
          {newLeads > 0 && (
            <span className="ms-auto me-1 min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] inline-flex items-center justify-center animate-pulse" style={{ fontWeight: 800 }}>
              {newLeads}
            </span>
          )}
          <span className={newLeads > 0 ? '' : 'ms-auto'}>
            {customersOpen ? <ChevronDown className="w-4 h-4" /> : (dir === 'rtl' ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />)}
          </span>
        </button>
        {customersOpen && (
          <div className="space-y-0.5 ps-3 mt-1">
            {customersItems.map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-[13px] ${
                    isActive ? 'bg-sidebar-accent text-[#043CC8]' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}>
                <item.icon className="w-4 h-4" />
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                {item.showBadge && newLeads > 0 && (
                  <span className="ms-auto min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] inline-flex items-center justify-center" style={{ fontWeight: 800 }}>
                    {newLeads}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Reports */}
        <button onClick={() => setReportsOpen(!reportsOpen)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[14px] ${
            isReports ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          }`}>
          <FileText className="w-[18px] h-[18px]" />
          <span style={{ fontWeight: 500 }}>{t('Reports', 'التقارير')}</span>
          <span className="ms-auto">
            {reportsOpen ? <ChevronDown className="w-4 h-4" /> : (dir === 'rtl' ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />)}
          </span>
        </button>
        {reportsOpen && (
          <div className="space-y-0.5 ps-3 mt-1">
            {reportsItems.map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-[13px] ${
                    isActive ? 'bg-sidebar-accent text-[#043CC8]' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Invoices */}
        <button onClick={() => setInvoicesOpen(!invoicesOpen)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[14px] ${
            isInvoices ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          }`}>
          <Receipt className="w-[18px] h-[18px]" />
          <span style={{ fontWeight: 500 }}>{t('Invoices & Payments', 'الفواتير والمدفوعات')}</span>
          <span className="ms-auto">
            {invoicesOpen ? <ChevronDown className="w-4 h-4" /> : (dir === 'rtl' ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />)}
          </span>
        </button>
        {invoicesOpen && (
          <div className="space-y-0.5 ps-3 mt-1">
            {invoicesItems.map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-[13px] ${
                    isActive ? 'bg-sidebar-accent text-[#043CC8]' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border relative" ref={userMenuRef}>
        <button onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-accent transition-colors">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-[12px] shrink-0" style={{ fontWeight: 700 }}>SA</div>
          <div className="flex-1 min-w-0 text-start">
            <p className="text-[13px] truncate" style={{ fontWeight: 600 }}>{t('Super Admin', 'المشرف العام')}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email ?? ''}</p>
          </div>
          <ChevronUp className={`w-4 h-4 text-sidebar-foreground/40 transition-transform ${userMenuOpen ? '' : 'rotate-180'}`} />
        </button>
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute bottom-full mb-2 left-3 right-3 bg-card border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-[13px] text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
                <span style={{ fontWeight: 500 }}>{t('Log Out', 'تسجيل الخروج')}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex w-[280px] bg-sidebar border-e border-sidebar-border flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-[280px] bg-sidebar h-full shadow-2xl`}>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
          <button className="lg:hidden p-2 hover:bg-muted rounded-xl transition-colors" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-[13px]" style={{ fontWeight: 500 }}>
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'en' ? 'العربية' : 'English'}</span>
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl hover:bg-muted transition-colors">
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {/* Send Notification */}
            <div className="relative">
              <button onClick={() => setSendNotifOpen(!sendNotifOpen)}
                className="p-2 rounded-xl hover:bg-muted transition-colors" title={t('Send Notification', 'إرسال إشعار')}>
                <Send className="w-[18px] h-[18px]" />
              </button>
              {sendNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSendNotifOpen(false)} />
                  <div className={`absolute top-full mt-2 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-[340px] bg-card border border-border rounded-2xl shadow-2xl z-50 p-4`}>
                    <h3 className="text-[15px] mb-3" style={{ fontWeight: 600 }}>{t('Send Notification to Users', 'إرسال إشعار للمستخدمين')}</h3>
                    <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>{t('Title', 'العنوان')}</label>
                    <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
                      placeholder={t('Notification title...', 'عنوان الإشعار...')}
                      className="w-full px-3 py-2 rounded-xl bg-input-background border border-border focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 outline-none transition-all text-[13px] text-foreground mb-3" />
                    <label className="block text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>{t('Message', 'الرسالة')}</label>
                    <textarea value={notifText} onChange={e => setNotifText(e.target.value)}
                      placeholder={t('Write notification content...', 'اكتب محتوى الإشعار...')}
                      className="w-full h-24 px-3 py-2 rounded-xl bg-input-background border border-border focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 outline-none transition-all text-[13px] text-foreground resize-none" />
                    <button onClick={handleSendNotification}
                      disabled={!notifTitle.trim() || !notifText.trim()}
                      className="w-full mt-3 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ fontWeight: 600 }}>
                      {t('Send', 'إرسال')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Remove notification bell - keep only Send Notification */}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}