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
