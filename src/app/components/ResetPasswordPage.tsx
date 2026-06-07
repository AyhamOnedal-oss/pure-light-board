import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { Eye, EyeOff, Globe, Moon, Sun, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import logoDark from '../../imports/FUQAH-AI-Logo-01@2x.png';
import logoLight from '../../imports/FUQAH-AI-Logo-02@2x.png';
import { normalizePassword } from '../utils/authInput';

export function ResetPasswordPage() {
  const { t, theme, setTheme, language, setLanguage } = useApp();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 'checking' until we know whether a recovery session was established
  // from the URL tokens; 'valid' when ready; 'invalid' when no session
  // (link expired or opened in a different browser).
  const [linkState, setLinkState] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    let cancelled = false;

    // Parse recovery tokens directly from the URL hash. Supabase normally
    // does this automatically via detectSessionInUrl, but if that parsing
    // fails (race condition, hash already consumed, etc.) the page would
    // stay blank. Doing it explicitly guarantees the form shows up.
    const parseHash = () => {
      const hash = window.location.hash || '';
      const raw = hash.startsWith('#') ? hash.slice(1) : hash;
      const params = new URLSearchParams(raw);
      return {
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        type: params.get('type'),
      };
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setLinkState('valid');
      }
    });

    (async () => {
      const { access_token, refresh_token, type } = parseHash();

      // If we have recovery tokens in the URL, set the session explicitly.
      if (access_token && refresh_token && (type === 'recovery' || !type)) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (!error && data.session) {
          setLinkState('valid');
          // Clean tokens out of the visible URL
          try {
            window.history.replaceState(null, '', window.location.pathname);
          } catch { /* ignore */ }
          return;
        }
      }

      // Fallback: check whether supabase-js already restored a session
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setLinkState('valid');
        try {
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch { /* ignore */ }
      } else {
        setLinkState('invalid');
      }
    })();

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const logo = theme === 'dark' ? logoDark : logoLight;

  const validatePassword = (pw: string): string | undefined => {
    if (pw.length < 8) return t('Password must be at least 8 characters', 'يجب أن تكون كلمة المرور 8 أحرف على الأقل');
    if (!/[A-Z]/.test(pw)) return t('Must include at least one uppercase letter (A-Z)', 'يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)');
    if (!/[a-z]/.test(pw)) return t('Must include at least one lowercase letter (a-z)', 'يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)');
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    const normNew = normalizePassword(newPassword);
    const normConfirm = normalizePassword(confirmPassword);
    const pwError = validatePassword(normNew);
    if (pwError) newErrors.newPassword = pwError;

    if (!normConfirm) {
      newErrors.confirmPassword = t('Please confirm your password', 'يرجى تأكيد كلمة المرور');
    } else if (normNew !== normConfirm) {
      newErrors.confirmPassword = t('Passwords do not match', 'كلمات المرور غير متطابقة');
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: normNew });
    setLoading(false);
    if (error) {
      setSubmitError(
        error.message?.includes('session')
          ? t('Reset link expired or invalid. Please request a new one.', 'انتهت صلاحية رابط إعادة التعيين أو أنه غير صالح. يرجى طلب رابط جديد.')
          : error.message,
      );
      return;
    }
    await supabase.auth.signOut();
    setSuccess(true);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 outline-none transition-all text-[14px] text-foreground";
  const inputErrorClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-[14px] text-foreground";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-5 right-5 flex gap-2">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-[13px]"
          style={{ fontWeight: 500 }}
        >
          <Globe className="w-4 h-4" />
          {language === 'en' ? 'العربية' : 'English'}
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
      </div>

      <div className="w-full max-w-[420px]">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Fuqah AI" className="h-10 mb-3 object-contain" />
          </div>

          {linkState === 'checking' ? (
            <div className="flex flex-col items-center text-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground text-[13px]">
                {t('Verifying reset link…', 'جاري التحقق من رابط إعادة التعيين…')}
              </p>
            </div>
          ) : linkState === 'invalid' ? (
            <div className="flex flex-col items-center text-center py-6">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-[18px] mb-2" style={{ fontWeight: 600 }}>
                {t('Reset link invalid or expired', 'رابط إعادة التعيين غير صالح أو منتهي')}
              </h2>
              <p className="text-muted-foreground text-[14px] mb-6 leading-relaxed">
                {t(
                  'This password reset link is no longer valid. Please request a new one.',
                  'انتهت صلاحية رابط إعادة تعيين كلمة المرور. يرجى طلب رابط جديد.',
                )}
              </p>
              <button
                onClick={() => navigate('/login?forgot=1')}
                className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px]"
                style={{ fontWeight: 600 }}
              >
                {t('Request a new reset link', 'طلب رابط جديد')}
              </button>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-[18px] mb-2" style={{ fontWeight: 600 }}>
                {t('Password Updated', 'تم تحديث كلمة المرور')}
              </h2>
              <p className="text-muted-foreground text-[14px] mb-6">
                {t('Password has been successfully updated', 'تم تحديث كلمة المرور بنجاح')}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px]"
                style={{ fontWeight: 600 }}
              >
                {t('Back to Login', 'العودة لتسجيل الدخول')}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-[18px] text-center mb-1" style={{ fontWeight: 600 }}>
                {t('Reset Password', 'إعادة تعيين كلمة المرور')}
              </h2>
              <p className="text-muted-foreground text-[13px] text-center mb-6">
                {t('Enter your new password below', 'أدخل كلمة المرور الجديدة أدناه')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[13px] mb-2 text-muted-foreground">
                    {t('New Password', 'كلمة المرور الجديدة')}
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, newPassword: undefined })); }}
                      placeholder="••••••••"
                      className={errors.newPassword ? inputErrorClass : inputClass}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors">
                      {showNew ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.newPassword}
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    <p className={`text-[11px] ${newPassword.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {t('• At least 8 characters', '• 8 أحرف على الأقل')}
                    </p>
                    <p className={`text-[11px] ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {t('• One uppercase letter (A-Z)', '• حرف كبير واحد (A-Z)')}
                    </p>
                    <p className={`text-[11px] ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {t('• One lowercase letter (a-z)', '• حرف صغير واحد (a-z)')}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] mb-2 text-muted-foreground">
                    {t('Confirm Password', 'تأكيد كلمة المرور')}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: undefined })); }}
                      placeholder="••••••••"
                      className={errors.confirmPassword ? inputErrorClass : inputClass}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.confirmPassword}
                    </p>
                  )}
                  {!errors.confirmPassword && confirmPassword.length === 0 && (
                    <p className="text-muted-foreground text-[11px] mt-1.5">{t('Re-enter your new password', 'أعد إدخال كلمة المرور الجديدة')}</p>
                  )}
                  {!errors.confirmPassword && confirmPassword.length > 0 && confirmPassword === newPassword && (
                    <p className="text-green-500 text-[12px] mt-1.5 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {t('Passwords match', 'كلمات المرور متطابقة')}</p>
                  )}
                  {!errors.confirmPassword && confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <p className="text-red-400 text-[12px] mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {t('Passwords do not match', 'كلمات المرور غير متطابقة')}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px] disabled:opacity-60"
                  style={{ fontWeight: 600 }}
                >
                  {loading ? t('Updating...', 'جاري التحديث...') : t('Update Password', 'تحديث كلمة المرور')}
                </button>
                {submitError && (
                  <p className="flex items-center gap-1 text-red-400 text-[12px] mt-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {submitError}
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}