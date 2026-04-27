import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { ToastContainer } from './ToastContainer';
import {
  LayoutDashboard, Users, MessageSquare, Ticket, Settings,
  ChevronDown, ChevronRight, Brain, CreditCard, User,
  Globe, Moon, Sun, Bell, Menu, X, Paintbrush, MessageCircle, Store,
  LogOut, ChevronUp
} from 'lucide-react';
import logoDark from '../../imports/FUQAH-AI-Logo-01@2x.png';
import logoLight from '../../imports/FUQAH-AI-Logo-02@2x.png';
import { mockConversations } from './ConversationsPage';
import { buildTicketsFromConversations } from './TicketsPage';
import { CURRENT_USER_ID, notifKeys, getTs, setTs, toMs } from '../utils/notifications';
import { getCurrentMemberId, isAllowed, MemberPermissions, PermissionKey } from '../utils/permissions';

const TEAM_STORAGE_KEY = 'fuqah_team_members';
function readCurrentUserPermissions(): MemberPermissions | 'all' {
  const id = getCurrentMemberId();
  if (!id) return 'all';
  try {
    const raw = localStorage.getItem(TEAM_STORAGE_KEY);
    if (!raw) return {};
    const members = JSON.parse(raw) as Array<{ id: string; permissions?: MemberPermissions }>;
    const m = members.find(x => x.id === id);
    return m?.permissions || {};
  } catch { return {}; }
}

