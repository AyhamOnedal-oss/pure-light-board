import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, X, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';

export function AccountSettings() {
  const { t, showToast, user } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState({ name: '', email: user?.email ?? '', phone: '' });
  const [saving, setSaving] = useState(false);

  // Load profile from settings_account
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('settings_account')
        .select('display_name, phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const next = {
        name: data?.display_name ?? '',
        email: user.email ?? '',
        phone: data?.phone ?? '',
      };
      setName(next.name);
      setPhone(next.phone);
      setSaved(next);
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current?: string; newPw?: string; confirm?: string }>({});
  const [pwLoading, setPwLoading] = useState(false);
  const [currentPwStatus, setCurrentPwStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');

  const hasChanges = name !== saved.name || email !== saved.email || phone !== saved.phone;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
    setPhone(val);
    setPhoneError('');
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError('');
  };

  const validate = (): boolean => {
    let valid = true;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('Please enter a valid email address', 'يرجى إدخال بريد إلكتروني صحيح'));
      valid = false;
    }
    if (phone && !/^5\d{8}$/.test(phone)) {
      setPhoneError(t('Must start with 5, followed by 8 digits', 'يجب أن يبدأ بـ 5 متبوعاً بـ 8 أرقام'));
      valid = false;
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validate() || !user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('settings_account')
      .upsert({ user_id: user.id, display_name: name, phone: phone || null }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      showToast(t('Failed to save. Try again.', 'فشل الحفظ. حاول مجدداً.'));
      return;
    }
    const data = { name, email, phone };
    setSaved(data);
    showToast(t('Account settings saved successfully', 'تم حفظ إعدادات الحساب بنجاح'));
  };

  const handleCancel = () => {
    setName(saved.name);
    setEmail(saved.email);
    setPhone(saved.phone);
    setEmailError('');
    setPhoneError('');
  };

  const resetPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setPwErrors({});
    setShowPassword(false);
    setCurrentPwStatus('idle');
  };

  const validatePasswordRules = (pw: string): string | undefined => {
    if (pw.length < 8) return t('Password must be at least 8 characters', 'يجب أن تكون كلمة المرور 8 أحرف على الأقل');
    if (!/[A-Z]/.test(pw)) return t('Must include at least one uppercase letter (A-Z)', 'يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)');
    if (!/[a-z]/.test(pw)) return t('Must include at least one lowercase letter (a-z)', 'يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)');
    return undefined;
  };

  const handleChangePassword = async () => {
    const errors: typeof pwErrors = {};

    if (!currentPassword) {
      errors.current = t('Please enter your current password', 'يرجى إدخال كلمة المرور الحالية');
    } else if (user?.email) {
      // Verify current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInErr) {
        errors.current = t('Incorrect current password', 'كلمة المرور الحالية غير صحيحة');
      }
    }

    if (!newPassword) {
      errors.newPw = t('Please enter a new password', 'يرجى إدخال كلمة المرور الجديدة');
    } else {
      const pwError = validatePasswordRules(newPassword);
      if (pwError) errors.newPw = pwError;
    }

    if (!confirmPassword) {
      errors.confirm = t('Please confirm your password', 'يرجى تأكيد كلمة المرور');
    } else if (newPassword !== confirmPassword) {
      errors.confirm = t('Passwords do not match', 'كلمات المرور غير متطابقة');
    }

    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) {
      setPwErrors({ newPw: error.message });
      return;
    }
    resetPasswordModal();
    showToast(t('Password updated successfully', 'تم تحديث كلمة المرور بنجاح'));
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground";
  const inputErrorClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-red-500 text-[14px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-foreground";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Account Settings', 'إعدادات الحساب')}</h1>
        <p className="text-muted-foreground text-[14px] mt-1">{t('Manage your personal information', 'إدارة معلوماتك الشخصية')}</p>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-5">
        <div>
          <label className="text-[13px] text-muted-foreground mb-2 block">{t('Full Name', 'الاسم الكامل')}</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[13px] text-muted-foreground mb-2 block">{t('Email Address', 'البريد الإلكتروني')}</label>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            dir="ltr"
            placeholder="email@example.com"
            className={emailError ? inputErrorClass : inputClass}
          />
          {emailError && <p className="text-red-400 text-[12px] mt-1.5">{emailError}</p>}
        </div>
        <div>
          <label className="text-[13px] text-muted-foreground mb-2 block">{t('Phone Number', 'رقم الهاتف')}</label>
          <div className={`flex items-center rounded-xl bg-input-background border overflow-hidden transition-all focus-within:ring-2 ${
            phoneError ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20' : 'border-border focus-within:border-[#043CC8] focus-within:ring-[#043CC8]/20'
          }`}>
            <span className="px-3 py-3 text-[14px] text-muted-foreground bg-muted/40 border-e border-border shrink-0 select-none" dir="ltr" style={{ fontWeight: 500 }}>+966</span>
            <input
              value={phone}
              onChange={handlePhoneChange}
              placeholder="5XXXXXXXX"
              dir="ltr"
              inputMode="numeric"
              maxLength={9}
              className="flex-1 px-3 py-3 bg-transparent text-[14px] outline-none text-foreground"
            />
          </div>
          {phoneError && <p className="text-red-400 text-[12px] mt-1.5">{phoneError}</p>}
        </div>

        <div className="flex gap-3 pt-2 flex-wrap">
          {hasChanges && (
            <>
              <button onClick={handleCancel} className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 active:scale-[0.98] transition-all text-[14px]" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[14px] disabled:opacity-60" style={{ fontWeight: 500 }}>
                {saving ? t('Saving...', 'جاري الحفظ...') : t('Save Changes', 'حفظ التغييرات')}
              </button>
            </>
          )}
          <button onClick={() => setShowPassword(true)} className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl hover:bg-muted text-[14px] transition-colors" style={{ fontWeight: 500 }}>
            <Lock className="w-4 h-4" /> {t('Change Password', 'تغيير كلمة المرور')}
          </button>
        </div>
      </div>

      {showPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px]" style={{ fontWeight: 600 }}>{t('Change Password', 'تغيير كلمة المرور')}</h3>
              <button onClick={resetPasswordModal} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-[13px] mb-2 text-muted-foreground">{t('Current Password', 'كلمة المرور الحالية')}</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPwErrors(prev => ({ ...prev, current: undefined })); setCurrentPwStatus('idle'); }}
                  onBlur={() => {
                    if (!currentPassword) { setCurrentPwStatus('idle'); return; }
                    // TODO: Backend integration - validate current password against server
                    const MOCK_CURRENT_PASSWORD = '123456Aa';
                    if (currentPassword === MOCK_CURRENT_PASSWORD) {
                      setCurrentPwStatus('correct');
                      setPwErrors(prev => ({ ...prev, current: undefined }));
                    } else {
                      setCurrentPwStatus('incorrect');
                    }
                  }}
                  placeholder="••••••••"
                  className={pwErrors.current || currentPwStatus === 'incorrect' ? inputErrorClass : currentPwStatus === 'correct' ? "w-full px-4 py-3 rounded-xl bg-input-background border border-green-500 text-[14px] outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all text-foreground" : inputClass}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.current && <p className="text-red-400 text-[12px] mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pwErrors.current}</p>}
              {!pwErrors.current && currentPwStatus === 'idle' && currentPassword.length === 0 && (
                <p className="text-muted-foreground text-[11px] mt-1.5">{t('Enter your current password', 'أدخل كلمة المرور الحالية')}</p>
              )}
              {!pwErrors.current && currentPwStatus === 'correct' && (
                <p className="text-green-500 text-[12px] mt-1.5 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {t('Correct password', 'كلمة المرور صحيحة')}</p>
              )}
              {!pwErrors.current && currentPwStatus === 'incorrect' && (
                <p className="text-red-400 text-[12px] mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {t('Incorrect password', 'كلمة المرور غير صحيحة')}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[13px] mb-2 text-muted-foreground">{t('New Password', 'كلمة المرور الجديدة')}</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPwErrors(prev => ({ ...prev, newPw: undefined })); }}
                  placeholder="••••••••"
                  className={pwErrors.newPw ? inputErrorClass : inputClass}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.newPw && <p className="text-red-400 text-[12px] mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pwErrors.newPw}</p>}
              <div className="mt-2 space-y-0.5">
                <p className={`text-[11px] ${newPassword.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`}>{t('• At least 8 characters', '• 8 أحرف على الأقل')}</p>
                <p className={`text-[11px] ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-muted-foreground'}`}>{t('• One uppercase letter (A-Z)', '• حرف كبير واحد (A-Z)')}</p>
                <p className={`text-[11px] ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-muted-foreground'}`}>{t('• One lowercase letter (a-z)', '• حرف صغير واحد (a-z)')}</p>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[13px] mb-2 text-muted-foreground">{t('Confirm New Password', 'تأكيد كلمة المرور الجديدة')}</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPwErrors(prev => ({ ...prev, confirm: undefined })); }}
                  placeholder="••••••••"
                  className={pwErrors.confirm ? inputErrorClass : inputClass}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.confirm && <p className="text-red-400 text-[12px] mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pwErrors.confirm}</p>}
              {!pwErrors.confirm && confirmPassword.length === 0 && (
                <p className="text-muted-foreground text-[11px] mt-1.5">{t('Re-enter your new password', 'أعد إدخال كلمة المرور الجديدة')}</p>
              )}
              {!pwErrors.confirm && confirmPassword.length > 0 && confirmPassword === newPassword && (
                <p className="text-green-500 text-[12px] mt-1.5 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {t('Passwords match', 'كلمات المرور متطابقة')}</p>
              )}
              {!pwErrors.confirm && confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-red-400 text-[12px] mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {t('Passwords do not match', 'كلمات المرور غير متطابقة')}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={resetPasswordModal} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px] transition-colors" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] text-[14px] transition-colors disabled:opacity-60"
                style={{ fontWeight: 500 }}
              >
                {pwLoading ? t('Updating...', 'جاري التحديث...') : t('Update Password', 'تحديث كلمة المرور')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}