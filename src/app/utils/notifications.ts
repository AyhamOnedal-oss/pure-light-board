export const CURRENT_USER_ID = 'admin-1';
export const CURRENT_USER_NAME = 'Ahmed Al-Rashid';
export const CURRENT_USER_ROLE: 'admin' | 'team' = 'admin';

const NS = 'fuqah.notif';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export function getTs(key: string): number {
  const v = safeGet(key);
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
export function setTs(key: string, ts: number = Date.now()) {
  safeSet(key, String(ts));
}

export const notifKeys = {
  ticketsListSeen: (uid: string) => `${NS}.${uid}.tickets.list`,
  conversationsListSeen: (uid: string) => `${NS}.${uid}.conversations.list`,
  ticketOpened: (uid: string, tid: string) => `${NS}.${uid}.tickets.open.${tid}`,
  ticketNotesSeen: (uid: string, tid: string) => `${NS}.${uid}.tickets.notes.${tid}`,
  conversationOpened: (uid: string, cid: string) => `${NS}.${uid}.conversations.open.${cid}`,
};

export function toMs(dateLike: string): number {
  try {
    const d = new Date(dateLike.includes('T') ? dateLike : dateLike.replace(' ', 'T'));
    return d.getTime();
  } catch { return 0; }
}
