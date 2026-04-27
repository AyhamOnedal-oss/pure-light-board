export type LeadSource = 'tiktok' | 'facebook' | 'instagram' | 'snapchat' | 'google' | 'zid' | 'salla' | 'manual';

export type LeadStatus =
  | 'new_lead'              // from ad platform, not contacted
  | 'contacted'             // sales reached out
  | 'not_interested'        // contacted but declined
  | 'trial'                 // trial subscription active
  | 'trial_expired'         // trial ended, not converted
  | 'subscribed'            // paid subscriber
  | 'subscription_expired'  // paid subscription ended
  | 'cancelled';            // unsubscribed

export interface CustomColumnOption {
  id: string;
  label: string;
  labelAr: string;
  color: string;
}

export type ColumnType = 'text' | 'status' | 'date' | 'money';

export interface CustomColumn {
  id: string;
  label: string;
  labelAr: string;
  type: ColumnType;
  color: string;
  options?: CustomColumnOption[]; // for status type
}

export type AttachmentKind = 'image' | 'file' | 'link';

export interface NoteAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  dataUrl?: string;   // images/small files stored inline
  url?: string;       // links
  mime?: string;
  size?: number;
}

export interface CustomerNote {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  attachments?: NoteAttachment[];
}

export interface JourneyEvent {
  id: string;
  status: LeadStatus;
  date: string;            // ISO
  note?: string;
  automatic?: boolean;     // system-generated (e.g. trial expired)
}

export interface PipelineCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: LeadSource;
  /** The e-commerce platform (Zid/Salla) the customer actually subscribed on.
   *  Source stays as the original marketing platform (TikTok, Snapchat, etc.). */
  subscribedVia?: 'zid' | 'salla';
  status: LeadStatus;
  subscriptionPrice?: number;       // SAR/month
  subscriptionPlan?: string;        // e.g. "Pro", "Growth"
  startDate?: string;               // ISO date
  endDate?: string;                 // ISO date
  notes: CustomerNote[];
  journey: JourneyEvent[];
  trialExpiredAcknowledged?: boolean;
  subscriptionExpiredAcknowledged?: boolean;
  createdAt: string;
  viewed: boolean;                  // legacy global flag (kept for backwards compat)
  notesSeenAt?: string;             // legacy global flag
  /** Per-user acknowledgement map. Key = user id. */
  seenBy?: Record<string, { viewedAt?: string; notesSeenAt?: string }>;
  /** User IDs that explicitly marked this customer as unread via the row menu. */
  forcedUnreadBy?: string[];
  /** Team members assigned to follow up with this customer. */
  assignedMemberIds?: string[];
  customValues: Record<string, string>; // columnId -> optionId (kept for backwards compatibility)
}

const CUSTOMERS_KEY = 'fuqah.pipeline.customers.v1';
const COLUMNS_KEY = 'fuqah.pipeline.columns.v1';

export const STATUS_META: Record<LeadStatus, { label: string; labelAr: string; color: string }> = {
  new_lead:              { label: 'New Lead',             labelAr: 'عميل محتمل',         color: '#808080' },
  contacted:             { label: 'Contacted',            labelAr: 'تم التواصل',         color: '#579BFC' },
  not_interested:        { label: 'Not Interested',       labelAr: 'لا يريد الاشتراك',  color: '#A25DDC' },
  trial:                 { label: 'On Trial',             labelAr: 'تجريبي',             color: '#FDAB3D' },
  trial_expired:         { label: 'Trial Expired',        labelAr: 'انتهى التجريبي',    color: '#E2445C' },
  subscribed:            { label: 'Subscribed',           labelAr: 'مشترك',              color: '#00C875' },
  subscription_expired:  { label: 'Subscription Expired', labelAr: 'انتهى الاشتراك',    color: '#E2445C' },
  cancelled:             { label: 'Cancelled',            labelAr: 'ملغي',               color: '#808080' },
};

export const SOURCE_META: Record<LeadSource, { label: string; labelAr: string; bg: string; color: string }> = {
  tiktok:    { label: 'TikTok',    labelAr: 'تيك توك',  bg: '#000000', color: '#FE2C55' },
  facebook:  { label: 'Facebook',  labelAr: 'فيسبوك',   bg: '#1877F2', color: '#ffffff' },
  instagram: { label: 'Instagram', labelAr: 'إنستجرام', bg: '#E1306C', color: '#ffffff' },
  snapchat:  { label: 'Snapchat',  labelAr: 'سناب شات', bg: '#FFFC00', color: '#000000' },
  google:    { label: 'Google',    labelAr: 'جوجل',     bg: '#4285F4', color: '#ffffff' },
  zid:       { label: 'Zid',       labelAr: 'زد',       bg: '#3B1E5E', color: '#ffffff' },
  salla:     { label: 'Salla',     labelAr: 'سلة',      bg: '#002e5b', color: '#baff39' },
  manual:    { label: 'Manual',    labelAr: 'يدوي',     bg: '#808080', color: '#ffffff' },
};

