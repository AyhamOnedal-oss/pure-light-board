import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Eye, EyeOff, Globe, Moon, Sun, AlertCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import logoDark from '../../../imports/FUQAH-AI-Logo-01@2x.png';
import logoLight from '../../../imports/FUQAH-AI-Logo-02@2x.png';

export function AdminLoginPage() {
  const { t, theme, setTheme, language, setLanguage, signIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const logo = theme === 'dark' ? logoDark : logoLight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = t('Email is required', 'البريد الإلكتروني مطلوب');
    if (!password) newErrors.password = t('Password is required', 'كلمة المرور مطلوبة');
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setErrors({ general: t('Invalid admin credentials', 'بيانات الأدمن غير صحيحة') });
      return;
    }
    // RequireAuth + LoginPage effect will route super_admin users to /admin.
    navigate('/admin', { replace: true });
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-border focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 outline-none transition-all text-[14px] text-foreground";
  const inputErrorClass = "w-full px-4 py-3 rounded-xl bg-input-background border border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-[14px] text-foreground";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-5 right-5 flex gap-2">
        <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-[13px]" style={{ fontWeight: 500 }}>
          <Globe className="w-4 h-4" /> {language === 'en' ? 'العربية' : 'English'}
        </button>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors">
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
      </div>
      <div className="w-full max-w-[420px]">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 sm:p-10">
          <div className="flex flex-col items-center mb-6">
            <img src={logo} alt="Fuqah AI" className="h-10 mb-3 object-contain" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 text-[11px] mt-2" style={{ fontWeight: 700 }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('Admin Panel', 'لوحة الأدمن')}
            </div>
          </div>
          <h2 className="text-[18px] text-center mb-1" style={{ fontWeight: 600 }}>{t('Admin Login', 'دخول الأدمن')}</h2>
          <p className="text-muted-foreground text-[13px] text-center mb-6">{t('Access the admin control panel', 'الوصول إلى لوحة تحكم الأدمن')}</p>

          {errors.general && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 text-[13px] mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] mb-2 text-muted-foreground">{t('Email', 'البريد الإلكتروني')}</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined, general: undefined })); }}
                placeholder="admin@fuqah.ai" className={errors.email ? inputErrorClass : inputClass} />
              {errors.email && <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.email}</p>}
            </div>
            <div>
              <label className="block text-[13px] mb-2 text-muted-foreground">{t('Password', 'كلمة المرور')}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined, general: undefined })); }}
                  placeholder="••••••••" className={errors.password ? inputErrorClass : inputClass} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {errors.password && <p className="flex items-center gap-1 text-red-400 text-[12px] mt-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.password}</p>}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all text-[15px] disabled:opacity-60" style={{ fontWeight: 600 }}>
              {loading ? t('Signing in...', 'جاري الدخول...') : t('Sign In as Admin', 'دخول كأدمن')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
