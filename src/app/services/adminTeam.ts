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

export const MOCK_TEAM: AdminTeamMember[] = [
  { id: 'mock-1', name: 'Ahmed Hassan', name_ar: 'أحمد حسن', email: 'ahmed@samksa.ai', phone: '+966501111111',
    permissions: ['admin_dashboard','team_management','lists_management','customer_management','pipeline','customers','reports','reports_all','reports_zid','reports_salla','billing','billing_subscriptions','billing_servers','billing_other'],
    status: 'active' },
  { id: 'mock-2', name: 'Sara Mohammed', name_ar: 'سارة محمد', email: 'sara@samksa.ai', phone: '+966502222222',
    permissions: ['lists_management','customer_management','pipeline','customers','reports','reports_all'], status: 'active' },
  { id: 'mock-3', name: 'Khalid Ali', name_ar: 'خالد علي', email: 'khalid@samksa.ai', phone: '+966503333333',
    permissions: ['lists_management','customer_management','pipeline'], status: 'inactive' },
  { id: 'mock-4', name: 'Nora Ibrahim', name_ar: 'نورة إبراهيم', email: 'nora@samksa.ai', phone: '+966504444444',
    permissions: ['lists_management','reports','reports_all','billing','billing_subscriptions'], status: 'active' },
];

export async function fetchTeamMembers(): Promise<AdminTeamMember[]> {
  try {
    const { data, error } = await supabase
      .from('admin_team_members')
      .select('id,name,name_ar,email,phone,permissions,status')
      .order('created_at', { ascending: true });
    if (error || !data || data.length === 0) return MOCK_TEAM;
    return data as AdminTeamMember[];
  } catch {
    return MOCK_TEAM;
  }
}