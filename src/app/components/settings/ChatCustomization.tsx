import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Paperclip, ArrowUp, Sun, Moon, Loader2, MessageCircle, Clock, X, AlertTriangle, RotateCcw } from 'lucide-react';
import iconImg from '../../../imports/FUQAH-AI-icon-01@2x.png';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc841b6e`;
const STORE_ID = 'store_shrman'; // Unique store identifier for this user

const CHAT_CUSTOM_KEY = 'fuqah_chat_customization';

function loadChatCustom() {
  try {
    const stored = localStorage.getItem(CHAT_CUSTOM_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    primaryColor: '#000000',
    widgetOuter: '#000000',
    widgetInner: '#FFFFFF',
    position: 'right' as 'right' | 'left',
    previewMode: 'light' as 'dark' | 'light',
    welcomeBubbleEnabled: true,
    welcomeBubbleLine1: 'مرحباً 👋',
    welcomeBubbleLine2: 'كيف يمكنني مساعدتك؟',
    inactivityEnabled: true,
    inactivityPromptSeconds: 90,
    inactivityCloseSeconds: 60,
    ratingInactivitySeconds: 900,
  };
}

const WELCOME_LINE1_MAX = 24;
const WELCOME_LINE2_MAX = 36;
const PROMPT_MIN = 30, PROMPT_MAX = 300;
const CLOSE_MIN = 15, CLOSE_MAX = 180;
const RATING_MIN = 30, RATING_MAX = 3600, RATING_STEP = 30;
const DEFAULT_PROMPT = 90, DEFAULT_CLOSE = 60, DEFAULT_RATING = 900;

function formatSeconds(s: number, t: (en: string, ar: string) => string) {
  if (s < 60) return `${s} ${t('seconds', 'ثانية')}`;
  const m = s / 60;
  const mStr = Number.isInteger(m) ? `${m}` : m.toFixed(1);
  return `${s} ${t('seconds', 'ثانية')} (${mStr} ${t('min', 'دقيقة')})`;
}

function saveChatCustom(data: any) {
  try { localStorage.setItem(CHAT_CUSTOM_KEY, JSON.stringify(data)); } catch {}
}

async function saveToSupabase(settings: any) {
  const res = await fetch(`${API_BASE}/chat-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ storeId: STORE_ID, settings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save to server');
  }
  return res.json();
}

