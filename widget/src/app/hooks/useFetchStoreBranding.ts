/**
 * useFetchStoreBranding — workspace name + logo + icon, derived from
 * the same `widget-config` edge function (it returns workspace_name / logo_url / icon_url).
 */

import { useState, useEffect } from "react";
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, getStoreContext, hasContext, buildContextQuery } from "../config/supabase";

export interface StoreBranding {
  storeName: string;
  storeLogo?: string;
  storeIcon?: string;
  isLoaded: boolean;
}

export function useFetchStoreBranding(): StoreBranding {
  const [storeName, setStoreName] = useState("Fuqah AI");
  const [storeLogo, setStoreLogo] = useState<string | undefined>();
  const [storeIcon, setStoreIcon] = useState<string | undefined>();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctx = getStoreContext();
    if (!hasContext(ctx)) {
      setIsLoaded(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${FUNCTIONS_BASE}/widget-config?${buildContextQuery(ctx)}`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );
        if (!res.ok) {
          if (!cancelled) setIsLoaded(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.workspace_name) setStoreName(data.workspace_name);
        if (data.logo_url) setStoreLogo(data.logo_url);
        if (data.icon_url) setStoreIcon(data.icon_url);
        setIsLoaded(true);
      } catch (err) {
        console.log("[FuqahChat] branding error:", err);
        if (!cancelled) setIsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { storeName, storeLogo, storeIcon, isLoaded };
}
