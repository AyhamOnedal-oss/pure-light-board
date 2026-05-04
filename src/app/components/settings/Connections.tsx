import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../../integrations/supabase/client';
import { Loader2, Plug, CheckCircle2, XCircle, Copy, ExternalLink } from 'lucide-react';

interface SallaConnection {
  id: string;
  merchant_id: number;
  store_name: string | null;
  store_url: string | null;
  is_active: boolean;
  connection_status: string;
  connected_at: string | null;
}

interface ZidConnection {
  id: string;
  store_uuid: string;
  store_name: string | null;
  store_url: string | null;
  is_active: boolean;
  connection_status: string;
  connected_at: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SALLA_INSTALL_URL = 'https://salla.sa/apps'; // merchant-facing app store

export function Connections() {
  const { t, tenantId } = useApp();
  const [loading, setLoading] = useState(true);
  const [salla, setSalla] = useState<SallaConnection | null>(null);
  const [zid, setZid] = useState<ZidConnection | null>(null);
  const [copied, setCopied] = useState(false);

  // Single-line snippet for any storefront (Salla, Zid, Shopify, custom).
  // The widget auto-detects the platform store id at runtime via widget-loader.
  const snippet = `<script src="https://widget.fuqah.net/widget.js" async></script>`;

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: sallaRow }, { data: zidRow }] = await Promise.all([
        supabase.from('salla_connections').select('*').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('zid_connections').select('*').eq('tenant_id', tenantId).maybeSingle(),
      ]);
      if (!cancelled) {
        setSalla(sallaRow as SallaConnection | null);
        setZid(zidRow as ZidConnection | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const handleConnectZid = () => {
    const url = new URL(`${SUPABASE_URL}/functions/v1/zid-oauth-install`);
    if (tenantId) url.searchParams.set('state', tenantId);
    window.location.href = url.toString();
  };

  const handleDisconnect = async (platform: 'salla' | 'zid') => {
    if (!tenantId) return;
    if (!confirm(t('Disconnect this store?', 'فصل هذا المتجر؟'))) return;
    const table = platform === 'salla' ? 'salla_connections' : 'zid_connections';
    await supabase.from(table).update({ is_active: false, connection_status: 'disconnected' }).eq('tenant_id', tenantId);
    if (platform === 'salla') setSalla(s => s ? { ...s, is_active: false, connection_status: 'disconnected' } : s);
    else setZid(z => z ? { ...z, is_active: false, connection_status: 'disconnected' } : z);
  };

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('Connections', 'الاتصالات')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Connect your Salla or Zid store to deploy the chat widget.', 'اربط متجرك في سلة أو زد لتثبيت واجهة المحادثة.')}
        </p>
      </header>

      {/* Salla */}
      <ConnectionCard
        title="Salla"
        connection={salla ? {
          name: salla.store_name,
          url: salla.store_url,
          active: salla.is_active && salla.connection_status === 'connected',
          status: salla.connection_status,
          connected_at: salla.connected_at,
        } : null}
        onConnect={() => window.open(SALLA_INSTALL_URL, '_blank')}
        onDisconnect={() => handleDisconnect('salla')}
        t={t}
      />

      {/* Zid */}
      <ConnectionCard
        title="Zid"
        connection={zid ? {
          name: zid.store_name,
          url: zid.store_url,
          active: zid.is_active && zid.connection_status === 'connected',
          status: zid.connection_status,
          connected_at: zid.connected_at,
        } : null}
        onConnect={handleConnectZid}
        onDisconnect={() => handleDisconnect('zid')}
        t={t}
      />

      {/* Embed snippet */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold mb-1">{t('Embed snippet', 'كود التضمين')}</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {t('Paste this snippet in your storefront. The widget auto-detects your store.', 'الصق هذا الكود في متجرك. ستتعرف الأداة على متجرك تلقائياً.')}
        </p>
        <div className="flex items-stretch gap-2">
          <pre className="flex-1 bg-muted text-foreground text-xs p-3 rounded-lg overflow-x-auto font-mono">{snippet}</pre>
          <button
            onClick={copySnippet}
            className="px-4 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? t('Copied!', 'تم النسخ!') : t('Copy', 'نسخ')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectionCard({ title, connection, onConnect, onDisconnect, t }: {
  title: string;
  connection: { name: string | null; url: string | null; active: boolean; status: string; connected_at: string | null } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  t: (en: string, ar: string) => string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {connection ? (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                {connection.active ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t('Connected', 'متصل')}</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5 text-red-500" /> {t('Disconnected', 'مفصول')}</>
                )}
                {connection.name && <span>· {connection.name}</span>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{t('Not connected', 'غير متصل')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connection?.url && (
            <a href={connection.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t('Visit', 'زيارة')} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {connection?.active ? (
            <button onClick={onDisconnect} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted">
              {t('Disconnect', 'فصل')}
            </button>
          ) : (
            <button onClick={onConnect} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90">
              {t('Connect', 'ربط')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}