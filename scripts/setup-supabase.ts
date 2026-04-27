/**
 * Supabase Database Setup Script
 * This script creates all necessary tables for Fuqah AI Dashboard
 */

const SUPABASE_URL = "https://kyohutbusszojssbgbvw.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  console.log("\nTo run this script:");
  console.log("1. Get your service role key from:");
  console.log("   https://supabase.com/dashboard/project/kyohutbusszojssbgbvw/settings/api");
  console.log("2. Run: SUPABASE_SERVICE_ROLE_KEY='your-key' deno run --allow-net --allow-env scripts/setup-supabase.ts");
  Deno.exit(1);
}

const queries = [
  {
    name: "stores table",
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
  },
  {
    name: "conversations table",
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
  },
  {
    name: "messages table",
    sql: `
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK (sender IN ('customer', 'ai', 'agent')),
        content TEXT NOT NULL,
        media_url TEXT,
        feedback TEXT CHECK (feedback IN ('positive', 'negative', NULL)),
        feedback_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_messages_feedback ON messages(conversation_id) WHERE feedback IS NOT NULL;
    `
  },
  {
    name: "tickets table",
    sql: `
      CREATE TABLE IF NOT EXISTS tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number TEXT UNIQUE NOT NULL,
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        customer_phone TEXT NOT NULL,
        customer_name TEXT,
        title_en TEXT,
        title_ar TEXT,
        description_en TEXT,
        description_ar TEXT,
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        assigned_to UUID,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_store ON tickets(store_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(store_id, status);
      CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
    `
  },
  {
    name: "ratings table",
    sql: `
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ratings_store ON ratings(store_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ratings_conversation ON ratings(conversation_id);
    `
  },
  {
    name: "insights table",
    sql: `
      CREATE TABLE IF NOT EXISTS insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('complaints', 'requests', 'inquiries', 'suggestions', 'unknown')),
        label_en TEXT NOT NULL,
        label_ar TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_insights_store ON insights(store_id, category, count DESC);
      CREATE INDEX IF NOT EXISTS idx_insights_resolved ON insights(store_id) WHERE resolved = FALSE;
    `
  },
  {
    name: "analytics table",
    sql: `
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        total_conversations INTEGER DEFAULT 0,
        completion_rate DECIMAL(5,2) DEFAULT 0.00,
        total_tickets INTEGER DEFAULT 0,
        open_tickets INTEGER DEFAULT 0,
        closed_tickets INTEGER DEFAULT 0,
        words_consumed INTEGER DEFAULT 0,
        bubble_clicks INTEGER DEFAULT 0,
        avg_response_time_seconds DECIMAL(10,2) DEFAULT 0.00,
        complaints_count INTEGER DEFAULT 0,
        inquiries_count INTEGER DEFAULT 0,
        requests_count INTEGER DEFAULT 0,
        suggestions_count INTEGER DEFAULT 0,
        unknown_count INTEGER DEFAULT 0,
        positive_feedback INTEGER DEFAULT 0,
        negative_feedback INTEGER DEFAULT 0,
        total_ratings INTEGER DEFAULT 0,
        avg_rating DECIMAL(3,2) DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(store_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_store_date ON analytics(store_id, date DESC);
    `
  },
  {
    name: "bubble_clicks table",
    sql: `
      CREATE TABLE IF NOT EXISTS bubble_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        session_id TEXT,
        clicked_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bubble_clicks_store ON bubble_clicks(store_id, clicked_at DESC);
    `
  },
  {
    name: "update_updated_at function",
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `
  },
  {
    name: "triggers for updated_at",
    sql: `
      DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
      CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
      CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
      CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_insights_updated_at ON insights;
      CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON insights
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_analytics_updated_at ON analytics;
      CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON analytics
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `
  },
  {
    name: "increment_message_count function",
    sql: `
      CREATE OR REPLACE FUNCTION increment_message_count()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE conversations
        SET
          message_count = message_count + 1,
          last_message_at = NEW.created_at
        WHERE id = NEW.conversation_id;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS increment_conversation_message_count ON messages;
      CREATE TRIGGER increment_conversation_message_count AFTER INSERT ON messages
        FOR EACH ROW EXECUTE FUNCTION increment_message_count();
    `
  },
  {
    name: "generate_ticket_number function",
    sql: `
      CREATE OR REPLACE FUNCTION generate_ticket_number()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
          NEW.ticket_number := 'TKT-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
        END IF;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS generate_ticket_number_trigger ON tickets;
      CREATE TRIGGER generate_ticket_number_trigger BEFORE INSERT ON tickets
        FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();
    `
  }
];

async function executeSQL(sql: string): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`   Error: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

console.log("🚀 Starting Fuqah AI Dashboard database setup...\n");

let successCount = 0;
let failCount = 0;

for (const query of queries) {
  process.stdout.write(`📝 Creating ${query.name}... `);

  const success = await executeSQL(query.sql);

  if (success) {
    console.log("✅");
    successCount++;
  } else {
    console.log("❌");
    failCount++;
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`${"=".repeat(50)}\n`);

if (failCount === 0) {
  console.log("🎉 Database setup completed successfully!");
  console.log("\nYou can now view your tables at:");
  console.log(`https://supabase.com/dashboard/project/kyohutbusszojssbgbvw/editor`);
} else {
  console.log("⚠️  Some operations failed. Please check the errors above.");
  console.log("\nAlternative: Run the SQL manually in Supabase SQL Editor:");
  console.log(`https://supabase.com/dashboard/project/kyohutbusszojssbgbvw/sql`);
}