export const PALETTE: string[] = [
  '#043CC8', '#00C875', '#FDAB3D', '#E2445C', '#579BFC',
  '#A25DDC', '#FE2C55', '#00D4FF', '#FF7A00', '#808080',
];

// No default custom columns — Location / Priority removed per spec.
const defaultColumns = (): CustomColumn[] => ([]);

function daysAgoISO(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}
function daysFromNowISO(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
}
function daysAgoShort(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
}

const mkJourney = (events: Array<{ status: LeadStatus; daysAgo: number; note?: string; automatic?: boolean }>): JourneyEvent[] =>
  events.map((e, i) => ({
    id: `j_${i}_${e.status}`,
    status: e.status,
    date: daysAgoISO(e.daysAgo),
    note: e.note,
    automatic: e.automatic,
  }));

const defaultCustomers = (): PipelineCustomer[] => ([
  {
    id: 'cus_1', name: 'Ahmed Al-Saud', email: 'ahmed@example.sa', phone: '+966501234567',
    source: 'facebook', status: 'new_lead',
    createdAt: daysAgoISO(0.02), viewed: false,
    notes: [], customValues: {},
    journey: mkJourney([{ status: 'new_lead', daysAgo: 0.02 }]),
  },
  {
    id: 'cus_2', name: 'Sara Al-Qahtani', email: 'sara@example.sa', phone: '+966555667788',
    source: 'tiktok', status: 'new_lead',
    createdAt: daysAgoISO(0.1), viewed: false,
    notes: [], customValues: {},
    journey: mkJourney([{ status: 'new_lead', daysAgo: 0.1 }]),
  },
  {
    id: 'cus_3', name: 'Khalid Store', email: 'khalid@zidstore.sa', phone: '+966533221100',
    source: 'zid', status: 'trial',
    subscriptionPlan: 'Growth', subscriptionPrice: 299,
    startDate: daysAgoShort(1), endDate: daysFromNowISO(2),
    createdAt: daysAgoISO(1), viewed: true,
    notes: [{ id: 'n1', author: 'Super Admin', text: 'Onboarded via Zid token — follow up before trial ends.', createdAt: daysAgoISO(0.5) }],
    customValues: {},
    journey: mkJourney([
      { status: 'new_lead',  daysAgo: 1.2 },
      { status: 'contacted', daysAgo: 1.1 },
      { status: 'trial',     daysAgo: 1, note: 'Zid trial started (3 days)' },
    ]),
  },
  {
    id: 'cus_4', name: 'Noor Fashion', email: 'noor@sallashop.sa', phone: '+966544998877',
    source: 'salla', status: 'subscribed',
    subscriptionPlan: 'Pro', subscriptionPrice: 599,
    startDate: daysAgoShort(14), endDate: daysFromNowISO(16),
    createdAt: daysAgoISO(14), viewed: true,
    notes: [], customValues: {},
    journey: mkJourney([
      { status: 'new_lead',  daysAgo: 20 },
      { status: 'contacted', daysAgo: 18 },
      { status: 'trial',     daysAgo: 17 },
      { status: 'subscribed', daysAgo: 14, note: 'Upgraded to Pro via Salla' },
    ]),
  },
  {
    id: 'cus_5', name: 'Omar Trial', email: 'omar@example.sa', phone: '+966522113344',
    source: 'salla', status: 'trial_expired',
    subscriptionPlan: 'Starter', subscriptionPrice: 149,
    startDate: daysAgoShort(10), endDate: daysAgoShort(3),
    createdAt: daysAgoISO(10), viewed: true,
    notes: [], customValues: {},
    journey: mkJourney([
      { status: 'new_lead',      daysAgo: 11 },
      { status: 'trial',         daysAgo: 10 },
      { status: 'trial_expired', daysAgo: 3, automatic: true, note: 'Trial ended — needs follow-up' },
    ]),
  },
  {
    id: 'cus_6', name: 'Lina Boutique', email: 'lina@example.sa', phone: '+966511223344',
    source: 'instagram', status: 'contacted',
    createdAt: daysAgoISO(2), viewed: true,
    notes: [], customValues: {},
    journey: mkJourney([
      { status: 'new_lead',  daysAgo: 3 },
      { status: 'contacted', daysAgo: 2, note: 'Left voicemail, sent WhatsApp follow-up' },
    ]),
  },
]);

export function loadColumns(): CustomColumn[] {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (!raw) {
      const seed = defaultColumns();
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  } catch { return defaultColumns(); }
}
export function saveColumns(c: CustomColumn[]) {
  try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(c)); } catch {}
}

