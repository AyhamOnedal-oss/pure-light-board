import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  MoreHorizontal,
  Eye,
  CheckCircle2,
  UserPlus,
  Trash2,
  MessagesSquare,
  Ticket as TicketIcon,
  Lightbulb,
  Inbox,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../../integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';

import whatsappIcon from '../../../imports/whatsapp.png';
import instagramIcon from '../../../imports/ig_instagram_media_social_icon_124260.png';
import tiktokIcon from '../../../imports/tok_tik_brands_icon_256563.png';
import snapchatIcon from '../../../imports/Snapchat_icon-icons.com_66800.png';
import webIcon from '../../../imports/googlechrome_93595.png';

type ActivityType = 'conversation' | 'ticket' | 'insight';
type ActivityStatus = 'open' | 'pending' | 'resolved' | 'trending' | 'new';
type ChannelKey = 'whatsapp' | 'instagram' | 'tiktok' | 'snapchat' | 'web' | 'none';

interface ActivityRow {
  id: string;
  type: ActivityType;
  channel: ChannelKey;
  primaryEn: string;
  primaryAr: string;
  previewEn: string;
  previewAr: string;
  status: ActivityStatus;
  assignee?: string;
  updatedAt: number; // ms timestamp
}

const channelMeta: Record<ChannelKey, { icon: string | null; labelEn: string; labelAr: string }> = {
  whatsapp: { icon: whatsappIcon, labelEn: 'WhatsApp', labelAr: 'واتساب' },
  instagram: { icon: instagramIcon, labelEn: 'Instagram', labelAr: 'انستغرام' },
  tiktok: { icon: tiktokIcon, labelEn: 'TikTok', labelAr: 'تيك توك' },
  snapchat: { icon: snapchatIcon, labelEn: 'Snapchat', labelAr: 'سناب شات' },
  web: { icon: webIcon, labelEn: 'Web', labelAr: 'الويب' },
  none: { icon: null, labelEn: '—', labelAr: '—' },
};

const agents = ['Aisha M.', 'Khalid R.', 'Lina S.', 'Omar T.'];

const now = Date.now();
const m = (mins: number) => now - mins * 60_000;

