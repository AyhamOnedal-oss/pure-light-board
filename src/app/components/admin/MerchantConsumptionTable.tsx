import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '@/integrations/supabase/client';

type TokenRow = {
  day: string;
  project_id: string | null;
  model: string | null;
  scope: string;
  input_tokens: number;
  output_tokens: number;
  requests: number;
  words_approx: number;
  cost_usd: number;
};

type Bucket = { input: number; output: number; cost: number; convos: number };

const ZERO: Bucket = { input: 0, output: 0, cost: 0, convos: 0 };

export function MerchantConsumptionTable({ tenantId }: { tenantId: string }) {
  const { t, language, dir } = useApp();
  const [loading, setLoading] = useState(true);
  const [trial, setTrial] = useState<Bucket>(ZERO);
  const [current, setCurrent] = useState<Bucket>(ZERO);
  const [analysis, setAnalysis] = useState<Bucket>(ZERO);
  const [iqtest, setIqtest] = useState<Bucket>(ZERO);
  const [previous, setPrevious] = useState<Bucket | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // 1. plan period start (drives trial vs current split)
      const { data: plan } = await supabase
        .from('settings_plans')
        .select('period_start, trial_ended_at')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const periodStart: string = (plan as any)?.period_start
        ? String((plan as any).period_start)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      // Trial cutoff is frozen: set when tenant first moved onto a paid plan.
      // If null (tenant still on trial), treat the entire history as trial.
      const trialEndedAtIso: string | null = (plan as any)?.trial_ended_at
        ? new Date((plan as any).trial_ended_at).toISOString()
        : null;
      const trialEndedDay: string | null = trialEndedAtIso ? trialEndedAtIso.slice(0, 10) : null;

      // 2. all token rows for this tenant (last 365d)
      const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - 365);
      const { data: tokens } = await supabase.rpc('admin_merchant_tokens', {
        _tenant: tenantId,
        _from: fromDate.toISOString().slice(0, 10),
        _to: new Date().toISOString().slice(0, 10),
      });

      // 3. conversation counts (current period only)
      const periodStartIso = new Date(periodStart + 'T00:00:00Z').toISOString();
      const [{ count: convCurrent }, { count: convTrial }, { count: convAnalysis }, { count: convIq }] = await Promise.all([
        supabase.from('conversations_main').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('is_test', false).gte('created_at', periodStartIso),
        (trialEndedAtIso
          ? supabase.from('conversations_main').select('id', { count: 'exact', head: true })
              .eq('tenant_id', tenantId).eq('is_test', false).lt('created_at', trialEndedAtIso)
          : supabase.from('conversations_main').select('id', { count: 'exact', head: true })
              .eq('tenant_id', tenantId).eq('is_test', false)),
        supabase.from('conversations_main').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('analysis_done', true).gte('created_at', periodStartIso),
        supabase.from('conversations_main').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('is_test', true).gte('created_at', periodStartIso),
      ]);

      if (!active) return;

      const t1 = { ...ZERO }, c1 = { ...ZERO }, a1 = { ...ZERO }, i1 = { ...ZERO };
      ((tokens as TokenRow[]) || []).forEach((r) => {
        const isCurrent = r.day >= periodStart;
        // Trial rows are frozen at trial_ended_at (or all history if still on trial).
        const isTrial = trialEndedDay ? (r.day < trialEndedDay) : true;
        const inT = Number(r.input_tokens) || 0;
        const outT = Number(r.output_tokens) || 0;
        const cost = Number(r.cost_usd) || 0;
        if (r.scope === 'iqtest') {
          i1.input += inT; i1.output += outT; i1.cost += cost;
        } else if (r.scope === 'classifier' || r.scope === 'other') {
          if (isCurrent) { a1.input += inT; a1.output += outT; a1.cost += cost; }
        } else { // chat / vision
          if (isTrial) { t1.input += inT; t1.output += outT; t1.cost += cost; }
          if (isCurrent) { c1.input += inT; c1.output += outT; c1.cost += cost; }
        }
      });
      t1.convos = convTrial || 0;
      c1.convos = convCurrent || 0;
      a1.convos = convAnalysis || 0;
      i1.convos = convIq || 0;
      setTrial(t1); setCurrent(c1); setAnalysis(a1); setIqtest(i1);

      // Previous subscriptions = chat rows between trial_ended_at and current period_start.
      const prev = { ...ZERO };
      ((tokens as TokenRow[]) || []).forEach((r) => {
        const afterTrial = trialEndedDay ? r.day >= trialEndedDay : false;
        if (afterTrial && r.day < periodStart && r.scope === 'chat') {
          prev.input += Number(r.input_tokens) || 0;
          prev.output += Number(r.output_tokens) || 0;
          prev.cost += Number(r.cost_usd) || 0;
        }
      });
      setPrevious(prev.input + prev.output > 0 ? prev : null);

      setLoading(false);
    })();
    return () => { active = false; };
  }, [tenantId]);

  const fmt = (n: number) => n.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US');
  const dollar = (n: number) => `$${n.toFixed(4)}`;

  const rows: Array<{ key: string; label: string; bucket: Bucket; note?: string }> = [
    { key: 'trial',    label: t('Trial Subscription', 'الاشتراك التجريبي'), bucket: trial },
    { key: 'current',  label: t('Current Subscription', 'الاشتراك الحالي'), bucket: current },
    { key: 'analysis', label: t('Post-close Analysis', 'تحليل المحادثات بعد الإغلاق'), bucket: analysis, note: t('Analyzed conversations only', 'محادثات مُحللة فقط') },
    { key: 'iqtest',   label: t('IQ Test (Test Chat)', 'اختبار الذكاء'), bucket: iqtest },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-4 mt-4"
      dir={dir}
    >
      <h3 className="text-[14px] mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
        <BarChart3 className="w-4 h-4" />
        {t('Token & Conversation Consumption', 'استهلاك التوكنز والمحادثات')}
      </h3>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Section', 'القسم')}</th>
                  <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Conversations', 'المحادثات')}</th>
                  <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Input Tokens', 'مدخلات Tokens')}</th>
                  <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Output Tokens', 'مخرجات Tokens')}</th>
                  <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Total', 'الإجمالي')}</th>
                  <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Cost', 'التكلفة')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5">
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      {r.note && <div className="text-muted-foreground text-[10px]">{r.note}</div>}
                    </td>
                    <td className="py-2.5 text-[14px]" style={{ fontWeight: 700 }}>{fmt(r.bucket.convos)}</td>
                    <td className="py-2.5">{fmt(r.bucket.input)}</td>
                    <td className="py-2.5">{fmt(r.bucket.output)}</td>
                    <td className="py-2.5" style={{ fontWeight: 600 }}>{fmt(r.bucket.input + r.bucket.output)}</td>
                    <td className="py-2.5">{dollar(r.bucket.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previous && (
            <div className="mt-3 p-3 rounded-xl bg-muted/30 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span style={{ fontWeight: 600 }}>{t('Previous Subscriptions', 'الاشتراكات السابقة')}:</span>
              <span>{t('Input', 'مدخلات')}: {fmt(previous.input)}</span>
              <span>{t('Output', 'مخرجات')}: {fmt(previous.output)}</span>
              <span>{t('Cost', 'التكلفة')}: {dollar(previous.cost)}</span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}