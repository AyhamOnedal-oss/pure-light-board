import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff, Globe, Moon, Sun, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import logoDark from '../../imports/FUQAH-AI-Logo-01@2x.png';
import logoLight from '../../imports/FUQAH-AI-Logo-02@2x.png';

export function LoginPage() {
  const { t, theme, setTheme, language, setLanguage, signIn, signUp, sendPasswordReset, session, authLoading } = useApp();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Forgot password state
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // If already signed in, bounce to intended destination (or /dashboard).
  useEffect(() => {
    if (!authLoading && session) {
      const dest = location.state?.from || '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [authLoading, session, navigate, location.state]);

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
      const dest = location.state?.from || '/dashboard';
      navigate(dest, { replace: true });
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
            {view === 'login' && (
              <p className="text-muted-foreground text-[14px]">
                {t('AI-Powered Customer Service', 'خدمة عملاء مدعومة بالذكاء الاصطناعي')}
              </p>
            )}
          </div>

          {/* LOGIN VIEW */}
          {view === 'login' && (
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
                className="w-full py-3 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] active:scale-[0.98] transition-all text-[15px]"
                style={{ fontWeight: 600 }}
              >
                {t('Sign In', 'تسجيل الدخول')}
              </button>

              {loginError && (
                <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {loginError}
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