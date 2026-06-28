// Per-admin notification tracking for the Landing Page area.
// Uses localStorage scoped by admin user id.

const NS = 'fuqah.admin.landing';

function get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function set(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} }

export const landingKeys = {
  listSeen: (uid: string) => `${NS}.list.${uid}`,
  leadOpened: (uid: string, leadId: string) => `${NS}.open.${uid}.${leadId}`,
  leadNotesSeen: (uid: string, leadId: string) => `${NS}.notes.${uid}.${leadId}`,
};

export function getListSeenAt(uid: string): number {
  return Number(get(landingKeys.listSeen(uid))) || 0;
}
export function markListSeen(uid: string, ts: number = Date.now()) {
  set(landingKeys.listSeen(uid), String(ts));
}

export function getLeadOpenedAt(uid: string, leadId: string): number {
  return Number(get(landingKeys.leadOpened(uid, leadId))) || 0;
}
export function markLeadOpened(uid: string, leadId: string, notesCount: number, ts: number = Date.now()) {
  set(landingKeys.leadOpened(uid, leadId), String(ts));
  set(landingKeys.leadNotesSeen(uid, leadId), String(notesCount));
}

export function getLeadNotesSeenCount(uid: string, leadId: string): number {
  const v = get(landingKeys.leadNotesSeen(uid, leadId));
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface LandingLeadLike {
  id: string;
  created_at: string;
  notes?: Array<{ createdAt: string }> | null;
}

export function isLeadNewFor(uid: string, lead: LandingLeadLike): boolean {
  const opened = getLeadOpenedAt(uid, lead.id);
  if (opened > 0) return false;
  return new Date(lead.created_at).getTime() > getListSeenAt(uid);
}

export function unseenNotesCountFor(uid: string, lead: LandingLeadLike): number {
  const total = (lead.notes || []).length;
  const seen = getLeadNotesSeenCount(uid, lead.id);
  return Math.max(0, total - seen);
}

export function countSidebarBadge(uid: string, leads: LandingLeadLike[]): number {
  let count = 0;
  const listSeen = getListSeenAt(uid);
  for (const l of leads) {
    const opened = getLeadOpenedAt(uid, l.id);
    const isNew = opened === 0 && new Date(l.created_at).getTime() > listSeen;
    const noteDelta = unseenNotesCountFor(uid, l) > 0;
    if (isNew || noteDelta) count++;
  }
  return count;
}