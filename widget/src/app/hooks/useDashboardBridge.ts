/**
 * useDashboardBridge — Listens for postMessage from Dashboard for live preview
 *
 * When the chat widget is embedded in an iframe inside the dashboard,
 * this hook receives configuration updates in real-time and applies them.
 *
 * Usage in FloatingWidget or App:
 *   const config = useDashboardBridge(onConfigUpdate);
 */

import { useEffect, useCallback } from 'react';
import type {
  DashboardConfig,
  DashboardToWidgetMessage,
  WidgetToDashboardMessage,
} from '../types/dashboardConfig';

type ConfigUpdateHandler = (config: Partial<DashboardConfig>) => void;

export function useDashboardBridge(onConfigUpdate: ConfigUpdateHandler) {
  // Send message to parent (dashboard)
  const sendToDashboard = useCallback((msg: WidgetToDashboardMessage) => {
    if (window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as DashboardToWidgetMessage;
      if (!data || !data.type || !data.type.startsWith('FUQAH_')) return;

      switch (data.type) {
        case 'FUQAH_CONFIG_UPDATE':
          onConfigUpdate(data.payload);
          break;
        case 'FUQAH_THEME_UPDATE':
          onConfigUpdate({
            appearance: data.payload as any,
            bubble: data.payload as any,
          });
          break;
        case 'FUQAH_STORE_UPDATE':
          onConfigUpdate({ store: data.payload as any });
          break;
        case 'FUQAH_FEATURES_UPDATE':
          onConfigUpdate({ features: data.payload as any });
          break;
        case 'FUQAH_RESET_PREVIEW':
          // Dashboard requests full reset — handled by consumer
          onConfigUpdate({});
          break;
      }
    };

    window.addEventListener('message', handler);

    // Notify dashboard that widget is ready
    sendToDashboard({ type: 'FUQAH_WIDGET_READY' });

    return () => window.removeEventListener('message', handler);
  }, [onConfigUpdate, sendToDashboard]);

  return { sendToDashboard };
}
