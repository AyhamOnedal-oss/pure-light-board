import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Upload, Store, X, Image, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const STORE_STORAGE_KEY = 'fuqah_store_info';
const STORE_ID = 'store_shrman';
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc841b6e`;

function loadLocalData() {
  try {
    const stored = localStorage.getItem(STORE_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { storeName: 'My E-Commerce Store', domain: 'store.example.com', logo: '', icon: '' };
}

function saveLocalData(data: any) {
  try { localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const ACCEPTED_FORMATS = 'image/jpeg,image/jpg,image/png';
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function ImageUploadField({ label, description, hint, value, onChange, onRemove, inputId, t }: {
  label: string; description: string; hint: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void; inputId: string;
  t: (en: string, ar: string) => string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div>
      <label className="text-[13px] text-muted-foreground mb-1 block">{label}</label>
      <p className="text-[11px] text-muted-foreground/70 mb-3">{description}</p>
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-border shrink-0 relative overflow-visible">
          {value ? (
            <>
              <img src={value} alt={label} className="w-full h-full object-cover rounded-2xl" />
              <button
                onClick={() => setShowConfirm(true)}
                className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-20 border-2 border-white dark:border-gray-800"
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </>
          ) : (
            <Image className="w-7 h-7 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <input type="file" accept={ACCEPTED_FORMATS} onChange={onChange} className="hidden" id={inputId} />
          <label
            htmlFor={inputId}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#043CC8] text-white rounded-xl hover:bg-[#0330a0] cursor-pointer text-[13px] transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Upload className="w-4 h-4" /> {value ? t('Replace', 'استبدال') : t('Upload', 'رفع')}
          </label>
          <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-[90%] shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>{t('Are you sure you want to delete this image?', 'هل أنت متأكد من حذف هذه الصورة؟')}</h3>
            <p className="text-[13px] text-muted-foreground">{t('This action will remove the image and save changes automatically.', 'سيتم حذف الصورة وحفظ التغييرات تلقائياً.')}</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={() => { setShowConfirm(false); onRemove(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all text-[14px]"
                style={{ fontWeight: 500 }}
              >
                {t('Delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StoreInfo() {
  const { t, showToast } = useApp();
  const localDefaults = loadLocalData();
  const [storeName, setStoreName] = useState(localDefaults.storeName);
  const [domain, setDomain] = useState(localDefaults.domain);
  const [logo, setLogo] = useState(localDefaults.logo || '');
  const [icon, setIcon] = useState(localDefaults.icon || '');
  const [saved, setSaved] = useState({ storeName: localDefaults.storeName, domain: localDefaults.domain, logo: localDefaults.logo || '', icon: localDefaults.icon || '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/store-branding/${STORE_ID}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (res.ok) {
          const { branding } = await res.json();
          if (branding) {
            const data = {
              storeName: branding.storeName || localDefaults.storeName,
              domain: branding.domain || localDefaults.domain,
              logo: branding.logo || '',
              icon: branding.icon || '',
            };
            setStoreName(data.storeName);
            setDomain(data.domain);
            setLogo(data.logo);
            setIcon(data.icon);
            setSaved(data);
            saveLocalData(data);
          }
        }
      } catch (err) {
        console.log('Failed to fetch store branding from Supabase, using local:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasChanges = storeName !== saved.storeName || domain !== saved.domain || logo !== saved.logo || icon !== saved.icon;

  const handleSave = async () => {
    const data = { storeName, domain, logo, icon };
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/store-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ storeId: STORE_ID, branding: data }),
      });
      if (!res.ok) {
        const errData = await res.json();
        console.log('Error saving store branding:', errData);
        showToast(t('Failed to save. Try again.', 'فشل الحفظ. حاول مجدداً.'));
        return;
      }
      setSaved(data);
      saveLocalData(data);
      showToast(t('Store info saved successfully', 'تم حفظ معلومات المتجر بنجاح'));
    } catch (err) {
      console.log('Error saving store branding:', err);
      showToast(t('Failed to save. Try again.', 'فشل الحفظ. حاول مجدداً.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setStoreName(saved.storeName);
    setDomain(saved.domain);
    setLogo(saved.logo);
    setIcon(saved.icon);
  };

  const handleFileUpload = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      showToast(t('File too large. Max 2MB.', 'الملف كبير جداً. الحد الأقصى 2 ميجابايت.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Store Information', 'معلومات المتجر')}</h1>
        <p className="text-muted-foreground text-[14px] mt-1">{t('Manage your store details', 'إدارة تفاصيل متجرك')}</p>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-6">
        {/* Store Logo */}
        <ImageUploadField
          label={t('Store Logo', 'شعار المتجر')}
          description={t('Appears in the center of the chat page before the conversation starts', 'يظهر في منتصف صفحة المحادثة قبل بدء المحادثة')}
          hint={t('JPEG, PNG — 1024×256px recommended — Max 2MB', 'JPEG, PNG — 1024×256 بكسل موصى — حد أقصى 2 ميجابايت')}
          value={logo}
          onChange={handleFileUpload(setLogo)}
          onRemove={async () => {
            setLogo('');
            const data = { storeName, domain, logo: '', icon };
            setSaving(true);
            try {
              await fetch(`${API_BASE}/store-branding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
                body: JSON.stringify({ storeId: STORE_ID, branding: data }),
              });
              setSaved(data);
              saveLocalData(data);
              showToast(t('Logo deleted successfully', 'تم حذف الشعار بنجاح'));
            } catch (err) {
              console.log('Error deleting logo:', err);
            } finally {
              setSaving(false);
            }
          }}
          inputId="logo-upload"
          t={t}
        />

        {/* Store Icon */}
        <ImageUploadField
          label={t('Store Icon', 'أيقونة المتجر')}
          description={t('Appears at the top of the chat page header', 'يظهر في أعلى صفحة المحادثة في الهيدر')}
          hint={t('JPEG, PNG — 32×32px recommended — Max 2MB', 'JPEG, PNG — 32×32 بكسل موصى — حد أقصى 2 ميجابايت')}
          value={icon}
          onChange={handleFileUpload(setIcon)}
          onRemove={async () => {
            setIcon('');
            const data = { storeName, domain, logo, icon: '' };
            setSaving(true);
            try {
              await fetch(`${API_BASE}/store-branding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
                body: JSON.stringify({ storeId: STORE_ID, branding: data }),
              });
              setSaved(data);
              saveLocalData(data);
              showToast(t('Icon deleted successfully', 'تم حذف الأيقونة بنجاح'));
            } catch (err) {
              console.log('Error deleting icon:', err);
            } finally {
              setSaving(false);
            }
          }}
          inputId="icon-upload"
          t={t}
        />

        <div>
          <label className="text-[13px] text-muted-foreground mb-2 block">{t('Store Name', 'اسم المتجر')}</label>
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground"
          />
        </div>

        <div>
          <label className="text-[13px] text-muted-foreground mb-2 block">{t('Domain', 'النطاق')}</label>
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground"
          />
        </div>

        {/* Cancel (LEFT, red) | Save Changes (RIGHT) */}
        {hasChanges && (
          <div className="flex gap-3 pt-2">
            <button onClick={handleCancel} className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 active:scale-[0.98] transition-all text-[14px]" style={{ fontWeight: 500 }}>
              {t('Cancel', 'إلغاء')}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px] disabled:opacity-60" style={{ fontWeight: 500 }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('Save Changes', 'حفظ التغييرات')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}