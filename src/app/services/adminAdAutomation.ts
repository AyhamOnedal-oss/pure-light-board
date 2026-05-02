import { supabase } from '@/integrations/supabase/client';
import type { Platform, Campaign, PlatformId, CampaignStatus, CampaignType } from '../components/admin/adAutomationData';

/**
 * Admin Ad Automation — Supabase-backed loader.
 * Falls back to localStorage-cached mock data (existing behaviour) when DB
 * has no rows. The UI components still use the mock helpers in
 * `adAutomationData.ts` for create/update flows; this service replaces only
 * the initial fetch.
 */

interface DbPlatformRow {
  id: string;
  platform_id: PlatformId;
  account_id: string | null;
  account_name: string | null;
  connected: boolean;
  last_sync: string | null;
  added_at: string;
}

interface DbCampaignRow {
  id: string;
  platform_row_id: string;
  name: string;
  owner: string;
  type: CampaignType;
  content: string | null;
  link: string | null;
  media_url: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  status: CampaignStatus;
  start_date: string;
  end_date: string;
  last_sync: string | null;
  created_at: string;
}

function rowToPlatform(r: DbPlatformRow): Platform {
  return {
    id: r.id,
    platformId: r.platform_id,
    addedAt: r.added_at,
    connected: r.connected,
    accountId: r.account_id ?? undefined,
    accountName: r.account_name ?? undefined,
    lastSync: r.last_sync ?? undefined,
  };
}

function rowToCampaign(r: DbCampaignRow): Campaign {
  return {
    id: r.id,
    platformRowId: r.platform_row_id,
    name: r.name,
    owner: r.owner,
    type: r.type,
    mediaKind: r.type,
    mediaUrl: r.media_url ?? undefined,
    content: r.content ?? '',
    link: r.link ?? '',
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend,
    conversions: r.conversions,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    createdAt: r.created_at,
    lastSync: r.last_sync ?? undefined,
  };
}

export async function fetchAdPlatforms(): Promise<Platform[] | null> {
  try {
    const { data, error } = await supabase
      .from('admin_ad_platforms')
      .select('id,platform_id,account_id,account_name,connected,last_sync,added_at')
      .order('added_at', { ascending: true });
    if (error || !data || data.length === 0) return null;
    return (data as DbPlatformRow[]).map(rowToPlatform);
  } catch {
    return null;
  }
}

export async function fetchAdCampaigns(): Promise<Campaign[] | null> {
  try {
    const { data, error } = await supabase
      .from('admin_ad_campaigns')
      .select('id,platform_row_id,name,owner,type,content,link,media_url,impressions,clicks,spend,conversions,status,start_date,end_date,last_sync,created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return null;
    return (data as DbCampaignRow[]).map(rowToCampaign);
  } catch {
    return null;
  }
}