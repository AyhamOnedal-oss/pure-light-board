import { supabase } from '@/integrations/supabase/client';

export interface AdminTeamMember {
  id: string;
  name: string;
  name_ar: string;
  email: string;
  phone: string | null;
  permissions: string[];
  status: 'active' | 'inactive';
}

export async function fetchTeamMembers(): Promise<AdminTeamMember[]> {
  try {
    const { data, error } = await supabase
      .from('admin_team_members')
      .select('id,name,name_ar,email,phone,permissions,status,user_id')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('fetchTeamMembers failed', error);
      return [];
    }
    if (!data) return [];
    return data as AdminTeamMember[];
  } catch (e) {
    console.error('fetchTeamMembers threw', e);
    return [];
  }
}