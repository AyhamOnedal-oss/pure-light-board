import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, MoreHorizontal, Edit, UserX, Mail, Trash2, X, ChevronDown, ChevronRight, Shield, LayoutDashboard, Users, MessageSquare, Ticket, Settings, Brain, Paintbrush, MessageCircle, CreditCard, User, Store } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import {
  MemberPermissions,
  PermissionKey,
  countEnabled,
  emptyPermissions,
  SETTINGS_SUB_KEYS,
} from '../utils/permissions';

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  permissions: MemberPermissions;
}

// Members are now persisted in the team_members table.

interface FormData {
  name: string;
  email: string;
  phone: string;
  permissions: MemberPermissions;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  permissions?: string;
}

function PermissionsSection({
  permissions,
  setPermissions,
  t,
  error,
}: {
  permissions: MemberPermissions;
  setPermissions: (p: MemberPermissions) => void;
  t: (en: string, ar: string) => string;
  error?: string;
}) {
  const [settingsExpanded, setSettingsExpanded] = useState(!!permissions.settings);

  const toggle = (key: PermissionKey) => {
    const next: MemberPermissions = { ...permissions, [key]: !permissions[key] };
    // If turning settings off, clear sub-permissions
    if (key === 'settings' && !next.settings) {
      SETTINGS_SUB_KEYS.forEach(k => { delete next[k]; });
    }
    // If turning any sub-permission on, ensure parent is on and expanded
    if (key.startsWith('settings_') && next[key]) {
      next.settings = true;
      setSettingsExpanded(true);
    }
    setPermissions(next);
  };

  const topLevel: { key: PermissionKey; icon: any; label: string }[] = [
    { key: 'home', icon: LayoutDashboard, label: t('Home', 'الرئيسية') },
    { key: 'team', icon: Users, label: t('Team', 'الفريق') },
    { key: 'conversations', icon: MessageSquare, label: t('Conversations', 'المحادثات') },
    { key: 'tickets', icon: Ticket, label: t('Tickets', 'التذاكر') },
  ];

  const settingsSubs: { key: PermissionKey; icon: any; label: string }[] = [
    { key: 'settings_train_ai', icon: Brain, label: t('Train AI', 'تدريب الذكاء') },
    { key: 'settings_chat_design', icon: Paintbrush, label: t('Chat Design', 'تصميم المحادثة') },
    { key: 'settings_test_chat', icon: MessageCircle, label: t('Test Chat', 'اختبار المحادثة') },
    { key: 'settings_plans', icon: CreditCard, label: t('Plans', 'الخطط') },
    { key: 'settings_account', icon: User, label: t('Account', 'الحساب') },
    { key: 'settings_store', icon: Store, label: t('Store Info', 'معلومات المتجر') },
  ];

  const enabledCount = countEnabled(permissions);

  const Row = ({ icon: Icon, label, checked, onChange, nested = false, disabled = false }: any) => (
    <label
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
      } ${nested ? 'ps-9' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 accent-[#043CC8] cursor-pointer disabled:cursor-not-allowed"
      />
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-[13px] flex-1" style={{ fontWeight: 500 }}>{label}</span>
    </label>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] text-muted-foreground flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          {t('Permissions', 'الصلاحيات')}
        </label>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
          enabledCount > 0 ? 'bg-[#043CC8]/10 text-[#043CC8]' : 'bg-red-500/10 text-red-400'
        }`} style={{ fontWeight: 600 }}>
          {enabledCount} {t('selected', 'محدد')}
        </span>
      </div>
      <div className={`rounded-xl border ${error ? 'border-red-500' : 'border-border'} bg-input-background/40 p-1.5 space-y-0.5 max-h-[260px] overflow-y-auto`}>
        {topLevel.map(it => (
          <Row
            key={it.key}
            icon={it.icon}
            label={it.label}
            checked={!!permissions[it.key]}
            onChange={() => toggle(it.key)}
          />
        ))}

        {/* Settings parent with expand */}
        <div>
          <div className="flex items-center">
            <label className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={!!permissions.settings}
                onChange={() => toggle('settings')}
                className="w-4 h-4 accent-[#043CC8] cursor-pointer"
              />
              <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-[13px]" style={{ fontWeight: 500 }}>{t('Settings', 'الإعدادات')}</span>
            </label>
            <button
              type="button"
              onClick={() => setSettingsExpanded(e => !e)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              {settingsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {settingsExpanded && (
            <div className="mt-0.5 space-y-0.5 border-s-2 border-border ms-5">
              {settingsSubs.map(it => (
                <Row
                  key={it.key}
                  icon={it.icon}
                  label={it.label}
                  checked={!!permissions[it.key]}
                  onChange={() => toggle(it.key)}
                  disabled={!permissions.settings}
                  nested
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-red-400 text-[12px] mt-1.5">{error}</p>}
    </div>
  );
}

// Extracted as a stable component to prevent re-mount on parent re-render
function MemberModal({
  title,
  formData,
  setFormData,
  errors,
  onSave,
  onClose,
  t,
}: {
  title: string;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  errors: FormErrors;
  onSave: () => void;
  onClose: () => void;
  t: (en: string, ar: string) => string;
}) {
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
    setFormData(prev => ({ ...prev, phone: val }));
  };

  const canSave = countEnabled(formData.permissions) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px]" style={{ fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-[13px] text-muted-foreground mb-2 block">{t('Full Name', 'الاسم الكامل')}</label>
            <input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('Full name', 'الاسم الكامل')}
              className={`w-full px-4 py-3 rounded-xl bg-input-background border text-[14px] outline-none focus:ring-2 transition-all text-foreground ${
                errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-border focus:border-[#043CC8] focus:ring-[#043CC8]/20'
              }`}
            />
            {errors.name && <p className="text-red-400 text-[12px] mt-1.5">{errors.name}</p>}
          </div>
          {/* Email */}
          <div>
            <label className="text-[13px] text-muted-foreground mb-2 block">{t('Email Address', 'البريد الإلكتروني')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder={t('email@example.com', 'email@example.com')}
              dir="ltr"
              className={`w-full px-4 py-3 rounded-xl bg-input-background border text-[14px] outline-none focus:ring-2 transition-all text-foreground ${
                errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-border focus:border-[#043CC8] focus:ring-[#043CC8]/20'
              }`}
            />
            {errors.email && <p className="text-red-400 text-[12px] mt-1.5">{errors.email}</p>}
          </div>
          {/* Phone — Saudi format */}
          <div>
            <label className="text-[13px] text-muted-foreground mb-2 block">{t('Phone Number', 'رقم الهاتف')}</label>
            <div className={`flex items-center rounded-xl bg-input-background border overflow-hidden transition-all focus-within:ring-2 ${
              errors.phone ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20' : 'border-border focus-within:border-[#043CC8] focus-within:ring-[#043CC8]/20'
            }`}>
              <span className="px-3 py-3 text-[14px] text-muted-foreground bg-muted/40 border-e border-border shrink-0 select-none" dir="ltr" style={{ fontWeight: 500 }}>+966</span>
              <input
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="5XXXXXXXX"
                dir="ltr"
                inputMode="numeric"
                maxLength={9}
                className="flex-1 px-3 py-3 bg-transparent text-[14px] outline-none text-foreground"
              />
            </div>
            {errors.phone && <p className="text-red-400 text-[12px] mt-1.5">{errors.phone}</p>}
          </div>

          {/* Permissions */}
          <PermissionsSection
            permissions={formData.permissions}
            setPermissions={(p) => setFormData(prev => ({ ...prev, permissions: p }))}
            t={t}
            error={errors.permissions}
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px] transition-colors" style={{ fontWeight: 500 }}>
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className={`flex-1 py-2.5 rounded-xl text-white text-[14px] transition-colors ${
              canSave ? 'bg-[#043CC8] hover:bg-[#0330a0] cursor-pointer' : 'bg-[#043CC8]/40 cursor-not-allowed'
            }`}
            style={{ fontWeight: 500 }}
            title={!canSave ? t('Select at least one permission to save', 'اختر صلاحية واحدة على الأقل للحفظ') : ''}
          >
            {t('Save', 'حفظ')}
          </button>
        </div>
        {!canSave && (
          <p className="text-[12px] text-muted-foreground text-center mt-2">
            {t('Select at least one permission to enable save', 'اختر صلاحية واحدة على الأقل لتفعيل الحفظ')}
          </p>
        )}
      </div>
    </div>
  );
}

export function TeamPage() {
  const { t, showToast, dir, tenantId, user } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', email: '', phone: '', permissions: emptyPermissions() });
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const menuButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  // Load members from Supabase
  React.useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, phone, status, permissions')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.log('Failed to load team members:', error.message);
      } else if (data) {
        setMembers(data.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone || '',
          status: m.status as 'active' | 'inactive',
          permissions: (m.permissions || {}) as MemberPermissions,
        })));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = t('Name is required', 'الاسم مطلوب');
    }
    if (!formData.email.trim()) {
      newErrors.email = t('Email is required', 'البريد الإلكتروني مطلوب');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('Please enter a valid email address', 'يرجى إدخال بريد إلكتروني صحيح');
    }
    if (formData.phone && !/^5\d{8}$/.test(formData.phone)) {
      newErrors.phone = t('Must start with 5, followed by 8 digits (e.g. 5XXXXXXXX)', 'يجب أن يبدأ بـ 5 متبوعاً بـ 8 أرقام');
    }
    if (countEnabled(formData.permissions) === 0) {
      newErrors.permissions = t('Select at least one permission', 'اختر صلاحية واحدة على الأقل');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleStatus = async (id: string) => {
    const member = members.find(x => x.id === id);
    if (!member) return;
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('team_members').update({ status: newStatus }).eq('id', id);
    if (error) { showToast(t('Failed to update', 'فشل التحديث')); return; }
    setMembers(m => m.map(x => x.id === id ? { ...x, status: newStatus } : x));
    setMenuOpen(null);
    if (member?.status === 'active') {
      showToast(t('Member disabled. They will see: "Your account has been disabled"', 'تم تعطيل العضو. سيرى رسالة: "تم تعطيل حسابك"'));
    } else {
      showToast(t('Member enabled successfully', 'تم تفعيل العضو بنجاح'));
    }
  };

  const deleteMember = (id: string) => {
    setDeleteConfirm(id);
    setMenuOpen(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('team_members').delete().eq('id', deleteConfirm);
    if (error) { showToast(t('Failed to delete', 'فشل الحذف')); return; }
    setMembers(m => m.filter(x => x.id !== deleteConfirm));
    setDeleteConfirm(null);
    showToast(t('Member deleted', 'تم حذف العضو'));
  };

  const openAddModal = () => {
    setFormData({ name: '', email: '', phone: '', permissions: emptyPermissions() });
    setErrors({});
    setShowAdd(true);
  };

  const openEditModal = (member: Member) => {
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      permissions: { ...(member.permissions || {}) },
    });
    setErrors({});
    setEditMember(member);
    setMenuOpen(null);
  };

  const handleAdd = async () => {
    if (!validateForm() || !tenantId) return;
    const { data, error } = await supabase.from('team_members').insert({
      tenant_id: tenantId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      permissions: formData.permissions,
      invited_by: user?.id ?? null,
    }).select('id').single();
    if (error || !data) { showToast(t('Failed to add member', 'فشل إضافة العضو')); return; }
    setMembers([...members, { id: data.id, ...formData, status: 'active' }]);
    setShowAdd(false);
    showToast(t(`Member added. Invitation email will be sent to ${formData.email}`, `تمت إضافة العضو. سيتم إرسال دعوة إلى ${formData.email}`));
  };

  const handleEdit = async () => {
    if (!editMember || !validateForm()) return;
    const { error } = await supabase.from('team_members').update({
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      permissions: formData.permissions,
    }).eq('id', editMember.id);
    if (error) { showToast(t('Failed to update', 'فشل التحديث')); return; }
    setMembers(m => m.map(x => x.id === editMember.id ? { ...x, ...formData } : x));
    setEditMember(null);
    showToast(t('Member updated successfully', 'تم تحديث العضو بنجاح'));
  };

  const resendInvite = (member: Member) => {
    setMenuOpen(null);
    showToast(t(`Invitation sent to ${member.email}`, `تم إرسال الدعوة إلى ${member.email}`));
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    return `+966 ${phone}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Team', 'الفريق')}</h1>
          <p className="text-muted-foreground text-[14px] mt-1">{loading ? t('Loading…', 'جارٍ التحميل…') : t(`${members.length} members`, `${members.length} أعضاء`)}</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2.5 bg-[#043CC8] text-white rounded-xl hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]" style={{ fontWeight: 500 }}>
          <Plus className="w-4 h-4" /> {t('Add Member', 'إضافة عضو')}
        </button>
      </div>

      {showAdd && (
        <MemberModal
          title={t('Add New Member', 'إضافة عضو جديد')}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          t={t}
        />
      )}
      {editMember && (
        <MemberModal
          title={t('Edit Member', 'تعديل العضو')}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          onSave={handleEdit}
          onClose={() => setEditMember(null)}
          t={t}
        />
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start px-6 py-4 text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>{t('Name', 'الاسم')}</th>
                <th className="text-start px-6 py-4 text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>{t('Email', 'البريد')}</th>
                <th className="text-start px-6 py-4 text-[13px] text-muted-foreground hidden md:table-cell" style={{ fontWeight: 500 }}>{t('Phone', 'الهاتف')}</th>
                <th className="text-start px-6 py-4 text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>{t('Permissions', 'الصلاحيات')}</th>
                <th className="text-start px-6 py-4 text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</th>
                <th className="px-6 py-4 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const permCount = countEnabled(m.permissions || {});
                return (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#043CC8] to-[#00FFF4] flex items-center justify-center text-white text-[11px] shrink-0" style={{ fontWeight: 700 }}>
                        {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-[14px]" style={{ fontWeight: 500 }}>{m.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[14px] text-muted-foreground">{m.email}</td>
                  <td className="px-6 py-4 text-[14px] text-muted-foreground hidden md:table-cell" dir="ltr">{formatPhone(m.phone)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full ${
                      permCount > 0 ? 'bg-[#043CC8]/10 text-[#043CC8]' : 'bg-red-500/10 text-red-400'
                    }`} style={{ fontWeight: 600 }}>
                      <Shield className="w-3 h-3" />
                      {permCount} {t('granted', 'ممنوحة')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[12px] px-2.5 py-1 rounded-full ${m.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'}`} style={{ fontWeight: 600 }}>
                      {m.status === 'active' ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <button ref={el => { menuButtonRefs.current[m.id] = el; }} onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {menuOpen === m.id && (() => {
                        const btnEl = menuButtonRefs.current[m.id];
                        if (!btnEl) return null;
                        const rect = btnEl.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const menuHeight = 200;
                        const openAbove = spaceBelow < menuHeight;
                        const top = openAbove ? rect.top - menuHeight : rect.bottom + 4;
                        const left = dir === 'rtl' ? rect.left : Math.min(rect.right - 192, window.innerWidth - 200);
                        return (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(null)} />
                            <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-48" style={{ top, left }}>
                              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors" onClick={() => openEditModal(m)}>
                                <Edit className="w-4 h-4 text-muted-foreground" /> {t('Edit', 'تعديل')}
                              </button>
                              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors" onClick={() => toggleStatus(m.id)}>
                                <UserX className="w-4 h-4 text-muted-foreground" /> {m.status === 'active' ? t('Disable', 'تعطيل') : t('Enable', 'تفعيل')}
                              </button>
                              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors" onClick={() => resendInvite(m)}>
                                <Mail className="w-4 h-4 text-muted-foreground" /> {t('Resend Invite', 'إعادة الدعوة')}
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-500/10 text-red-400 text-[13px] transition-colors" onClick={() => deleteMember(m.id)}>
                                <Trash2 className="w-4 h-4" /> {t('Delete', 'حذف')}
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[17px]" style={{ fontWeight: 600 }}>{t('Confirm Delete', 'تأكيد الحذف')}</h3>
              <button onClick={() => setDeleteConfirm(null)} className="p-1 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-[14px] text-muted-foreground">{t('Are you sure you want to delete this member?', 'هل أنت متأكد من حذف هذا العضو؟')}</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px] transition-colors" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[14px] transition-colors" style={{ fontWeight: 500 }}>
                {t('Delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
