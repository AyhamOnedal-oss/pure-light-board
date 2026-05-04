import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff, Globe, Moon, Sun, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import logoDark from '../../imports/FUQAH-AI-Logo-01@2x.png';
import logoLight from '../../imports/FUQAH-AI-Logo-02@2x.png';

export function LoginPage() {
  const { t, theme, setTheme, language, setLanguage, signIn, signUp, sendPasswordReset, session, authLoading, isSuperAdmin, roleLoading } = useApp();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  // Pre-fill email when arriving from Zid/Salla install flow.
  const initialQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const fromPlatform = initialQuery?.get('from') ?? '';
  const prefillEmail = initialQuery?.get('email') ?? '';
  const fromStatus = initialQuery?.get('status') ?? '';
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Forgot password state
  const [view, setView] = useState<'login' | 'forgot'>('login');
  // When arriving from a fresh Zid/Salla install, show a dedicated
  // "check your email" screen instead of the login form. The user can
  // dismiss it to reveal the sign-in form.
  const [showInstallSuccess, setShowInstallSuccess] = useState<boolean>(
    !!((fromPlatform === 'zid' || fromPlatform === 'salla') && prefillEmail && (fromStatus === 'new' || fromStatus === 'linked'))
  );
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // If already signed in, bounce to intended destination (or /dashboard).
  useEffect(() => {
    if (!authLoading && !roleLoading && session) {
      // Super admins always land on /admin, regardless of any prior `from` location
      // (which may point to /dashboard from an unauthenticated redirect).
      const dest = isSuperAdmin
        ? '/admin'
        : (location.state?.from && !location.state.from.startsWith('/admin')
            ? location.state.from
            : '/dashboard');
      navigate(dest, { replace: true });
    }
  }, [authLoading, roleLoading, session, navigate, location.state, isSuperAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSignupSuccess(false);

    if (!email || !password) {
      setLoginError(t('Please enter email and password', 'يرجى إدخال البريد الإلكتروني وكلمة المرور'));
      return;
    }

    setLoginLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      setLoginLoading(false);
      if (error) {
        setLoginError(t('Invalid email or password', 'البريد الإلكتروني أو كلمة المرور غير صحيحة'));
        return;
      }
      // Role-based destination is handled by the effect above once session/isSuperAdmin resolve.
    } else {
      const { error } = await signUp(email.trim(), password);
      setLoginLoading(false);
      if (error) {
        setLoginError(error);
        return;
      }
      // If email confirmation is enabled, no session yet — show a success hint.
      setSignupSuccess(true);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError(t('Please enter a valid email address', 'يرجى إدخال بريد إلكتروني صحيح'));
      return;
    }

    setForgotLoading(true);
    const { error } = await sendPasswordReset(forgotEmail.trim());
    setForgotLoading(false);

    if (error) {
      setForgotError(error);
      return;
    }
    setForgotSuccess(true);
  };

  const resetForgotState = () => {
    setView('login');
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  const logo = theme === 'dark' ? logoDark : logoLight;
  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;

  const inputClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 outline-none transition-all text-[14px] text-foreground";
  const inputErrorClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-[14px] text-foreground";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Top controls */}
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
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Fuqah AI" className="h-10 mb-3 object-contain" />
            {view === 'login' && !showInstallSuccess && (
              <p className="text-muted-foreground text-[14px]">
                {t('AI-Powered Customer Service', 'خدمة عملاء مدعومة بالذكاء الاصطناعي')}
              </p>
            )}
          </div>

          {/* INSTALL SUCCESS — "check your email" screen after Zid/Salla install */}
          {showInstallSuccess && (
            <div className="flex flex-col items-center text-center py-2">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-[20px] mb-2" style={{ fontWeight: 700 }}>
                {fromStatus === 'linked'
                  ? t('Your store is linked', 'تم ربط متجرك')
                  : t('Check your email', 'تحقق من بريدك الإلكتروني')}
              </h2>
              <p className="text-muted-foreground text-[14px] mb-2 leading-relaxed">
                {fromStatus === 'linked'
                  ? t(
                      `Your ${fromPlatform === 'zid' ? 'Zid' : 'Salla'} store has been linked to your existing Fuqah AI account.`,
                      `تم ربط متجرك على ${fromPlatform === 'zid' ? 'زد' : 'سلة'} بحسابك الحالي في فقاعة.`,
                    )
                  : t(
                      `Your ${fromPlatform === 'zid' ? 'Zid' : 'Salla'} store is connected. We've sent a temporary password to your inbox.`,
                      `تم ربط متجرك على ${fromPlatform === 'zid' ? 'زد' : 'سلة'} بنجاح. أرسلنا كلمة مرور مؤقتة إلى بريدك في فقاعة.`,
                    )}
              </p>
              <p className="text-foreground text-[14px] mb-1" style={{ fontWeight: 600 }}>
                {prefillEmail}
              </p>
              <p className="text-muted-foreground text-[12.5px] mb-6 leading-relaxed">
                {t(
                  'Please check your inbox (and spam folder), then sign in below.',
                  'يرجى مراجعة صندوق الوارد (والبريد المزعج)، ثم سجّل الدخول من هنا.',
                )}
              </p>
              <button
                onClick={() => setShowInstallSuccess(false)}
                className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px] mb-3"
                style={{ fontWeight: 600 }}
              >
                {t('Continue to Sign In', 'المتابعة لتسجيل الدخول')}
              </button>
              <ResendResetLink
                email={prefillEmail}
                t={t}
                onResend={async () => { await sendPasswordReset(prefillEmail); }}
              />
            </div>
          )}

          {/* LOGIN VIEW */}
          {view === 'login' && !showInstallSuccess && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[13px] mb-2 text-muted-foreground">
                  {t('Email Address', 'البريد الإلكتروني')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('name@company.com', 'name@company.com')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[13px] mb-2 text-muted-foreground">
                  {t('Password', 'كلمة المرور')}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px]"
                style={{ fontWeight: 600 }}
              >
                {loginLoading
                  ? t('Please wait…', 'يرجى الانتظار…')
                  : (mode === 'signin' ? t('Sign In', 'تسجيل الدخول') : t('Create Account', 'إنشاء حساب'))}
              </button>

              {loginError && (
                <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {loginError}
                </p>
              )}

              {signupSuccess && (
                <p className="flex items-center gap-1 text-emerald-400 text-[12px] mt-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {t('Account created. Check your email to confirm, then sign in.', 'تم إنشاء الحساب. تحقق من بريدك للتأكيد، ثم سجّل الدخول.')}
                </p>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-[#043CC8] hover:underline text-[13px]"
                  style={{ fontWeight: 500 }}
                >
                  {t('Forgot your password?', 'نسيت كلمة المرور؟')}
                </button>
              </div>

              <div className="text-center text-[13px] text-muted-foreground">
                {mode === 'signin'
                  ? t("Don't have an account?", 'ليس لديك حساب؟')
                  : t('Already have an account?', 'لديك حساب بالفعل؟')}{' '}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setLoginError(''); setSignupSuccess(false); }}
                  className="text-[#043CC8] hover:underline"
                  style={{ fontWeight: 600 }}
                >
                  {mode === 'signin' ? t('Create one', 'أنشئ واحدًا') : t('Sign in', 'تسجيل الدخول')}
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot' && !forgotSuccess && (
            <>
              <button
                onClick={resetForgotState}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] mb-5 transition-colors"
                style={{ fontWeight: 500 }}
              >
                <BackArrow className="w-4 h-4" />
                {t('Back to Login', 'العودة لتسجيل الدخول')}
              </button>

              <h2 className="text-[18px] mb-1" style={{ fontWeight: 600 }}>
                {t('Forgot Password', 'نسيت كلمة المرور')}
              </h2>
              <p className="text-muted-foreground text-[13px] mb-6">
                {t('Enter your email and we\'ll send you a reset link', 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين')}
              </p>

              <form onSubmit={handleForgotSubmit} className="space-y-5">
                <div>
                  <label className="block text-[13px] mb-2 text-muted-foreground">
                    {t('Email Address', 'البريد الإلكتروني')}
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                    placeholder={t('name@company.com', 'name@company.com')}
                    className={forgotError ? inputErrorClass : inputClass}
                  />
                  {forgotError && (
                    <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {forgotError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px] disabled:opacity-60"
                  style={{ fontWeight: 600 }}
                >
                  {forgotLoading ? t('Sending...', 'جاري الإرسال...') : t('Send Reset Link', 'إرسال رابط إعادة التعيين')}
                </button>
              </form>
            </>
          )}

          {/* FORGOT PASSWORD SUCCESS */}
          {view === 'forgot' && forgotSuccess && (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-[18px] mb-2" style={{ fontWeight: 600 }}>
                {t('Check Your Email', 'تحقق من بريدك الإلكتروني')}
              </h2>
              <p className="text-muted-foreground text-[14px] mb-6 leading-relaxed">
                {t(
                  'A reset link has been sent to your email. Please check your inbox.',
                  'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد.'
                )}
              </p>
              <button
                onClick={resetForgotState}
                className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px]"
                style={{ fontWeight: 600 }}
              >
                {t('Back to Login', 'العودة لتسجيل الدخول')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}