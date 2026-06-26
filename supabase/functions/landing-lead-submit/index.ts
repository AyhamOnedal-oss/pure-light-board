// Public endpoint that receives submissions from the marketing landing page
// and stores them in `admin_landing_leads`. The DB trigger computes the
// identity match (email/phone vs active Zid/Salla store contacts).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SOURCES = new Set(['tiktok','instagram','snapchat','facebook','google','ecommerce','other']);

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normPhone(p: unknown): string {
  const digits = String(p ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return '+' + digits;
  if (digits.startsWith('0')) return '+966' + digits.slice(1);
  if (digits.length === 9) return '+966' + digits;
  return digits.startsWith('+') ? String(p) : '+' + digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad('method_not_allowed', 405);

  let body: any;
  try { body = await req.json(); } catch { return bad('invalid_json'); }

  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const phone = normPhone(body?.phone);
  const customer_type = body?.customer_type === 'existing' ? 'existing' : 'new';
  const contact_time = body?.contact_time === 'evening' ? 'evening' : 'morning';
  const rawSource = String(body?.source ?? '').trim().toLowerCase();
  const source = customer_type === 'new'
    ? (SOURCES.has(rawSource) ? rawSource : 'other')
    : null;
  const subject = String(body?.subject ?? '').trim().slice(0, 500) || null;
  const description = String(body?.description ?? '').trim().slice(0, 4000) || null;

  if (!name || name.length > 200) return bad('invalid_name');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return bad('invalid_email');
  if (!phone || phone.replace(/\D/g, '').length < 8) return bad('invalid_phone');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ua = req.headers.get('user-agent')?.slice(0, 500) || null;

  const { data, error } = await supabase
    .from('admin_landing_leads')
    .insert({
      name, email, phone, customer_type, contact_time, source, subject, description,
      ip_address: ip, user_agent: ua,
    })
    .select('id, match_status')
    .single();

  if (error) {
    console.error('landing-lead-submit insert error', error);
    return bad('insert_failed', 500);
  }

  return new Response(
    JSON.stringify({ ok: true, id: data.id, match_status: data.match_status }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
