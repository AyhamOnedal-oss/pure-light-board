import { supabase } from '../../integrations/supabase/client';

/**
 * Seeds demo conversations, messages, customers, and tickets for a tenant.
 * Idempotent: only runs if there are no conversations or tickets yet.
 */
export async function seedDemoData(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Idempotency check
    const [{ count: convCount }, { count: tkCount }] = await Promise.all([
      supabase.from('conversations_main').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('tickets_main').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);
    if ((convCount ?? 0) > 0 || (tkCount ?? 0) > 0) {
      return { ok: true };
    }

    // 1. Customers
    const customers = [
      { tenant_id: tenantId, display_name: 'Fatima Al-Zahrani', display_name_ar: 'فاطمة الزهراني', phone: '+966 55 123 4567', avatar_color: '#043CC8', locale: 'ar' },
      { tenant_id: tenantId, display_name: 'Mohammed Ali', display_name_ar: 'محمد علي', phone: '+966 54 456 7890', avatar_color: '#10b981', locale: 'ar' },
      { tenant_id: tenantId, display_name: 'Nora Saeed', display_name_ar: 'نورة سعيد', phone: '+966 53 789 0123', avatar_color: '#f59e0b', locale: 'ar' },
      { tenant_id: tenantId, display_name: 'Reem Hassan', display_name_ar: 'ريم حسن', phone: '+966 59 654 3210', avatar_color: '#ff4466', locale: 'ar' },
      { tenant_id: tenantId, display_name: 'Hassan Faisal', display_name_ar: 'حسن فيصل', phone: '+966 50 111 2222', avatar_color: '#00C9BD', locale: 'ar' },
    ];
    const { data: insertedCustomers, error: custErr } = await supabase
      .from('conversations_customers').insert(customers).select('id, display_name, phone, avatar_color');
    if (custErr) throw custErr;
    const cMap = Object.fromEntries((insertedCustomers || []).map(c => [c.display_name!, c]));

    // 2. Conversations
    const now = new Date();
    const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

    const convs = [
      { tenant_id: tenantId, customer_id: cMap['Fatima Al-Zahrani']?.id, subject: 'Order tracking', category: 'inquiry' as const, status: 'closed' as const, ticket_status: 'closed', csat_rating: 5, rating_comment: 'دعم ممتاز! حصلت على معلومات التتبع فوراً.', close_reason: 'customer_manual', last_message_at: ago(2), created_at: ago(60), resolved_at: ago(2) },
      { tenant_id: tenantId, customer_id: cMap['Mohammed Ali']?.id, subject: 'Return request', category: 'request' as const, status: 'open' as const, ticket_status: 'open', csat_rating: 4, last_message_at: ago(15), created_at: ago(45) },
      { tenant_id: tenantId, customer_id: cMap['Nora Saeed']?.id, subject: 'Color availability', category: 'inquiry' as const, status: 'closed' as const, csat_rating: 5, rating_comment: 'سريع جداً ومفيد!', close_reason: 'ai_request', last_message_at: ago(60), created_at: ago(120), resolved_at: ago(60) },
      { tenant_id: tenantId, customer_id: cMap['Reem Hassan']?.id, subject: 'Damaged product', category: 'complaint' as const, status: 'open' as const, ticket_status: 'open', csat_rating: 2, last_message_at: ago(300), created_at: ago(360) },
      { tenant_id: tenantId, customer_id: cMap['Hassan Faisal']?.id, subject: 'Product availability', category: 'inquiry' as const, status: 'closed' as const, csat_rating: 5, close_reason: 'customer_manual', last_message_at: ago(360), created_at: ago(380), resolved_at: ago(360) },
    ];
    const { data: insertedConvs, error: convErr } = await supabase
      .from('conversations_main').insert(convs).select('id, customer_id, subject, category, status, created_at, ticket_status');
    if (convErr) throw convErr;
    const convBySubject = Object.fromEntries((insertedConvs || []).map(c => [c.subject!, c]));

    // 3. Messages — keyed per conversation
    type MsgIn = { tenant_id: string; conversation_id: string; sender: 'customer' | 'ai'; body: string; kind?: string; file_name?: string; feedback?: string | null; created_at: string };
    const msgs: MsgIn[] = [];
    const push = (subject: string, list: Omit<MsgIn, 'tenant_id' | 'conversation_id'>[]) => {
      const c = convBySubject[subject];
      if (!c) return;
      list.forEach(m => msgs.push({ tenant_id: tenantId, conversation_id: c.id, ...m }));
    };

    push('Order tracking', [
      { sender: 'customer', body: 'مرحباً، أحتاج مساعدة في تتبع طلبي #45231', kind: 'text', created_at: ago(58) },
      { sender: 'ai', body: 'مرحباً فاطمة! يسعدني مساعدتك. طلبك #45231 في الطريق ومن المتوقع وصوله غداً.', kind: 'text', feedback: 'positive', created_at: ago(57) },
      { sender: 'customer', body: 'هل يمكنك إرسال لقطة شاشة التتبع؟', kind: 'text', created_at: ago(50) },
      { sender: 'ai', body: '', kind: 'image', file_name: 'tracking-screenshot.png', feedback: 'positive', created_at: ago(49) },
      { sender: 'customer', body: 'شكراً لمساعدتك!', kind: 'text', created_at: ago(2) },
    ]);
    push('Return request', [
      { sender: 'customer', body: 'أريد إرجاع هذا المنتج', kind: 'text', created_at: ago(45) },
      { sender: 'ai', body: 'أتفهم ذلك. هل يمكنك مشاركة رقم الطلب وسبب الإرجاع؟', kind: 'text', feedback: 'positive', created_at: ago(44) },
      { sender: 'customer', body: 'طلب #78432. المقاس خاطئ.', kind: 'text', created_at: ago(40) },
      { sender: 'customer', body: '', kind: 'file', file_name: 'receipt.pdf', created_at: ago(39) },
      { sender: 'ai', body: 'تم بدء عملية الإرجاع للطلب #78432. ستتلقى ملصق الشحن عبر البريد الإلكتروني خلال 24 ساعة.', kind: 'text', feedback: 'positive', created_at: ago(15) },
    ]);
    push('Color availability', [
      { sender: 'customer', body: 'هل يتوفر هذا باللون الأزرق؟', kind: 'text', created_at: ago(120) },
      { sender: 'ai', body: 'نعم! لدينا أزرق داكن، أزرق سماوي، وأزرق ملكي. أيهم يهمك؟', kind: 'text', feedback: 'positive', created_at: ago(60) },
    ]);
    push('Damaged product', [
      { sender: 'customer', body: 'المنتج وصل تالف', kind: 'text', created_at: ago(360) },
      { sender: 'ai', body: 'أنا آسف لسماع ذلك! هل يمكنك مشاركة صور الضرر؟', kind: 'text', feedback: 'negative', created_at: ago(355) },
      { sender: 'customer', body: '', kind: 'image', file_name: 'damaged-item.jpg', created_at: ago(300) },
    ]);
    push('Product availability', [
      { sender: 'customer', body: 'هل هذا المنتج متوفر؟', kind: 'text', created_at: ago(380) },
      { sender: 'ai', body: 'نعم، متوفر في المخزون! هل ترغب في إضافته إلى سلة التسوق؟', kind: 'text', feedback: 'positive', created_at: ago(370) },
      { sender: 'customer', body: 'شكراً على الرد السريع!', kind: 'text', created_at: ago(360) },
    ]);

    if (msgs.length > 0) {
      const { error: msgErr } = await supabase.from('conversations_messages').insert(msgs);
      if (msgErr) throw msgErr;
    }

    // 4. Tickets — link to conversations 1, 2, 4 plus 2 standalone
    const tickets = [
      {
        tenant_id: tenantId, subject: 'استفسار عن تتبع الطلب #45231', conversation_id: convBySubject['Order tracking']?.id,
        category: 'inquiry' as const, priority: 'low' as const, status: 'closed' as const, rating: 5,
        customer_name: 'Fatima Al-Zahrani', customer_phone: '+966 55 123 4567', customer_avatar_color: '#043CC8',
        customer_id: cMap['Fatima Al-Zahrani']?.id, created_at: ago(60), resolved_at: ago(2),
      },
      {
        tenant_id: tenantId, subject: 'طلب إرجاع المنتج #78432', conversation_id: convBySubject['Return request']?.id,
        category: 'request' as const, priority: 'medium' as const, status: 'open' as const, rating: 4,
        customer_name: 'Mohammed Ali', customer_phone: '+966 54 456 7890', customer_avatar_color: '#10b981',
        customer_id: cMap['Mohammed Ali']?.id, created_at: ago(45),
      },
      {
        tenant_id: tenantId, subject: 'شكوى — منتج تالف عند الاستلام', conversation_id: convBySubject['Damaged product']?.id,
        category: 'complaint' as const, priority: 'high' as const, status: 'open' as const, rating: 2,
        customer_name: 'Reem Hassan', customer_phone: '+966 59 654 3210', customer_avatar_color: '#ff4466',
        customer_id: cMap['Reem Hassan']?.id, created_at: ago(360),
      },
      {
        tenant_id: tenantId, subject: 'شكوى — تأخر الطلب أكثر من أسبوع', category: 'complaint' as const, priority: 'high' as const, status: 'open' as const,
        customer_name: 'Ali Saeed', customer_phone: '+966 59 654 3210', customer_avatar_color: '#8b5cf6',
        created_at: ago(180),
      },
      {
        tenant_id: tenantId, subject: 'طلب تغيير عنوان التوصيل', category: 'request' as const, priority: 'medium' as const, status: 'closed' as const,
        customer_name: 'Sara Mohammed', customer_phone: '+966 58 111 2222', customer_avatar_color: '#f59e0b',
        created_at: ago(800), resolved_at: ago(700),
      },
    ];
    const { data: insertedTickets, error: tkErr } = await supabase
      .from('tickets_main').insert(tickets).select('id, subject, status, created_at, resolved_at');
    if (tkErr) throw tkErr;

    // 5. Activities — opening event for each + closing event for closed ones + a note on the last one
    const acts: Array<{ tenant_id: string; ticket_id: string; type: string; status?: string; text?: string; author_name: string; author_role: string; created_at: string }> = [];
    (insertedTickets || []).forEach(tk => {
      acts.push({ tenant_id: tenantId, ticket_id: tk.id, type: 'status', status: 'created', author_name: 'System', author_role: 'admin', created_at: tk.created_at });
      if (tk.status === 'closed' && tk.resolved_at) {
        acts.push({ tenant_id: tenantId, ticket_id: tk.id, type: 'status', status: 'closed', author_name: 'System', author_role: 'admin', created_at: tk.resolved_at });
      }
    });
    const lastClosed = (insertedTickets || []).find(t => t.subject?.includes('عنوان'));
    if (lastClosed) {
      acts.push({ tenant_id: tenantId, ticket_id: lastClosed.id, type: 'note', text: 'تمت مراجعة الطلب وتحديث العنوان بنجاح. لا حاجة لإجراء إضافي.', author_name: 'Ahmed Al-Rashid', author_role: 'admin', created_at: lastClosed.resolved_at || lastClosed.created_at });
    }
    if (acts.length > 0) {
      const { error: actErr } = await supabase.from('tickets_activities').insert(acts);
      if (actErr) throw actErr;
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}