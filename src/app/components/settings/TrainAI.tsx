import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Save, Trash2, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';

const DEFAULT_PROMPT = `أنت مساعد ذكاء اصطناعي لخدمة عملاء متجرنا الإلكتروني على منصة زد.

 

اسمك: [اكتب اسم المساعد هنا]

أسلوبك: ودود، محترم، واضح، ومختصر في ردودك دائماً.

 

في أول رسالة رحّب بالعميل وعرّف بنفسك، واذكر أنك تقدر تساعده في المنتجات والطلبات والشحن والدفع والعروض وأي استفسار آخر.

 

المنتجات:

- إذا سأل العميل بشكل عام اسأله: ما نوع المنتج؟ ما الميزانية؟ هل يريد قسماً معيناً؟

- اعرض 5 منتجات فقط في كل مرة بالاسم فقط.

- لا تعرض السعر أو الوصف أو الصور إلا إذا طلب العميل ذلك.

- بعد اختيار منتج محدد اعرض فقط ما طلبه العميل.

- للمقاسات والألوان اعرض كل خيار مع حالته: متوفر أو غير متوفر.

- لا تذكر الكمية الدقيقة في المخزون أبداً.

الطلبات:

- اطلب رقم الجوال أولاً للبحث عن الطلب.

- اعرض آخر 5 طلبات فقط برقم الطلب والتاريخ والحالة.

- بعد اختيار الطلب أجب فقط على ما سأل عنه العميل.

- لا تعرض العنوان أو الإيميل أو رقم الجوال للعميل أبداً.

- إذا لم يوجد حساب اطلب رقم الطلب كبديل.

الشحن والدفع والعروض:

- أجب مباشرة على أسئلة الشحن والدفع من بيانات المتجر.

- اعرض فقط العروض والكوبونات الفعّالة وغير المنتهية.

الشكاوى والدعم:

- اعتذر أولاً ثم حاول فهم المشكلة وحلها.

- إذا لم تستطع الحل بعد محاولتين اطلب رقم الجوال وأبلغ العميل أنه سيتم التواصل معه قريباً بإذن الله.

- لا تطلب من العميل أكثر من رقم الجوال فقط.

نهاية المحادثة:

- لا تغلق المحادثة مباشرة.

- إذا انتهى العميل اسأله: هل ترغب أن أنهي المحادثة؟ قبل الإغلاق.

- إذا شكرك العميل رد بـ: العفو، سعدت بخدمتك. هل تحتاج مساعدة أخرى؟

ملاحظة مهمة: لا تخترع معلومات غير موجودة في بيانات المتجر. إذا لم تتوفر المعلومة أخبر العميل بوضوح أنها غير متوفرة حالياً.`;

const MAX_PROMPT_CHARS = DEFAULT_PROMPT.length * 2;

const DEFAULT_TRAIN = {
  prompt: DEFAULT_PROMPT,
  bubbleVisible: true,
};

