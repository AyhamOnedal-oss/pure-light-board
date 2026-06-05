export type PermissionKey =
  | 'home'
  | 'team'
  | 'conversations'
  | 'tickets'
  | 'settings'
  | 'settings_train_ai'
  | 'settings_chat_design'
  | 'settings_test_chat'
  | 'settings_plans'
  | 'settings_account'
  | 'settings_store';

export interface MemberPermissions {
  home?: boolean;
  team?: boolean;
  conversations?: boolean;
  tickets?: boolean;
  settings?: boolean;
  settings_train_ai?: boolean;
  settings_chat_design?: boolean;
  settings_test_chat?: boolean;
  settings_plans?: boolean;
  settings_account?: boolean;
  settings_store?: boolean;
}

export const SETTINGS_SUB_KEYS: PermissionKey[] = [
  'settings_train_ai',
  'settings_chat_design',
  'settings_test_chat',
  'settings_plans',
  'settings_account',
  'settings_store',
];

export const TOP_LEVEL_KEYS: PermissionKey[] = [
  'home', 'team', 'conversations', 'tickets', 'settings',
];

export const PATH_TO_PERMISSION: Record<string, PermissionKey> = {
  '/dashboard': 'home',
  '/dashboard/team': 'team',
  '/dashboard/conversations': 'conversations',
  '/dashboard/tickets': 'tickets',
  '/dashboard/settings/train-ai': 'settings_train_ai',
  '/dashboard/settings/customize': 'settings_chat_design',
  '/dashboard/settings/test-chat': 'settings_test_chat',
  '/dashboard/settings/plans': 'settings_plans',
  '/dashboard/settings/account': 'settings_account',
  '/dashboard/settings/store': 'settings_store',
};

export function countEnabled(p: MemberPermissions): number {
  let n = 0;
  for (const k of Object.keys(p) as PermissionKey[]) {
    if (p[k]) n += 1;
  }
  return n;
}

export function emptyPermissions(): MemberPermissions {
  return {};
}

// --- Current-user resolution (demo: admin = all). Wire to real auth later. ---
const CURRENT_MEMBER_KEY = 'fuqah.currentMember.id';

export function getCurrentMemberId(): string | null {
  try { return localStorage.getItem(CURRENT_MEMBER_KEY); } catch { return null; }
}
export function setCurrentMemberId(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(CURRENT_MEMBER_KEY);
    else localStorage.setItem(CURRENT_MEMBER_KEY, id);
  } catch {}
}

const ALL_TRUE: MemberPermissions = {
  home: true, team: true, conversations: true, tickets: true, settings: true,
  settings_train_ai: true, settings_chat_design: true, settings_test_chat: true,
  settings_plans: true, settings_account: true, settings_store: true,
};

export function getCurrentUserPermissions(getMemberById: (id: string) => { permissions?: MemberPermissions } | undefined): MemberPermissions {
  const id = getCurrentMemberId();
  if (!id) return ALL_TRUE; // admin
  const m = getMemberById(id);
  return m?.permissions || {};
}

export function isAllowed(perms: MemberPermissions, key: PermissionKey): boolean {
  if (!perms) return false;
  if (key.startsWith('settings_')) {
    return !!perms.settings && !!perms[key];
  }
  return !!perms[key];
}

// --- Live permissions for the signed-in user from team_members ---
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ResolvedPermissions = MemberPermissions | 'all';

/**
 * Resolve the currently signed-in user's effective permissions for the
 * active tenant. Returns 'all' for tenant owners/admins (no team_members
 * row, since they created the workspace) or super admins, and the stored
 * `permissions` JSON for invited members.
 */
export function useCurrentMemberPermissions(
  userId: string | null | undefined,
  tenantId: string | null | undefined,
  isSuperAdmin: boolean,
): { perms: ResolvedPermissions; loading: boolean } {
  // Start locked-down. Never default to 'all' — otherwise the sidebar and
  // route guards briefly treat invited employees as full admins on the
  // initial render, before the async role/permission query resolves.
  const [perms, setPerms] = useState<ResolvedPermissions>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isSuperAdmin) { setPerms('all'); setLoading(false); return; }
    if (!userId || !tenantId) {
      // Safe default while we don't know the user/tenant yet: deny everything.
      // Returning 'all' here was unlocking restricted pages (tickets, etc.)
      // for invited employees during the brief loading window.
      setPerms({});
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Tenant role: owner/admin bypass the per-member permission map.
      const { data: tm } = await supabase
        .from('auth_tenant_members')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      const role = tm?.role as string | undefined;
      if (role === 'owner' || role === 'admin') {
        if (!cancelled) { setPerms('all'); setLoading(false); }
        return;
      }
      const { data: row } = await supabase
        .from('team_members')
        .select('permissions')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const p = (row?.permissions as MemberPermissions | undefined) || {};
      setPerms(p);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, tenantId, isSuperAdmin]);

  return { perms, loading };
}

export function firstAllowedPath(perms: ResolvedPermissions): string {
  if (perms === 'all') return '/dashboard';
  if (perms.home) return '/dashboard';
  if (perms.conversations) return '/dashboard/conversations';
  if (perms.tickets) return '/dashboard/tickets';
  if (perms.team) return '/dashboard/team';
  if (perms.settings) {
    for (const k of SETTINGS_SUB_KEYS) {
      if (perms[k]) {
        const entry = Object.entries(PATH_TO_PERMISSION).find(([, v]) => v === k);
        if (entry) return entry[0];
      }
    }
  }
  return '/dashboard';
}