export function loadCustomers(): PipelineCustomer[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) {
      const seed = defaultCustomers();
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  } catch { return defaultCustomers(); }
}
export function saveCustomers(c: PipelineCustomer[]) {
  try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(c)); } catch {}
}

/**
 * Applies automatic state transitions and logs them to the journey:
 *  - trial + endDate < today  → trial_expired
 *  - subscribed + endDate < today → subscription_expired
 */
export function reconcileCustomers(customers: PipelineCustomer[]): PipelineCustomer[] {
  const today = new Date().toISOString().slice(0, 10);
  const nowISO = new Date().toISOString();
  return customers.map(c => {
    if (c.status === 'trial' && c.endDate && c.endDate < today) {
      return {
        ...c,
        status: 'trial_expired',
        trialExpiredAcknowledged: false,
        journey: [...(c.journey || []), {
          id: `j_auto_${Date.now()}`,
          status: 'trial_expired',
          date: nowISO,
          automatic: true,
          note: 'Trial ended automatically',
        }],
      };
    }
    if (c.status === 'subscribed' && c.endDate && c.endDate < today) {
      return {
        ...c,
        status: 'subscription_expired',
        subscriptionExpiredAcknowledged: false,
        journey: [...(c.journey || []), {
          id: `j_auto_${Date.now()}`,
          status: 'subscription_expired',
          date: nowISO,
          automatic: true,
          note: 'Paid subscription ended automatically',
        }],
      };
    }
    return c;
  });
}

export function countNewLeads(customers: PipelineCustomer[]): number {
  return customers.filter(c => !c.viewed).length;
}
export function countTrialExpiredUnacknowledged(customers: PipelineCustomer[]): number {
  return customers.filter(c =>
    (c.status === 'trial_expired' && !c.trialExpiredAcknowledged) ||
    (c.status === 'subscription_expired' && !c.subscriptionExpiredAcknowledged)
  ).length;
}

/** Append a journey event when a customer's status changes (call from UI). */
export function appendJourney(c: PipelineCustomer, status: LeadStatus, note?: string): PipelineCustomer {
  return {
    ...c,
    status,
    journey: [...(c.journey || []), {
      id: `j_${Date.now()}`,
      status,
      date: new Date().toISOString(),
      note,
    }],
  };
}

export function fmtDate(iso?: string, lang: 'en' | 'ar' = 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function monthsActive(startDate?: string, endDate?: string): number {
  if (!startDate) return 0;
  const start = new Date(startDate).getTime();
  const endCap = endDate ? new Date(endDate).getTime() : Date.now();
  const end = Math.min(endCap, Date.now());
  if (Number.isNaN(start) || end < start) return 0;
  return Math.max(1, Math.round((end - start) / (30 * 86_400_000)));
}
export function totalPaid(c: PipelineCustomer): number {
  if (!c.subscriptionPrice) return 0;
  if (c.status !== 'subscribed' && c.status !== 'subscription_expired' && c.status !== 'cancelled') return 0;
  return monthsActive(c.startDate, c.endDate) * c.subscriptionPrice;
}
export function hasNotes(c: PipelineCustomer): boolean {
  return (c.notes || []).length > 0;
}
/** True when there is at least one note newer than the last time the admin opened the page. */
export function hasUnseenNotes(c: PipelineCustomer): boolean {
  const notes = c.notes || [];
  if (notes.length === 0) return false;
  if (!c.notesSeenAt) return true;
  return notes.some(n => n.createdAt > c.notesSeenAt!);
}

export function daysRemaining(endDate?: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / 86_400_000);
}

// ------------------------------------------------------------------
// Team members + assignment settings + per-user "seen" tracking
// ------------------------------------------------------------------

export type UserRole = 'admin' | 'member';
export interface TeamMember {
  id: string;
  name: string;
  role: UserRole;
  color: string;
}

export type AssignmentMode = 'manual' | 'self_claim' | 'round_robin';

export interface PipelineSettings {
  assignmentMode: AssignmentMode;
  roundRobinCursor: number; // index into member list for next auto-assignment
}

const MEMBERS_KEY = 'fuqah.pipeline.members.v1';
const SETTINGS_KEY = 'fuqah.pipeline.settings.v1';
const CURRENT_USER_KEY = 'fuqah.pipeline.currentUser.v1';

const defaultMembers = (): TeamMember[] => ([
  { id: 'u_admin', name: 'Super Admin', role: 'admin',  color: '#043CC8' },
  { id: 'u_reem',  name: 'Reem',        role: 'member', color: '#FDAB3D' },
  { id: 'u_yousef',name: 'Yousef',      role: 'member', color: '#00C875' },
  { id: 'u_mona',  name: 'Mona',        role: 'member', color: '#A25DDC' },
]);

