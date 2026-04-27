export type PlatformId = 'tiktok' | 'snapchat' | 'instagram' | 'facebook' | 'google';

export interface Platform {
  id: string;
  platformId: PlatformId;
  addedAt: string;
  connected: boolean;
  accountId?: string;
  accountName?: string;
  accessToken?: string;      // stored server-side in production
  developerToken?: string;   // Google Ads only
  refreshToken?: string;     // Google Ads only
  lastSync?: string;
}

export interface PlatformCredField {
  key: 'accountId' | 'accessToken' | 'developerToken' | 'refreshToken' | 'accountName';
  label: string;
  labelAr: string;
  placeholder: string;
  required: boolean;
  secret?: boolean;
  helpUrl?: string;
  help?: string;
  helpAr?: string;
}

export const PLATFORM_CRED_FIELDS: Record<PlatformId, PlatformCredField[]> = {
  tiktok: [
    { key: 'accountName', label: 'Account Name (optional)', labelAr: 'اسم الحساب (اختياري)', placeholder: 'My TikTok Ads', required: false },
    { key: 'accountId', label: 'Advertiser ID', labelAr: 'معرّف المُعلن', placeholder: '7123456789012345678', required: true,
      help: 'Found in TikTok Ads Manager → Account Info', helpAr: 'موجود في TikTok Ads Manager ← معلومات الحساب',
      helpUrl: 'https://ads.tiktok.com' },
    { key: 'accessToken', label: 'Access Token', labelAr: 'رمز الوصول', placeholder: 'act.xxxxxxx...', required: true, secret: true,
      help: 'Generate in TikTok for Business → Marketing API', helpAr: 'أنشئه من TikTok for Business ← Marketing API' },
  ],
  snapchat: [
    { key: 'accountName', label: 'Account Name (optional)', labelAr: 'اسم الحساب (اختياري)', placeholder: 'My Snap Ads', required: false },
    { key: 'accountId', label: 'Ad Account ID', labelAr: 'معرّف حساب الإعلانات', placeholder: 'abc12345-6789-...', required: true,
      help: 'Snap Ads Manager → Settings → Ad Account Info', helpAr: 'Snap Ads Manager ← الإعدادات ← معلومات الحساب' },
    { key: 'accessToken', label: 'OAuth Access Token', labelAr: 'رمز OAuth', placeholder: 'eyJhbGci...', required: true, secret: true },
  ],
  instagram: [
    { key: 'accountName', label: 'Account Name (optional)', labelAr: 'اسم الحساب (اختياري)', placeholder: 'My Instagram Ads', required: false },
    { key: 'accountId', label: 'Meta Ad Account ID', labelAr: 'معرّف حساب Meta الإعلاني', placeholder: 'act_1234567890', required: true,
      help: 'Starts with "act_" — from Meta Ads Manager', helpAr: 'يبدأ بـ "act_" — من Meta Ads Manager' },
    { key: 'accessToken', label: 'Meta Access Token', labelAr: 'رمز Meta', placeholder: 'EAAB...', required: true, secret: true,
      help: 'Long-lived token with ads_read permission', helpAr: 'رمز طويل الأجل بصلاحية ads_read' },
  ],
  facebook: [
    { key: 'accountName', label: 'Account Name (optional)', labelAr: 'اسم الحساب (اختياري)', placeholder: 'My Facebook Ads', required: false },
    { key: 'accountId', label: 'Meta Ad Account ID', labelAr: 'معرّف حساب Meta الإعلاني', placeholder: 'act_1234567890', required: true,
      help: 'Starts with "act_" — from Meta Ads Manager', helpAr: 'يبدأ بـ "act_" — من Meta Ads Manager' },
    { key: 'accessToken', label: 'Meta Access Token', labelAr: 'رمز Meta', placeholder: 'EAAB...', required: true, secret: true,
      help: 'Long-lived token with ads_read permission', helpAr: 'رمز طويل الأجل بصلاحية ads_read' },
  ],
  google: [
    { key: 'accountName', label: 'Account Name (optional)', labelAr: 'اسم الحساب (اختياري)', placeholder: 'My Google Ads', required: false },
    { key: 'accountId', label: 'Customer ID', labelAr: 'معرّف العميل', placeholder: '123-456-7890', required: true,
      help: 'Top-right in Google Ads UI (10 digits)', helpAr: 'أعلى يمين واجهة Google Ads (10 أرقام)' },
    { key: 'developerToken', label: 'Developer Token', labelAr: 'رمز المطور', placeholder: 'xxxxxxxxxxxxxxxxxxxxxx', required: true, secret: true },
    { key: 'refreshToken', label: 'OAuth Refresh Token', labelAr: 'رمز التحديث', placeholder: '1//0gxxxxxxx...', required: true, secret: true,
      help: 'Generated via Google Ads OAuth flow', helpAr: 'من خلال مسار OAuth لـ Google Ads' },
  ],
};

