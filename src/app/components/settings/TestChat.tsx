import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowUp, Paperclip, Trash2 } from 'lucide-react';
import iconImg from '../../../imports/FUQAH-AI-icon-01@2x.png';
import logoImg from '../../../imports/FUQAH-AI-Logo-01@2x.png';

interface Msg { id: string; sender: 'user' | 'ai'; text: string; time: string; }

const STORAGE_KEY = 'fuqah_test_chat_messages';

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
  const { t, language } = useApp();
  const [messages, setMessages] = useState<Msg[]>(loadMessages);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aiResponses = [
    { en: "Thank you for your message! I'm here to help. Could you provide more details?", ar: "شكراً لرسالتك! أنا هنا للمساعدة. هل يمكنك تقديم المزيد من التفاصيل؟" },
    { en: "I understand your concern. Let me look into that for you right away.", ar: "أتفهم قلقك. دعني أبحث في ذلك لك فوراً." },
    { en: "Great question! Based on our policies, I can help you with that.", ar: "سؤال رائع! بناءً على سياساتنا، يمكنني مساعدتك في ذلك." },
    { en: "I've noted your request. Is there anything else I can assist you with?", ar: "لقد سجلت طلبك. هل هناك شيء آخر يمكنني مساعدتك به؟" },
    { en: "Your order is being processed. You should receive a confirmation email shortly.", ar: "طلبك قيد المعالجة. ستتلقى بريداً إلكترونياً للتأكيد قريباً." },
  ];

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

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Msg = { id: Date.now().toString(), sender: 'user', text: input.trim(), time: now };
    const resp = aiResponses[Math.floor(Math.random() * aiResponses.length)];
    const aiMsg: Msg = { id: (Date.now() + 1).toString(), sender: 'ai', text: language === 'ar' ? resp.ar : resp.en, time: now };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
  }, [input, language]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userMsg: Msg = { id: Date.now().toString(), sender: 'user', text: `📎 ${file.name}`, time: now };
      const aiMsg: Msg = { id: (Date.now() + 1).toString(), sender: 'ai', text: language === 'ar' ? 'تم استلام الملف. جاري المعالجة...' : 'File received. Processing...', time: now };
      setMessages(prev => [...prev, userMsg, aiMsg]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
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
      <div className="px-4 py-2.5 rounded-xl bg-orange-500/8 border border-orange-500/15">
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
                    : 'bg-black text-white rounded-bl-sm'
                }`}>
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                  <p className={`text-[9px] mt-1 ${msg.sender === 'user' ? 'text-muted-foreground' : 'text-white/50'}`}>{msg.time}</p>
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