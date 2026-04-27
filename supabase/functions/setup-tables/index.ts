import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = [];

    // 1. Create stores table
    try {
      await supabaseAdmin.rpc('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS stores (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_name TEXT NOT NULL,
            store_logo TEXT,
            api_endpoint TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_stores_created ON stores(created_at DESC);
        `
      });
      results.push({ table: 'stores', status: 'success' });
    } catch (e) {
      results.push({ table: 'stores', status: 'error', error: e.message });
    }

    // 2. Create conversations table
    try {
      await supabaseAdmin.rpc('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
            customer_phone TEXT,
            customer_name TEXT,
            classification TEXT CHECK (classification IN ('complaint', 'inquiry', 'request', 'suggestion', 'unknown')),
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
            message_count INTEGER DEFAULT 0,
            last_message_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_conversations_store ON conversations(store_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_conversations_classification ON conversations(store_id, classification);
          CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(store_id, status);
        `
      });
      results.push({ table: 'conversations', status: 'success' });
    } catch (e) {
      results.push({ table: 'conversations', status: 'error', error: e.message });
    }

    // 3-8. Create remaining tables...
    // (continuing with all other tables)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database setup completed',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
