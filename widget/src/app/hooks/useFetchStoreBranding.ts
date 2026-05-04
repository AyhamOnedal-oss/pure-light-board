/**
 * useFetchStoreBranding — Fetches store branding (name, logo, icon) from the dashboard API.
 */

import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface StoreBranding {
  storeName: string;
  storeLogo?: string;
  storeIcon?: string;
  isLoaded: boolean;
}

const ENDPOINT = `https://${projectId}.supabase.co/functions/v1/make-server-fc841b6e/store-branding/store_shrman`;

export function useFetchStoreBranding(): StoreBranding {
  const [storeName, setStoreName] = useState('Fuqah AI');
  const [storeLogo, setStoreLogo] = useState<string | undefined>(undefined);
  const [storeIcon, setStoreIcon] = useState<string | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBranding() {
      try {
        const res = await fetch(ENDPOINT, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (!res.ok) {
          console.log(`[FuqahChat] Failed to fetch branding: ${res.status}`);
          if (!cancelled) setIsLoaded(true);
          return;
        }

        const data = await res.json();

        if (!data?.success || !data?.branding) {
          console.log('[FuqahChat] Invalid branding response:', data);
          if (!cancelled) setIsLoaded(true);
          return;
        }

        const b = data.branding;
        if (!cancelled) {
          if (b.storeName) setStoreName(b.storeName);
          if (b.logo) setStoreLogo(b.logo);
          if (b.icon) setStoreIcon(b.icon);
          setIsLoaded(true);
          console.log('[FuqahChat] Branding loaded:', b.storeName);
        }
      } catch (err) {
        console.log('[FuqahChat] Error fetching branding:', err);
        if (!cancelled) setIsLoaded(true);
      }
    }

    fetchBranding();
    return () => { cancelled = true; };
  }, []);

  return { storeName, storeLogo, storeIcon, isLoaded };
}
