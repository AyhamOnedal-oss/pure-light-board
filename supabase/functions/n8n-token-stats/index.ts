import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Returns chat-AI token usage pulled from n8n for the given date range.
// The n8n workflow exposed at N8N_TOKEN_STATS_URL must respond with:
//   { tokens: number, cost_usd?: number, requests?: number }
// If the secret/URL is missing or the call fails, we return null fields so
// the UI can render "—" instead of a misleading zero.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token)
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Super-admin only
    const { data: roleRow } = await supabase
      .from('auth_user_roles').select('role').eq('user_id', claims.claims.sub).eq('role', 'super_admin').maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const from: string | null = body?.from ?? null
    const to: string | null = body?.to ?? null

    const url = Deno.env.get('N8N_TOKEN_STATS_URL')
    if (!url) {
      return new Response(JSON.stringify({ available: false, reason: 'N8N_TOKEN_STATS_URL not set' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(JSON.stringify({ available: false, reason: `n8n ${res.status}: ${text.slice(0, 200)}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const payload = await res.json().catch(() => ({}))
    const tokens = Number(payload?.tokens ?? payload?.total_tokens ?? 0) || 0
    const cost = Number(payload?.cost_usd ?? payload?.cost ?? 0) || 0
    const requests = Number(payload?.requests ?? 0) || 0

    return new Response(JSON.stringify({ available: true, tokens, cost_usd: cost, requests }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ available: false, reason: String(e?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})