const sampleRows: ActivityRow[] = [
  { id: 'a01', type: 'conversation', channel: 'whatsapp', primaryEn: 'Sara Al-Otaibi', primaryAr: 'سارة العتيبي', previewEn: 'My delivery is 5 days late!', previewAr: 'توصيلي تأخر ٥ أيام!', status: 'open', updatedAt: m(2) },
  { id: 'a02', type: 'ticket', channel: 'web', primaryEn: '#T-1043 · Delivery delay', primaryAr: '#T-1043 · تأخر التوصيل', previewEn: 'Customer escalated, awaiting agent', previewAr: 'تم تصعيد العميل، بانتظار الوكيل', status: 'pending', assignee: 'Khalid R.', updatedAt: m(12) },
  { id: 'a03', type: 'insight', channel: 'none', primaryEn: 'Cash on delivery not available', primaryAr: 'الدفع عند الاستلام غير متاح', previewEn: '38 customers asked this week', previewAr: '٣٨ عميلاً سألوا هذا الأسبوع', status: 'trending', updatedAt: m(36) },
  { id: 'a04', type: 'conversation', channel: 'instagram', primaryEn: 'Mohammed Al-Harbi', primaryAr: 'محمد الحربي', previewEn: 'Do you ship to Bahrain?', previewAr: 'هل تشحنون للبحرين؟', status: 'resolved', updatedAt: m(58) },
  { id: 'a05', type: 'conversation', channel: 'tiktok', primaryEn: 'Reem Al-Qahtani', primaryAr: 'ريم القحطاني', previewEn: 'I want to exchange for size M', previewAr: 'أبغى استبدال بمقاس M', status: 'open', updatedAt: m(74) },
  { id: 'a06', type: 'ticket', channel: 'whatsapp', primaryEn: '#T-1042 · Refund request', primaryAr: '#T-1042 · طلب استرجاع', previewEn: 'Awaiting finance approval', previewAr: 'بانتظار موافقة المالية', status: 'pending', assignee: 'Aisha M.', updatedAt: m(95) },
  { id: 'a07', type: 'insight', channel: 'none', primaryEn: 'Track order status', primaryAr: 'تتبع حالة الطلب', previewEn: '63 inquiries this week', previewAr: '٦٣ استفسارًا هذا الأسبوع', status: 'trending', updatedAt: m(120) },
  { id: 'a08', type: 'conversation', channel: 'snapchat', primaryEn: 'Faisal Al-Dossary', primaryAr: 'فيصل الدوسري', previewEn: 'Is the leather wallet still in stock?', previewAr: 'محفظة الجلد متوفرة؟', status: 'new', updatedAt: m(140) },
  { id: 'a09', type: 'conversation', channel: 'whatsapp', primaryEn: 'Noura Al-Saud', primaryAr: 'نورة آل سعود', previewEn: 'Promo code KSA20 not working', previewAr: 'كود الخصم KSA20 ما يشتغل', status: 'open', updatedAt: m(165) },
  { id: 'a10', type: 'ticket', channel: 'instagram', primaryEn: '#T-1041 · Damaged product', primaryAr: '#T-1041 · منتج تالف', previewEn: 'Replacement shipped', previewAr: 'تم شحن البديل', status: 'resolved', assignee: 'Lina S.', updatedAt: m(190) },
  { id: 'a11', type: 'insight', channel: 'none', primaryEn: 'Return policy details', primaryAr: 'تفاصيل سياسة الإرجاع', previewEn: '54 inquiries this week', previewAr: '٥٤ استفسارًا هذا الأسبوع', status: 'trending', updatedAt: m(220) },
  { id: 'a12', type: 'conversation', channel: 'web', primaryEn: 'Hessa Al-Mutairi', primaryAr: 'حصة المطيري', previewEn: 'Can I change the delivery address?', previewAr: 'أقدر أغير عنوان التوصيل؟', status: 'open', updatedAt: m(250) },
  { id: 'a13', type: 'conversation', channel: 'tiktok', primaryEn: 'Yousef Al-Ghamdi', primaryAr: 'يوسف الغامدي', previewEn: 'When will you restock the black hoodie?', previewAr: 'متى يرجع توفر الهودي الأسود؟', status: 'pending', assignee: 'Omar T.', updatedAt: m(290) },
  { id: 'a14', type: 'ticket', channel: 'web', primaryEn: '#T-1040 · Wrong item received', primaryAr: '#T-1040 · منتج خاطئ', previewEn: 'Pickup scheduled for tomorrow', previewAr: 'تم جدولة الاستلام غدًا', status: 'pending', assignee: 'Khalid R.', updatedAt: m(330) },
  { id: 'a15', type: 'conversation', channel: 'instagram', primaryEn: 'Maha Al-Zahrani', primaryAr: 'مها الزهراني', previewEn: 'Loved the packaging — thanks!', previewAr: 'التغليف رائع — شكرًا!', status: 'resolved', updatedAt: m(380) },
  { id: 'a16', type: 'insight', channel: 'none', primaryEn: 'Add Apple Pay support', primaryAr: 'إضافة دعم Apple Pay', previewEn: '19 suggestions this week', previewAr: '١٩ اقتراحًا هذا الأسبوع', status: 'new', updatedAt: m(430) },
  { id: 'a17', type: 'conversation', channel: 'whatsapp', primaryEn: 'Abdulrahman K.', primaryAr: 'عبدالرحمن ك.', previewEn: 'Need invoice for last order', previewAr: 'أبغى فاتورة آخر طلب', status: 'open', updatedAt: m(500) },
  { id: 'a18', type: 'ticket', channel: 'snapchat', primaryEn: '#T-1039 · No response from support', primaryAr: '#T-1039 · لا رد من الدعم', previewEn: 'Reassigned to senior agent', previewAr: 'أُعيد التعيين لوكيل أول', status: 'pending', assignee: 'Aisha M.', updatedAt: m(560) },
  { id: 'a19', type: 'conversation', channel: 'web', primaryEn: 'Ghada Al-Anazi', primaryAr: 'غادة العنزي', previewEn: 'Item arrived earlier than expected!', previewAr: 'الطلب وصل قبل الموعد!', status: 'resolved', updatedAt: m(640) },
  { id: 'a20', type: 'insight', channel: 'none', primaryEn: 'Mobile app suggestion', primaryAr: 'اقتراح تطبيق جوال', previewEn: '15 customers requested', previewAr: '١٥ عميلاً طلبوا', status: 'new', updatedAt: m(720) },
  { id: 'a21', type: 'conversation', channel: 'tiktok', primaryEn: 'Tariq B.', primaryAr: 'طارق ب.', previewEn: 'Cancel order #98221 please', previewAr: 'ألغوا الطلب #98221 لو سمحت', status: 'open', updatedAt: m(820) },
  { id: 'a22', type: 'ticket', channel: 'whatsapp', primaryEn: '#T-1038 · Quality complaint', primaryAr: '#T-1038 · شكوى جودة', previewEn: 'Refund issued', previewAr: 'تم إصدار الاسترجاع', status: 'resolved', assignee: 'Lina S.', updatedAt: m(940) },
  { id: 'a23', type: 'conversation', channel: 'instagram', primaryEn: 'Salma R.', primaryAr: 'سلمى ر.', previewEn: 'DM about wholesale pricing', previewAr: 'رسالة عن أسعار الجملة', status: 'new', updatedAt: m(1080) },
  { id: 'a24', type: 'insight', channel: 'none', primaryEn: 'Loyalty rewards program', primaryAr: 'برنامج مكافآت الولاء', previewEn: '11 suggestions this week', previewAr: '١١ اقتراحًا هذا الأسبوع', status: 'new', updatedAt: m(1240) },
];

