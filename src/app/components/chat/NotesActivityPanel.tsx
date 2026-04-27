import React, { useEffect, useRef, useState } from 'react';
import { X, Send, StickyNote, FolderOpen, CheckCircle, Shield, User, MoreHorizontal, Pencil, Trash2, Check, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttachmentBubble, AttachmentMeta } from './AttachmentBubble';

export type ActivityType = 'note' | 'status';
export type AuthorRole = 'admin' | 'team';

export interface Activity {
  id: string;
  type: ActivityType;
  text?: string;
  status?: 'open' | 'closed' | 'created';
  author: string;
  authorRole: AuthorRole;
  timestamp: string; // ISO
  editedAt?: string;
  attachment?: AttachmentMeta;
}

function formatStamp(iso: string, lang: 'en' | 'ar') {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
    const timePart = d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  } catch {
    return iso;
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function roleBadge(role: AuthorRole, t: (en: string, ar: string) => string) {
  if (role === 'admin') {
    return { label: t('Admin', 'مسؤول'), color: '#043CC8', Icon: Shield };
  }
  return { label: t('Team', 'فريق'), color: '#10b981', Icon: User };
}

export function NotesActivityPanel({
  open,
  onClose,
  ticketId,
  activities,
  onAddNote,
  onEditNote,
  onDeleteNote,
  currentUser,
  currentUserRole,
}: {
  open: boolean;
  onClose: () => void;
  ticketId: string;
  activities: Activity[];
  onAddNote: (text: string, attachment?: AttachmentMeta) => void;
  onEditNote: (id: string, text: string) => void;
  onDeleteNote: (id: string) => void;
  currentUser: string;
  currentUserRole: AuthorRole;
}) {
  const { t, language, dir } = useApp();
  const draftKey = `fuqah.notes.draft.v1:${ticketId}`;
  const [draft, setDraft] = useState<string>(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });

  useEffect(() => {
    try {
      const v = localStorage.getItem(draftKey) || '';
      setDraft(v);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    try {
      if (draft) localStorage.setItem(draftKey, draft);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [draft, draftKey]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<AttachmentMeta | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, activities.length]);

  useEffect(() => {
    if (!open) {
      setMenuFor(null);
      setEditingId(null);
      setEditDraft('');
    }
  }, [open]);

  const submit = () => {
    const text = draft.trim();
    if (!text && !pending) return;
    onAddNote(text, pending || undefined);
    setDraft('');
    setPending(null);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (pending?.url) { try { URL.revokeObjectURL(pending.url); } catch {} }
    const isImage = file.type.startsWith('image/');
    const url = URL.createObjectURL(file);
    setPending({
      type: isImage ? 'image' : 'file',
      fileName: file.name,
      url,
      size: file.size,
      contentType: file.type,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearPending = () => {
    if (pending?.url) { try { URL.revokeObjectURL(pending.url); } catch {} }
    setPending(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const text = editDraft.trim();
    if (!text) return;
    onEditNote(editingId, text);
    setEditingId(null);
    setEditDraft('');
  };

  const sorted = [...activities].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 bottom-0 z-50 w-full max-w-[420px] bg-card border-s border-border shadow-2xl flex flex-col transition-transform duration-300 ${
          dir === 'rtl' ? 'left-0' : 'right-0'
        } ${open ? 'translate-x-0' : dir === 'rtl' ? '-translate-x-full' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#043CC8]/10 text-[#043CC8] flex items-center justify-center shrink-0">
              <StickyNote className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] truncate" style={{ fontWeight: 700 }}>{t('Notes', 'ملاحظات')}</p>
              <p className="text-[11px] text-muted-foreground truncate">{ticketId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={t('Close', 'إغلاق')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {sorted.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <StickyNote className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t('No notes yet', 'لا توجد ملاحظات بعد')}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">{t('Add the first note below', 'أضف أول ملاحظة أدناه')}</p>
            </div>
          )}
          {sorted.map(a => {
            if (a.type === 'status') {
              const isOpen = a.status === 'open';
              const isCreated = a.status === 'created';
              const Icon = isCreated ? StickyNote : isOpen ? FolderOpen : CheckCircle;
              const color = isCreated ? '#043CC8' : isOpen ? '#ff4466' : '#10b981';
              const label = isCreated
                ? t('— New ticket opened', '— تم فتح تذكرة جديدة')
                : isOpen
                  ? t('reopened the ticket', 'أعاد فتح التذكرة')
                  : t('closed the ticket', 'أغلق التذكرة');
              return (
                <div key={a.id} className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: color + '18', color }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[12px] text-foreground">
                      <span style={{ fontWeight: 600 }}>{a.author}</span>
                      <span className="text-muted-foreground"> {label}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatStamp(a.timestamp, language)}</p>
                  </div>
                </div>
              );
            }
            const badge = roleBadge(a.authorRole, t);
            const BIcon = badge.Icon;
            const isOwn = a.author === currentUser;
            const isEditing = editingId === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: badge.color + '18', color: badge.color }}
                    >
                      <BIcon className="w-3 h-3" />
                    </div>
                    <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{a.author}</p>
                    <span
                      className="text-[9px] px-1.5 py-[1px] rounded-full shrink-0"
                      style={{ backgroundColor: badge.color + '18', color: badge.color, fontWeight: 600 }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground/70">{formatStamp(a.timestamp, language)}</span>
                    {isOwn && !isEditing && (
                      <div className="relative">
                        <button
                          onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
                          className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          title={t('Options', 'خيارات')}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {menuFor === a.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setMenuFor(null)} />
                            <div className="absolute z-40 end-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl py-1 w-36">
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-[13px] transition-colors"
                                onClick={() => {
                                  setEditingId(a.id);
                                  setEditDraft(a.text || '');
                                  setMenuFor(null);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                {t('Edit', 'تعديل')}
                              </button>
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-400 text-[13px] transition-colors"
                                onClick={() => {
                                  onDeleteNote(a.id);
                                  setMenuFor(null);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('Delete', 'حذف')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-1">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditDraft('');
                        }
                      }}
                      rows={2}
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all resize-none text-foreground"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={saveEdit}
                        disabled={!editDraft.trim()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#043CC8] hover:bg-[#043CC8]/90 disabled:opacity-40 text-white text-[11px] transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        <Check className="w-3 h-3" /> {t('Save', 'حفظ')}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditDraft(''); }}
                        className="px-2.5 py-1 rounded-lg hover:bg-muted text-muted-foreground text-[11px] transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        {t('Cancel', 'إلغاء')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {a.attachment && (
                      <div className={`${a.text ? 'mb-1.5' : ''} -mx-1`}>
                        <AttachmentBubble attachment={a.attachment} />
                      </div>
                    )}
                    {a.text && (
                      <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                        {a.text}
                        {a.editedAt && (
                          <span className="text-[10px] text-muted-foreground/60 ms-1.5">({t('edited', 'معدّلة')})</span>
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 bg-muted/20">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Pending attachment preview */}
          {pending && (
            <div className="mb-2 flex items-center gap-2.5 p-2 rounded-xl bg-card border border-border">
              {pending.type === 'image' && pending.url ? (
                <img
                  src={pending.url}
                  alt={pending.fileName}
                  className="w-11 h-11 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {pending.type === 'image'
                    ? <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    : <FileText className="w-5 h-5 text-muted-foreground" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] truncate text-foreground" style={{ fontWeight: 600 }} title={pending.fileName}>
                  {pending.fileName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {formatBytes(pending.size)}
                  {pending.contentType ? ` · ${pending.contentType}` : ''}
                </p>
              </div>
              <button
                onClick={clearPending}
                className="w-7 h-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 flex items-center justify-center transition-colors shrink-0"
                title={t('Remove', 'حذف')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div dir="ltr" className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/70 text-foreground flex items-center justify-center transition-colors shrink-0"
              title={t('Attach file or image', 'إرفاق ملف أو صورة')}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              dir={dir}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder={t('Write your note...', 'اكتب ملاحظتك...')}
              className="flex-1 px-3 py-2 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all resize-none text-foreground"
            />
            <button
              onClick={submit}
              disabled={!draft.trim() && !pending}
              className="w-10 h-10 rounded-xl bg-[#043CC8] hover:bg-[#043CC8]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
              title={t('Send', 'إرسال')}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-1.5">
            {t('Posting as', 'النشر باسم')}{' '}
            <span style={{ fontWeight: 600 }}>{currentUser}</span>{' '}
            <span className="text-muted-foreground/60">
              ({currentUserRole === 'admin' ? t('Admin', 'مسؤول') : t('Team', 'فريق')})
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
