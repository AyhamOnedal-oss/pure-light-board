import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Loader2, Key, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '@/integrations/supabase/client';

type KeyRow = {
  id: string | null;
  slot: string;
  default_model: string | null;
  input_price_per_1m: number;
  output_price_per_1m: number;
  notes: string | null;
};

const SLOTS: { slot: string; usage_ar: string; usage_en: string }[] = [
  { slot: 'chat',       usage_ar: 'المحادثات الأساسية في الشات', usage_en: 'Primary chat conversations' },
  { slot: 'classifier', usage_ar: 'تحليل المحادثات بعد الإغلاق',  usage_en: 'Post-close conversation analysis' },
  { slot: 'iqtest',     usage_ar: 'اختبار الذكاء',                 usage_en: 'IQ Test conversations' },
];

const emptyRow = (slot: string): KeyRow => ({
  id: null, slot, default_model: '', input_price_per_1m: 0, output_price_per_1m: 0, notes: '',
});

export function OpenAIKeysCard() {
  const { t, language, dir, showToast } = useApp();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KeyRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [costs, setCosts] = useState<Record<string, number>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_openai_keys' as any)
      .select('id,slot,default_model,input_price_per_1m,output_price_per_1m,notes');
    const bySlot = new Map<string, KeyRow>();
    for (const r of (data as any[] | null) ?? []) bySlot.set((r as any).slot, r as KeyRow);
    setRows(SLOTS.map((s) => bySlot.get(s.slot) ?? emptyRow(s.slot)));
    const { data: costData } = await supabase.rpc('admin_openai_cost_by_slot' as any);
    const costMap: Record<string, number> = {};
    for (const c of (costData as any[] | null) ?? []) costMap[c.slot] = Number(c.cost_usd) || 0;
    setCosts(costMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSave = async () => {
    if (!editing) return;
    setSaving(true);
    const payload: any = {
      slot: editing.slot,
      default_model: editing.default_model || null,
      input_price_per_1m: Math.max(0, Number(editing.input_price_per_1m) || 0),
      output_price_per_1m: Math.max(0, Number(editing.output_price_per_1m) || 0),
      notes: null,
    };
    const q = editing.id
      ? supabase.from('admin_openai_keys' as any).update(payload).eq('id', editing.id)
      : supabase.from('admin_openai_keys' as any).upsert(payload, { onConflict: 'slot' });
    const { error } = await q;
    setSaving(false);
    setConfirming(false);
    if (error) { showToast(t('Save failed', 'فشل الحفظ'), 'error'); return; }
    // Re-sync so the new pricing/model is applied to all merchants from now on
    supabase.functions.invoke('openai-usage-sync', { body: {} }).catch(() => {});
    showToast(t('Saved & synced', 'تم الحفظ والمزامنة'), 'success');
    setEditing(null);
    load();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
      className="bg-card rounded-2xl border border-border p-4"
      dir={dir}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] flex items-center gap-2" style={{ fontWeight: 600 }}>
          <Key className="w-4 h-4" />
          {t('OpenAI Keys', 'مفاتيح OpenAI')}
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>#</th>
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Usage', 'الاستخدام')}</th>
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Model', 'النموذج')}</th>
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Input /1M', 'مدخلات /1M')}</th>
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Output /1M', 'مخرجات /1M')}</th>
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Cost (USD)', 'التكلفة (دولار)')}</th>
                <th className="py-2 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const meta = SLOTS.find((s) => s.slot === r.slot)!;
                const empty = !r.id;
                const cost = costs[r.slot] ?? 0;
                return (
                  <tr key={r.slot} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5" style={{ fontWeight: 600 }}>{i + 1}</td>
                    <td className="py-2.5">{language === 'ar' ? meta.usage_ar : meta.usage_en}</td>
                    <td className="py-2.5">
                      {empty
                        ? <span className="text-muted-foreground italic">{t('Not set', 'غير مضبوط')}</span>
                        : <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">{r.default_model || '—'}</code>}
                    </td>
                    <td className="py-2.5">{empty ? '—' : `$${Number(r.input_price_per_1m)}`}</td>
                    <td className="py-2.5">{empty ? '—' : `$${Number(r.output_price_per_1m)}`}</td>
                    <td className="py-2.5 text-[11px]" style={{ fontWeight: 600 }}>
                      {cost > 0 ? `$${cost.toFixed(4)}` : '—'}
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        onClick={() => setEditing({ ...r })}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title={t('Edit', 'تعديل')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !saving && setEditing(null)}>
          <div className="bg-card rounded-2xl border border-border p-5 w-full max-w-md mx-4" dir={dir} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[14px]" style={{ fontWeight: 600 }}>
                {(editing.id ? t('Edit Key', 'تعديل المفتاح') : t('Add Key', 'إضافة مفتاح'))} — {editing.slot}
              </h4>
              <button onClick={() => setEditing(null)} disabled={saving} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-[12px]">
              <Field label={t('Model', 'النموذج')} value={editing.default_model ?? ''} onChange={(v) => setEditing({ ...editing, default_model: v })} placeholder="gpt-5.4-nano" />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('Input /1M (USD)', 'مدخلات /1M (دولار)')} decimal value={String(editing.input_price_per_1m)} onChange={(v) => setEditing({ ...editing, input_price_per_1m: v as any })} />
                <Field label={t('Output /1M (USD)', 'مخرجات /1M (دولار)')} decimal value={String(editing.output_price_per_1m)} onChange={(v) => setEditing({ ...editing, output_price_per_1m: v as any })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-3 py-1.5 rounded-lg border border-border text-[12px] hover:bg-muted">{t('Cancel', 'إلغاء')}</button>
              <button onClick={() => setConfirming(true)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#043CC8] text-white text-[12px] flex items-center gap-2">
                {t('Save', 'حفظ')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => !saving && setConfirming(false)}>
          <div className="bg-card rounded-2xl border border-border p-5 w-full max-w-sm mx-4" dir={dir} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>
                  {t('Apply new pricing & model?', 'تطبيق السعر/النموذج الجديد؟')}
                </h4>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {t(
                    'All merchant usage from now on will be calculated with the new model and prices. Past usage stays as it was billed at the time.',
                    'كل استهلاك التجار من الآن فصاعدًا سيُحسب بالنموذج والأسعار الجديدة، أمّا الاستهلاك السابق فيبقى كما هو محسوب بأسعاره وقت الاستهلاك.'
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setConfirming(false)} disabled={saving} className="px-3 py-1.5 rounded-lg border border-border text-[12px] hover:bg-muted">{t('Cancel', 'إلغاء')}</button>
              <button onClick={doSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#043CC8] text-white text-[12px] flex items-center gap-2">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {t('Confirm & apply', 'تأكيد وتطبيق')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Field({ label, value, onChange, decimal, placeholder }: { label: string; value: string; onChange: (v: string) => void; decimal?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <div className="text-muted-foreground text-[11px] mb-1">{label}</div>
      <input
        type={decimal ? 'number' : 'text'}
        inputMode={decimal ? 'decimal' : undefined}
        step={decimal ? '0.01' : undefined}
        min={decimal ? 0 : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-[12px] focus:outline-none focus:border-[#043CC8]"
      />
    </label>
  );
}
