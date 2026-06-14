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
  kind?: 'ticket_new' | string;
  ticketId?: string;
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
  markTicketNotificationRead: (ticketId: string) => void;
  unreadCount: number;
  pushNotification: (n: { title: string; titleAr: string; message: string; messageAr: string; kind?: string; ticketId?: string }) => void;
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

  const pushNotification = useCallback((n: { title: string; titleAr: string; message: string; messageAr: string; kind?: string; ticketId?: string }) => {
    setNotifications(prev => {
      // De-dupe ticket_new by ticketId so we don't stack the same alert
      // when realtime + backfill both fire, or across tab refreshes.
      if (n.kind === 'ticket_new' && n.ticketId && prev.some(p => (p as any).ticketId === n.ticketId)) {
        return prev;
      }
      return [{
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        title: n.title,
        titleAr: n.titleAr,
        message: n.message,
        messageAr: n.messageAr,
        time: 'now',
        read: false,
        kind: n.kind,
        ticketId: n.ticketId,
      }, ...prev];
    });
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Per-message cooldown so the same error can't be re-shown immediately
  // after it auto-dismisses. Without this, components that retry on every
  // render (e.g. failed RLS-restricted queries) can spam dozens of copies.
  const toastCooldownRef = React.useRef<Map<string, number>>(new Map());

  // Real Supabase auth
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // Tracks whether the most recent sign-out was initiated by the user
  // (Log Out button) vs. happening involuntarily (e.g. the server-side
  // auth user was deleted). Without this, `onAuthStateChange` would
  // treat every normal logout as a "deleted account" event.
  const explicitSignOutRef = React.useRef(false);

  // Auth listener — set up FIRST, then fetch initial session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Only treat this as "account deleted" when it was NOT an
      // explicit user-initiated sign-out. USER_DELETED is unambiguous;
      // TOKEN_REFRESHED with no session means the refresh failed
      // (typically because the auth user was removed server-side).
      // Plain SIGNED_OUT also fires on normal logout, so we ignore it
      // unless we can prove the account is actually gone.
      const wasExplicit = explicitSignOutRef.current;
      if (event === 'SIGNED_OUT') explicitSignOutRef.current = false;
      if (!s && !wasExplicit && (event === 'USER_DELETED' || event === 'TOKEN_REFRESHED')) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.replace('/login?reason=deleted');
        }
      }
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
    (async () => {
      const uid = session.user.id;
      // Priority:
      //  1. A tenant where the user has a team_members row (= invited
      //     employee) — keeps invited users in the inviter's workspace
      //     instead of the personal one auto-provisioned at signup.
      //  2. The oldest non-owner membership.
      //  3. The oldest owner membership (normal signup).
      const [memRes, invRes] = await Promise.all([
        supabase
          .from('auth_tenant_members')
          .select('tenant_id, role, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: true }),
        supabase
          .from('team_members')
          .select('tenant_id, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      const memberships = memRes.data ?? [];
      const invites = invRes.data ?? [];
      // No memberships at all + not a super admin ⇒ this account was
      // deleted by an admin. Force sign-out and route to login with the
      // "account deleted" reason so the user sees a clear Arabic message.
      if (memberships.length === 0 && invites.length === 0) {
        // Defer the role check to the next tick using a fresh query so we
        // don't race with the super-admin effect.
        const { data: roleRow } = await supabase
          .from('auth_user_roles')
          .select('role')
          .eq('user_id', uid)
          .eq('role', 'super_admin')
          .maybeSingle();
        if (!roleRow) {
          await supabase.auth.signOut();
          setSession(null);
          setTenantId(null);
          setTenantLoading(false);
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.replace('/login?reason=deleted');
          }
          return;
        }
      }
      const inviteIds = new Set(invites.map((i: any) => i.tenant_id));
      const pick =
        memberships.find((m: any) => inviteIds.has(m.tenant_id)) ||
        memberships.find((m: any) => m.role !== 'owner') ||
        memberships[0];
      setTenantId(pick?.tenant_id ?? null);
      setTenantLoading(false);
    })();
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
    explicitSignOutRef.current = true;
    await supabase.auth.signOut();
    setSession(null);
    setTenantId(null);
  }, []);

  // Push a bell notification for every new ticket on this tenant.
  // - Subscribes to realtime INSERTs on tickets_main
  // - Backfills the last 24h on mount so the bell is populated after login
  // - De-dupes per ticketId using a persistent localStorage set so we don't
  //   re-push across refreshes or multiple tabs.
  useEffect(() => {
    if (!tenantId || !session?.user?.id) return;
    const uid = session.user.id;
    const SEEN_KEY = `fuqah.notif.${uid}.ticket_new.seen`;
    const readSeen = (): Set<string> => {
      try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
      catch { return new Set(); }
    };
    const writeSeen = (s: Set<string>) => {
      try {
        // cap at 500 most-recent ids to keep storage bounded
        const arr = Array.from(s);
        const capped = arr.length > 500 ? arr.slice(arr.length - 500) : arr;
        localStorage.setItem(SEEN_KEY, JSON.stringify(capped));
      } catch {}
    };
    const pushTicket = (row: { id: string; display_code?: string | null; customer_name?: string | null }) => {
      const seen = readSeen();
      if (seen.has(row.id)) return;
      seen.add(row.id);
      writeSeen(seen);
      const code = row.display_code || row.id.slice(0, 8);
      const who = row.customer_name?.trim() || 'Storefront visitor';
      const whoAr = row.customer_name?.trim() || 'زائر المتجر';
      pushNotification({
        kind: 'ticket_new',
        ticketId: row.id,
        title: 'New ticket opened',
        titleAr: 'تم فتح تذكرة جديدة',
        message: `${who} — ${code}`,
        messageAr: `${whoAr} — ${code}`,
      });
    };

    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('tickets_main')
        .select('id, display_code, customer_name, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(50);
      if (cancelled || !data) return;
      data.forEach(pushTicket);
    })();

    const channel = supabase
      .channel(`bell-tickets-${tenantId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets_main', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as { id: string; display_code?: string | null; customer_name?: string | null };
          if (row?.id) pushTicket(row);
        })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tenantId, session?.user?.id, pushNotification]);

  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: {
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      return { error: error?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? 'Failed to send reset email' };
    }
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
  const markTicketNotificationRead = useCallback((ticketId: string) => {
    setNotifications(n => n.map(x =>
      x.kind === 'ticket_new' && x.ticketId === ticketId ? { ...x, read: true } : x
    ));
  }, []);
  const unreadCount = notifications.filter(n => !n.read).length;

  const showToast = useCallback((message: string) => {
    const now = Date.now();
    const COOLDOWN_MS = 4000;
    const last = toastCooldownRef.current.get(message) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    toastCooldownRef.current.set(message, now);
    setToasts(prev => {
      // Deduplicate: don't stack the same message repeatedly.
      if (prev.some(t => t.message === message)) return prev;
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`;
      // Hard cap to avoid runaway stacks.
      const capped = prev.length >= 4 ? prev.slice(-3) : prev;
      setTimeout(() => {
        setToasts(cur => cur.filter(t => t.id !== id));
      }, 3000);
      return [...capped, { id, message }];
    });
  }, []);

  return (
    <AppContext.Provider value={{
      language, setLanguage, theme, setTheme, t, dir,
      notifications, markRead, markTicketNotificationRead, unreadCount, pushNotification,
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