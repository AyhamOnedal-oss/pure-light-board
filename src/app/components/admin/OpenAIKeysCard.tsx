import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Loader2, Key, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '@/integrations/supabase/client';

type KeyRow = {
  id: string;
  slot: string;
  label: string | null;
  project_id: string | null;
  default_model: string | null;
  input_price_per_1m: number;
  output_price_per_1m: number;
  tokens_per_word: number;
  notes: string | null;
};

const SLOT_USAGE_AR: Record<string, string> = {
  chat: 'المحادثات الأساسية في الشات',
  classifier: 'تحليل المحادثات بعد الإغلاق',
};
const SLOT_USAGE_EN: Record<string, string> = {
  chat: 'Primary chat conversations',
  classifier: 'Post-close conversation analysis',
};

export function OpenAIKeysCard() {
  const { t, language, dir, showToast } = useApp();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [activeSince, setActiveSince] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KeyRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: versions }] = await Promise.all([
      supabase
        .from('admin_openai_keys' as any)
        .select('id,slot,label,project_id,default_model,input_price_per_1m,output_price_per_1m,tokens_per_word,notes')
        .order('slot'),
      supabase
        .from('admin_openai_key_versions' as any)
        .select('key_id, effective_from')
        .is('effective_to', null),
    ]);
    if (!error) setRows((data as any) || []);
    const since: Record<string, string> = {};
    for (const v of (versions as any[] | null) ?? []) {
      since[v.key_id] = v.effective_from;
    }
    setActiveSince(since);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('admin_openai_keys' as any)
      .update({
        label: editing.label,
        project_id: editing.project_id,
        default_model: editing.default_model,
        input_price_per_1m: editing.input_price_per_1m,
        output_price_per_1m: editing.output_price_per_1m,
        tokens_per_word: editing.tokens_per_word,
        notes: editing.notes,
      })
      .eq('id', editing.id);
    setSaving(false);
    setConfirming(false);
    if (error) {
      showToast(t('Save failed', 'فشل الحفظ'), 'error');
      return;
    }
    // Kick a sync immediately so the new pricing/model takes effect now.
    supabase.functions.invoke('openai-usage-sync', { body: {} }).catch(() => {});
    showToast(t('Saved', 'تم الحفظ'), 'success');
    setEditing(null);
    load();
  };

  const fmtSince = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
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
                <th className={`py-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-medium`}>{t('Notes', 'ملاحظات')}</th>
                <th className="py-2 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5" style={{ fontWeight: 600 }}>{i + 1}</td>
                  <td className="py-2.5">{language === 'ar' ? (SLOT_USAGE_AR[r.slot] ?? r.label ?? r.slot) : (SLOT_USAGE_EN[r.slot] ?? r.label ?? r.slot)}</td>
                  <td className="py-2.5"><code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">{r.default_model || '—'}</code></td>
                  <td className="py-2.5">${Number(r.input_price_per_1m).toFixed(2)}</td>
                  <td className="py-2.5">${Number(r.output_price_per_1m).toFixed(2)}</td>
                  <td className="py-2.5 text-muted-foreground text-[11px] max-w-[240px]">
                    <div className="truncate">{r.notes || '—'}</div>
                    {activeSince[r.id] && (
                      <div className="text-[10px] opacity-70 mt-0.5">
                        {t('Active since', 'فعّال منذ')} {fmtSince(activeSince[r.id])}
                      </div>
                    )}
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
              ))}
              <tr className="bg-muted/20">
                <td className="py-2.5" style={{ fontWeight: 600 }}>3</td>
                <td className="py-2.5">{t('IQ Test (uses Chat key)', 'اختبار الذكاء (يستخدم مفتاح الشات)')}</td>
                <td className="py-2.5 text-muted-foreground" colSpan={3}>{t('Same model & price as #1, tracked separately', 'نفس نموذج وسعر #1 مع تتبع منفصل')}</td>
                <td className="py-2.5 text-muted-foreground text-[11px]">tenant_id:iqtest</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !saving && setEditing(null)}>
          <div className="bg-card rounded-2xl border border-border p-5 w-full max-w-md mx-4" dir={dir} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[14px]" style={{ fontWeight: 600 }}>{t('Edit Key', 'تعديل المفتاح')} — {editing.slot}</h4>
              <button onClick={() => setEditing(null)} disabled={saving} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-[12px]">
              <Field label={t('Label', 'الاسم')} value={editing.label ?? ''} onChange={(v) => setEditing({ ...editing, label: v })} />
              <Field label={t('Model', 'النموذج')} value={editing.default_model ?? ''} onChange={(v) => setEditing({ ...editing, default_model: v })} />
              <Field label={t('Project ID', 'معرّف المشروع')} value={editing.project_id ?? ''} onChange={(v) => setEditing({ ...editing, project_id: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('Input /1M $', 'مدخلات /1M $')} type="number" value={String(editing.input_price_per_1m)} onChange={(v) => setEditing({ ...editing, input_price_per_1m: Number(v) })} />
                <Field label={t('Output /1M $', 'مخرجات /1M $')} type="number" value={String(editing.output_price_per_1m)} onChange={(v) => setEditing({ ...editing, output_price_per_1m: Number(v) })} />
              </div>
              <Field label={t('Tokens / word', 'توكنز / كلمة')} type="number" value={String(editing.tokens_per_word)} onChange={(v) => setEditing({ ...editing, tokens_per_word: Number(v) })} />
              <Field label={t('Notes', 'ملاحظات')} value={editing.notes ?? ''} onChange={(v) => setEditing({ ...editing, notes: v })} />
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
                    'All new conversations from now on will be calculated with the new model and prices. Past usage stays as it was billed at the time.',
                    'كل المحادثات الجديدة من الآن فصاعدًا ستُحسب بالنموذج والأسعار الجديدة، أمّا الاستخدام السابق فيبقى كما هو محسوب بأسعاره وقت الاستهلاك.'
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

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="text-muted-foreground text-[11px] mb-1">{label}</div>
      <input
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-[12px] focus:outline-none focus:border-[#043CC8]"
      />
    </label>
  );
}