/**
 * useFetchChatSettings — fetches widget design + behavior from
 * the dashboard's `widget-config` edge function and maps it to ThemeSettings.
 *
 * Edge function returns the row from `settings_chat_design` plus workspace
 * branding fields (workspace_name, logo_url, icon_url, locale).
 */

import { useState, useEffect } from "react";
import type { ThemeSettings } from "../types/themeSettings";
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, getStoreContext, hasContext, buildContextQuery } from "../config/supabase";

export interface FetchedChatSettings {
  themeSettings: ThemeSettings;
  position: "bottom-right" | "bottom-left";
  isLoaded: boolean;
}

const FALLBACK_SETTINGS: ThemeSettings = {
  mode: "light",
  mainColor: "#000000",
  widgetOuterColor: "#000000",
  widgetInnerColor: "#FFFFFF",
};

const FALLBACK_POSITION: "bottom-right" | "bottom-left" = "bottom-right";

export function useFetchChatSettings(): FetchedChatSettings {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(FALLBACK_SETTINGS);
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">(FALLBACK_POSITION);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctx = getStoreContext();
    if (!hasContext(ctx)) {
      console.log("[FuqahChat] No store context available, using defaults");
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
          console.log(`[FuqahChat] widget-config ${res.status}`);
          if (!cancelled) setIsLoaded(true);
          return;
        }
        const s = await res.json();
        if (cancelled) return;

        setThemeSettings({
          mode: s.theme_mode === "dark" || s.preview_mode === "dark" ? "dark" : "light",
          mainColor: s.primary_color || FALLBACK_SETTINGS.mainColor,
          widgetOuterColor: s.widget_outer_color || FALLBACK_SETTINGS.widgetOuterColor,
          widgetInnerColor: s.widget_inner_color || FALLBACK_SETTINGS.widgetInnerColor,
          welcomeBubbleEnabled:
            typeof s.welcome_bubble_enabled === "boolean" ? s.welcome_bubble_enabled : true,
          welcomeBubbleLine1: s.welcome_bubble_line1 || "مرحباً 👋",
          welcomeBubbleLine2: s.welcome_bubble_line2 || "كيف يمكنني مساعدتك؟",
          inactivityEnabled:
            typeof s.inactivity_enabled === "boolean" ? s.inactivity_enabled : true,
          inactivityPromptSeconds: Number.isFinite(s.inactivity_prompt_seconds)
            ? Number(s.inactivity_prompt_seconds)
            : 90,
          inactivityCloseSeconds: Number.isFinite(s.inactivity_close_seconds)
            ? Number(s.inactivity_close_seconds)
            : 60,
          ratingInactivitySeconds: Number.isFinite(s.rating_inactivity_seconds)
            ? Number(s.rating_inactivity_seconds)
            : 900,
        });

        setPosition(s.position === "left" ? "bottom-left" : "bottom-right");
        setIsLoaded(true);
      } catch (err) {
        console.log("[FuqahChat] widget-config error:", err);
        if (!cancelled) setIsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { themeSettings, position, isLoaded };
}