function relativeTime(ts: number, lang: 'en' | 'ar'): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (mins < 60) return lang === 'ar' ? `${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'ar' ? `${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'ar' ? `${days} ي` : `${days}d ago`;
}

const typeStyles: Record<ActivityType, string> = {
  conversation: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20',
  ticket: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
  insight: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20',
};

const statusStyles: Record<ActivityStatus, string> = {
  open: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  trending: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20',
  new: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
};

const typeIcon: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  conversation: MessagesSquare,
  ticket: TicketIcon,
  insight: Lightbulb,
};

export function RecentActivityTable() {
  const { t, language, dir, showToast, user } = useApp();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('id, type, channel, primary_en, primary_ar, preview_en, preview_ar, status, assignee, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) {
      showToast(t('Failed to load activity', 'فشل تحميل النشاط'));
      setRows([]);
    } else {
      setRows((data ?? []).map(r => ({
        id: r.id,
        type: r.type as ActivityType,
        channel: r.channel as ChannelKey,
        primaryEn: r.primary_en,
        primaryAr: r.primary_ar,
        previewEn: r.preview_en,
        previewAr: r.preview_ar,
        status: r.status as ActivityStatus,
        assignee: r.assignee ?? undefined,
        updatedAt: new Date(r.updated_at).getTime(),
      })));
    }
    setLoading(false);
  }, [user, showToast, t]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.updatedAt - a.updatedAt),
    [rows]
  );

  const labelType = (ty: ActivityType) =>
    ty === 'conversation' ? t('Conversation', 'محادثة')
      : ty === 'ticket' ? t('Ticket', 'تذكرة')
      : t('Insight', 'استبصار');

  const labelStatus = (s: ActivityStatus) =>
    s === 'open' ? t('Open', 'مفتوح')
      : s === 'pending' ? t('Pending', 'معلّق')
      : s === 'resolved' ? t('Resolved', 'محلول')
      : s === 'trending' ? t('Trending', 'رائج')
      : t('New', 'جديد');

  const handleResolve = async (row: ActivityRow) => {
    const prev = rows;
    setRows(p => p.map(r => r.id === row.id ? { ...r, status: 'resolved', updatedAt: Date.now() } : r));
    const { error } = await supabase.from('activities').update({ status: 'resolved' }).eq('id', row.id);
    if (error) { setRows(prev); showToast(t('Update failed', 'فشل التحديث')); return; }
    showToast(t('Marked as resolved', 'تم التحديد كمحلول'));
  };

  const handleAssign = async (row: ActivityRow, agent: string) => {
    const prev = rows;
    setRows(p => p.map(r => r.id === row.id ? { ...r, assignee: agent, updatedAt: Date.now() } : r));
    const { error } = await supabase.from('activities').update({ assignee: agent }).eq('id', row.id);
    if (error) { setRows(prev); showToast(t('Assignment failed', 'فشل الإسناد')); return; }
    showToast(t(`Assigned to ${agent}`, `تم الإسناد إلى ${agent}`));
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    const prev = rows;
    setRows(p => p.filter(r => r.id !== id));
    setConfirmDeleteId(null);
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) { setRows(prev); showToast(t('Delete failed', 'فشل الحذف')); return; }
    showToast(t('Activity removed', 'تم حذف النشاط'));
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    const payload = sampleRows.map(r => ({
      user_id: user.id,
      type: r.type,
      channel: r.channel,
      primary_en: r.primaryEn,
      primary_ar: r.primaryAr,
      preview_en: r.previewEn,
      preview_ar: r.previewAr,
      status: r.status,
      assignee: r.assignee ?? null,
      updated_at: new Date(r.updatedAt).toISOString(),
    }));
    const { error } = await supabase.from('activities').insert(payload);
    setSeeding(false);
    if (error) { showToast(t('Seeding failed', 'فشل تعبئة البيانات')); return; }
    showToast(t('Sample data added', 'تمت إضافة البيانات التجريبية'));
    await fetchRows();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[16px]" style={{ fontWeight: 600 }}>
              {t('Recent Activity', 'النشاط الأخير')}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {t('Conversations, tickets, and insights — all in one place', 'المحادثات والتذاكر والاستبصارات — في مكان واحد')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground">
              {t(`${sorted.length} items`, `${sorted.length} عنصرًا`)}
            </span>
            {user && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-60"
              >
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {t('Add sample data', 'إضافة بيانات تجريبية')}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-3" />
            <p className="text-[13px]">{t('Loading activity…', 'جارٍ تحميل النشاط…')}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="w-10 h-10 mb-3 opacity-60" />
            <p className="text-[14px] mb-1">{t('No activity yet', 'لا يوجد نشاط بعد')}</p>
            <p className="text-[12px] opacity-80">
              {t('Click "Add sample data" to populate this table.', 'اضغط على "إضافة بيانات تجريبية" لتعبئة هذا الجدول.')}
            </p>
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[48px] text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">{t('Type', 'النوع')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('Channel', 'القناة')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('Customer / Subject', 'العميل / الموضوع')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('Status', 'الحالة')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('Assignee', 'المُسنَد')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('Updated', 'آخر تحديث')}</TableHead>
                  <TableHead className="w-[56px] text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row, i) => {
                  const TypeI = typeIcon[row.type];
                  const ch = channelMeta[row.channel];
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 text-[11px] font-medium ${typeStyles[row.type]}`}>
                          <TypeI className="w-3 h-3" />
                          {labelType(row.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ch.icon ? (
                            <img src={ch.icon} alt="" className="w-4 h-4 rounded-sm object-contain" />
                          ) : (
                            <span className="w-4 h-4 inline-block" />
                          )}
                          <span className="text-[13px]">{language === 'ar' ? ch.labelAr : ch.labelEn}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] truncate" style={{ fontWeight: 500 }}>
                            {language === 'ar' ? row.primaryAr : row.primaryEn}
                          </span>
                          <span className="text-[12px] text-muted-foreground truncate">
                            {language === 'ar' ? row.previewAr : row.previewEn}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`px-2 py-0.5 text-[11px] font-medium ${statusStyles[row.status]}`}>
                          {labelStatus(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {row.assignee ?? t('Unassigned', 'غير مُسنَد')}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {relativeTime(row.updatedAt, language)}
                      </TableCell>
                      <TableCell className="text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              aria-label={t('Row actions', 'إجراءات الصف')}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={dir === 'rtl' ? 'start' : 'end'} className="w-48">
                            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                              {t('Actions', 'إجراءات')}
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelected(row)}>
                              <Eye className="w-4 h-4" />
                              {t('View details', 'عرض التفاصيل')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleResolve(row)}
                              disabled={row.status === 'resolved'}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {t('Mark as resolved', 'تحديد كمحلول')}
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <UserPlus className="w-4 h-4" />
                                {t('Assign to…', 'إسناد إلى…')}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {agents.map(a => (
                                  <DropdownMenuItem key={a} onClick={() => handleAssign(row, a)}>
                                    {a}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('Delete', 'حذف')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      {/* Details sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={dir === 'rtl' ? 'left' : 'right'} className="w-[420px] sm:max-w-[420px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${typeStyles[selected.type]}`}>
                    {labelType(selected.type)}
                  </Badge>
                  <span className="text-[14px]">
                    {language === 'ar' ? selected.primaryAr : selected.primaryEn}
                  </span>
                </SheetTitle>
                <SheetDescription>
                  {language === 'ar' ? selected.previewAr : selected.previewEn}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-[13px] px-4">
                <Field label={t('Channel', 'القناة')} value={language === 'ar' ? channelMeta[selected.channel].labelAr : channelMeta[selected.channel].labelEn} />
                <Field label={t('Status', 'الحالة')} value={labelStatus(selected.status)} />
                <Field label={t('Assignee', 'المُسنَد')} value={selected.assignee ?? t('Unassigned', 'غير مُسنَد')} />
                <Field label={t('Updated', 'آخر تحديث')} value={relativeTime(selected.updatedAt, language)} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this activity?', 'حذف هذا النشاط؟')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will remove the row from your dashboard view. You can\u2019t undo this in the demo.', 'سيُزال الصف من العرض. لا يمكن التراجع في النسخة التجريبية.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'إلغاء')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t('Delete', 'حذف')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end">{value}</span>
    </div>
  );
}

export default RecentActivityTable;