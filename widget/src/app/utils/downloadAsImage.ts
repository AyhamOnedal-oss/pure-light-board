/**
 * downloadAsImage — Renders chat/ticket content to a Canvas and exports as PNG.
 *
 * This produces a VIEW-ONLY file: the user cannot edit, delete, or modify
 * the downloaded content since it's a flat raster image.
 */

import type { Message } from '../components/ChatWidget';

interface DownloadOptions {
  storeName: string;
  conversationId: string;
  ticketId?: string;
  messages: Message[];
  type: 'chat' | 'ticket';
  isDarkMode?: boolean;
}

const CANVAS_WIDTH = 800;
const PADDING = 40;
const LINE_HEIGHT = 24;
const SECTION_GAP = 16;

/** Measures text and wraps into multiple lines if needed */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];

  // Split into segments by space while preserving order
  const words = text.split(' ');

  let currentLine = '';

  for (const word of words) {
    // If a single word itself exceeds maxWidth, break it character by character
    if (ctx.measureText(word).width > maxWidth) {
      // Flush current line first
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      // Break the long word into fitting chunks
      let remaining = word;
      while (remaining.length > 0) {
        let end = remaining.length;
        while (end > 1 && ctx.measureText(remaining.slice(0, end)).width > maxWidth) {
          end--;
        }
        const chunk = remaining.slice(0, end);
        remaining = remaining.slice(end);
        if (remaining.length > 0) {
          lines.push(chunk);
        } else {
          // Last chunk becomes the start of a new currentLine
          currentLine = chunk;
        }
      }
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/** Pre-calculate total canvas height */
function calculateHeight(
  ctx: CanvasRenderingContext2D,
  options: DownloadOptions,
  maxTextWidth: number
): number {
  let h = PADDING; // top padding

  // Title + separator
  h += 36 + SECTION_GAP;
  h += 2 + SECTION_GAP;

  // Meta lines (conversationId, ticketId, storeName, date, count)
  let metaLines = 4;
  if (options.ticketId) metaLines++;
  if (options.type === 'ticket') metaLines++; // status line
  h += metaLines * LINE_HEIGHT + SECTION_GAP;

  // Separator
  h += 2 + SECTION_GAP;

  // Messages
  ctx.font = '14px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
  for (const m of options.messages) {
    const sender = m.sender === 'store' ? options.storeName : 'العميل';
    const time = m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const prefix = `[${time}] ${sender}: `;
    const fullText = `${prefix}${m.text || '[مرفق]'}`;
    const wrapped = wrapText(ctx, fullText, maxTextWidth - 16);
    h += wrapped.length * LINE_HEIGHT + 8;
  }

  // Footer
  h += SECTION_GAP + 2 + SECTION_GAP + LINE_HEIGHT;
  h += PADDING; // bottom padding

  return h;
}

export function downloadAsImage(options: DownloadOptions): void {
  const { storeName, conversationId, ticketId, messages, type, isDarkMode } = options;

  // Colors
  const bg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const textColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const secondaryColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const accentColor = isDarkMode ? '#3b82f6' : '#0ea5e9';
  const separatorColor = isDarkMode ? '#334155' : '#e5e7eb';
  const storeMsgBg = isDarkMode ? '#334155' : '#f3f4f6';
  const customerMsgBg = isDarkMode ? '#1e40af' : '#dbeafe';

  const dateStr = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Create offscreen canvas for measurement
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = CANVAS_WIDTH;
  measureCanvas.height = 100;
  const measureCtx = measureCanvas.getContext('2d')!;

  const maxTextWidth = CANVAS_WIDTH - PADDING * 2;
  const totalHeight = calculateHeight(measureCtx, options, maxTextWidth);

  // Create final canvas
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_WIDTH * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, totalHeight);

  let y = PADDING;

  // ── Title ──
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 22px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  const title = type === 'ticket' ? `سجل التذكرة — ${storeName}` : `سجل المحادثة — ${storeName}`;
  ctx.fillText(title, CANVAS_WIDTH / 2, y + 22);
  y += 36 + SECTION_GAP;

  // Separator
  ctx.fillStyle = separatorColor;
  ctx.fillRect(PADDING, y, CANVAS_WIDTH - PADDING * 2, 2);
  y += 2 + SECTION_GAP;

  // ── Meta info ──
  ctx.textAlign = 'right';
  ctx.font = '14px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
  const metaX = CANVAS_WIDTH - PADDING;

  const metaEntries: [string, string][] = [
    ['معرّف المحادثة', conversationId],
  ];
  if (ticketId) metaEntries.push(['رقم التذكرة', ticketId]);
  metaEntries.push(['المتجر', storeName]);
  metaEntries.push(['التاريخ', dateStr]);
  metaEntries.push(['عدد الرسائل', `${messages.length}`]);
  if (type === 'ticket') metaEntries.push(['الحالة', 'مفتوحة']);

  for (const [label, value] of metaEntries) {
    ctx.fillStyle = secondaryColor;
    ctx.fillText(`${label}: `, metaX, y + 16);
    const labelWidth = ctx.measureText(`${label}: `).width;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
    ctx.fillText(value, metaX - labelWidth, y + 16);
    ctx.font = '14px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
    y += LINE_HEIGHT;
  }
  y += SECTION_GAP;

  // Separator
  ctx.fillStyle = separatorColor;
  ctx.fillRect(PADDING, y, CANVAS_WIDTH - PADDING * 2, 2);
  y += 2 + SECTION_GAP;

  // ── Messages ──
  ctx.textAlign = 'right';
  for (const m of messages) {
    const isCustomer = m.sender === 'customer';
    const sender = isCustomer ? 'العميل' : storeName;
    const time = m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const attachNote = m.attachment ? ` [مرفق: ${m.attachment.name}]` : '';
    const fullText = `[${time}] ${sender}: ${m.text || '[مرفق]'}${attachNote}`;

    const wrapped = wrapText(ctx, fullText, maxTextWidth - 16);

    // Message background pill
    const pillHeight = wrapped.length * LINE_HEIGHT + 8;
    const pillY = y - 2;
    ctx.fillStyle = isCustomer ? customerMsgBg : storeMsgBg;
    roundRect(ctx, PADDING, pillY, CANVAS_WIDTH - PADDING * 2, pillHeight, 8);
    ctx.fill();

    // Message text
    ctx.fillStyle = textColor;
    ctx.font = '14px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
    for (const line of wrapped) {
      ctx.fillText(line, metaX - 8, y + 14);
      y += LINE_HEIGHT;
    }
    y += 8;
  }

  // ── Footer ──
  y += SECTION_GAP;
  ctx.fillStyle = separatorColor;
  ctx.fillRect(PADDING, y, CANVAS_WIDTH - PADDING * 2, 2);
  y += 2 + SECTION_GAP;

  ctx.fillStyle = secondaryColor;
  ctx.font = '13px "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('مدعوم من فقاعة AI — www.fuqah.ai', CANVAS_WIDTH / 2, y + 14);

  // ── Export as PNG ──
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefix = type === 'ticket' ? `تذكرة-${ticketId}` : `محادثة-${conversationId}`;
    a.download = `${prefix}-${storeName}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/** Helper: draw a rounded rectangle path */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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