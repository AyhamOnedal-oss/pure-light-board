import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Returns OpenAI token usage broken down by bucket (vision / user_intent /
// reply_intent / conversation_classification / ticket_classification / other),
// pulled directly from the OpenAI Usage API.
//
// Requires OPENAI_ADMIN_KEY (sk-admin-...) with `api.usage.read` scope.
// Mapping from OpenAI project_id → bucket label can be customised via
// OPENAI_PROJECT_BUCKETS as a JSON object like:
//   {"proj_abc":"vision","proj_def":"user_intent"}
// If unset, everything rolls into a single "openai" bucket.

type Bucket = 'vision' | 'user_intent' | 'reply_intent' | 'conversation_classification' | 'ticket_classification' | 'openai'

interface BucketTotals { tokens: number; input_tokens: number; output_tokens: number; cost_usd: number; }

function emptyTotals(): BucketTotals { return { tokens: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 } }

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
    const { data: roleRow } = await supabase
      .from('auth_user_roles').select('role').eq('user_id', claims.claims.sub).eq('role', 'super_admin').maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminKey = Deno.env.get('OPENAI_ADMIN_KEY')
    if (!adminKey) {
      return new Response(JSON.stringify({ available: false, reason: 'OPENAI_ADMIN_KEY not set' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const fromIso: string | null = body?.from ?? null
    const toIso: string | null = body?.to ?? null
    const startTime = Math.floor((fromIso ? new Date(fromIso).getTime() : (Date.now() - 30 * 86400_000)) / 1000)
    const endTime = Math.floor((toIso ? new Date(toIso).getTime() : Date.now()) / 1000)

    let projectMap: Record<string, Bucket> = {}
    try {
      const raw = Deno.env.get('OPENAI_PROJECT_BUCKETS')
      if (raw) projectMap = JSON.parse(raw) as Record<string, Bucket>
    } catch { /* ignore */ }

    // Fetch completions usage grouped by project
    const params = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      bucket_width: '1d',
      group_by: 'project_id',
      limit: '180',
    })
    const usageRes = await fetch(`https://api.openai.com/v1/organization/usage/completions?${params}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    })
    if (!usageRes.ok) {
      const text = await usageRes.text()
      return new Response(JSON.stringify({ available: false, reason: `OpenAI ${usageRes.status}: ${text.slice(0, 200)}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const usageJson = await usageRes.json()

    const costRes = await fetch(`https://api.openai.com/v1/organization/costs?${new URLSearchParams({
      start_time: String(startTime), end_time: String(endTime), bucket_width: '1d', group_by: 'project_id', limit: '180',
    })}`, { headers: { Authorization: `Bearer ${adminKey}` } })
    const costJson = costRes.ok ? await costRes.json() : { data: [] }

    const buckets: Record<Bucket, BucketTotals> = {
      vision: emptyTotals(),
      user_intent: emptyTotals(),
      reply_intent: emptyTotals(),
      conversation_classification: emptyTotals(),
      ticket_classification: emptyTotals(),
      openai: emptyTotals(),
    }

    for (const bucket of (usageJson?.data ?? [])) {
      for (const result of (bucket?.results ?? [])) {
        const projectId = result?.project_id ?? null
        const key: Bucket = (projectId && projectMap[projectId]) ? projectMap[projectId] : 'openai'
        const inTok = Number(result?.input_tokens ?? 0) || 0
        const outTok = Number(result?.output_tokens ?? 0) || 0
        buckets[key].input_tokens += inTok
        buckets[key].output_tokens += outTok
        buckets[key].tokens += inTok + outTok
      }
    }
    for (const bucket of (costJson?.data ?? [])) {
      for (const result of (bucket?.results ?? [])) {
        const projectId = result?.project_id ?? null
        const key: Bucket = (projectId && projectMap[projectId]) ? projectMap[projectId] : 'openai'
        const amount = Number(result?.amount?.value ?? 0) || 0
        buckets[key].cost_usd += amount
      }
    }

    return new Response(JSON.stringify({ available: true, buckets, has_project_map: Object.keys(projectMap).length > 0 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ available: false, reason: String(e?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})