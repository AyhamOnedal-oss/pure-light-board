import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../integrations/supabase/client';
import type { AdminPermKey } from '../utils/adminPermissions';
import { ADMIN_ALL_PERM_KEYS } from '../utils/adminPermissions';

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
  kind?: 'word_limit_warning' | 'word_limit_reached' | 'subscription_renewed' | 'admin_message' | string;
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
  pushNotification: (n: { title: string; message: string }) => Promise<{ ok: boolean; error?: string }>;
  toasts: Toast[];
  showToast: (message: string) => void;
  // Auth
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  tenantId: string | null;
  tenantLoading: boolean;
  isSuperAdmin: boolean;
  isAdminEmployee: boolean;
  isAnyAdmin: boolean;
  roleLoading: boolean;
  adminPermissions: AdminPermKey[];
  adminPermissionsLoading: boolean;
  adminCan: (key: AdminPermKey) => boolean;
  isSubscriptionEnded: boolean;
  subscriptionLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('fuqah_language');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('fuqah_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'dark';
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
  const [isAdminEmployee, setIsAdminEmployee] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermKey[]>([]);
  const [adminPermissionsLoading, setAdminPermissionsLoading] = useState(true);
  const [isSubscriptionEnded, setIsSubscriptionEnded] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

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
          .in('role', ['super_admin', 'admin'])
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

  // Resolve admin roles (super_admin and admin-employee) for the current user
  useEffect(() => {
    if (!session?.user) {
      setIsSuperAdmin(false); setIsAdminEmployee(false); setRoleLoading(false); return;
    }
    let cancelled = false;
    setRoleLoading(true);
    supabase
      .from('auth_user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .in('role', ['super_admin', 'admin'])
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r: any) => r.role);
        setIsSuperAdmin(roles.includes('super_admin'));
        setIsAdminEmployee(roles.includes('admin'));
        setRoleLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Load the per-staff admin permissions for the signed-in user.
  // - super_admin -> all permissions
  // - admin (employee) -> permissions array from admin_team_members (active only)
  // - others -> none
  useEffect(() => {
    if (!session?.user) {
      setAdminPermissions([]); setAdminPermissionsLoading(false); return;
    }
    if (roleLoading) return;
    if (isSuperAdmin) {
      setAdminPermissions([...ADMIN_ALL_PERM_KEYS]);
      setAdminPermissionsLoading(false);
      return;
    }
    if (!isAdminEmployee) {
      setAdminPermissions([]);
      setAdminPermissionsLoading(false);
      return;
    }
    let cancelled = false;
    setAdminPermissionsLoading(true);
    (async () => {
      const uid = session.user.id;
      let perms: string[] = [];
      // Try by user_id first (fast path after backfill).
      const { data: byId } = await supabase
        .from('admin_team_members')
        .select('permissions, status')
        .eq('user_id', uid)
        .maybeSingle();
      let row: any = byId;
      if (!row && session.user.email) {
        const { data: byEmail } = await supabase
          .from('admin_team_members')
          .select('permissions, status')
          .ilike('email', session.user.email)
          .maybeSingle();
        row = byEmail;
      }
      if (row && row.status === 'active' && Array.isArray(row.permissions)) {
        perms = row.permissions as string[];
      }
      if (!cancelled) {
        setAdminPermissions(perms as AdminPermKey[]);
        setAdminPermissionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id, isSuperAdmin, isAdminEmployee, roleLoading]);

  const adminCan = useCallback(
    (key: AdminPermKey) => isSuperAdmin || adminPermissions.includes(key),
    [isSuperAdmin, adminPermissions],
  );

  // Subscription gate — block dashboard access when status='suspended'
  // or subscription_end_date is in the past.
  useEffect(() => {
    if (!tenantId) { setIsSubscriptionEnded(false); setSubscriptionLoading(false); return; }
    let cancelled = false;
    setSubscriptionLoading(true);
    (async () => {
      const [{ data: ws }, { data: plan }] = await Promise.all([
        supabase.from('settings_workspace').select('status').eq('id', tenantId).maybeSingle(),
        supabase.from('settings_plans').select('subscription_end_date').eq('tenant_id', tenantId).maybeSingle(),
      ]);
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const endDate = (plan?.subscription_end_date || '').toString().slice(0, 10);
      const ended = (ws?.status === 'suspended') || (!!endDate && endDate < today);
      setIsSubscriptionEnded(ended);
      setSubscriptionLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

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

  // Load bell notifications for the current tenant from app_notifications.
  // Subscribes to realtime so new events (word limit, renewal, admin
  // broadcast) appear instantly. Per-user "read" tracking lives in the
  // row's read_by jsonb array.
  const userIdForRead = session?.user?.id ?? null;
  useEffect(() => {
    if (!tenantId || !userIdForRead) { setNotifications([]); return; }
    let cancelled = false;

    const mapRow = (r: any): Notification => {
      const readBy: string[] = Array.isArray(r.read_by) ? r.read_by : [];
      return {
        id: r.id,
        title: r.title_en ?? '',
        titleAr: r.title_ar ?? '',
        message: r.message_en ?? '',
        messageAr: r.message_ar ?? '',
        time: r.created_at ?? '',
        read: readBy.includes(userIdForRead),
        kind: r.kind,
      };
    };

    const load = async () => {
      const { data } = await supabase
        .from('app_notifications')
        .select('id, kind, title_en, title_ar, message_en, message_ar, read_by, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      const rows = (data ?? []).map(mapRow);
      // TEMP: mock bell entries for design/QA. Remove when real events flow in.
      const now = Date.now();
      const mocks: Notification[] = [
        {
          id: 'mock-word-warning',
          title: 'Approaching conversation limit',
          titleAr: 'اقتراب من حد المحادثات',
          message: 'You have used 80% of your monthly conversation quota.',
          messageAr: 'لقد استخدمت 80% من حصة المحادثات الشهرية.',
          time: new Date(now - 5 * 60_000).toISOString(),
          read: false,
          kind: 'word_limit_warning',
        },
        {
          id: 'mock-renewed',
          title: 'Subscription renewed',
          titleAr: 'تم تجديد الاشتراك',
          message: 'Your subscription has been renewed successfully.',
          messageAr: 'تم تجديد اشتراكك بنجاح.',
          time: new Date(now - 2 * 60 * 60_000).toISOString(),
          read: false,
          kind: 'subscription_renewed',
        },
        {
          id: 'mock-admin-msg',
          title: 'Scheduled maintenance',
          titleAr: 'صيانة مجدولة',
          message: 'The service will undergo maintenance tonight at 2 AM.',
          messageAr: 'سيخضع النظام لصيانة الليلة في الساعة الثانية صباحاً.',
          time: new Date(now - 24 * 60 * 60_000).toISOString(),
          read: true,
          kind: 'admin_message',
        },
      ];
      setNotifications([...rows, ...mocks]);
    };
    load();

    const channel = supabase
      .channel(`bell-notifs-${tenantId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_notifications', filter: `tenant_id=eq.${tenantId}` },
        () => load())
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [tenantId, userIdForRead]);

  const pushNotification = useCallback(async (n: { title: string; message: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke('broadcast-admin-notification', {
        body: { title: n.title, message: n.message },
      });
      if (error) return { ok: false, error: error.message };
      if ((data as any)?.error) return { ok: false, error: String((data as any).error) };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'failed' };
    }
  }, []);

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
  const markRead = useCallback(async (id: string) => {
    const uid = session?.user?.id;
    if (!uid) return;
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    // Append uid to read_by jsonb (idempotent).
    const { data: row } = await supabase
      .from('app_notifications')
      .select('read_by')
      .eq('id', id)
      .maybeSingle();
    const existing: string[] = Array.isArray((row as any)?.read_by) ? (row as any).read_by : [];
    if (existing.includes(uid)) return;
    const next = [...existing, uid];
    await supabase.from('app_notifications').update({ read_by: next }).eq('id', id);
  }, [session?.user?.id]);
  // Kept for backward compatibility — ticket notifications were removed.
  const markTicketNotificationRead = useCallback((_ticketId: string) => {}, []);
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
      isAdminEmployee,
      isAnyAdmin: isSuperAdmin || isAdminEmployee,
      roleLoading,
      adminPermissions,
      adminPermissionsLoading,
      adminCan,
      isSubscriptionEnded, subscriptionLoading,
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