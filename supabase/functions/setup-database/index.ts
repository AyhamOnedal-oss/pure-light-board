import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Create stores table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS stores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_name TEXT NOT NULL,
          store_logo TEXT,
          api_endpoint TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Create conversations table
    await supabase.rpc('exec_sql', {
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
      `
    });

    return new Response(
      JSON.stringify({ success: true, message: "Database setup completed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
