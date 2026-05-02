import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPayment {
  id: string; store: string; storeAr: string; date: string;
  plan: string; planAr: string; amount: number;
  status: 'pending' | 'paid'; platform: 'Zid' | 'Salla'; paymentDate: string;
}

export interface ServerInvoice {
  id: string; server: string; plan: string;
  amount: number; tax: number; amountAfterTax: number;
  start: string; duration: string; end: string;
  renewal: string; usage: number;
  status: 'active' | 'inactive' | 'expired' | 'cancelled';
}

export interface OtherInvoice {
  id: string; name: string; vendor: string; details: string;
  amount: number; tax: number; amountAfterTax: number;
  date: string; invoiceNumber: string; status: 'paid' | 'unpaid';
}

export const MOCK_SUBS: SubscriptionPayment[] = [
  { id: '1', store: 'Elegant Store', storeAr: 'متجر أنيق', date: '2026-04-15', plan: 'Professional', planAr: 'احترافي', amount: 399, status: 'pending', platform: 'Zid', paymentDate: '' },
  { id: '2', store: 'Fashion Hub', storeAr: 'مركز الموضة', date: '2026-04-14', plan: 'Basic', planAr: 'أساسي', amount: 199, status: 'paid', platform: 'Zid', paymentDate: '2026-04-14' },
  { id: '3', store: 'Tech Galaxy', storeAr: 'مجرة التقنية', date: '2026-04-13', plan: 'Business', planAr: 'أعمال', amount: 799, status: 'pending', platform: 'Salla', paymentDate: '' },
  { id: '4', store: 'Home Decor', storeAr: 'ديكور المنزل', date: '2026-04-12', plan: 'Economy', planAr: 'اقتصادي', amount: 99, status: 'paid', platform: 'Salla', paymentDate: '2026-04-12' },
  { id: '5', store: 'Sweet Treats', storeAr: 'حلويات لذيذة', date: '2026-04-11', plan: 'Professional', planAr: 'احترافي', amount: 399, status: 'pending', platform: 'Zid', paymentDate: '' },
  { id: '6', store: 'Pet Care', storeAr: 'عناية الحيوانات', date: '2026-04-10', plan: 'Basic', planAr: 'أساسي', amount: 199, status: 'pending', platform: 'Salla', paymentDate: '' },
];

export const MOCK_SERVERS: ServerInvoice[] = [
  { id: '1', server: 'Supabase', plan: 'Pro', amount: 25, tax: 3.75, amountAfterTax: 28.75, start: '2026-01-01', duration: '12 months', end: '2027-01-01', renewal: 'auto', usage: 72, status: 'active' },
  { id: '2', server: 'OpenAI', plan: 'Pay-as-you-go', amount: 180, tax: 27, amountAfterTax: 207, start: '2026-04-01', duration: '1 month', end: '2026-05-01', renewal: 'auto', usage: 85, status: 'active' },
  { id: '3', server: 'Hostinger', plan: 'Business', amount: 45, tax: 6.75, amountAfterTax: 51.75, start: '2026-02-01', duration: '12 months', end: '2027-02-01', renewal: 'manual', usage: 45, status: 'active' },
  { id: '4', server: 'Resend', plan: 'Pro', amount: 20, tax: 3, amountAfterTax: 23, start: '2026-03-01', duration: '1 month', end: '2026-04-01', renewal: 'auto', usage: 38, status: 'expired' },
];

export const MOCK_OTHER: OtherInvoice[] = [
  { id: '1', name: 'Design Services', vendor: 'Creative Agency', details: 'Dashboard UI/UX design', amount: 5000, tax: 750, amountAfterTax: 5750, date: '2026-04-01', invoiceNumber: 'INV-2026-001', status: 'paid' },
  { id: '2', name: 'Marketing Campaign', vendor: 'Digital Marketing Co', details: 'Q2 marketing campaign', amount: 3000, tax: 450, amountAfterTax: 3450, date: '2026-04-10', invoiceNumber: 'INV-2026-002', status: 'unpaid' },
  { id: '3', name: 'Legal Consultation', vendor: 'Law Firm', details: 'Terms & privacy review', amount: 2000, tax: 300, amountAfterTax: 2300, date: '2026-03-15', invoiceNumber: 'INV-2026-003', status: 'paid' },
];

export async function fetchSubscriptionPayments(): Promise<SubscriptionPayment[]> {
  try {
    const { data, error } = await supabase
      .from('admin_invoices_subscriptions')
      .select('id,store_name,store_name_ar,invoice_date,plan,plan_ar,amount,status,platform,payment_date')
      .order('invoice_date', { ascending: false });
    if (error || !data || data.length === 0) return MOCK_SUBS;
    return (data as any[]).map(r => ({
      id: r.id,
      store: r.store_name, storeAr: r.store_name_ar,
      date: r.invoice_date, plan: r.plan, planAr: r.plan_ar,
      amount: Number(r.amount),
      status: (r.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid',
      platform: r.platform as 'Zid' | 'Salla',
      paymentDate: r.payment_date || '',
    }));
  } catch { return MOCK_SUBS; }
}

export async function fetchServerInvoices(): Promise<ServerInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('admin_invoices_servers')
      .select('id,server_name,plan,amount,tax,amount_after_tax,start_date,duration,end_date,renewal,usage_percent,status')
      .order('created_at', { ascending: true });
    if (error || !data || data.length === 0) return MOCK_SERVERS;
    return (data as any[]).map(r => ({
      id: r.id, server: r.server_name, plan: r.plan,
      amount: Number(r.amount), tax: Number(r.tax), amountAfterTax: Number(r.amount_after_tax),
      start: r.start_date || '', duration: r.duration || '', end: r.end_date || '',
      renewal: r.renewal, usage: r.usage_percent,
      status: r.status as ServerInvoice['status'],
    }));
  } catch { return MOCK_SERVERS; }
}

export async function fetchOtherInvoices(): Promise<OtherInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('admin_invoices_other')
      .select('id,name,vendor,details,amount,tax,amount_after_tax,invoice_date,invoice_number,status')
      .order('invoice_date', { ascending: false });
    if (error || !data || data.length === 0) return MOCK_OTHER;
    return (data as any[]).map(r => ({
      id: r.id, name: r.name, vendor: r.vendor, details: r.details || '',
      amount: Number(r.amount), tax: Number(r.tax), amountAfterTax: Number(r.amount_after_tax),
      date: r.invoice_date, invoiceNumber: r.invoice_number,
      status: (r.status === 'paid' ? 'paid' : 'unpaid') as 'paid' | 'unpaid',
    }));
  } catch { return MOCK_OTHER; }
}