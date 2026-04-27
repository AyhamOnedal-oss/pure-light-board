-- ============================================
-- Fuqah AI Dashboard - Supabase Schema
-- ============================================
-- Simple, merchant-friendly database design
-- All tables support RTL (Arabic) and LTR (English)
-- ============================================

-- 1. STORES TABLE
-- Stores basic merchant information
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,
  store_logo TEXT,
  api_endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_created ON stores(created_at DESC);

-- 2. CONVERSATIONS TABLE
-- Main conversation records between customers and AI
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

CREATE INDEX idx_conversations_store ON conversations(store_id, created_at DESC);
CREATE INDEX idx_conversations_classification ON conversations(store_id, classification);
CREATE INDEX idx_conversations_status ON conversations(store_id, status);

-- 3. MESSAGES TABLE
-- Individual messages within conversations
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

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_feedback ON messages(conversation_id) WHERE feedback IS NOT NULL;

-- 4. TICKETS TABLE
-- Support tickets created from conversations
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL, -- Format: TKT-XXXXX
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

CREATE INDEX idx_tickets_store ON tickets(store_id, created_at DESC);
CREATE INDEX idx_tickets_status ON tickets(store_id, status);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);

-- 5. RATINGS TABLE
-- Customer satisfaction ratings
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ratings_store ON ratings(store_id, created_at DESC);
CREATE INDEX idx_ratings_conversation ON ratings(conversation_id);

-- 6. INSIGHTS TABLE
-- AI-driven insights (complaints, requests, inquiries, suggestions, unknown)
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

CREATE INDEX idx_insights_store ON insights(store_id, category, count DESC);
CREATE INDEX idx_insights_resolved ON insights(store_id) WHERE resolved = FALSE;

-- 7. ANALYTICS TABLE
-- Daily aggregated metrics for dashboard KPIs
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- KPIs
  total_conversations INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage
  total_tickets INTEGER DEFAULT 0,
  open_tickets INTEGER DEFAULT 0,
  closed_tickets INTEGER DEFAULT 0,
  words_consumed INTEGER DEFAULT 0,
  bubble_clicks INTEGER DEFAULT 0,
  avg_response_time_seconds DECIMAL(10,2) DEFAULT 0.00,

  -- Conversation classification counts
  complaints_count INTEGER DEFAULT 0,
  inquiries_count INTEGER DEFAULT 0,
  requests_count INTEGER DEFAULT 0,
  suggestions_count INTEGER DEFAULT 0,
  unknown_count INTEGER DEFAULT 0,

  -- Feedback counts
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,

  -- Rating metrics
  total_ratings INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0.00,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, date)
);

CREATE INDEX idx_analytics_store_date ON analytics(store_id, date DESC);

-- 8. BUBBLE_CLICKS TABLE
-- Track bubble clicks for analytics
CREATE TABLE IF NOT EXISTS bubble_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  session_id TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bubble_clicks_store ON bubble_clicks(store_id, clicked_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-increment message count when message is added
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

CREATE TRIGGER increment_conversation_message_count AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION increment_message_count();

-- Generate ticket number automatically
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'TKT-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_ticket_number_trigger BEFORE INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_clicks ENABLE ROW LEVEL SECURITY;

-- Policies: Merchants can only access their own store data
-- (Assuming auth.uid() maps to store owner)

CREATE POLICY "Merchants can view their own stores" ON stores
  FOR SELECT USING (auth.uid()::TEXT = id::TEXT);

CREATE POLICY "Merchants can view their own conversations" ON conversations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = conversations.store_id AND auth.uid()::TEXT = stores.id::TEXT
  ));

CREATE POLICY "Merchants can view their own messages" ON messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM conversations c
    JOIN stores s ON s.id = c.store_id
    WHERE c.id = messages.conversation_id AND auth.uid()::TEXT = s.id::TEXT
  ));

CREATE POLICY "Merchants can view their own tickets" ON tickets
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = tickets.store_id AND auth.uid()::TEXT = stores.id::TEXT
  ));

CREATE POLICY "Merchants can view their own ratings" ON ratings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = ratings.store_id AND auth.uid()::TEXT = stores.id::TEXT
  ));

CREATE POLICY "Merchants can view their own insights" ON insights
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = insights.store_id AND auth.uid()::TEXT = stores.id::TEXT
  ));

CREATE POLICY "Merchants can view their own analytics" ON analytics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = analytics.store_id AND auth.uid()::TEXT = stores.id::TEXT
  ));

CREATE POLICY "Merchants can view their own bubble clicks" ON bubble_clicks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = bubble_clicks.store_id AND auth.uid()::TEXT = stores.id::TEXT
  ));

-- ============================================
-- SAMPLE QUERIES FOR DASHBOARD
-- ============================================

-- Get today's KPIs for a store
-- SELECT * FROM analytics WHERE store_id = 'xxx' AND date = CURRENT_DATE;

-- Get recent conversations with classification
-- SELECT * FROM conversations WHERE store_id = 'xxx' ORDER BY created_at DESC LIMIT 50;

-- Get all open tickets
-- SELECT * FROM tickets WHERE store_id = 'xxx' AND status = 'open' ORDER BY created_at DESC;

-- Get average rating for last 30 days
-- SELECT AVG(rating) FROM ratings WHERE store_id = 'xxx' AND created_at >= NOW() - INTERVAL '30 days';

-- Get top insights by category
-- SELECT * FROM insights WHERE store_id = 'xxx' AND category = 'complaints' AND resolved = FALSE ORDER BY count DESC LIMIT 10;

-- Get AI message feedback (positive vs negative)
-- SELECT feedback, COUNT(*) FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = 'xxx') AND feedback IS NOT NULL GROUP BY feedback;
