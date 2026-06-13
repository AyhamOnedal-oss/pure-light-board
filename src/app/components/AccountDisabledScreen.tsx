import React from 'react';
import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function AccountDisabledScreen() {
  const { t, signOut } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <LogOut className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-[20px] text-foreground" style={{ fontWeight: 700 }}>
          {t('Your account has been disabled', 'تم تعطيل حسابك')}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {t(
            'Please contact your workspace administrator to regain access.',
            'يرجى التواصل مع مسؤول المساحة الخاصة بك لاستعادة الوصول.',
          )}
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-[14px] transition-opacity"
          style={{ fontWeight: 600 }}
        >
          {t('Log Out', 'تسجيل الخروج')}
        </button>
      </div>
    </div>
  );
}

export default AccountDisabledScreen;