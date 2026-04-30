import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../integrations/supabase/client';

type Language = 'en' | 'ar';
type Theme = 'dark' | 'light';

interface Notification {
  id: string;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  time: string;
  read: boolean;
}

interface Toast {
  id: string;
  message: string;
}

interface AppContextType {
  language: Language;
  setLanguage: (l: Language) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (en: string, ar: string) => string;
  dir: 'ltr' | 'rtl';
  notifications: Notification[];
  markRead: (id: string) => void;
  unreadCount: number;
  pushNotification: (n: { title: string; titleAr: string; message: string; messageAr: string }) => void;
  toasts: Toast[];
  showToast: (message: string) => void;
  // Auth
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  tenantId: string | null;
  tenantLoading: boolean;
  isSuperAdmin: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
}

const AppContext = createContext<AppContextType | null>(null);

const defaultNotifications: Notification[] = [
  { id: '1', title: 'New Feature', titleAr: 'ميزة جديدة', message: 'AI response quality improved by 40%', messageAr: 'تحسين جودة استجابة الذكاء الاصطناعي بنسبة 40%', time: '2 hours ago', read: false },
  { id: '2', title: 'System Update', titleAr: 'تحديث النظام', message: 'Scheduled maintenance tonight at 2AM', messageAr: 'صيانة مجدولة الليلة الساعة 2 صباحاً', time: '5 hours ago', read: false },
  { id: '3', title: 'Plan Alert', titleAr: 'تنبيه الخطة', message: 'You have used 80% of your word quota', messageAr: 'لقد استخدمت 80% من حصة الكلمات', time: '1 day ago', read: false },
  { id: '4', title: 'New Integration', titleAr: 'تكامل جديد', message: 'WhatsApp Business API now available', messageAr: 'واجهة WhatsApp Business متاحة الآن', time: '2 days ago', read: true },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('fuqah_language');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('fuqah_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'dark';
  });
  const BROADCAST_KEY = 'fuqah.broadcast.notifications';
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const raw = localStorage.getItem(BROADCAST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return defaultNotifications;
  });

  useEffect(() => {
    try { localStorage.setItem(BROADCAST_KEY, JSON.stringify(notifications)); } catch {}
  }, [notifications]);

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key !== BROADCAST_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setNotifications(parsed);
      } catch {}
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const pushNotification = useCallback((n: { title: string; titleAr: string; message: string; messageAr: string }) => {
    setNotifications(prev => [{
      id: Date.now().toString(),
      title: n.title,
      titleAr: n.titleAr,
      message: n.message,
      messageAr: n.messageAr,
      time: 'now',
      read: false,
    }, ...prev]);
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Real Supabase auth
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // Auth listener — set up FIRST, then fetch initial session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Resolve tenant for the current user
  useEffect(() => {
    if (!session?.user) { setTenantId(null); return; }
    let cancelled = false;
    setTenantLoading(true);
    supabase
      .from('auth_tenant_members')
      .select('tenant_id, role, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setTenantId(data?.tenant_id ?? null);
          setTenantLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Resolve super_admin role for the current user
  useEffect(() => {
    if (!session?.user) { setIsSuperAdmin(false); setRoleLoading(false); return; }
    let cancelled = false;
    setRoleLoading(true);
    supabase
      .from('auth_user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'super_admin')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) { setIsSuperAdmin(!!data); setRoleLoading(false); }
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setTenantId(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  }, []);

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem('fuqah_language', l);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('fuqah_theme', t);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.body.style.fontFamily = "'IBM Plex Sans Arabic', 'Inter', system-ui, -apple-system, sans-serif";
  }, [language]);

  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' as const : 'ltr' as const;
  const markRead = (id: string) => setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  const unreadCount = notifications.filter(n => !n.read).length;

  const showToast = useCallback((message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <AppContext.Provider value={{
      language, setLanguage, theme, setTheme, t, dir,
      notifications, markRead, unreadCount, pushNotification,
      toasts, showToast,
      session, user: session?.user ?? null, authLoading,
      tenantId, tenantLoading,
      isSuperAdmin,
      roleLoading,
      signIn, signUp, signOut, sendPasswordReset,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};