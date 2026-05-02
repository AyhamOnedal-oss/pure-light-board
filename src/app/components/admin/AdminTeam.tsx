import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { motion } from 'motion/react';
import { AnimatedValue } from '../AnimatedNumber';
import { Users, UserCheck, Plus, Edit, Trash2, Send, Ban, CheckCircle, X } from 'lucide-react';
import { fetchTeamMembers, MOCK_TEAM, type AdminTeamMember } from '../../services/adminTeam';

interface Employee {
  id: string;
  name: string; nameAr: string;
  email: string; phone: string;
  permissions: string[];
  status: 'active' | 'inactive';
}

type PermNode = { key: string; en: string; ar: string; children?: PermNode[] };

const PERMISSION_TREE: PermNode[] = [
  { key: 'admin_dashboard', en: 'Admin Dashboard', ar: 'لوحة تحكم الأدمين' },
  { key: 'team_management', en: 'Team Management', ar: 'إدارة الفريق' },
  {
    key: 'lists_management', en: 'Lists Management', ar: 'إدارة القوائم',
    children: [
      {
        key: 'customer_management', en: 'Customer Management', ar: 'إدارة العملاء',
        children: [
          { key: 'pipeline', en: 'Customer Pipeline', ar: 'سير العميل' },
          { key: 'customers', en: 'Customers List', ar: 'قائمة العملاء' },
        ],
      },
      {
        key: 'reports', en: 'Reports', ar: 'التقارير',
        children: [
          { key: 'reports_all', en: 'All Reports', ar: 'الكل' },
          { key: 'reports_zid', en: 'Zid Reports', ar: 'تقارير زد' },
          { key: 'reports_salla', en: 'Salla Reports', ar: 'تقارير سلة' },
        ],
      },
      {
        key: 'billing', en: 'Invoices & Payments', ar: 'الفواتير والمدفوعات',
        children: [
          { key: 'billing_subscriptions', en: 'Subscription Payments', ar: 'مدفوعات الاشتراكات' },
          { key: 'billing_servers', en: 'Server Invoices', ar: 'فواتير الخوادم' },
          { key: 'billing_other', en: 'Other Invoices', ar: 'فواتير أخرى' },
        ],
      },
    ],
  },
];

const ALL_PERM_KEYS: string[] = (() => {
  const out: string[] = [];
  const walk = (nodes: PermNode[]) => nodes.forEach(n => { out.push(n.key); if (n.children) walk(n.children); });
  walk(PERMISSION_TREE);
  return out;
})();

function flattenLabel(key: string, language: 'en' | 'ar'): string {
  const walk = (nodes: PermNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.key === key) return language === 'ar' ? n.ar : n.en;
      if (n.children) { const r = walk(n.children); if (r) return r; }
    }
  };
  return walk(PERMISSION_TREE) || key;
}

function rowToEmployee(r: AdminTeamMember): Employee {
  return {
    id: r.id, name: r.name, nameAr: r.name_ar,
    email: r.email, phone: r.phone || '',
    permissions: r.permissions, status: r.status,
  };
}

const mockEmployees: Employee[] = MOCK_TEAM.map(rowToEmployee);

