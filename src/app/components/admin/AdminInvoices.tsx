import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useParams } from 'react-router';
import { motion } from 'motion/react';
import { Plus, Edit, Trash2, Check, X, Download, Search, CalendarDays } from 'lucide-react';
import {
  fetchSubscriptionPayments, fetchServerInvoices, fetchOtherInvoices,
  MOCK_SUBS, MOCK_SERVERS, MOCK_OTHER,
} from '../../services/adminInvoices';

// ============= SUBSCRIPTION PAYMENTS =============
function SubscriptionPayments() {
  const { t, language, showToast } = useApp();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState('');
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');

  const [payments, setPayments] = useState<typeof MOCK_SUBS>(MOCK_SUBS);

  useEffect(() => {
    let alive = true;
    fetchSubscriptionPayments()
      .then(rows => { if (alive) setPayments(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const handleConfirmReceipt = (id: string) => {
    setConfirmingId(id);
    setConfirmDate(new Date().toISOString().split('T')[0]);
  };

  const confirmPayment = () => {
    if (!confirmingId || !confirmDate) return;
    setPayments(prev => prev.map(p => p.id === confirmingId ? { ...p, status: 'paid', paymentDate: confirmDate } : p));
    showToast(t('Payment confirmed successfully', 'تم تأكيد الدفعة بنجاح'));
    setConfirmingId(null);
    setConfirmDate('');
  };

  const handleEditDate = (id: string, currentDate: string) => {
    setEditingDateId(id);
    setEditDate(currentDate);
  };

  const saveEditDate = () => {
    if (!editingDateId || !editDate) return;
    setPayments(prev => prev.map(p => p.id === editingDateId ? { ...p, paymentDate: editDate } : p));
    showToast(t('Date updated successfully', 'تم تحديث التاريخ بنجاح'));
    setEditingDateId(null);
    setEditDate('');
  };

  const renderTable = (platform: string) => {
    const items = payments.filter(p => p.platform === platform);
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
            {platform === 'Zid' ? t('Pending Zid Payments', 'مدفوعات زد المعلقة') : t('Pending Salla Payments', 'مدفوعات سلة المعلقة')}
          </h3>
          <span className={`px-2.5 py-1 rounded-lg text-[11px] ${platform === 'Zid' ? 'bg-[#043CC8]/10 text-[#043CC8]' : 'bg-[#22c55e]/10 text-[#22c55e]'}`} style={{ fontWeight: 600 }}>{platform}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Store', 'المتجر')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Date', 'التاريخ')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Plan', 'الخطة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Amount', 'المبلغ')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4" style={{ fontWeight: 600 }}>{language === 'ar' ? p.storeAr : p.store}</td>
                  <td className="py-3 px-4">{p.date}</td>
                  <td className="py-3 px-4">{language === 'ar' ? p.planAr : p.plan}</td>
                  <td className="py-3 px-4" style={{ fontWeight: 600 }}>{p.amount} {t('SAR', 'ر.س')}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-lg text-[11px] ${p.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`} style={{ fontWeight: 600 }}>
                      {p.status === 'paid' ? t('Paid', 'مدفوع') : t('Pending', 'معلق')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {p.status === 'pending' && (
                      <button onClick={() => handleConfirmReceipt(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[11px] transition-colors" style={{ fontWeight: 600 }}>
                        <Check className="w-3.5 h-3.5" /> {t('Confirm Receipt', 'تأكيد الاستلام')}
                      </button>
                    )}
                    {p.status === 'paid' && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleEditDate(p.id, p.paymentDate)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        <span className="text-[11px] text-muted-foreground">{p.paymentDate}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Confirm Receipt Modal */}
      {confirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h3 className="text-[16px] mb-4" style={{ fontWeight: 600 }}>{t('Confirm Receipt', 'تأكيد الاستلام')}</h3>
            <label className="block text-[12px] text-muted-foreground mb-1">{t('Payment Received Date', 'تاريخ استلام الدفعة')}</label>
            <input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[14px] text-foreground" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setConfirmingId(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
              <button onClick={confirmPayment} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 text-[13px]" style={{ fontWeight: 600 }}>{t('Confirm', 'تأكيد')}</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Date Modal */}
      {editingDateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h3 className="text-[16px] mb-4" style={{ fontWeight: 600 }}>{t('Edit Payment Date', 'تعديل تاريخ الدفع')}</h3>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[14px] text-foreground" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditingDateId(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
              <button onClick={saveEditDate} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px]" style={{ fontWeight: 600 }}>{t('Save', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}
      {renderTable('Zid')}
      {renderTable('Salla')}
    </div>
  );
}

// ============= SERVER INVOICES =============
function ServerInvoices() {
  const { t, language, showToast } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ server: '', plan: '', amount: '', taxEnabled: true, start: '', duration: '', renewal: 'auto', status: 'active' });

  const [invoices, setInvoices] = useState<typeof MOCK_SERVERS>(MOCK_SERVERS);

  useEffect(() => {
    let alive = true;
    fetchServerInvoices()
      .then(rows => { if (alive) setInvoices(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const openNew = () => { setEditId(null); setForm({ server: '', plan: '', amount: '', taxEnabled: true, start: '', duration: '', renewal: 'auto', status: 'active' }); setShowForm(true); };
  const openEdit = (inv: typeof invoices[0]) => {
    setEditId(inv.id);
    setForm({ server: inv.server, plan: inv.plan, amount: inv.amount.toString(), taxEnabled: inv.tax > 0, start: inv.start, duration: inv.duration, renewal: inv.renewal, status: inv.status });
    setShowForm(true);
  };
  const handleSave = () => {
    const amt = parseFloat(form.amount) || 0;
    const tax = form.taxEnabled ? amt * 0.15 : 0;
    showToast(editId ? t('Invoice updated', 'تم تحديث الفاتورة') : t('Invoice created', 'تم إنشاء الفاتورة'));
    setShowForm(false);
  };
  const handleDelete = (id: string) => { setInvoices(prev => prev.filter(i => i.id !== id)); showToast(t('Invoice deleted', 'تم حذف الفاتورة')); };

  const statusColor = (s: string) => s === 'active' ? 'bg-green-500/10 text-green-500' : s === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500';
  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[13px] text-foreground";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('Server Invoices', 'فواتير الخوادم')}</h3>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] transition-colors" style={{ fontWeight: 600 }}>
          <Plus className="w-4 h-4" /> {t('Create Invoice', 'إنشاء فاتورة')}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] mb-4" style={{ fontWeight: 600 }}>{editId ? t('Edit Invoice', 'تعديل الفاتورة') : t('Create Invoice', 'إنشاء فاتورة')}</h3>
            <div className="space-y-3">
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Server Name', 'اسم الخادم')}</label><input value={form.server} onChange={e => setForm({ ...form, server: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Plan Type', 'نوع الخطة')}</label><input value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Amount', 'المبلغ')}</label><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} /></div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.taxEnabled} onChange={e => setForm({ ...form, taxEnabled: e.target.checked })} className="w-4 h-4 rounded accent-[#043CC8]" />
                  <span className="text-[12px]">{t('Enable Tax (15%)', 'تفعيل الضريبة (15%)')}</span>
                </label>
                {form.taxEnabled && form.amount && (
                  <span className="text-[11px] text-muted-foreground">{t('After tax:', 'بعد الضريبة:')} {(parseFloat(form.amount) * 1.15).toFixed(2)}</span>
                )}
              </div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Start Date', 'تاريخ البدء')}</label><input type="date" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Duration', 'المدة')}</label><input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 12 months" className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Renewal Type', 'نوع التجديد')}</label>
                <select value={form.renewal} onChange={e => setForm({ ...form, renewal: e.target.value })} className={inputClass}>
                  <option value="auto">{t('Auto', 'تلقائي')}</option><option value="manual">{t('Manual', 'يدوي')}</option>
                </select>
              </div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Status', 'الحالة')}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  <option value="active">{t('Active', 'نشط')}</option><option value="inactive">{t('Inactive', 'غير نشط')}</option><option value="expired">{t('Expired', 'منتهي')}</option><option value="cancelled">{t('Cancelled', 'ملغي')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px]" style={{ fontWeight: 600 }}>{editId ? t('Update', 'تحديث') : t('Save', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Server', 'الخادم')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden md:table-cell" style={{ fontWeight: 500 }}>{t('Plan', 'الخطة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Amount', 'المبلغ')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden lg:table-cell" style={{ fontWeight: 500 }}>{t('Tax', 'الضريبة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden lg:table-cell" style={{ fontWeight: 500 }}>{t('After Tax', 'بعد الضريبة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden xl:table-cell" style={{ fontWeight: 500 }}>{t('Period', 'الفترة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden xl:table-cell" style={{ fontWeight: 500 }}>{t('Usage', 'الاستخدام')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4" style={{ fontWeight: 600 }}>{inv.server}</td>
                  <td className="py-3 px-4 hidden md:table-cell">{inv.plan}</td>
                  <td className="py-3 px-4">${inv.amount}</td>
                  <td className="py-3 px-4 hidden lg:table-cell">${inv.tax}</td>
                  <td className="py-3 px-4 hidden lg:table-cell" style={{ fontWeight: 600 }}>${inv.amountAfterTax}</td>
                  <td className="py-3 px-4 hidden xl:table-cell text-[11px]">{inv.start} → {inv.end}</td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <div className="flex items-center gap-2"><div className="w-12 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-[#043CC8]" style={{ width: `${inv.usage}%` }} /></div><span className="text-[11px]">{inv.usage}%</span></div>
                  </td>
                  <td className="py-3 px-4"><span className={`px-2 py-1 rounded-lg text-[10px] ${statusColor(inv.status)}`} style={{ fontWeight: 600 }}>
                    {inv.status === 'active' ? t('Active', 'نشط') :
                    inv.status === 'inactive' ? t('Inactive', 'غير نشط') :
                    inv.status === 'expired' ? t('Expired', 'منتهي') :
                    inv.status === 'cancelled' ? t('Cancelled', 'ملغي') : inv.status
                  }</span></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============= OTHER INVOICES =============
function OtherInvoices() {
  const { t, language, showToast } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', vendor: '', details: '', amount: '', taxEnabled: true, date: '', invoiceNumber: '', status: 'unpaid' });

  const [invoices, setInvoices] = useState<typeof MOCK_OTHER>(MOCK_OTHER);

  useEffect(() => {
    let alive = true;
    fetchOtherInvoices()
      .then(rows => { if (alive) setInvoices(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const openNew = () => { setEditId(null); setForm({ name: '', vendor: '', details: '', amount: '', taxEnabled: true, date: '', invoiceNumber: '', status: 'unpaid' }); setShowForm(true); };
  const openEdit = (inv: typeof invoices[0]) => {
    setEditId(inv.id);
    setForm({ name: inv.name, vendor: inv.vendor, details: inv.details, amount: inv.amount.toString(), taxEnabled: inv.tax > 0, date: inv.date, invoiceNumber: inv.invoiceNumber, status: inv.status });
    setShowForm(true);
  };
  const handleSave = () => { showToast(editId ? t('Invoice updated', 'تم تحديث الفاتورة') : t('Invoice created', 'تم إنشاء الفاتورة')); setShowForm(false); };
  const handleDelete = (id: string) => { setInvoices(prev => prev.filter(i => i.id !== id)); showToast(t('Invoice deleted', 'تم حذف الفاتورة')); };

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[13px] text-foreground";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('Other Invoices', 'فواتير أخرى')}</h3>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] transition-colors" style={{ fontWeight: 600 }}>
          <Plus className="w-4 h-4" /> {t('Create Invoice', 'إنشاء فاتورة')}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] mb-4" style={{ fontWeight: 600 }}>{editId ? t('Edit Invoice', 'تعديل الفاتورة') : t('Create Invoice', 'إنشاء فاتورة')}</h3>
            <div className="space-y-3">
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Invoice Name', 'اسم الفاتورة')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Vendor / Party', 'المورد / الجهة')}</label><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Details', 'التفاصيل')}</label><textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} className={`${inputClass} h-20 resize-none`} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Amount', 'المبلغ')}</label><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} /></div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.taxEnabled} onChange={e => setForm({ ...form, taxEnabled: e.target.checked })} className="w-4 h-4 rounded accent-[#043CC8]" />
                  <span className="text-[12px]">{t('Enable Tax (15%)', 'تفعيل الضريبة (15%)')}</span>
                </label>
                {form.taxEnabled && form.amount && (
                  <span className="text-[11px] text-muted-foreground">{t('After tax:', 'بعد الضريبة:')} {(parseFloat(form.amount) * 1.15).toFixed(2)}</span>
                )}
              </div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Invoice Date', 'تاريخ الفاتورة')}</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Invoice Number', 'رقم الفاتورة')}</label><input value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Status', 'الحالة')}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  <option value="paid">{t('Paid', 'مدفوع')}</option><option value="unpaid">{t('Unpaid', 'غير مدفوع')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px]" style={{ fontWeight: 600 }}>{editId ? t('Update', 'تحديث') : t('Save', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Name', 'الاسم')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden md:table-cell" style={{ fontWeight: 500 }}>{t('Vendor', 'المورد')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Amount', 'المبلغ')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden lg:table-cell" style={{ fontWeight: 500 }}>{t('After Tax', 'بعد الضريبة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden md:table-cell" style={{ fontWeight: 500 }}>{t('Date', 'التاريخ')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4" style={{ fontWeight: 600 }}>{inv.name}</td>
                  <td className="py-3 px-4 hidden md:table-cell">{inv.vendor}</td>
                  <td className="py-3 px-4">{inv.amount.toLocaleString()} {t('SAR', 'ر.س')}</td>
                  <td className="py-3 px-4 hidden lg:table-cell" style={{ fontWeight: 600 }}>{inv.amountAfterTax.toLocaleString()} {t('SAR', 'ر.س')}</td>
                  <td className="py-3 px-4 hidden md:table-cell">{inv.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] ${inv.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`} style={{ fontWeight: 600 }}>
                      {inv.status === 'paid' ? t('Paid', 'مدفوع') : t('Unpaid', 'غير مدفوع')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============= MAIN EXPORT =============
export function AdminInvoices() {
  const { type } = useParams<{ type: string }>();
  return (
    <div className="space-y-6">
      {type === 'subscriptions' && <SubscriptionPayments />}
      {type === 'server' && <ServerInvoices />}
      {type === 'other' && <OtherInvoices />}
    </div>
  );
}