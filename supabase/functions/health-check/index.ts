import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Status = 'up' | 'degraded' | 'down';
type Outcome = {
  provider: string;
  status: Status;
  latency_ms: number;
  http_code: number | null;
  error: string | null;
};

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; err?: Error }> {
  const t0 = Date.now();
  try { return { ms: Date.now() - t0, value: await fn() }; }
  catch (e) { return { ms: Date.now() - t0, err: e as Error }; }
}

async function pingSupabase(): Promise<Outcome> {
  const url = `${Deno.env.get('SUPABASE_URL')}/auth/v1/health`;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const r = await timeIt(() => fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }));
  if (r.err) return { provider: 'Supabase', status: 'down', latency_ms: r.ms, http_code: null, error: r.err.message };
  const resp = r.value!;
  return {
    provider: 'Supabase',
    status: resp.ok ? 'up' : 'down',
    latency_ms: r.ms,
    http_code: resp.status,
    error: resp.ok ? null : `HTTP ${resp.status}`,
  };
}

function mapIndicator(indicator: string): Status {
  // Statuspage.io: none | minor | major | critical | maintenance
  if (indicator === 'none') return 'up';
  if (indicator === 'minor' || indicator === 'maintenance') return 'degraded';
  return 'down';
}

async function pingStatusPage(provider: string, url: string): Promise<Outcome> {
  const r = await timeIt(() => fetch(url));
  if (r.err) return { provider, status: 'down', latency_ms: r.ms, http_code: null, error: r.err.message };
  const resp = r.value!;
  if (!resp.ok) return { provider, status: 'down', latency_ms: r.ms, http_code: resp.status, error: `HTTP ${resp.status}` };
  try {
    const j = await resp.json();
    const indicator: string = j?.status?.indicator ?? 'none';
    const description: string = j?.status?.description ?? '';
    const status = mapIndicator(indicator);
    return {
      provider,
      status,
      latency_ms: r.ms,
      http_code: resp.status,
      error: status === 'up' ? null : (description || indicator),
    };
  } catch {
    return { provider, status: 'down', latency_ms: r.ms, http_code: resp.status, error: 'invalid status payload' };
  }
}

async function pingHostinger(): Promise<Outcome> {
  const target = Deno.env.get('HOSTINGER_HEALTH_URL') ?? 'https://www.hostinger.com';
  const r = await timeIt(() => fetch(target, { redirect: 'follow' }));
  if (r.err) return { provider: 'Hostinger', status: 'down', latency_ms: r.ms, http_code: null, error: r.err.message };
  const resp = r.value!;
  return {
    provider: 'Hostinger',
    status: resp.ok ? 'up' : 'down',
    latency_ms: r.ms,
    http_code: resp.status,
    error: resp.ok ? null : `HTTP ${resp.status}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const checks = await Promise.all([
      pingSupabase(),
      pingStatusPage('OpenAI', 'https://status.openai.com/api/v2/status.json'),
      pingStatusPage('Resend', 'https://resend-status.com/api/v2/status.json'),
      pingHostinger(),
    ]);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Detect flips to 'down' so we can fire a notification once.
    const providers = checks.map(c => c.provider);
    const { data: prevRows } = await supa
      .from('admin_health_checks')
      .select('provider,status,checked_at')
      .in('provider', providers)
      .order('checked_at', { ascending: false })
      .limit(50);
    const prevByProvider = new Map<string, string>();
    for (const row of prevRows ?? []) {
      if (!prevByProvider.has(row.provider)) prevByProvider.set(row.provider, row.status);
    }

    const { error } = await supa.from('admin_health_checks').insert(checks);
    if (error) throw error;

    for (const c of checks) {
      const prev = prevByProvider.get(c.provider);
      if (c.status === 'down' && prev !== 'down') {
        await supa.from('app_notifications').insert({
          tenant_id: null,
          kind: 'server_down',
          title_en: `${c.provider} is down`,
          title_ar: `${c.provider} غير متصل`,
          message_en: c.error ?? 'Provider reported as down.',
          message_ar: c.error ?? 'تم الإبلاغ عن المزود كغير متصل.',
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, checks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});