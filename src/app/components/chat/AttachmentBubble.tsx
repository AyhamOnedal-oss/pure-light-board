import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Paperclip, Download, Eye, X, FileText } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useApp } from '../../context/AppContext';

export interface AttachmentMeta {
  type: 'image' | 'file';
  fileName?: string;
  url?: string;
  size?: number;
  contentType?: string;
}

function previewUrlFor(att: AttachmentMeta): string {
  if (att.url) return att.url;
  const name = att.fileName || 'file';
  if (att.type === 'image') {
    const seed = encodeURIComponent(name);
    return `https://picsum.photos/seed/${seed}/800/600`;
  }
  const body = `This is a demo attachment preview for "${name}".\nIn production, this would be the real file downloaded from Supabase Storage.\n`;
  return `data:${att.contentType || 'text/plain'};charset=utf-8,${encodeURIComponent(body)}`;
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function triggerDownload(url: string, fileName: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  const node = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Top-right action buttons */}
      <div dir="ltr" className="fixed top-4 right-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => triggerDownload(url, name)}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-md border border-white/20 shadow-lg"
          title="Download"
        >
          <Download className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-md border border-white/20 shadow-lg"
          title="Close"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Centered image */}
      <div className="relative flex items-center justify-center max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        {!loaded && !failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
        {failed ? (
          <div className="flex flex-col items-center justify-center text-white/70 gap-2">
            <X className="w-10 h-10 opacity-40" />
            <p className="text-[13px]">Failed to load image</p>
          </div>
        ) : (
          <img
            src={url}
            alt={name}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`max-w-[92vw] max-h-[90vh] rounded-xl object-contain shadow-2xl transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>

      {/* Bottom filename caption */}
      <p
        className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-[80vw] truncate text-center text-white/90 text-[12px] bg-black/50 backdrop-blur-sm rounded-full py-1.5 px-4 border border-white/10"
        style={{ fontWeight: 500 }}
        title={name}
      >
        {name}
      </p>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

export function AttachmentBubble({ attachment, onAi = false }: { attachment: AttachmentMeta; onAi?: boolean }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const url = previewUrlFor(attachment);
  const name = attachment.fileName || (attachment.type === 'image' ? 'image.jpg' : 'file');
  const sizeLabel = formatSize(attachment.size);

  const textColor = onAi ? 'text-white' : 'text-foreground';
  const subColor = onAi ? 'text-white/70' : 'text-muted-foreground';
  const btnBg = onAi ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-muted hover:bg-muted/70 text-foreground';

  if (attachment.type === 'image') {
    return (
      <>
        <div className="p-1.5 flex flex-col gap-1.5 w-[240px] max-w-full">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative block rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-white/40 bg-muted"
            style={{ aspectRatio: '4 / 3' }}
            title={t('Open image', 'فتح الصورة')}
          >
            <ImageWithFallback
              src={url}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover block"
            />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <span className="w-10 h-10 rounded-full bg-white/95 text-gray-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                <Eye className="w-[18px] h-[18px]" />
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2 px-1.5 pb-1">
            <ImageIcon className={`w-3.5 h-3.5 ${subColor} opacity-70`} />
            <span className={`text-[11px] truncate flex-1 ${textColor}`} style={{ fontWeight: 500 }} title={name}>{name}</span>
            {sizeLabel && <span className={`text-[10px] ${subColor}`}>{sizeLabel}</span>}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerDownload(url, name); }}
              className={`w-7 h-7 rounded-lg ${btnBg} flex items-center justify-center shrink-0 transition-colors`}
              title={t('Download', 'تحميل')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {open && <Lightbox url={url} name={name} onClose={() => setOpen(false)} />}
      </>
    );
  }

  // File
  return (
    <div className="px-3 py-2.5 flex items-center gap-2.5 min-w-[220px]">
      <div className={`w-9 h-9 rounded-lg ${onAi ? 'bg-white/15' : 'bg-muted'} flex items-center justify-center shrink-0`}>
        <FileText className={`w-[18px] h-[18px] ${onAi ? 'text-white' : 'text-foreground/70'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] truncate ${textColor}`} style={{ fontWeight: 600 }} title={name}>{name}</p>
        <p className={`text-[11px] ${subColor}`}>{sizeLabel || t('File', 'ملف')}</p>
      </div>
      <button
        type="button"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        className={`w-8 h-8 rounded-lg ${btnBg} flex items-center justify-center shrink-0 transition-colors`}
        title={t('View', 'استعراض')}
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => triggerDownload(url, name)}
        className={`w-8 h-8 rounded-lg ${btnBg} flex items-center justify-center shrink-0 transition-colors`}
        title={t('Download', 'تحميل')}
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}
