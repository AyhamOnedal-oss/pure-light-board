import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download as DownloadIcon, Paperclip } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface LogMessage {
  id: string;
  sender: 'customer' | 'ai';
  text: string;
  time: string;
  type?: 'text' | 'image' | 'file';
  fileName?: string;
}

export interface ChatLogData {
  kind: 'chat' | 'ticket';
  conversationId?: string;
  ticketId?: string;
  storeName: string;
  dateISO: string;
  status?: 'open' | 'closed';
  messages: LogMessage[];
}

function loadStoreName(fallback: string) {
  try {
    const raw = localStorage.getItem('fuqah_store_info');
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.storeName) return data.storeName as string;
    }
  } catch {}
  return fallback;
}

export function getStoreName() {
  return loadStoreName('My E-Commerce Store');
}

const LIGHT = {
  bg: '#FFFFFF', primary: '#1f2937', secondary: '#6b7280',
  accent: '#0ea5e9', divider: '#e5e7eb', aiMsg: '#f3f4f6', custMsg: '#dbeafe',
};
const DARK = {
  bg: '#1e293b', primary: '#f1f5f9', secondary: '#94a3b8',
  accent: '#3b82f6', divider: '#334155', aiMsg: '#334155', custMsg: '#1e40af',
};

const WIDTH = 800;
const PAD = 40;
const LINE_H = 24;
const GAP = 16;
const MSG_GAP = 8;
const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';

