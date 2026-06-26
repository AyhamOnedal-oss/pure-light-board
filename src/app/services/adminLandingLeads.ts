import { supabase } from '@/integrations/supabase/client';

export type LandingMatch = 'full' | 'partial' | 'none';
export type LandingCustomerType = 'new' | 'existing';
export type LandingContactTime = 'morning' | 'evening';
export type LandingSource =
  | 'tiktok' | 'instagram' | 'snapchat' | 'facebook'
  | 'google' | 'ecommerce' | 'other';

export interface LandingNote {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  createdAt: string;
}

export interface LandingLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  customer_type: LandingCustomerType;
  contact_time: LandingContactTime;
  source: LandingSource | null;
  subject: string | null;
  description: string | null;
  match_status: LandingMatch;
  matched_tenant_id: string | null;
  copied_to_pipeline_at: string | null;
  pipeline_customer_id: string | null;
  notes: LandingNote[];
  created_at: string;
  updated_at: string;
}

export async function fetchLandingLeads(): Promise<LandingLead[]> {
  const { data, error } = await supabase
    .from('admin_landing_leads' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data as unknown as LandingLead[]) || []).map(l => ({ ...l, notes: l.notes || [] }));
}

export async function fetchLandingLead(id: string): Promise<LandingLead | null> {
  const { data, error } = await supabase
    .from('admin_landing_leads' as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const l = data as unknown as LandingLead;
  return { ...l, notes: l.notes || [] };
}

export async function deleteLandingLead(id: string) {
  const { error } = await supabase.from('admin_landing_leads' as any).delete().eq('id', id);
  if (error) throw error;
}

export async function updateLandingLead(id: string, patch: Partial<LandingLead>) {
  const { error } = await supabase.from('admin_landing_leads' as any).update(patch as any).eq('id', id);
  if (error) throw error;
}

export async function markCopiedToPipeline(id: string, pipelineCustomerId: string) {
  await updateLandingLead(id, {
    copied_to_pipeline_at: new Date().toISOString(),
    pipeline_customer_id: pipelineCustomerId,
  } as any);
}

export async function addLandingLeadNote(id: string, note: LandingNote): Promise<LandingNote[]> {
  const lead = await fetchLandingLead(id);
  const next = [...(lead?.notes ?? []), note];
  await updateLandingLead(id, { notes: next } as any);
  return next;
}

export async function deleteLandingLeadNote(id: string, noteId: string): Promise<LandingNote[]> {
  const lead = await fetchLandingLead(id);
  const next = (lead?.notes ?? []).filter(n => n.id !== noteId);
  await updateLandingLead(id, { notes: next } as any);
  return next;
}
