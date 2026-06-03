import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../../integrations/supabase/client';
import { ArrowUp, Paperclip, Trash2 } from 'lucide-react';
import iconImg from '../../../imports/FUQAH-AI-icon-01@2x.png';
import logoImg from '../../../imports/FUQAH-AI-Logo-01@2x.png';

interface MsgAttachment { url: string; name: string; content_type: string; size: number; storage_path: string; }
interface Msg { id: string; sender: 'user' | 'ai'; text: string; time: string; pending?: boolean; error?: boolean; attachments?: MsgAttachment[]; }

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;

const STORAGE_KEY = 'fuqah_test_chat_messages';
const CONV_KEY = 'fuqah_test_chat_conversation_id';

function loadConversationId(): string {
  try {
    let id = localStorage.getItem(CONV_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CONV_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function loadMessages(): Msg[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveMessages(msgs: Msg[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}

export function TestChat() {
  const { t, language, tenantId } = useApp();
  const [messages, setMessages] = useState<Msg[]>(loadMessages);
  const [conversationId, setConversationId] = useState<string>(loadConversationId);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  const uploadFiles = useCallback(async (files: File[]): Promise<MsgAttachment[]> => {
    if (!tenantId || files.length === 0) return [];
    const uploaded: MsgAttachment[] = [];
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${tenantId}/test-${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(path, 60 * 60);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error('sign_failed');
      uploaded.push({
        url: signed.signedUrl,
        name: file.name,
        content_type: file.type,
        size: file.size,
        storage_path: path,
      });
    }
    return uploaded;
  }, [tenantId, conversationId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (sending) return;
    if (!tenantId) return;
    if (!text && pendingFiles.length === 0) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userId = Date.now().toString();
    const pendingId = (Date.now() + 1).toString();
    const localPreviews: MsgAttachment[] = pendingFiles.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      content_type: f.type,
      size: f.size,
      storage_path: '',
    }));
    const userMsg: Msg = { id: userId, sender: 'user', text, time: now, attachments: localPreviews };
    const pendingMsg: Msg = { id: pendingId, sender: 'ai', text: '…', time: now, pending: true };

    // Build history from current messages (before adding the new one)
    const history = messages
      .filter(m => !m.pending && !m.error)
      .map(m => ({ sender: m.sender === 'user' ? 'customer' as const : 'ai' as const, text: m.text }));

    setMessages(prev => [...prev, userMsg, pendingMsg]);
    const filesToUpload = pendingFiles;
    setPendingFiles([]);
    setInput('');
    setSending(true);
    setUploading(filesToUpload.length > 0);

    try {
      let uploaded: MsgAttachment[] = [];
      if (filesToUpload.length > 0) {
        try {
          uploaded = await uploadFiles(filesToUpload);
        } catch (e) {
          console.error('upload failed', e);
          const errText = language === 'ar' ? 'فشل رفع الملف.' : 'File upload failed.';
          setMessages(prev => prev.map(m => m.id === pendingId
            ? { ...m, text: errText, time: now, pending: false, error: true }
            : m));
          return;
        } finally {
          setUploading(false);
        }
      }

      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: {
          tenant_id: tenantId,
          conversation_id: conversationId,
          visitor_id: `test-${tenantId}`,
          message: text,
          attachments: uploaded,
          history,
          is_test: true,
        },
      });

      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (error || !data) {
        const errText = language === 'ar'
          ? 'تعذّر الاتصال بالذكاء الاصطناعي. حاول مرة أخرى.'
          : 'Could not reach the AI. Please try again.';
        setMessages(prev => prev.map(m => m.id === pendingId
          ? { ...m, text: errText, time: replyTime, pending: false, error: true }
          : m));
      } else if ((data as any).error === 'rate_limited') {
        const errText = language === 'ar'
          ? 'تم تجاوز الحد المسموح، حاول بعد قليل.'
          : 'Rate limit reached, please try again shortly.';
        setMessages(prev => prev.map(m => m.id === pendingId
          ? { ...m, text: errText, time: replyTime, pending: false, error: true }
          : m));
      } else {
        const reply: string = (data as any).reply || (language === 'ar' ? '(لا يوجد رد)' : '(No reply)');
        setMessages(prev => prev.map(m => m.id === pendingId
          ? { ...m, text: reply, time: replyTime, pending: false }
          : m));
      }
    } catch (e) {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const errText = language === 'ar' ? 'خطأ في الشبكة.' : 'Network error.';
      setMessages(prev => prev.map(m => m.id === pendingId
        ? { ...m, text: errText, time: replyTime, pending: false, error: true }
        : m));
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [input, language, messages, sending, tenantId, conversationId, pendingFiles, uploadFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const valid: File[] = [];
    for (const f of files) {
      if (!ALLOWED_MIME.includes(f.type)) {
        alert(language === 'ar' ? 'نوع الملف غير مدعوم. الصور فقط (JPG, PNG, WEBP, GIF).' : 'Unsupported file type. Images only (JPG, PNG, WEBP, GIF).');
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        alert(language === 'ar' ? 'حجم الملف أكبر من 5 ميجابايت.' : 'File exceeds 5MB.');
        continue;
      }
      valid.push(f);
    }
    setPendingFiles(prev => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const clearChat = () => {
    setMessages([]);
    setPendingFiles([]);
    localStorage.removeItem(STORAGE_KEY);
    const newId = crypto.randomUUID();
    try { localStorage.setItem(CONV_KEY, newId); } catch {}
    setConversationId(newId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Test Chat', 'اختبار المحادثة')}</h1>
          <p className="text-muted-foreground text-[14px] mt-1">{t('Test how your AI responds to messages', 'اختبر كيف يستجيب الذكاء الاصطناعي للرسائل')}</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[13px] transition-colors shrink-0" style={{ fontWeight: 500 }}>
            <Trash2 className="w-4 h-4" /> {t('Clear Chat', 'مسح المحادثة')}
          </button>
        )}
      </div>

      {/* Orange usage warning */}
      <div className="px-4 py-2.5 rounded-xl bg-orange-500/8 border border-orange-500/15 inline-flex w-fit max-w-full">
        <p className="text-[12px] text-orange-500" style={{ fontWeight: 600 }}>
          ⚠️ {t(
            'Words used in this test are counted as input and output usage.',
            'الكلمات المستخدمة في هذا الاختبار تُحسب كاستخدام إدخال وإخراج.'
          )}
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div dir="ltr" className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-[500px] flex flex-col w-full max-w-[700px]">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2.5 shrink-0 justify-end" style={{ backgroundColor: '#000000' }}>
            <span className="text-white text-[14px]" style={{ fontWeight: 600 }}>Fuqah AI</span>
            <img src={iconImg} alt="" className="w-7 h-7 rounded-full object-cover bg-black p-[3px]" />
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-[13px]">{t('Write your test message', 'اكتب رسالتك التجريبية')}</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0 mr-1.5 mt-1 overflow-hidden p-[2px]">
                    <img src={iconImg} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[13px] ${
                  msg.sender === 'user'
                    ? 'bg-muted text-foreground rounded-br-sm'
                    : msg.error
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 rounded-bl-sm'
                      : 'bg-black text-white rounded-bl-sm'
                }`}>
                  {msg.pending ? (
                    <span className="inline-flex gap-1 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : (
                    <>
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                      <p className={`text-[9px] mt-1 ${msg.sender === 'user' ? 'text-muted-foreground' : msg.error ? 'text-red-500/60' : 'text-white/50'}`}>{msg.time}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input — Attachment LEFT, Send RIGHT */}
          <div className="p-3 border-t border-border shrink-0">
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <button onClick={handleFileClick} className="p-2 hover:bg-muted rounded-xl transition-colors shrink-0 mb-0.5">
                <Paperclip className="w-[18px] h-[18px] text-muted-foreground" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('...Write your test message', '...اكتب رسالتك التجريبية')}
                rows={1}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground resize-none overflow-hidden"
                style={{ minHeight: '40px', maxHeight: '100px', textAlign: 'right' }}
              />
              <button onClick={sendMessage} className="w-9 h-9 rounded-full bg-black hover:bg-black/80 flex items-center justify-center active:scale-90 transition-all shrink-0 mb-0.5">
                <ArrowUp className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}