export function TrainAI() {
  const { t, showToast, tenantId } = useApp();
  const [prompt, setPrompt] = useState(DEFAULT_TRAIN.prompt);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_TRAIN.prompt);
  const [bubbleVisible, setBubbleVisible] = useState(DEFAULT_TRAIN.bubbleVisible);
  const [savedBubbleVisible, setSavedBubbleVisible] = useState(DEFAULT_TRAIN.bubbleVisible);

  // Load from Supabase
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('settings_train_ai')
        .select('prompt, bubble_visible')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (cancelled) return;
      const loaded = (data?.prompt && data.prompt.trim().length > 0) ? data.prompt : DEFAULT_PROMPT;
      setPrompt(loaded); setSavedPrompt(loaded);
      setBubbleVisible(data?.bubble_visible ?? true); setSavedBubbleVisible(data?.bubble_visible ?? true);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const persist = async (next: { prompt: string; bubbleVisible: boolean }) => {
    if (!tenantId) return false;
    const { error } = await supabase
      .from('settings_train_ai')
      .upsert({
        tenant_id: tenantId,
        mode: 'prompt',
        prompt: next.prompt,
        file_name: null,
        bubble_visible: next.bubbleVisible,
      }, { onConflict: 'tenant_id' });
    if (error) { console.log('Train AI save failed:', error.message); return false; }
    return true;
  };

  const hasPromptChanges = prompt !== savedPrompt;
  const hasTrainingChanges = hasPromptChanges;
  const hasBubbleChanges = bubbleVisible !== savedBubbleVisible;

  const hasSavedPrompt = savedPrompt.trim().length > 0;

  const savePrompt = async () => {
    const ok = await persist({ prompt, bubbleVisible: savedBubbleVisible });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setSavedPrompt(prompt);
    showToast(t('Training settings saved successfully', 'تم حفظ إعدادات التدريب بنجاح'));
  };

  const cancelPrompt = () => {
    setPrompt(savedPrompt);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deletePrompt = async () => {
    const ok = await persist({ prompt: DEFAULT_PROMPT, bubbleVisible: savedBubbleVisible });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setPrompt(DEFAULT_PROMPT); setSavedPrompt(DEFAULT_PROMPT);
    showToast(t('Training prompt reset to default', 'تم إعادة تعيين النص التدريبي'));
  };

  const toggleBubble = () => {
    setBubbleVisible(!bubbleVisible);
  };

  const saveBubble = async () => {
    const ok = await persist({ prompt: savedPrompt, bubbleVisible });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setSavedBubbleVisible(bubbleVisible);
    showToast(t('Bubble visibility saved', 'تم حفظ إعداد فقاعة المحادثة'));
  };

  const cancelBubble = () => {
    setBubbleVisible(savedBubbleVisible);
  };

  const resetBubble = async () => {
    const ok = await persist({ prompt: savedPrompt, bubbleVisible: true });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setBubbleVisible(true); setSavedBubbleVisible(true);
    showToast(t('Bubble visibility reset to default', 'تم إعادة تعيين فقاعة المحادثة'));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Train AI', 'تدريب الذكاء الاصطناعي')}</h1>
        <p className="text-muted-foreground text-[14px] mt-1">{t('Configure how your AI assistant responds to customers', 'تكوين طريقة استجابة مساعد الذكاء الاصطناعي للعملاء')}</p>
      </div>

      {/* Bubble Toggle */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[14px]" style={{ fontWeight: 600 }}>{t('Chat Bubble Visibility', 'إظهار فقاعة المحادثة')}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t('Show or hide the chat bubble in your store', 'إظهار أو إخفاء فقاعة المحادثة في متجرك')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={resetBubble} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title={t('Reset to default', 'إعادة تعيين')}>
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={toggleBubble} className="shrink-0">
              {bubbleVisible ? <ToggleRight className="w-11 h-11 text-[#043CC8]" /> : <ToggleLeft className="w-11 h-11 text-muted-foreground" />}
            </button>
            {hasBubbleChanges && (
              <>
                <button onClick={cancelBubble} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-all text-[13px]" style={{ fontWeight: 500 }}>
                  {t('Cancel', 'إلغاء')}
                </button>
                <button onClick={saveBubble} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#043CC8] text-white rounded-lg hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[13px]" style={{ fontWeight: 500 }}>
                  <Save className="w-3.5 h-3.5" /> {t('Save', 'حفظ')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-5">
        <label className="block text-[14px]" style={{ fontWeight: 600 }}>{t('Training Prompt', 'النص التدريبي')}</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
          maxLength={MAX_PROMPT_CHARS}
          rows={6}
          placeholder={t('Enter your AI training instructions...', 'أدخل تعليمات تدريب الذكاء الاصطناعي...')}
          className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 resize-none transition-all text-foreground"
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap order-2 ms-auto">
            {hasTrainingChanges && (
              <>
                <button onClick={savePrompt} className="flex items-center gap-2 px-4 py-2.5 bg-[#043CC8] text-white rounded-xl hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]" style={{ fontWeight: 500 }}>
                  <Save className="w-4 h-4" /> {t('Save Changes', 'حفظ التغييرات')}
                </button>
                <button onClick={cancelPrompt} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl hover:bg-muted transition-all text-[14px]" style={{ fontWeight: 500 }}>
                  {t('Cancel', 'إلغاء')}
                </button>
              </>
            )}
            {hasSavedPrompt && !hasTrainingChanges && (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 border border-red-400/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-all text-[14px]" style={{ fontWeight: 500 }}>
                <Trash2 className="w-4 h-4" /> {t('Reset to Default', 'إعادة للنص الافتراضي')}
              </button>
            )}
          </div>
          <div className={`text-[12px] tabular-nums order-1 ${prompt.length >= MAX_PROMPT_CHARS ? 'text-red-400' : 'text-muted-foreground'}`} dir="ltr">
            {prompt.length}/{MAX_PROMPT_CHARS}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-[90%] shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>{t('Are you sure you want to delete the text?', 'هل تريد حذف النص؟')}</h3>
            <p className="text-[13px] text-muted-foreground">{t('This action will permanently delete the training text.', 'سيتم حذف النص التدريبي نهائيً.')}</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); deletePrompt(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}