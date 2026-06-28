import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const adminUserId = claimsData.claims.sub as string;

    const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

    const { data: allowed, error: permErr } = await admin
      .rpc('admin_has_permission', { _user_id: adminUserId, _key: 'customer_management' });
    if (permErr || !allowed) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId as string | undefined;
    if (!tenantId) return json({ error: 'tenantId required' }, 400);

    // Find tenant owner (or first member)
    const { data: members, error: memErr } = await admin
      .from('auth_tenant_members')
      .select('user_id, role, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (memErr) return json({ error: memErr.message }, 500);
    if (!members?.length) return json({ error: 'No users linked to this tenant' }, 404);
    const target = members.find((m: any) => m.role === 'owner') || members[0];

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(target.user_id);
    if (userErr || !userData?.user?.email) {
      return json({ error: userErr?.message || 'Target user has no email' }, 404);
    }
    const email = userData.user.email;

    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    const cleanOrigin = origin.replace(/\/+$/, '').replace(/\/admin.*$/, '');
    const base = cleanOrigin || 'https://app.fuqah.ai';

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: base + '/dashboard' },
    });
    if (linkErr || !linkData?.properties) {
      return json({ error: linkErr?.message || 'Failed to generate link' }, 500);
    }
    const props: any = linkData.properties;
    const tokenHash: string | undefined = props.hashed_token || props.token_hash;
    if (!tokenHash) {
      return json({ error: 'No token returned from Supabase' }, 500);
    }

    await admin.from('admin_impersonation_log').insert({
      tenant_id: tenantId,
      admin_user_id: adminUserId,
      target_user_id: target.user_id,
      target_email: email,
    });

    // Resolve actor name for the activity log
    let actorName: string | null = null;
    const { data: staffRow } = await admin
      .from('admin_team_members')
      .select('full_name')
      .eq('user_id', adminUserId)
      .maybeSingle();
    if (staffRow?.full_name) actorName = staffRow.full_name as string;
    if (!actorName) {
      const { data: actorUser } = await admin.auth.admin.getUserById(adminUserId);
      const meta = (actorUser?.user?.user_metadata || {}) as any;
      actorName = meta.display_name || meta.full_name || (actorUser?.user?.email?.split('@')[0]) || null;
    }
    await admin.from('admin_activity_events').insert({
      tenant_id: tenantId,
      event_type: 'impersonation',
      actor_user_id: adminUserId,
      actor_name: actorName,
      metadata: { target_email: email },
    });

    // The client opens /admin/impersonate?... in a new tab, which exchanges
    // the token_hash for a session in that tab only (per-tab storage).
    const redirectUrl = `${base}/impersonate?token_hash=${encodeURIComponent(tokenHash)}&email=${encodeURIComponent(email)}&tenant=${encodeURIComponent(tenantId)}`;
    return json({ url: redirectUrl, tokenHash, email, tenantId });
  } catch (e) {
    console.error('admin-impersonate error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}