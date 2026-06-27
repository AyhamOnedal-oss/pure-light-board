import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Consumes a magic-link token_hash issued by the `admin-impersonate` edge
 * function and signs this tab in as the target merchant. Per-tab session
 * storage (see src/integrations/supabase/client.ts) keeps the original
 * admin tab's session untouched.
 */
export function AdminImpersonateRedirect() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token_hash = params.get('token_hash') || '';
        if (!token_hash) {
          throw new Error('Missing impersonation token.');
        }
        // Ensure this tab starts from a clean slate.
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        const { error: vErr } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash,
        });
        if (vErr) throw vErr;
        if (cancelled) return;
        window.location.replace('/dashboard');
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to sign in as customer.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-500" />
            <h1 className="text-[16px] mb-2" style={{ fontWeight: 700 }}>Impersonation failed</h1>
            <p className="text-[13px] text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-[#043CC8]" />
            <h1 className="text-[16px] mb-1" style={{ fontWeight: 700 }}>Signing in as customer…</h1>
            <p className="text-[13px] text-muted-foreground">جارٍ تسجيل الدخول كعميل…</p>
          </>
        )}
      </div>
    </div>
  );
}