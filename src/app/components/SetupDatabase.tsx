import React, { useState } from 'react';
import { Database, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SetupStep {
  name: string;
  nameAr: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export function SetupDatabase() {
  const { t, theme } = useApp();
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<SetupStep[]>([
    { name: 'stores table', nameAr: 'جدول المتاجر', status: 'pending' },
    { name: 'conversations table', nameAr: 'جدول المحادثات', status: 'pending' },
    { name: 'messages table', nameAr: 'جدول الرسائل', status: 'pending' },
    { name: 'tickets table', nameAr: 'جدول التذاكر', status: 'pending' },
    { name: 'ratings table', nameAr: 'جدول التقييمات', status: 'pending' },
    { name: 'insights table', nameAr: 'جدول الرؤى', status: 'pending' },
    { name: 'analytics table', nameAr: 'جدول المقاييس', status: 'pending' },
    { name: 'bubble_clicks table', nameAr: 'جدول النقرات', status: 'pending' },
  ]);

  const updateStepStatus = (index: number, status: SetupStep['status'], error?: string) => {
    setSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, status, error } : step
    ));
  };

  const executeSQL = async (sql: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const SUPABASE_URL = `https://kyohutbusszojssbgbvw.supabase.co`;
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5b2h1dGJ1c3N6b2pzc2JnYnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDk5NTYsImV4cCI6MjA5MTcyNTk1Nn0.TgYntJK3VQeH3CpB1GGX1OYPOp_l91Kk6DmlyttghUo";

      // Note: This is a simplified approach
      // In production, you would need service role key and proper SQL execution endpoint
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        return { success: false, error: await response.text() };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const runSetup = async () => {
    setIsRunning(true);

    const sqlQueries = [
      // stores
      `CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_name TEXT NOT NULL,
        store_logo TEXT,
        api_endpoint TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // conversations
      `CREATE TABLE IF NOT EXISTS conversations (
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
      )`,
      // messages
      `CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK (sender IN ('customer', 'ai', 'agent')),
        content TEXT NOT NULL,
        media_url TEXT,
        feedback TEXT CHECK (feedback IN ('positive', 'negative', NULL)),
        feedback_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // tickets
      `CREATE TABLE IF NOT EXISTS tickets (
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
      )`,
      // ratings
      `CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // insights
      `CREATE TABLE IF NOT EXISTS insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('complaints', 'requests', 'inquiries', 'suggestions', 'unknown')),
        label_en TEXT NOT NULL,
        label_ar TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // analytics
      `CREATE TABLE IF NOT EXISTS analytics (
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
      )`,
      // bubble_clicks
      `CREATE TABLE IF NOT EXISTS bubble_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        session_id TEXT,
        clicked_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    for (let i = 0; i < sqlQueries.length; i++) {
      updateStepStatus(i, 'running');
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay for UI

      const result = await executeSQL(sqlQueries[i]);

      if (result.success) {
        updateStepStatus(i, 'success');
      } else {
        updateStepStatus(i, 'error', result.error);
      }
    }

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-[#043CC8]/10 flex items-center justify-center">
              <Database className="w-7 h-7 text-[#043CC8]" />
            </div>
            <div>
              <h1 className="text-[24px]" style={{ fontWeight: 700 }}>
                {t('Database Setup', 'إعداد قاعدة البيانات')}
              </h1>
              <p className="text-[14px] text-muted-foreground mt-1">
                {t('Create all required tables for Fuqah AI Dashboard', 'إنشاء جميع الجداول المطلوبة للوحة التحكم')}
              </p>
            </div>
          </div>

          {/* Setup Steps */}
          <div className="space-y-3 mb-6">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  step.status === 'success'
                    ? 'border-green-500/30 bg-green-500/5'
                    : step.status === 'error'
                    ? 'border-red-500/30 bg-red-500/5'
                    : step.status === 'running'
                    ? 'border-[#043CC8]/30 bg-[#043CC8]/5'
                    : 'border-border bg-card'
                }`}
              >
                {/* Status Icon */}
                <div className="shrink-0">
                  {step.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {step.status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {step.status === 'running' && (
                    <Loader2 className="w-5 h-5 text-[#043CC8] animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-muted" />
                  )}
                </div>

                {/* Step Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px]" style={{ fontWeight: 500 }}>
                    {step.nameAr}
                  </p>
                  {step.error && (
                    <p className="text-[12px] text-red-500 mt-1 truncate">
                      {step.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={runSetup}
            disabled={isRunning}
            className={`w-full py-3.5 px-6 rounded-xl text-white text-[15px] transition-all ${
              isRunning
                ? 'bg-muted cursor-not-allowed'
                : 'bg-[#043CC8] hover:bg-[#032fa3]'
            }`}
            style={{ fontWeight: 600 }}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('Setting up database...', 'جارٍ الإعداد...')}
              </span>
            ) : (
              t('Start Setup', 'بدء الإعداد')
            )}
          </button>

          {/* Manual Alternative */}
          <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-[13px] text-muted-foreground mb-2" style={{ fontWeight: 500 }}>
              {t('Alternative: Manual Setup', 'بديل: إعداد يدوي')}
            </p>
            <p className="text-[12px] text-muted-foreground mb-3">
              {t(
                'If automatic setup fails, you can run the SQL manually in Supabase SQL Editor:',
                'إذا فشل الإعداد التلقائي، يمكنك تشغيل SQL يدوياً في محرر Supabase:'
              )}
            </p>
            <a
              href="https://supabase.com/dashboard/project/kyohutbusszojssbgbvw/sql"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#043CC8] hover:underline block"
              style={{ fontWeight: 600 }}
            >
              {t('Open SQL Editor →', 'فتح محرر SQL ←')}
            </a>
            <p className="text-[11px] text-muted-foreground mt-2">
              {t('SQL file location:', 'موقع ملف SQL:')} <code className="bg-muted px-1.5 py-0.5 rounded">supabase/schema/dashboard_tables.sql</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