export type CampaignType = 'image' | 'video';
export type CampaignStatus = 'active' | 'paused' | 'done' | 'draft';

export interface Campaign {
  id: string;
  platformRowId: string;
  name: string;
  owner: string;
  mediaUrl?: string;
  mediaKind?: CampaignType;
  type: CampaignType;
  content: string;
  link: string;
  // Auto-synced metrics (read-only, from platform API)
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  lastSync?: string;
}

export const PLATFORM_META: Record<PlatformId, {
  name: string; nameAr: string; color: string; bg: string;
  apiDocs: string;
  authUrl: string;
}> = {
  tiktok:   { name: 'TikTok',     nameAr: 'تيك توك',   color: '#FE2C55', bg: '#000000',
    apiDocs: 'TikTok Marketing API', authUrl: 'https://business-api.tiktok.com/portal/auth' },
  snapchat: { name: 'Snapchat',   nameAr: 'سناب شات',  color: '#000000', bg: '#FFFC00',
    apiDocs: 'Snap Marketing API', authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize' },
  instagram:{ name: 'Instagram',  nameAr: 'إنستجرام',  color: '#ffffff', bg: 'linear-gradient(135deg,#833AB4,#FD1D1D,#F77737)',
    apiDocs: 'Meta Graph API', authUrl: 'https://www.facebook.com/v19.0/dialog/oauth' },
  facebook: { name: 'Facebook',   nameAr: 'فيسبوك',    color: '#ffffff', bg: '#1877F2',
    apiDocs: 'Meta Marketing API', authUrl: 'https://www.facebook.com/v19.0/dialog/oauth' },
  google:   { name: 'Google Ads', nameAr: 'جوجل أدز',  color: '#ffffff', bg: 'linear-gradient(135deg,#4285F4,#EA4335,#FBBC05,#34A853)',
    apiDocs: 'Google Ads API', authUrl: 'https://accounts.google.com/o/oauth2/auth' },
};

const PLATFORMS_KEY = 'fuqah.adAutomation.platforms.v2';
const CAMPAIGNS_KEY = 'fuqah.adAutomation.campaigns.v2';

export function loadPlatforms(): Platform[] {
  try {
    const raw = localStorage.getItem(PLATFORMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function savePlatforms(p: Platform[]) {
  try { localStorage.setItem(PLATFORMS_KEY, JSON.stringify(p)); } catch {}
}
export function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function saveCampaigns(c: Campaign[]) {
  try { localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(c)); } catch {}
}

export function statusColor(s: CampaignStatus) {
  switch (s) {
    case 'active': return { bg: '#00C875', text: '#ffffff' };
    case 'paused': return { bg: '#FDAB3D', text: '#ffffff' };
    case 'done':   return { bg: '#579BFC', text: '#ffffff' };
    case 'draft':  return { bg: '#808080', text: '#ffffff' };
  }
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

export function fmtMoney(n: number, lang: 'en' | 'ar' = 'en'): string {
  const v = Math.round(n).toLocaleString('en-US');
  return lang === 'ar' ? `${v} ر.س` : `SAR ${v}`;
}

// -------- Simulated platform sync (replaces real Ads API calls) --------

const SAMPLE_NAMES: Record<PlatformId, string[]> = {
  tiktok: ['Ramadan Launch 2026', 'Summer Collection Reveal', 'Flash Sale TikTok', 'Gen-Z Brand Awareness'],
  snapchat: ['Snap Spotlight Ad', 'AR Filter Campaign', 'Daily Deals Snap', 'Story Takeover'],
  instagram: ['Reels Boost Q2', 'Story Ads — Eid', 'Carousel Product Set', 'Shop Collection Promo'],
  facebook: ['Meta Lead Gen', 'Retargeting Funnel', 'Lookalike Audience', 'Holiday Catalog'],
  google: ['Search — Brand Terms', 'Performance Max Q2', 'Display Remarketing', 'Shopping Feed Ads'],
};

function rand(min: number, max: number) { return Math.floor(min + Math.random() * (max - min)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function today(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Create synthetic campaigns when a platform first connects (simulates Ads API fetch). */
export function syncPlatformCampaigns(platform: Platform): Campaign[] {
  const pool = SAMPLE_NAMES[platform.platformId];
  const count = rand(3, 6);
  const now = new Date().toISOString();
  const campaigns: Campaign[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let name = pool[i % pool.length];
    if (used.has(name)) name = `${name} #${i + 1}`;
    used.add(name);
    const impressions = rand(8_000, 450_000);
    const clicks = Math.floor(impressions * (0.005 + Math.random() * 0.045));
    const spend = Math.round(clicks * (0.4 + Math.random() * 2.6));
    const conversions = Math.floor(clicks * (0.01 + Math.random() * 0.08));
    const type: CampaignType = Math.random() > 0.45 ? 'video' : 'image';
    campaigns.push({
      id: `${platform.id}-${Date.now()}-${i}`,
      platformRowId: platform.id,
      name,
      owner: 'AI',
      type,
      content: `Auto-imported from ${platform.platformId} Ads API`,
      link: `https://ads.${platform.platformId}.com/campaign/${rand(10000, 99999)}`,
      impressions, clicks, spend, conversions,
      status: pick<CampaignStatus>(['active', 'active', 'active', 'paused', 'done']),
      startDate: today(-rand(5, 30)),
      endDate: today(rand(5, 60)),
      createdAt: now,
      lastSync: now,
    });
  }
  return campaigns;
}

/** Refresh metrics for existing campaigns (simulates periodic API pull). */
export function refreshMetrics(campaigns: Campaign[]): Campaign[] {
  const now = new Date().toISOString();
  return campaigns.map(c => {
    if (c.status !== 'active') return { ...c, lastSync: now };
    const deltaImp = rand(50, 2500);
    const deltaClk = Math.floor(deltaImp * (0.005 + Math.random() * 0.04));
    const deltaSpend = Math.round(deltaClk * (0.4 + Math.random() * 2.2));
    const deltaConv = Math.floor(deltaClk * (0.01 + Math.random() * 0.06));
    return {
      ...c,
      impressions: c.impressions + deltaImp,
      clicks: c.clicks + deltaClk,
      spend: c.spend + deltaSpend,
      conversions: c.conversions + deltaConv,
      lastSync: now,
    };
  });
}

export function timeAgo(iso?: string, lang: 'en' | 'ar' = 'en'): string {
  if (!iso) return lang === 'ar' ? 'لم تُزامَن' : 'Never synced';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return lang === 'ar' ? 'الآن' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return lang === 'ar' ? `قبل ${m}د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'ar' ? `قبل ${h}س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lang === 'ar' ? `قبل ${d}ي` : `${d}d ago`;
}
