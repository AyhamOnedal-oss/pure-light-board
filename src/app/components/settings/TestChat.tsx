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

// Legacy unscoped keys (pre-fix). We delete them on mount so old data does
// not leak between accounts that share a browser.
const LEGACY_MSGS_KEY = 'fuqah_test_chat_messages';
const LEGACY_CONV_KEY = 'fuqah_test_chat_conversation_id';

// Per-(user, tenant) scoped keys. Test Chat history must NEVER be shared
// across accounts on the same browser, and not even across team members of
// the same tenant.
function msgsKeyFor(userId: string, tenantId: string): string {
  return `fuqah_test_chat_messages:v2:${userId}:${tenantId}`;
}
function convKeyFor(userId: string, tenantId: string): string {
  return `fuqah_test_chat_conversation_id:v2:${userId}:${tenantId}`;
}

// Render text with clickable URLs. Matches http(s)://… and bare www.…
// Trims trailing punctuation so a link at the end of a sentence doesn't
// swallow the period/comma. Anchors are isolated as LTR so URLs render
// correctly inside Arabic/RTL paragraphs.
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>]+)/gi;
function LinkifiedText({ text, variant }: { text: string; variant: 'user' | 'ai' }) {
  const linkClass = variant === 'ai'
    ? 'text-sky-400 underline underline-offset-2 hover:text-sky-300 break-all'
    : 'text-[#043CC8] underline underline-offset-2 hover:text-[#0330a0] break-all';
  const parts = text.split(URL_REGEX);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (!part) return null;
        if (i % 2 === 1) {
          // Strip trailing punctuation that should not be part of the URL.
          const m = part.match(/^(.*?)([.,;:!?)\]]+)$/);
          const url = m ? m[1] : part;
          const tail = m ? m[2] : '';
          const href = url.startsWith('http') ? url : `https://${url}`;
          return (
            <React.Fragment key={i}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                dir="ltr"
                style={{ unicodeBidi: 'isolate' }}
                className={linkClass}
              >
                {url}
              </a>
              {tail}
            </React.Fragment>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

export function TestChat() {
  const { t, language, tenantId, session } = useApp();
  const userId = session?.user?.id ?? null;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // One-time cleanup: remove the old unscoped keys so stale data from a
  // previous account on this browser cannot leak.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_MSGS_KEY);
      localStorage.removeItem(LEGACY_CONV_KEY);
    } catch { /* ignore */ }
  }, []);

  // Reload scoped state whenever the active (user, tenant) changes. This
  // makes Zid→logout→Salla on the same browser show a fresh chat, and
  // ensures a team member never sees the owner's test history.
  useEffect(() => {
    if (!userId || !tenantId) {
      setMessages([]);
      setConversationId(crypto.randomUUID());
      return;
    }
    try {
      const storedMsgs = localStorage.getItem(msgsKeyFor(userId, tenantId));
      setMessages(storedMsgs ? (JSON.parse(storedMsgs) as Msg[]) : []);
    } catch {
      setMessages([]);
    }
    try {
      const cKey = convKeyFor(userId, tenantId);
      let cid = localStorage.getItem(cKey);
      if (!cid) {
        cid = crypto.randomUUID();
        localStorage.setItem(cKey, cid);
      }
      setConversationId(cid);
    } catch {
      setConversationId(crypto.randomUUID());
    }
  }, [userId, tenantId]);

  // Persist messages to the current scoped key. Skip writes until we know
  // the (user, tenant) so we never fall back to a global key.
  useEffect(() => {
    if (!userId || !tenantId) return;
    try {
      localStorage.setItem(msgsKeyFor(userId, tenantId), JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [messages, userId, tenantId]);

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
    // Test chat bypasses Supabase Storage and embeds the image as a base64 data URL.
    // This avoids the missing `chat-attachments` bucket dependency and works directly
    // with the chat-ai edge function and OpenAI vision (which accepts data: URLs).
    const uploaded: MsgAttachment[] = [];
    for (const file of files) {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      uploaded.push({
        url: dataUrl,
        name: file.name,
        content_type: file.type,
        size: file.size,
        storage_path: '',
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
    const newId = crypto.randomUUID();
    if (userId && tenantId) {
      try {
        localStorage.removeItem(msgsKeyFor(userId, tenantId));
        localStorage.setItem(convKeyFor(userId, tenantId), newId);
      } catch { /* ignore */ }
    }
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
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {msg.attachments.map((a, i) => (
                            <img
                              key={i}
                              src={a.url}
                              alt={a.name}
                              className="max-w-[180px] max-h-[180px] rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <LinkifiedText text={msg.text} variant={msg.sender} />
                      <p className={`text-[9px] mt-1 ${msg.sender === 'user' ? 'text-muted-foreground' : msg.error ? 'text-red-500/60' : 'text-white/50'}`}>{msg.time}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input — Attachment LEFT, Send RIGHT */}
          <div className="p-3 border-t border-border shrink-0">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-14 h-14 rounded-lg object-cover border border-border" />
                    <button
                      onClick={() => removePendingFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center"
                      aria-label="remove"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileChange} />
              <button onClick={handleFileClick} disabled={pendingFiles.length >= MAX_ATTACHMENTS} className="p-2 hover:bg-muted rounded-xl transition-colors shrink-0 mb-0.5 disabled:opacity-40">
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