async function loadFromSupabase() {
  const res = await fetch(`${API_BASE}/chat-settings/${STORE_ID}`, {
    headers: { 'Authorization': `Bearer ${publicAnonKey}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load from server');
  const data = await res.json();
  return data.settings;
}

// Module-level persistent saved state (survives component remounts)
const persistedSaved = loadChatCustom();

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <label className="text-[13px] text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-border shrink-0">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
          <div className="w-full h-full" style={{ backgroundColor: value }} />
        </div>
        <input
          value={value.toUpperCase()}
          onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v); }}
          className="w-[86px] px-2 py-1.5 rounded-lg bg-input-background border border-border text-[11px] outline-none focus:border-[#043CC8] transition-all font-mono text-foreground"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function ChatCustomization() {
  const { t, showToast } = useApp();

  const [primaryColor, setPrimaryColor] = useState(persistedSaved.primaryColor);
  const [widgetOuter, setWidgetOuter] = useState(persistedSaved.widgetOuter);
  const [widgetInner, setWidgetInner] = useState(persistedSaved.widgetInner);
  const [position, setPosition] = useState<'right' | 'left'>(persistedSaved.position);
  const [previewMode, setPreviewMode] = useState<'dark' | 'light'>(persistedSaved.previewMode);
  const [welcomeBubbleEnabled, setWelcomeBubbleEnabled] = useState<boolean>(persistedSaved.welcomeBubbleEnabled ?? true);
  const [welcomeBubbleLine1, setWelcomeBubbleLine1] = useState<string>(persistedSaved.welcomeBubbleLine1 ?? 'مرحباً 👋');
  const [welcomeBubbleLine2, setWelcomeBubbleLine2] = useState<string>(persistedSaved.welcomeBubbleLine2 ?? 'كيف يمكنني مساعدتك؟');
  const [inactivityEnabled, setInactivityEnabled] = useState<boolean>(persistedSaved.inactivityEnabled ?? true);
  const [inactivityPromptSeconds, setInactivityPromptSeconds] = useState<number>(persistedSaved.inactivityPromptSeconds ?? DEFAULT_PROMPT);
  const [inactivityCloseSeconds, setInactivityCloseSeconds] = useState<number>(persistedSaved.inactivityCloseSeconds ?? DEFAULT_CLOSE);
  const [ratingInactivitySeconds, setRatingInactivitySeconds] = useState<number>(persistedSaved.ratingInactivitySeconds ?? DEFAULT_RATING);
  const [saved, setSaved] = useState({ ...persistedSaved });
  const [saving, setSaving] = useState(false);
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const DEFAULTS = {
    primaryColor: '#000000',
    widgetOuter: '#000000',
    widgetInner: '#FFFFFF',
    position: 'right' as 'right' | 'left',
    previewMode: 'light' as 'dark' | 'light',
    welcomeBubbleEnabled: true,
    welcomeBubbleLine1: 'مرحباً 👋',
    welcomeBubbleLine2: 'كيف يمكنني مساعدتك؟',
    inactivityEnabled: true,
    inactivityPromptSeconds: DEFAULT_PROMPT,
    inactivityCloseSeconds: DEFAULT_CLOSE,
    ratingInactivitySeconds: DEFAULT_RATING,
  };

  const applyDefaults = () => {
    setPrimaryColor(DEFAULTS.primaryColor);
    setWidgetOuter(DEFAULTS.widgetOuter);
    setWidgetInner(DEFAULTS.widgetInner);
    setPosition(DEFAULTS.position);
    setPreviewMode(DEFAULTS.previewMode);
    setWelcomeBubbleEnabled(DEFAULTS.welcomeBubbleEnabled);
    setWelcomeBubbleLine1(DEFAULTS.welcomeBubbleLine1);
    setWelcomeBubbleLine2(DEFAULTS.welcomeBubbleLine2);
    setInactivityEnabled(DEFAULTS.inactivityEnabled);
    setInactivityPromptSeconds(DEFAULTS.inactivityPromptSeconds);
    setInactivityCloseSeconds(DEFAULTS.inactivityCloseSeconds);
    setRatingInactivitySeconds(DEFAULTS.ratingInactivitySeconds);
  };

  // Load from Supabase on mount
  useEffect(() => {
    loadFromSupabase().then(settings => {
      if (settings) {
        const s = {
          primaryColor: settings.primaryColor || '#000000',
          widgetOuter: settings.widgetOuter || '#000000',
          widgetInner: settings.widgetInner || '#FFFFFF',
          position: settings.position || 'right',
          previewMode: settings.previewMode || 'light',
          welcomeBubbleEnabled: settings.welcomeBubbleEnabled ?? true,
          welcomeBubbleLine1: settings.welcomeBubbleLine1 ?? 'مرحباً 👋',
          welcomeBubbleLine2: settings.welcomeBubbleLine2 ?? 'كيف يمكنني مساعدتك؟',
          inactivityEnabled: settings.inactivityEnabled ?? true,
          inactivityPromptSeconds: typeof settings.inactivityPromptSeconds === 'number' ? settings.inactivityPromptSeconds : DEFAULT_PROMPT,
          inactivityCloseSeconds: typeof settings.inactivityCloseSeconds === 'number' ? settings.inactivityCloseSeconds : DEFAULT_CLOSE,
          ratingInactivitySeconds: typeof settings.ratingInactivitySeconds === 'number' ? settings.ratingInactivitySeconds : DEFAULT_RATING,
        };
        setPrimaryColor(s.primaryColor);
        setWidgetOuter(s.widgetOuter);
        setWidgetInner(s.widgetInner);
        setPosition(s.position as 'right' | 'left');
        setPreviewMode(s.previewMode as 'dark' | 'light');
        setWelcomeBubbleEnabled(s.welcomeBubbleEnabled);
        setWelcomeBubbleLine1(s.welcomeBubbleLine1);
        setWelcomeBubbleLine2(s.welcomeBubbleLine2);
        setInactivityEnabled(s.inactivityEnabled);
        setInactivityPromptSeconds(s.inactivityPromptSeconds);
        setInactivityCloseSeconds(s.inactivityCloseSeconds);
        setRatingInactivitySeconds(s.ratingInactivitySeconds);
        setSaved(s);
        Object.assign(persistedSaved, s);
        saveChatCustom(s);
        console.log('Chat settings loaded from Supabase');
      }
      setLoadedFromServer(true);
    }).catch(err => {
      console.log('Error loading settings from Supabase:', err);
      setLoadedFromServer(true);
    });
  }, []);

  const hasChanges =
    primaryColor !== saved.primaryColor ||
    widgetOuter !== saved.widgetOuter ||
    widgetInner !== saved.widgetInner ||
    position !== saved.position ||
    previewMode !== saved.previewMode ||
    welcomeBubbleEnabled !== saved.welcomeBubbleEnabled ||
    welcomeBubbleLine1 !== saved.welcomeBubbleLine1 ||
    welcomeBubbleLine2 !== saved.welcomeBubbleLine2 ||
    inactivityEnabled !== saved.inactivityEnabled ||
    inactivityPromptSeconds !== saved.inactivityPromptSeconds ||
    inactivityCloseSeconds !== saved.inactivityCloseSeconds ||
    ratingInactivitySeconds !== saved.ratingInactivitySeconds;

  const handleSave = async () => {
    const newSaved = {
      primaryColor, widgetOuter, widgetInner, position, previewMode,
      welcomeBubbleEnabled,
      welcomeBubbleLine1: welcomeBubbleLine1.slice(0, WELCOME_LINE1_MAX),
      welcomeBubbleLine2: welcomeBubbleLine2.slice(0, WELCOME_LINE2_MAX),
      inactivityEnabled,
      inactivityPromptSeconds,
      inactivityCloseSeconds,
      ratingInactivitySeconds,
    };
    setSaving(true);
    try {
      await saveToSupabase(newSaved);
      setSaved(newSaved);
      Object.assign(persistedSaved, newSaved);
      saveChatCustom(newSaved);
      showToast(t('Settings saved successfully', 'تم حفظ الإعدادات بنجاح'));
    } catch (err) {
      console.log('Error saving chat settings:', err);
      // Still save locally as fallback
      setSaved(newSaved);
      Object.assign(persistedSaved, newSaved);
      saveChatCustom(newSaved);
      showToast(t('Saved locally (server error)', 'تم الحفظ محلياً (خطأ في الخادم)'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPrimaryColor(saved.primaryColor);
    setWidgetOuter(saved.widgetOuter);
    setWidgetInner(saved.widgetInner);
    setPosition(saved.position);
    setPreviewMode(saved.previewMode);
    setWelcomeBubbleEnabled(saved.welcomeBubbleEnabled ?? true);
    setWelcomeBubbleLine1(saved.welcomeBubbleLine1 ?? 'مرحباً 👋');
    setWelcomeBubbleLine2(saved.welcomeBubbleLine2 ?? 'كيف يمكنني مساعدتك؟');
    setInactivityEnabled(saved.inactivityEnabled ?? true);
    setInactivityPromptSeconds(saved.inactivityPromptSeconds ?? DEFAULT_PROMPT);
    setInactivityCloseSeconds(saved.inactivityCloseSeconds ?? DEFAULT_CLOSE);
    setRatingInactivitySeconds(saved.ratingInactivitySeconds ?? DEFAULT_RATING);
  };

  const handleInactivityToggle = (enabled: boolean) => {
    setInactivityEnabled(enabled);
    if (enabled && (!inactivityPromptSeconds || !inactivityCloseSeconds)) {
      setInactivityPromptSeconds(DEFAULT_PROMPT);
      setInactivityCloseSeconds(DEFAULT_CLOSE);
    }
  };

  const clampPrompt = (v: number) => Math.max(PROMPT_MIN, Math.min(PROMPT_MAX, Math.round(v)));
  const clampClose = (v: number) => Math.max(CLOSE_MIN, Math.min(CLOSE_MAX, Math.round(v)));

  // Derive colors from preview mode + primary color
  const isDarkPreview = previewMode === 'dark';
  const bgColor = isDarkPreview ? '#1e293b' : '#FFFFFF';
  const headerColor = primaryColor;
  const aiBubbleColor = primaryColor;
  const customerBubbleColor = isDarkPreview ? '#334155' : '#f3f4f6';
  const aiBubbleText = '#ffffff';
  const customerBubbleText = isDarkPreview ? '#f1f5f9' : '#1f2937';
  const sendButtonColor = primaryColor;
  const inputBgColor = isDarkPreview ? '#334155' : '#f3f4f6';
  const inputTextColor = isDarkPreview ? '#64748b' : '#9ca3af';
  const clipColor = isDarkPreview ? '#ffffff' : '#000000';
  const sendArrowColor = '#ffffff';
  const borderColor = isDarkPreview ? '#334155' : '#e5e7eb';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Chat Customization', 'تخصيص المحادثة')}</h1>
        <p className="text-muted-foreground text-[14px] mt-1">{t('Customize the look and feel of your chat widget', 'خصص مظهر وأسلوب أداة المحادثة')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Controls */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <h3 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>{t('Color Controls', 'إعدادات الألوان')}</h3>
            <p className="text-[11px] text-muted-foreground mb-2">{t('All changes reflect in live preview', 'جميع التغييرات تظهر في المعاينة المباشرة')}</p>
            <ColorField label={t('1. Primary Color', '1. اللون الأساسي')} value={primaryColor} onChange={setPrimaryColor} />
            <ColorField label={t('2. Widget Outer', '2. لون الأداة الخارجي')} value={widgetOuter} onChange={setWidgetOuter} />
            <ColorField label={t('3. Widget Inner', '3. لون الأداة الداخلي')} value={widgetInner} onChange={setWidgetInner} />
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <label className="text-[14px] mb-3 block" style={{ fontWeight: 600 }}>{t('Widget Position', 'موضع الأداة')}</label>
            <div className="flex gap-2">
              <button onClick={() => setPosition('right')} className={`flex-1 py-2.5 rounded-xl text-[13px] transition-all ${position === 'right' ? 'bg-[#043CC8] text-white shadow-md' : 'bg-muted text-muted-foreground hover:text-foreground'}`} style={{ fontWeight: 600 }}>
                {t('Bottom Right', 'أسفل اليمين')}
              </button>
              <button onClick={() => setPosition('left')} className={`flex-1 py-2.5 rounded-xl text-[13px] transition-all ${position === 'left' ? 'bg-[#043CC8] text-white shadow-md' : 'bg-muted text-muted-foreground hover:text-foreground'}`} style={{ fontWeight: 600 }}>
                {t('Bottom Left', 'أسفل اليسار')}
              </button>
            </div>
          </div>

          {/* Behavior & Messages — Welcome Bubble */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#043CC8]/10 text-[#043CC8] dark:text-[#6b8bff] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-[14px]" style={{ fontWeight: 600 }}>{t('Welcome Bubble', 'رسالة الترحيب')}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t('Small bubble shown above the widget icon', 'فقاعة صغيرة تظهر فوق أيقونة الويدجت')}</p>
                </div>
              </div>
              <ToggleSwitch checked={welcomeBubbleEnabled} onChange={setWelcomeBubbleEnabled} />
            </div>

            <div className={`space-y-3 transition-opacity ${welcomeBubbleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <LineInput
                label={t('Line 1', 'السطر الأول')}
                value={welcomeBubbleLine1}
                onChange={setWelcomeBubbleLine1}
                max={WELCOME_LINE1_MAX}
                disabled={!welcomeBubbleEnabled}
              />
              <LineInput
                label={t('Line 2', 'السطر الثاني')}
                value={welcomeBubbleLine2}
                onChange={setWelcomeBubbleLine2}
                max={WELCOME_LINE2_MAX}
                disabled={!welcomeBubbleEnabled}
                emojiHint={t('Tip: keep line 2 clean (avoid emojis).', 'نصيحة: اجعل السطر الثاني نظيفاً (تجنب الإيموجي).')}
              />
            </div>
          </div>

          {/* Behavior & Messages — Inactivity Timer */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Clock className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-[14px]" style={{ fontWeight: 600 }}>{t('Inactivity Timer', 'مؤقت الخمول')}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t('Prompt inactive users, then auto-close', 'تنبيه المستخدمين الخاملين ثم الإغلاق التلقائي')}</p>
                </div>
              </div>
              <ToggleSwitch checked={inactivityEnabled} onChange={handleInactivityToggle} />
            </div>

            {!inactivityEnabled ? (
              <p className="text-[11px] text-muted-foreground/80 bg-muted/50 rounded-xl px-3 py-2">
                {t('Timer disabled — no prompt will be shown to inactive users.', 'المؤقت معطّل — لن يُعرض أي تنبيه للمستخدمين الخاملين.')}
              </p>
            ) : (
              <div className="space-y-4">
                <SliderField
                  label={t('Prompt after idle', 'مدة الخمول قبل التنبيه')}
                  value={inactivityPromptSeconds}
                  onChange={v => setInactivityPromptSeconds(clampPrompt(v))}
                  min={PROMPT_MIN}
                  max={PROMPT_MAX}
                  displayLabel={formatSeconds(inactivityPromptSeconds, t)}
                  presets={[60, 90, 120, 180]}
                  warning={inactivityPromptSeconds < 45 ? t('Too short — may annoy users.', 'القيمة قصيرة جداً وقد تُزعج المستخدمين.') : ''}
                />
                <SliderField
                  label={t('Auto-close after prompt', 'مدة الإغلاق التلقائي')}
                  value={inactivityCloseSeconds}
                  onChange={v => setInactivityCloseSeconds(clampClose(v))}
                  min={CLOSE_MIN}
                  max={CLOSE_MAX}
                  displayLabel={formatSeconds(inactivityCloseSeconds, t)}
                  presets={[30, 60, 90]}
                  warning={inactivityCloseSeconds < 30 ? t('Too short — user may miss the prompt.', 'قد يُغلق المؤقت المحادثة قبل أن يلاحظها المستخدم.') : ''}
                />

                <div>
                  <label className="block text-[12px] mb-1" style={{ fontWeight: 600 }}>
                    {t('Rating screen idle timeout (seconds)', 'مدة الخمول في شاشة التقييم (بالثواني)')}
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                    {t(
                      'If the customer does not interact with the rating screen within this duration, the conversation will be closed automatically.',
                      'إذا لم يتفاعل العميل مع شاشة التقييم خلال هذه المدة، يتم إغلاق المحادثة تلقائياً.'
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRatingInactivitySeconds(v => Math.max(RATING_MIN, Math.min(RATING_MAX, (v || DEFAULT_RATING) - RATING_STEP)))}
                      className="w-9 h-9 rounded-lg border border-border bg-background hover:bg-muted text-[16px] flex items-center justify-center"
                      style={{ fontWeight: 700 }}
                      aria-label="decrement"
                    >−</button>
                    <input
                      type="number"
                      min={RATING_MIN}
                      max={RATING_MAX}
                      step={RATING_STEP}
                      value={ratingInactivitySeconds}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10);
                        if (isNaN(n)) return;
                        setRatingInactivitySeconds(Math.max(RATING_MIN, Math.min(RATING_MAX, n)));
                      }}
                      className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setRatingInactivitySeconds(v => Math.max(RATING_MIN, Math.min(RATING_MAX, (v || DEFAULT_RATING) + RATING_STEP)))}
                      className="w-9 h-9 rounded-lg border border-border bg-background hover:bg-muted text-[16px] flex items-center justify-center"
                      style={{ fontWeight: 700 }}
                      aria-label="increment"
                    >+</button>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ms-1">
                      {formatSeconds(ratingInactivitySeconds, t)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    `Flow: idle ${inactivityPromptSeconds}s → prompt banner → idle ${inactivityCloseSeconds}s → rating screen.`,
                    `التدفق: خمول ${inactivityPromptSeconds} ثانية ← تنبيه ← خمول ${inactivityCloseSeconds} ثانية إضافية ← شاشة التقييم.`
                  )}
                </div>

                {/* Mock preview of the inactivity banner */}
                <div className="rounded-xl border border-border overflow-hidden bg-background">
                  <div className="px-3 py-2 text-[10px] text-muted-foreground border-b border-border bg-muted/30">
                    {t('Preview — inactivity banner', 'معاينة — بانر الخمول')}
                  </div>
                  <div className="p-3" dir="rtl">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] text-foreground">
                      <p style={{ fontWeight: 600 }}>{t('Still with us? 👋', 'هل ما زلت معنا؟ 👋')}</p>
                      <p className="text-muted-foreground mt-0.5">{t('No activity — want to continue?', 'لاحظنا عدم وجود نشاط، هل تود المتابعة؟')}</p>
                      <div className="flex gap-2 mt-2">
                        <button className="flex-1 py-1.5 rounded-lg text-[11px] text-white" style={{ backgroundColor: primaryColor, fontWeight: 600 }}>
                          {t('Continue', 'متابعة المحادثة')}
                        </button>
                        <button className="flex-1 py-1.5 rounded-lg text-[11px] bg-muted text-foreground" style={{ fontWeight: 600 }}>
                          {t('End', 'إنهاء المحادثة')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right column: Preview + Reset + Save/Cancel */}
        <div className="space-y-4">
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px]" style={{ fontWeight: 600 }}>{t('Live Preview', 'معاينة مباشرة')}</h3>
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button
                onClick={() => setPreviewMode('light')}
                className={`p-1.5 rounded-lg transition-all ${previewMode === 'light' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewMode('dark')}
                className={`p-1.5 rounded-lg transition-all ${previewMode === 'dark' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-[300px]">
            <div dir="ltr" className="relative rounded-2xl overflow-hidden border border-border shadow-lg" style={{ backgroundColor: bgColor, height: '420px' }}>
              {/* Header */}
              <div dir="rtl" className="px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: headerColor }}>
                <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                  <img src={iconImg} alt="" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-white text-[12px]" style={{ fontWeight: 600 }}>Fuqah AI</p>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <p className="text-white/60 text-[9px]">{t('AI Agent', 'وكيل الذكاء الاصطناعي')}</p>
                  </div>
                </div>
              </div>

              {/* Messages — AI LEFT, Customer RIGHT */}
              <div className="p-3 space-y-2">
                {/* AI bubble — LEFT */}
                <div className="flex items-end gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-black p-0.5" >
                    <img src={iconImg} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="max-w-[80%] px-3 py-1.5 rounded-xl rounded-bl-sm text-[11px]" style={{ backgroundColor: aiBubbleColor, color: aiBubbleText }}>
                    {t('Hello! How can I help?', 'مرحباً! كيف أساعدك؟')}
                  </div>
                </div>
                {/* Customer bubble — RIGHT */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-1.5 rounded-xl rounded-br-sm text-[11px]" style={{ backgroundColor: customerBubbleColor, color: customerBubbleText }}>
                    {t('Help with my order', 'مساعدة في طلبي')}
                  </div>
                </div>
                {/* AI bubble — LEFT */}
                <div className="flex items-end gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-black p-0.5" >
                    <img src={iconImg} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="max-w-[80%] px-3 py-1.5 rounded-xl rounded-bl-sm text-[11px]" style={{ backgroundColor: aiBubbleColor, color: aiBubbleText }}>
                    {t('Sure! Share your order #.', 'بالتأكيد! شارك رقم طلبك.')}
                  </div>
                </div>
                {/* Customer bubble — RIGHT */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-1.5 rounded-xl rounded-br-sm text-[11px]" style={{ backgroundColor: customerBubbleColor, color: customerBubbleText }}>
                    #45231
                  </div>
                </div>
              </div>

              {/* Input — Attachment LEFT, Send RIGHT */}
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 backdrop-blur-sm" style={{ backgroundColor: inputBgColor }}>
                  <Paperclip className="w-3.5 h-3.5 shrink-0" style={{ color: clipColor }} />
                  <span className="flex-1 text-[11px]" style={{ color: inputTextColor }}>{t('Type a message...', 'اكتب رسالة...')}</span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: sendButtonColor }}>
                    <ArrowUp className="w-3.5 h-3.5" style={{ color: sendArrowColor }} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* Welcome Bubble — above widget (preview-only, non-interactive) */}
              {welcomeBubbleEnabled && (
                <div
                  dir="rtl"
                  className={`absolute pointer-events-none ${position === 'right' ? 'right-2.5' : 'left-2.5'}`}
                  style={{ bottom: 64 + 48 + 8, width: 180 }}
                  aria-hidden
                >
                  <div className="relative rounded-xl shadow-lg px-3 py-2 pe-6" style={{ backgroundColor: isDarkPreview ? '#1e293b' : '#FFFFFF', border: `1px solid ${borderColor}` }}>
                    <span
                      className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isDarkPreview ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.06)',
                        color: isDarkPreview ? '#e2e8f0' : '#475569',
                      }}
                      aria-hidden
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                    <p className="text-[11px] truncate" style={{ fontWeight: 600, color: isDarkPreview ? '#f1f5f9' : '#1f2937' }}>{welcomeBubbleLine1 || ' '}</p>
                    <p className="text-[10px] truncate" style={{ color: isDarkPreview ? '#94a3b8' : '#6b7280' }}>{welcomeBubbleLine2 || ' '}</p>
                    <div
                      className={`absolute -bottom-1.5 ${position === 'right' ? 'right-4' : 'left-4'} w-3 h-3 rotate-45`}
                      style={{ backgroundColor: isDarkPreview ? '#1e293b' : '#FFFFFF', borderRight: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}
                    />
                  </div>
                </div>
              )}

              {/* Widget — custom SVG */}
              <div className={`absolute bottom-14 ${position === 'right' ? 'right-2.5' : 'left-2.5'}`}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl shadow-black/30 overflow-hidden p-0" style={{ backgroundColor: widgetOuter }}>
                  <svg viewBox="0 0 1000 1000" className="w-full h-full">
                    <circle cx="500" cy="500" r="500" fill={widgetOuter} />
                    <path d="M500,217.35c-156.1,0-282.65,126.55-282.65,282.65s126.55,282.65,282.65,282.65v68.68s282.65-77.5,282.65-351.33c0-156.11-126.55-282.65-282.65-282.65Z" fill={widgetInner} />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reset to defaults */}
        <button
          type="button"
          onClick={() => setResetConfirmOpen(true)}
          className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-foreground text-[13px] flex items-center justify-center gap-2 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <RotateCcw className="w-4 h-4" />
          {t('Reset to Default Design', 'إعادة التصميم الافتراضي')}
        </button>

        {/* Save Changes | Cancel */}
        {hasChanges && (
          <div className="flex gap-3">
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0331a3] active:scale-[0.98] transition-all text-[13px] flex items-center justify-center" style={{ fontWeight: 600 }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Save Changes', 'حفظ التغييرات')}
            </button>
            <button onClick={handleCancel} className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 active:scale-[0.98] transition-all text-[13px]" style={{ fontWeight: 600 }}>
              {t('Cancel', 'إلغاء')}
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Reset confirmation modal */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setResetConfirmOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>{t('Reset to Default Design?', 'إعادة التصميم الافتراضي؟')}</h3>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {t('All colors, position, welcome message, and inactivity timer will be restored to defaults. You can still click Cancel afterwards to discard.', 'ستتم إعادة جميع الألوان والموضع ورسالة الترحيب ومؤقت الخمول إلى القيم الافتراضية. يمكنك الضغط على إلغاء بعدها للتراجع.')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={() => { applyDefaults(); setResetConfirmOpen(false); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Reset', 'إعادة التعيين')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}
      onMouseDown={(e) => e.stopPropagation()}
      dir="ltr"
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#043CC8]' : 'bg-muted'}`}
      aria-pressed={checked}
      role="switch"
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all pointer-events-none"
        style={{ left: checked ? 18 : 2 }}
      />
    </button>
  );
}

function LineInput({ label, value, onChange, max, disabled, emojiHint }: {
  label: string; value: string; onChange: (v: string) => void; max: number; disabled?: boolean; emojiHint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{label}</label>
        <span className={`text-[11px] font-mono ${value.length > max ? 'text-red-500' : 'text-muted-foreground/70'}`}>
          {value.length}/{max}
        </span>
      </div>
      <input
        dir="rtl"
        value={value}
        disabled={disabled}
        onChange={e => {
          const v = e.target.value.replace(/\n/g, '').slice(0, max);
          onChange(v);
        }}
        className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground disabled:opacity-60"
      />
      {emojiHint && <p className="text-[10px] text-muted-foreground/70 mt-1">{emojiHint}</p>}
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, displayLabel, presets, warning }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; displayLabel: string; presets: number[]; warning?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{label}</label>
        <span className="text-[11px] text-foreground font-mono">{displayLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          className="flex-1 accent-[#043CC8]"
        />
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="w-[68px] px-2 py-1.5 rounded-lg bg-input-background border border-border text-[12px] outline-none focus:border-[#043CC8] font-mono text-foreground"
        />
      </div>
      <div className="flex gap-1.5 mt-2 flex-wrap">
        {presets.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${value === p ? 'bg-[#043CC8] text-white border-[#043CC8]' : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'}`}
            style={{ fontWeight: 600 }}
          >
            {p}s
          </button>
        ))}
      </div>
      {warning && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}