function formatArTime(time: string) {
  // Convert "10:30 AM" or "HH:MM" to 24h
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const mm = m[2];
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mm}`;
}

function formatMsgLine(msg: LogMessage, senderLabel: string) {
  const time = formatArTime(msg.time);
  const attach = msg.fileName ? ` [Attachment: ${msg.fileName}]` : '';
  const text = msg.text || '';
  return `[${time}] ${senderLabel}: ${text}${attach}`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/(\s+)/);
    let current = '';
    for (const w of words) {
      const test = current + w;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        if (ctx.measureText(w).width > maxWidth) {
          // break long word char by char
          let piece = '';
          for (const ch of w) {
            if (ctx.measureText(piece + ch).width <= maxWidth) piece += ch;
            else { lines.push(piece); piece = ch; }
          }
          current = piece;
        } else {
          current = w.replace(/^\s+/, '');
        }
      }
    }
    if (current) lines.push(current);
    if (!para) lines.push('');
  }
  return lines;
}

export async function generateChatPNG(data: ChatLogData, themeMode: 'light' | 'dark', t: (en: string, ar: string) => string) {
  const C = themeMode === 'dark' ? DARK : LIGHT;
  const bubbleInnerW = WIDTH - PAD * 2 - 24; // 12px padding each side inside bubble
  const senderLabel = (s: 'customer' | 'ai') => s === 'customer'
    ? t('Customer', 'العميل')
    : t('AI Assistant', 'المساعد الذكي');

  // Measure first with an offscreen canvas
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `14px ${FONT}`;

  // Layout computation
  let y = PAD;
  y += 30; // title line
  y += GAP;
  y += 2 + GAP; // divider

  const meta: Array<[string, string]> = [];
  if (data.conversationId) meta.push([t('Conversation ID', 'معرف المحادثة'), data.conversationId]);
  if (data.ticketId) meta.push([t('Ticket ID', 'معرف التذكرة'), data.ticketId]);
  meta.push([t('Store Name', 'اسم المتجر'), data.storeName]);
  const dateStr = new Date(data.dateISO).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  meta.push([t('Date', 'التاريخ'), dateStr]);
  meta.push([t('Message Count', 'عدد الرسائل'), String(data.messages.length)]);
  if (data.kind === 'ticket' && data.status) {
    meta.push([t('Status', 'الحالة'), data.status === 'open' ? t('Open', 'مفتوحة') : t('Closed', 'مغلقة')]);
  }

  y += meta.length * LINE_H;
  y += GAP;
  y += 2 + GAP; // divider

  // messages
  const msgLines: { lines: string[]; sender: 'customer' | 'ai' }[] = [];
  for (const m of data.messages) {
    const line = formatMsgLine(m, senderLabel(m.sender));
    const wrapped = wrapText(measure, line, bubbleInnerW);
    msgLines.push({ lines: wrapped, sender: m.sender });
    y += wrapped.length * LINE_H + 16; // bubble vertical padding 8 top + 8 bottom
    y += MSG_GAP;
  }
  y += GAP;
  y += 2 + GAP; // divider
  y += 20; // footer
  y += PAD;

  const HEIGHT = Math.ceil(y);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  (ctx as any).direction = 'rtl';
  ctx.textBaseline = 'top';

  // bg
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let cy = PAD;
  // Title (center)
  ctx.fillStyle = C.primary;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'center';
  const title = data.kind === 'chat'
    ? `${t('Conversation Log', 'سجل المحادثة')} — ${data.storeName}`
    : `${t('Ticket Log', 'سجل التذكرة')} — ${data.storeName}`;
  ctx.fillText(title, WIDTH / 2, cy);
  cy += 30 + GAP;

  // divider
  ctx.fillStyle = C.divider;
  ctx.fillRect(PAD, cy, WIDTH - PAD * 2, 2);
  cy += 2 + GAP;

  // meta (right aligned)
  ctx.textAlign = 'right';
  ctx.font = `14px ${FONT}`;
  for (const [label, value] of meta) {
    const rightX = WIDTH - PAD;
    ctx.fillStyle = C.primary;
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(value, rightX, cy);
    const valueW = ctx.measureText(value).width;
    ctx.fillStyle = C.secondary;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(`${label}: `, rightX - valueW - 4, cy);
    cy += LINE_H;
  }
  cy += GAP;
  ctx.fillStyle = C.divider;
  ctx.fillRect(PAD, cy, WIDTH - PAD * 2, 2);
  cy += 2 + GAP;

  // messages
  ctx.textAlign = 'right';
  ctx.font = `14px ${FONT}`;
  for (const m of msgLines) {
    const bubbleH = m.lines.length * LINE_H + 16;
    const bubbleW = WIDTH - PAD * 2;
    ctx.fillStyle = m.sender === 'customer' ? C.custMsg : C.aiMsg;
    roundRect(ctx, PAD, cy, bubbleW, bubbleH, 8);
    ctx.fill();
    ctx.fillStyle = m.sender === 'customer'
      ? (themeMode === 'dark' ? '#ffffff' : C.primary)
      : C.primary;
    let ly = cy + 8;
    for (const line of m.lines) {
      ctx.fillText(line, WIDTH - PAD - 12, ly);
      ly += LINE_H;
    }
    cy += bubbleH + MSG_GAP;
  }
  cy += GAP - MSG_GAP;
  ctx.fillStyle = C.divider;
  ctx.fillRect(PAD, cy, WIDTH - PAD * 2, 2);
  cy += 2 + GAP;

  // footer center
  ctx.textAlign = 'center';
  ctx.fillStyle = C.secondary;
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Powered by Fuqah AI — www.fuqah.ai', WIDTH / 2, cy);

  return canvas.toDataURL('image/png');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ChatLogData;
}

export function ChatLogDownloadModal({ open, onClose, data }: Props) {
  const { t, theme } = useApp();
  const mode: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
  const C = mode === 'dark' ? DARK : LIGHT;
  const [busy, setBusy] = useState(false);

  const senderLabel = (s: 'customer' | 'ai') => s === 'customer'
    ? t('Customer', 'العميل')
    : t('AI Assistant', 'المساعد الذكي');

  const fileName = useMemo(() => {
    const safe = data.storeName.replace(/\s+/g, '-');
    const id = data.kind === 'chat' ? data.conversationId : data.ticketId;
    return data.kind === 'chat' ? `chat-${id}-${safe}.png` : `ticket-${id}-${safe}.png`;
  }, [data]);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const url = await generateChatPNG(data, mode, t);
      downloadDataUrl(url, fileName);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dateStr = new Date(data.dateISO).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = data.kind === 'chat'
    ? `${t('Conversation Log', 'سجل المحادثة')} — ${data.storeName}`
    : `${t('Ticket Log', 'سجل التذكرة')} — ${data.storeName}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-[860px] max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-[15px] text-foreground" style={{ fontWeight: 600 }}>
            {data.kind === 'chat' ? t('Download Chat', 'تحميل المحادثة') : t('Download Ticket', 'تحميل التذكرة')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#043CC8] text-white rounded-xl hover:bg-[#0330a0] text-[13px] disabled:opacity-60"
              style={{ fontWeight: 500 }}
            >
              <DownloadIcon className="w-4 h-4" />
              {busy ? t('Generating...', 'جاري الإنشاء...') : t('Re-download as PNG', 'إعادة التحميل كـ PNG')}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4" style={{ background: mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
          <div
            dir="rtl"
            style={{
              width: WIDTH,
              margin: '0 auto',
              background: C.bg,
              color: C.primary,
              padding: PAD,
              fontFamily: FONT,
              fontSize: 14,
              lineHeight: `${LINE_H}px`,
              borderRadius: 8,
            }}
          >
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: C.primary }}>{title}</div>
            <div style={{ height: GAP }} />
            <div style={{ height: 2, background: C.divider }} />
            <div style={{ height: GAP }} />

            <div style={{ textAlign: 'right' }}>
              {data.conversationId && <MetaRow label={t('Conversation ID', 'معرف المحادثة')} value={data.conversationId} C={C} />}
              {data.ticketId && <MetaRow label={t('Ticket ID', 'معرف التذكرة')} value={data.ticketId} C={C} />}
              <MetaRow label={t('Store Name', 'اسم المتجر')} value={data.storeName} C={C} />
              <MetaRow label={t('Date', 'التاريخ')} value={dateStr} C={C} />
              <MetaRow label={t('Message Count', 'عدد الرسائل')} value={String(data.messages.length)} C={C} />
              {data.kind === 'ticket' && data.status && (
                <MetaRow label={t('Status', 'الحالة')} value={data.status === 'open' ? t('Open', 'مفتوحة') : t('Closed', 'مغلقة')} C={C} />
              )}
            </div>

            <div style={{ height: GAP }} />
            <div style={{ height: 2, background: C.divider }} />
            <div style={{ height: GAP }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: MSG_GAP }}>
              {data.messages.map(m => (
                <div
                  key={m.id}
                  style={{
                    background: m.sender === 'customer' ? C.custMsg : C.aiMsg,
                    color: m.sender === 'customer' && mode === 'dark' ? '#ffffff' : C.primary,
                    padding: '8px 12px',
                    borderRadius: 8,
                    wordBreak: 'break-word',
                    textAlign: 'right',
                  }}
                >
                  [{formatArTime(m.time)}] {senderLabel(m.sender)}: {m.text}
                  {m.fileName && (
                    <span style={{ opacity: 0.85 }}>
                      {' '}<Paperclip className="inline w-3 h-3 -mt-0.5" /> [Attachment: {m.fileName}]
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ height: GAP }} />
            <div style={{ height: 2, background: C.divider }} />
            <div style={{ height: GAP }} />

            <div style={{ textAlign: 'center', fontSize: 13, color: C.secondary }}>
              Powered by Fuqah AI — www.fuqah.ai
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, C }: { label: string; value: string; C: typeof LIGHT }) {
  return (
    <div style={{ lineHeight: `${LINE_H}px` }}>
      <span style={{ color: C.secondary }}>{label}: </span>
      <span style={{ color: C.primary, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
