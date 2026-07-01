import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves the Arabic display name for the currently signed-in admin/staff
 * user. Prefers `admin_team_members.name_ar`, then `name`, then the auth
 * user metadata display name, then the email local-part. Falls back to
 * "المشرف" (Admin) so we never render a bare initial like "A".
 */
export async function resolveAdminAuthorName(): Promise<{ id: string | null; name: string }> {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return { id: null, name: 'المشرف' };
    const { data: tm } = await supabase
      .from('admin_team_members')
      .select('name_ar,name')
      .eq('user_id', u.id)
      .maybeSingle();
    const fromTeam = (tm?.name_ar || tm?.name || '').trim();
    if (fromTeam) return { id: u.id, name: fromTeam };
    const meta = (u.user_metadata || {}) as any;
    const fromMeta = (meta.display_name || meta.full_name || meta.name || '').toString().trim();
    if (fromMeta) return { id: u.id, name: fromMeta };
    const prefix = (u.email || '').split('@')[0];
    return { id: u.id, name: prefix || 'المشرف' };
  } catch {
    return { id: null, name: 'المشرف' };
  }
}