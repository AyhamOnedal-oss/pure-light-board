// Returns live usage % for the admin dashboard "Server / Service Usage" bars.
// - Supabase: bytes vs 8 GB Pro disk (via admin_db_usage RPC)
// - Resend: emails sent this month vs 3000/month cap (via Resend API)
// - OpenAI: tokens -> words (token * 0.75) vs admin-defined monthly budget
//           (admin_settings.openai_monthly_word_budget, set via admin_set_openai_word_budget RPC)
// - Hostinger: not wired yet -> returns null and the UI falls back to the seeded value

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_MONTHLY_CAP = 3000;

function startOfMonthRiyadhUTC(): Date {
  // Riyadh = UTC+3, no DST. First instant of current Riyadh month, in UTC.
  const now = new Date();
  const riyadh = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const y = riyadh.getUTCFullYear();
  const m = riyadh.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, -3, 0, 0));
}

async function fetchResendCount(): Promise<{ sent: number; cap: number; percent: number; ok: boolean }> {
  if (!RESEND_API_KEY) return { sent: 0, cap: RESEND_MONTHLY_CAP, percent: 0, ok: false };
  const since = startOfMonthRiyadhUTC().toISOString();
  let sent = 0;
  let after: string | undefined = undefined;
  // Paginate; cap to a safe number of pages to keep the function fast.
  for (let page = 0; page < 30; page++) {
    const url = new URL('https://api.resend.com/emails');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
    if (!r.ok) return { sent, cap: RESEND_MONTHLY_CAP, percent: Math.min(100, Math.round((sent / RESEND_MONTHLY_CAP) * 100)), ok: false };
    const body = await r.json().catch(() => null) as any;
    const data: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    if (data.length === 0) break;
    let stop = false;
    for (const row of data) {
      const ts = row?.created_at || row?.createdAt;
      if (!ts) continue;
      if (new Date(ts) < new Date(since)) { stop = true; break; }
      const last = (row?.last_event ?? '').toString().toLowerCase();
      // Count anything that was actually sent (delivered/opened/clicked/bounced/complained all imply send happened)
      if (last && last !== 'queued' && last !== 'scheduled') sent++;
    }
    if (stop) break;
    const last = data[data.length - 1];
    after = last?.id;
    if (!after) break;
  }
  const percent = Math.min(100, Math.round((sent / RESEND_MONTHLY_CAP) * 100));
  return { sent, cap: RESEND_MONTHLY_CAP, percent, ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use the caller's JWT so the RPC's admin_has_permission gate runs against them.
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const [openaiRes, dbRes, resend] = await Promise.all([
      supabase.rpc('admin_openai_usage'),
      supabase.rpc('admin_db_usage'),
      fetchResendCount(),
    ]);

    if (openaiRes.error) {
      const msg = (openaiRes.error.message || '').toLowerCase();
      if (msg.includes('forbidden')) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const out = {
      supabase: dbRes.data ?? null,
      resend,
      openai: openaiRes.data ?? null,
      hostinger: null as null,
    };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});