export function AdminTeam() {
  const { t, language, showToast } = useApp();
  const [employees, setEmployees] = useState(mockEmployees);

  useEffect(() => {
    let alive = true;
    fetchTeamMembers()
      .then(rows => { if (alive) setEmployees(rows.map(rowToEmployee)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', nameAr: '', email: '', phone: '', permissions: [] as string[], status: 'active' as 'active' | 'inactive' });

  const activeCount = employees.filter(e => e.status === 'active').length;
  const cardClass = "bg-card rounded-2xl border border-border p-5 shadow-sm";

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', nameAr: '', email: '', phone: '', permissions: [], status: 'active' });
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({ name: emp.name, nameAr: emp.nameAr, email: emp.email, phone: emp.phone, permissions: [...emp.permissions], status: emp.status });
    setShowForm(true);
  };

  const handleSave = () => {
    if (editId) {
      setEmployees(prev => prev.map(e => e.id === editId ? { ...e, name: form.name, nameAr: form.nameAr, email: form.email, phone: form.phone, permissions: form.permissions, status: form.status } : e));
      showToast(t('Employee updated successfully', 'تم تحديث الموظف بنجاح'));
    } else {
      const newEmp: Employee = { id: Date.now().toString(), name: form.name, nameAr: form.nameAr, email: form.email, phone: form.phone, permissions: form.permissions, status: form.status };
      setEmployees(prev => [...prev, newEmp]);
      showToast(t('Employee added successfully', 'تمت إضافة الموظف بنجاح'));
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    showToast(t('Employee deleted', 'تم حذف الموظف'));
  };

  const toggleStatus = (id: string) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: e.status === 'active' ? 'inactive' : 'active' } : e));
    showToast(t('Status updated', 'تم تحديث الحالة'));
  };

  const collectDescendantKeys = (node: PermNode): string[] => {
    const keys = [node.key];
    if (node.children) node.children.forEach(c => keys.push(...collectDescendantKeys(c)));
    return keys;
  };

  const findNode = (key: string, nodes: PermNode[] = PERMISSION_TREE): PermNode | undefined => {
    for (const n of nodes) {
      if (n.key === key) return n;
      if (n.children) { const r = findNode(key, n.children); if (r) return r; }
    }
  };

  const togglePermission = (key: string) => {
    setForm(prev => {
      const node = findNode(key);
      const descendants = node ? collectDescendantKeys(node) : [key];
      const has = prev.permissions.includes(key);
      if (has) {
        return { ...prev, permissions: prev.permissions.filter(p => !descendants.includes(p)) };
      }
      const next = new Set(prev.permissions);
      descendants.forEach(d => next.add(d));
      return { ...prev, permissions: Array.from(next) };
    });
  };

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:border-[#043CC8] outline-none text-[13px] text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 700 }}>{t('Team Management', 'إدارة الفريق')}</h1>
          <p className="text-[13px] text-muted-foreground">{t('Manage admin team members and permissions', 'إدارة أعضاء فريق الأدمن والصلاحيات')}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px] transition-colors" style={{ fontWeight: 600 }}>
          <Plus className="w-4 h-4" /> {t('Add Employee', 'إضافة موظف')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} relative overflow-hidden`}>
          <Users className="w-5 h-5 mb-2 text-[#043CC8]" />
          <p className="text-[11px] text-muted-foreground mb-1">{t('Total Employees', 'إجمالي الموظفين')}</p>
          <p className="text-[24px]" style={{ fontWeight: 700 }}><AnimatedValue value={employees.length} /></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${cardClass} relative overflow-hidden`}>
          <UserCheck className="w-5 h-5 mb-2 text-[#22c55e]" />
          <p className="text-[11px] text-muted-foreground mb-1">{t('Active Employees', 'الموظفون النشطون')}</p>
          <p className="text-[24px]" style={{ fontWeight: 700 }}><AnimatedValue value={activeCount} /></p>
        </motion.div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px]" style={{ fontWeight: 600 }}>{editId ? t('Edit Employee', 'تعديل الموظف') : t('Add Employee', 'إضافة موظف')}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Name (EN)', 'الاسم (إنجليزي)')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Name (AR)', 'الاسم (عربي)')}</label><input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Email', 'البريد الإلكتروني')}</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
              <div><label className="block text-[12px] text-muted-foreground mb-1">{t('Phone', 'رقم الهاتف')}</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} /></div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-2">{t('Permissions', 'الصلاحيات')}</label>
                <div className="space-y-1.5 rounded-xl border border-border p-3 bg-muted/20">
                  {PERMISSION_TREE.map(node => (
                    <PermissionTreeItem
                      key={node.key}
                      node={node}
                      depth={0}
                      selected={form.permissions}
                      onToggle={togglePermission}
                      language={language as 'en' | 'ar'}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1">{t('Status', 'الحالة')}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className={inputClass}>
                  <option value="active">{t('Active', 'نشط')}</option>
                  <option value="inactive">{t('Inactive', 'غير نشط')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>{t('Cancel', 'إلغاء')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[13px]" style={{ fontWeight: 600 }}>
                {editId ? t('Save Changes', 'حفظ التغييرات') : t('Add', 'إضافة')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Name', 'الاسم')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden md:table-cell" style={{ fontWeight: 500 }}>{t('Email', 'البريد')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden lg:table-cell" style={{ fontWeight: 500 }}>{t('Phone', 'الهاتف')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground hidden xl:table-cell" style={{ fontWeight: 500 }}>{t('Permissions', 'الصلاحيات')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#043CC8] to-[#00FFF4] flex items-center justify-center text-white text-[10px] shrink-0" style={{ fontWeight: 700 }}>
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontWeight: 600 }}>{language === 'ar' ? emp.nameAr : emp.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{emp.email}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{emp.phone}</td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {emp.permissions.slice(0, 3).map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[9px] bg-[#043CC8]/10 text-[#043CC8]" style={{ fontWeight: 600 }}>
                          {flattenLabel(p, language as 'en' | 'ar').slice(0, 14)}
                        </span>
                      ))}
                      {emp.permissions.length > 3 && <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground">+{emp.permissions.length - 3}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] ${emp.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`} style={{ fontWeight: 600 }}>
                      {emp.status === 'active' ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={t('Edit', 'تعديل')}><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggleStatus(emp.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={t('Toggle Status', 'تغيير الحالة')}>
                        {emp.status === 'active' ? <Ban className="w-3.5 h-3.5 text-yellow-500" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      </button>
                      <button onClick={() => showToast(t('Password reset link sent', 'تم إرسال رابط إعادة تعيين كلمة المرور'))} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={t('Re-send Password', 'إعادة إرسال كلمة المرور')}><Send className="w-3.5 h-3.5 text-[#043CC8]" /></button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-red-400" title={t('Delete', 'حذف')}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PermissionTreeItem({
  node, depth, selected, onToggle, language,
}: {
  node: PermNode; depth: number; selected: string[];
  onToggle: (key: string) => void; language: 'en' | 'ar';
}) {
  const checked = selected.includes(node.key);
  return (
    <div>
      <label
        className="flex items-center gap-2 cursor-pointer py-1 rounded-md hover:bg-muted/40 px-1.5"
        style={{ paddingInlineStart: depth * 18 + 6 }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(node.key)}
          className="w-4 h-4 rounded accent-[#043CC8]"
        />
        <span className="text-[12px]" style={{ fontWeight: depth === 0 ? 600 : 500 }}>
          {language === 'ar' ? node.ar : node.en}
        </span>
      </label>
      {node.children && (
        <div className="mt-0.5">
          {node.children.map(c => (
            <PermissionTreeItem
              key={c.key} node={c} depth={depth + 1}
              selected={selected} onToggle={onToggle} language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}
