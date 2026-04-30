import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Save, Upload, Trash2, ToggleLeft, ToggleRight, FileSpreadsheet, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';

const DEFAULT_TRAIN = {
  prompt: '',
  fileName: '',
  bubbleVisible: true,
  mode: 'prompt' as 'prompt' | 'file',
};

export function TrainAI() {
  const { t, showToast, tenantId } = useApp();
  const [mode, setMode] = useState<'prompt' | 'file'>(DEFAULT_TRAIN.mode);
  const [savedMode, setSavedMode] = useState<'prompt' | 'file'>(DEFAULT_TRAIN.mode);
  const [prompt, setPrompt] = useState(DEFAULT_TRAIN.prompt);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_TRAIN.prompt);
  const [bubbleVisible, setBubbleVisible] = useState(DEFAULT_TRAIN.bubbleVisible);
  const [savedBubbleVisible, setSavedBubbleVisible] = useState(DEFAULT_TRAIN.bubbleVisible);
  const [fileName, setFileName] = useState(DEFAULT_TRAIN.fileName);
  const [savedFileName, setSavedFileName] = useState(DEFAULT_TRAIN.fileName);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load from Supabase
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('settings_train_ai')
        .select('mode, prompt, file_name, bubble_visible')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (cancelled || !data) return;
      const m = (data.mode as 'prompt' | 'file') || 'prompt';
      setMode(m); setSavedMode(m);
      setPrompt(data.prompt || ''); setSavedPrompt(data.prompt || '');
      setFileName(data.file_name || ''); setSavedFileName(data.file_name || '');
      setBubbleVisible(data.bubble_visible ?? true); setSavedBubbleVisible(data.bubble_visible ?? true);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const persist = async (next: { prompt: string; fileName: string; bubbleVisible: boolean; mode: 'prompt' | 'file' }) => {
    if (!tenantId) return false;
    const { error } = await supabase
      .from('settings_train_ai')
      .upsert({
        tenant_id: tenantId,
        mode: next.mode,
        prompt: next.prompt,
        file_name: next.fileName || null,
        bubble_visible: next.bubbleVisible,
      }, { onConflict: 'tenant_id' });
    if (error) { console.log('Train AI save failed:', error.message); return false; }
    return true;
  };

  const hasPromptChanges = prompt !== savedPrompt;
  const hasFileChanges = fileName !== savedFileName;
  const hasModeChanges = mode !== savedMode;
  const hasTrainingChanges = hasPromptChanges || hasFileChanges || hasModeChanges;
  const hasBubbleChanges = bubbleVisible !== savedBubbleVisible;

  // Check if already using other method
  const hasSavedPrompt = savedPrompt.trim().length > 0;
  const hasSavedFile = savedFileName.trim().length > 0;

  const attemptSwitchMode = (newMode: 'prompt' | 'file') => {
    if (newMode === 'file' && hasSavedPrompt) {
      showToast(t('⚠️ You can only use one method: Text OR File. Delete your prompt first.', '⚠️ يمكنك استخدام طريقة واحدة فقط: نص أو ملف. احذف النص أولاً.'));
      return;
    }
    if (newMode === 'prompt' && hasSavedFile) {
      showToast(t('⚠️ You can only use one method: Text OR File. Remove your file first.', '⚠️ يمكنك استخدام طريقة واحدة فقط: نص أو ملف. أزل الملف أولاً.'));
      return;
    }
    setMode(newMode);
  };

  const savePrompt = async () => {
    const ok = await persist({ prompt, fileName, bubbleVisible: savedBubbleVisible, mode });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setSavedPrompt(prompt); setSavedMode(mode); setSavedFileName(fileName);
    showToast(t('Training settings saved successfully', 'تم حفظ إعدادات التدريب بنجاح'));
  };

  const cancelPrompt = () => {
    setPrompt(savedPrompt);
    setFileName(savedFileName);
    setMode(savedMode);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFileDeleteConfirm, setShowFileDeleteConfirm] = useState(false);

  const deletePrompt = async () => {
    const ok = await persist({ prompt: '', fileName: savedFileName, bubbleVisible: savedBubbleVisible, mode });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setPrompt(''); setSavedPrompt('');
    showToast(t('Training prompt deleted', 'تم حذف نص التدريب'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ok = await persist({ prompt: savedPrompt, fileName: file.name, bubbleVisible: savedBubbleVisible, mode });
      if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
      setFileName(file.name); setSavedFileName(file.name); setSavedMode(mode);
      showToast(t('Training file saved successfully', 'تم حفظ ملف التدريب بنجاح'));
    }
  };

  const saveFile = async () => {
    const ok = await persist({ prompt: savedPrompt, fileName, bubbleVisible: savedBubbleVisible, mode });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setSavedFileName(fileName); setSavedMode(mode);
    showToast(t('Training file saved successfully', 'تم حفظ ملف التدريب بنجاح'));
  };

  const removeFile = async () => {
    const ok = await persist({ prompt: savedPrompt, fileName: '', bubbleVisible: savedBubbleVisible, mode });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setFileName(''); setSavedFileName('');
    if (fileRef.current) fileRef.current.value = '';
    showToast(t('Training file removed', 'تم إزالة ملف التدريب'));
  };

  const toggleBubble = () => {
    setBubbleVisible(!bubbleVisible);
  };

  const saveBubble = async () => {
    const ok = await persist({ prompt: savedPrompt, fileName: savedFileName, bubbleVisible, mode: savedMode });
    if (!ok) { showToast(t('Failed to save', 'فشل الحفظ')); return; }
    setSavedBubbleVisible(bubbleVisible);
    showToast(t('Bubble visibility saved', 'تم حفظ إعداد فقاعة المحادثة'));
  };

  const cancelBubble = () => {
    setBubbleVisible(savedBubbleVisible);
  };

  const resetBubble = async () => {
    const ok = await persist({ prompt: savedPrompt, fileName: savedFileName, bubbleVisible: true, mode: savedMode });
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

      {/* Mode Selector */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
        <p className="text-[14px] mb-2" style={{ fontWeight: 600 }}>{t('Training Method', 'طريقة التدريب')}</p>
        <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[12px] text-amber-600 dark:text-amber-400">{t('You can only use one method at a time: Text Prompt OR File Upload. Delete current data to switch.', 'يمكنك استخدام طريقة واحدة فقط: نص تدريبي أو رفع ملف. احذف البيانات الحالية للتبديل.')}</p>
        </div>
        <div className="flex gap-2 bg-muted p-1 rounded-xl w-fit">
          <button
            onClick={() => attemptSwitchMode('prompt')}
            className={`px-5 py-2.5 rounded-lg text-[13px] transition-all ${mode === 'prompt' ? 'bg-[#043CC8] text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            style={{ fontWeight: 600 }}
          >
            {t('Text Prompt', 'نص تدريبي')}
          </button>
          <button
            onClick={() => attemptSwitchMode('file')}
            className={`px-5 py-2.5 rounded-lg text-[13px] transition-all ${mode === 'file' ? 'bg-[#043CC8] text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            style={{ fontWeight: 600 }}
          >
            {t('File Upload', 'رفع ملف')}
          </button>
        </div>
      </div>

      {mode === 'prompt' ? (
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
          <label className="text-[14px]" style={{ fontWeight: 600 }}>{t('Training Prompt', 'النص التدريبي')}</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={6}
            disabled={hasSavedFile}
            placeholder={t('Enter your AI training instructions...', 'أدخل تعليمات تدريب الذكاء الاصطناعي...')}
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 resize-none transition-all text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex gap-2 flex-wrap">
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
                <Trash2 className="w-4 h-4" /> {t('Delete Prompt', 'حذف النص')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          {fileName ? (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border">
              <FileSpreadsheet className="w-8 h-8 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] truncate" style={{ fontWeight: 500 }}>{fileName}</p>
                <p className="text-[12px] text-muted-foreground">{t('Training file uploaded', 'تم رفع ملف التدريب')}</p>
              </div>
              <button onClick={() => setShowFileDeleteConfirm(true)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className={`border-2 border-dashed border-border rounded-2xl p-10 text-center ${hasSavedPrompt ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-[14px] mb-1" style={{ fontWeight: 500 }}>{t('Upload Training File', 'رفع ملف التدريب')}</p>
              <p className="text-[13px] text-muted-foreground mb-5">{t('Supports Excel (.xlsx) and CSV files', 'يدعم ملفات Excel (.xlsx) و CSV')}</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" id="train-file" />
              <label htmlFor="train-file" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#043CC8] text-white rounded-xl hover:bg-[#0330a0] cursor-pointer text-[14px] transition-colors" style={{ fontWeight: 500 }}>
                <Upload className="w-4 h-4" /> {t('Choose File', 'اختر ملف')}
              </label>
            </div>
          )}
          {hasFileChanges && fileName && (
            <div className="mt-4 flex gap-2">
              <button onClick={saveFile} className="flex items-center gap-2 px-4 py-2.5 bg-[#043CC8] text-white rounded-xl hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]" style={{ fontWeight: 500 }}>
                <Save className="w-4 h-4" /> {t('Save Changes', 'حفظ التغييرات')}
              </button>
              <button onClick={() => { setFileName(savedFileName); }} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl hover:bg-muted transition-all text-[14px]" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* File Delete Confirmation Modal */}
      {showFileDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFileDeleteConfirm(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-[90%] shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>{t('Are you sure you want to delete this file?', 'هل تريد حذف هذا الملف؟')}</h3>
            <p className="text-[13px] text-muted-foreground">{t('This action will permanently remove the training file.', 'سيتم حذف ملف التدريب نهائياً.')}</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowFileDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={() => { setShowFileDeleteConfirm(false); removeFile(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}

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