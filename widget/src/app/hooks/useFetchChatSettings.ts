/**
 * useFetchChatSettings — Fetches chat appearance settings from the dashboard's Supabase endpoint.
 *
 * On mount, calls:
 *   GET https://<projectId>.supabase.co/functions/v1/make-server-fc841b6e/chat-settings/store_shrman
 *
 * Maps the response to ThemeSettings and widget position.
 * Falls back to defaults silently on error (console.log only).
 */

import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { ThemeSettings } from '../types/themeSettings';

export interface FetchedChatSettings {
  themeSettings: ThemeSettings;
  position: 'bottom-right' | 'bottom-left';
  isLoaded: boolean;
}

/** Fallback defaults — used when fetch fails */
const FALLBACK_SETTINGS: ThemeSettings = {
  mode: 'light',
  mainColor: '#000000',
  widgetOuterColor: '#000000',
  widgetInnerColor: '#FFFFFF',
};

const FALLBACK_POSITION: 'bottom-right' | 'bottom-left' = 'bottom-right';

const ENDPOINT = `https://${projectId}.supabase.co/functions/v1/make-server-fc841b6e/chat-settings/store_shrman`;

export function useFetchChatSettings(): FetchedChatSettings {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(FALLBACK_SETTINGS);
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>(FALLBACK_POSITION);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        const res = await fetch(ENDPOINT, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        });

        if (!res.ok) {
          console.log(`[FuqahChat] Failed to fetch settings: ${res.status} ${res.statusText}`);
          if (!cancelled) setIsLoaded(true);
          return;
        }

        const data = await res.json();

        if (!data?.success || !data?.settings) {
          console.log('[FuqahChat] Invalid settings response:', data);
          if (!cancelled) setIsLoaded(true);
          return;
        }

        const s = data.settings;

        if (!cancelled) {
          setThemeSettings({
            mode: s.previewMode === 'dark' ? 'dark' : 'light',
            mainColor: s.primaryColor || FALLBACK_SETTINGS.mainColor,
            widgetOuterColor: s.widgetOuter || FALLBACK_SETTINGS.widgetOuterColor,
            widgetInnerColor: s.widgetInner || FALLBACK_SETTINGS.widgetInnerColor,
            welcomeBubbleEnabled:
              typeof s.welcomeBubbleEnabled === 'boolean' ? s.welcomeBubbleEnabled : true,
            welcomeBubbleLine1:
              typeof s.welcomeBubbleLine1 === 'string' && s.welcomeBubbleLine1.trim()
                ? s.welcomeBubbleLine1 : 'مرحباً 👋',
            welcomeBubbleLine2:
              typeof s.welcomeBubbleLine2 === 'string' && s.welcomeBubbleLine2.trim()
                ? s.welcomeBubbleLine2 : 'كيف يمكنني مساعدتك؟',
            inactivityEnabled:
              typeof s.inactivityEnabled === 'boolean' ? s.inactivityEnabled : true,
            inactivityPromptSeconds:
              Number.isFinite(s.inactivityPromptSeconds) ? Number(s.inactivityPromptSeconds) : 90,
            inactivityCloseSeconds:
              Number.isFinite(s.inactivityCloseSeconds) ? Number(s.inactivityCloseSeconds) : 60,
            ratingInactivitySeconds:
              Number.isFinite(s.ratingInactivitySeconds) ? Number(s.ratingInactivitySeconds) : 900,
          });

          setPosition(s.position === 'left' ? 'bottom-left' : 'bottom-right');
          setIsLoaded(true);

          console.log('[FuqahChat] Settings loaded from dashboard:', s);
        }
      } catch (err) {
        console.log('[FuqahChat] Error fetching settings:', err);
        if (!cancelled) setIsLoaded(true);
      }
    }

    fetchSettings();
    return () => { cancelled = true; };
  }, []);

  return { themeSettings, position, isLoaded };
}
