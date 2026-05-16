import { Link, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';

export function NotFoundPage() {
  const { session, t } = useApp();
  const location = useLocation();
  const target = session ? '/dashboard' : '/login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-sm text-muted-foreground font-mono">404</p>
        <h1 className="text-2xl font-semibold text-foreground">
          {t('Page not found', 'الصفحة غير موجودة')}
        </h1>
        <p className="text-sm text-muted-foreground break-all">
          <code>{location.pathname}</code>
        </p>
        <Link
          to={target}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          {session
            ? t('Go to dashboard', 'الذهاب إلى لوحة التحكم')
            : t('Go to login', 'الذهاب لتسجيل الدخول')}
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;