const defaultSettings = (): PipelineSettings => ({
  assignmentMode: 'manual',
  roundRobinCursor: 0,
});

export function loadMembers(): TeamMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    if (!raw) { const seed = defaultMembers(); localStorage.setItem(MEMBERS_KEY, JSON.stringify(seed)); return seed; }
    return JSON.parse(raw);
  } catch { return defaultMembers(); }
}
export function saveMembers(m: TeamMember[]) {
  try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(m)); } catch {}
}

export function loadSettings(): PipelineSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) { const seed = defaultSettings(); localStorage.setItem(SETTINGS_KEY, JSON.stringify(seed)); return seed; }
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { return defaultSettings(); }
}
export function saveSettings(s: PipelineSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

export function getCurrentUserId(): string {
  return localStorage.getItem(CURRENT_USER_KEY) || 'u_admin';
}
export function setCurrentUserId(id: string) {
  try { localStorage.setItem(CURRENT_USER_KEY, id); } catch {}
}

/** Returns the next member for round-robin distribution (admins excluded). */
export function pickRoundRobinMember(members: TeamMember[], cursor: number): { member: TeamMember | null; nextCursor: number } {
  const eligible = members.filter(m => m.role === 'member');
  if (eligible.length === 0) return { member: null, nextCursor: cursor };
  const idx = Math.abs(cursor) % eligible.length;
  return { member: eligible[idx], nextCursor: cursor + 1 };
}

// --- Per-user unseen badges ---

function lastStatusChangeDate(c: PipelineCustomer, status: LeadStatus): string | undefined {
  const events = (c.journey || []).filter(e => e.status === status);
  return events.length ? events[events.length - 1].date : undefined;
}

/** True only for leads that have never been opened by anyone yet. */
export function isNewFor(c: PipelineCustomer, userId: string): boolean {
  if (isForcedUnreadFor(c, userId)) return false;
  const seen = c.seenBy?.[userId]?.viewedAt;
  if (seen) return false;
  // If anyone has viewed this customer, it's no longer a "new" lead.
  const anyoneViewed = c.viewed || Object.values(c.seenBy || {}).some(s => s?.viewedAt);
  return !anyoneViewed;
}

/** True when the user explicitly marked this row as unread via the menu. */
export function isForcedUnreadFor(c: PipelineCustomer, userId: string): boolean {
  return !!c.forcedUnreadBy?.includes(userId);
}

export function hasUnseenNotesFor(c: PipelineCustomer, userId: string): boolean {
  const notes = c.notes || [];
  if (notes.length === 0) return false;
  const seen = c.seenBy?.[userId]?.notesSeenAt || c.seenBy?.[userId]?.viewedAt;
  if (!seen) return true;
  return notes.some(n => n.createdAt > seen);
}

export function hasUnseenTerminalFor(c: PipelineCustomer, userId: string): LeadStatus | null {
  if (c.status !== 'trial_expired' && c.status !== 'subscription_expired' && c.status !== 'cancelled') return null;
  const changedAt = lastStatusChangeDate(c, c.status);
  if (!changedAt) return null;
  const seen = c.seenBy?.[userId]?.viewedAt;
  if (!seen || seen < changedAt) return c.status;
  return null;
}

/** Marks customer as seen for the given user (viewed + notes). */
export function markSeenBy(c: PipelineCustomer, userId: string): PipelineCustomer {
  const now = new Date().toISOString();
  return {
    ...c,
    viewed: true, // keep legacy flag in sync
    seenBy: { ...(c.seenBy || {}), [userId]: { viewedAt: now, notesSeenAt: now } },
    forcedUnreadBy: (c.forcedUnreadBy || []).filter(u => u !== userId),
  };
}

/** Returns true if the user has any unseen badge on this customer. */
export function hasAnyUnseenFor(c: PipelineCustomer, userId: string): boolean {
  return (
    isNewFor(c, userId) ||
    isForcedUnreadFor(c, userId) ||
    hasUnseenNotesFor(c, userId) ||
    !!hasUnseenTerminalFor(c, userId)
  );
}

/** Explicitly marks a previously-opened customer as unread for this user.
 *  Keeps the legacy `viewed` flag (so other users remain unaffected) and
 *  records the action in `forcedUnreadBy` so the row shows an UNREAD badge
 *  (not a NEW badge). Also clears this user's seen-at so note/terminal
 *  badges reappear. */
export function markUnreadBy(c: PipelineCustomer, userId: string): PipelineCustomer {
  const seenBy = { ...(c.seenBy || {}) };
  delete seenBy[userId];
  const forced = new Set(c.forcedUnreadBy || []);
  forced.add(userId);
  return { ...c, seenBy, forcedUnreadBy: Array.from(forced) };
}