export function Layout() {
  const { t, theme, setTheme, language, setLanguage, notifications, markRead, unreadCount, dir } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isSettings = location.pathname.startsWith('/dashboard/settings');

  useEffect(() => {
    if (isSettings && !settingsOpen) setSettingsOpen(true);
  }, [isSettings]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const [badgeVersion, setBadgeVersion] = useState(0);
  useEffect(() => {
    const path = location.pathname;
    if (path === '/dashboard/tickets') {
      setTs(notifKeys.ticketsListSeen(CURRENT_USER_ID));
    } else if (path === '/dashboard/conversations') {
      setTs(notifKeys.conversationsListSeen(CURRENT_USER_ID));
    }
    setBadgeVersion(v => v + 1);
  }, [location.pathname]);
  useEffect(() => {
    const onFocus = () => setBadgeVersion(v => v + 1);
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(onFocus, 5000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(id); };
  }, []);

  const ticketsSeenTs = getTs(notifKeys.ticketsListSeen(CURRENT_USER_ID));
  const conversationsSeenTs = getTs(notifKeys.conversationsListSeen(CURRENT_USER_ID));
  const ticketsBadge = React.useMemo(() => {
    const list = buildTicketsFromConversations();
    return list.filter(tk => toMs(tk.createdAt) > ticketsSeenTs).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsSeenTs, badgeVersion]);
  const conversationsBadge = React.useMemo(() => {
    return mockConversations.filter(c => toMs(c.createdAt) > conversationsSeenTs).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationsSeenTs, badgeVersion]);

  const userPerms = readCurrentUserPermissions();
  const can = (key: PermissionKey) => userPerms === 'all' ? true : isAllowed(userPerms, key);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('Home', 'الرئيسية'), end: true, badge: 0, key: 'home' as PermissionKey },
    { to: '/dashboard/team', icon: Users, label: t('Team', 'الفريق'), badge: 0, key: 'team' as PermissionKey },
    { to: '/dashboard/conversations', icon: MessageSquare, label: t('Conversations', 'المحادثات'), badge: conversationsBadge, key: 'conversations' as PermissionKey },
    { to: '/dashboard/tickets', icon: Ticket, label: t('Tickets', 'التذاكر'), badge: ticketsBadge, key: 'tickets' as PermissionKey },
  ];

  const settingsItems = [
    { to: '/dashboard/settings/train-ai', icon: Brain, label: t('Train AI', 'تدريب الذكاء'), key: 'settings_train_ai' as PermissionKey },
    { to: '/dashboard/settings/customize', icon: Paintbrush, label: t('Chat Design', 'تصميم المحادثة'), key: 'settings_chat_design' as PermissionKey },
    { to: '/dashboard/settings/test-chat', icon: MessageCircle, label: t('Test Chat', 'اختبار المحادثة'), key: 'settings_test_chat' as PermissionKey },
    { to: '/dashboard/settings/plans', icon: CreditCard, label: t('Plans', 'الخطط'), key: 'settings_plans' as PermissionKey },
    { to: '/dashboard/settings/account', icon: User, label: t('Account', 'الحساب'), key: 'settings_account' as PermissionKey },
    { to: '/dashboard/settings/store', icon: Store, label: t('Store Info', 'معلومات المتجر'), key: 'settings_store' as PermissionKey },
  ];

  const canSettings = userPerms === 'all' ? true : !!(userPerms as MemberPermissions).settings;

  const logo = theme === 'dark' ? logoDark : logoLight;

  const handleLogout = async () => {
    setUserMenuOpen(false);
    try { await signOut(); } catch {}
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-center">
        <img src={logo} alt="Fuqah AI" className="h-14 w-auto object-contain max-w-[220px]" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const allowed = can(item.key);
          if (!allowed) {
            return (
              <div
                key={item.to}
                onClick={(e) => e.preventDefault()}
                title={t('You do not have access to this section', 'ليس لديك صلاحية الوصول إلى هذا القسم')}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] opacity-40 cursor-not-allowed select-none text-sidebar-foreground/50"
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span className="ms-auto w-[18px] h-[18px] rounded-full border-2 border-red-500 relative flex items-center justify-center" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-[2px] bg-red-500 rotate-45" />
                </span>
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[14px] ${
                  isActive
                    ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span style={{ fontWeight: 500 }}>{item.label}</span>
              {item.badge > 0 && (
                <span className="ms-auto min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center" style={{ fontWeight: 700 }}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Settings */}
        {canSettings ? (
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[14px] ${
              isSettings
                ? 'bg-[#043CC8] text-white shadow-lg shadow-[#043CC8]/20'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}
          >
            <Settings className="w-[18px] h-[18px]" />
            <span style={{ fontWeight: 500 }}>{t('Settings', 'الإعدادات')}</span>
            <span className="ms-auto">
              {settingsOpen ? <ChevronDown className="w-4 h-4" /> : (dir === 'rtl' ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />)}
            </span>
          </button>
        ) : (
          <div
            title={t('You do not have access to this section', 'ليس لديك صلاحية الوصول إلى هذا القسم')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] opacity-40 cursor-not-allowed select-none text-sidebar-foreground/50"
          >
            <Settings className="w-[18px] h-[18px]" />
            <span style={{ fontWeight: 500 }}>{t('Settings', 'الإعدادات')}</span>
            <span className="ms-auto w-[18px] h-[18px] rounded-full border-2 border-red-500 relative flex items-center justify-center" aria-hidden>
              <span className="absolute inset-x-0 top-1/2 h-[2px] bg-red-500 rotate-45" />
            </span>
          </div>
        )}

        {canSettings && settingsOpen && (
          <div className="space-y-0.5 ps-3 mt-1">
            {settingsItems.map(item => {
              const allowed = can(item.key);
              if (!allowed) {
                return (
                  <div
                    key={item.to}
                    title={t('You do not have access to this section', 'ليس لديك صلاحية الوصول إلى هذا القسم')}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl text-[13px] opacity-40 cursor-not-allowed select-none text-sidebar-foreground/50"
                  >
                    <item.icon className="w-4 h-4" />
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                    <span className="ms-auto w-4 h-4 rounded-full border-2 border-red-500 relative flex items-center justify-center" aria-hidden>
                      <span className="absolute inset-x-0 top-1/2 h-[2px] bg-red-500 rotate-45" />
                    </span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-[13px] ${
                      isActive
                        ? 'bg-sidebar-accent text-[#043CC8]'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span style={{ fontWeight: 500 }}>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-accent transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#043CC8] to-[#00FFF4] flex items-center justify-center text-white text-[12px] shrink-0" style={{ fontWeight: 700 }}>
            AH
          </div>
          <div className="flex-1 min-w-0 text-start">
            <p className="text-[13px] truncate" style={{ fontWeight: 600 }}>{t('Ahmed Hassan', 'أحمد حسن')}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate">admin@store.com</p>
          </div>
          <ChevronUp className={`w-4 h-4 text-sidebar-foreground/40 transition-transform ${userMenuOpen ? '' : 'rotate-180'}`} />
        </button>

        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute bottom-full mb-2 left-3 right-3 bg-card border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-[13px] text-red-400 transition-colors"
              >
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[260px] bg-sidebar border-e border-sidebar-border flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-[260px] bg-sidebar h-full shadow-2xl`}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
          <button className="lg:hidden p-2 hover:bg-muted rounded-xl transition-colors" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-[13px]"
              style={{ fontWeight: 500 }}
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'en' ? 'العربية' : 'English'}</span>
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-xl hover:bg-muted transition-colors relative"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 end-1 w-4 h-4 bg-[#ff4466] text-white rounded-full text-[10px] flex items-center justify-center" style={{ fontWeight: 700 }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className={`absolute top-full mt-2 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-[340px] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden`}>
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('Notifications', 'الإشعارات')}</h3>
                      {unreadCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#043CC8]/10 text-[#043CC8]" style={{ fontWeight: 600 }}>
                          {unreadCount} {t('new', 'جديد')}
                        </span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={`w-full text-start p-4 hover:bg-muted/50 border-b border-border last:border-0 transition-colors ${!n.read ? 'bg-[#043CC8]/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            {!n.read && <div className="w-2 h-2 rounded-full bg-[#043CC8] mt-1.5 shrink-0" />}
                            <div className={!n.read ? '' : 'ps-5'}>
                              <p className="text-[14px]" style={{ fontWeight: 500 }}>{language === 'ar' ? n.titleAr : n.title}</p>
                              <p className="text-[13px] text-muted-foreground mt-0.5">{language === 'ar' ? n.messageAr : n.message}</p>
                              <p className="text-[11px] text-muted-foreground/60 mt-1.5">{n.time}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
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