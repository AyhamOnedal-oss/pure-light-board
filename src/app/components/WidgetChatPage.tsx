/**
 * WidgetChatPage — the chat UI loaded inside the storefront iframe
 * (`/widget/chat?tenant_id=...&platform=...&store_id=...`).
 *
 * This is the SINGLE runtime path for the storefront chat. It reuses
 * the React widget components in /widget/src/app so there is only one
 * implementation to maintain.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChatWindow } from '../../../widget/src/app/components/ChatWindow';
import { THEMES, getThemeById, ACTIVE_THEME_ID } from '../../../widget/src/app/types/theme';
import { useFetchChatSettings } from '../../../widget/src/app/hooks/useFetchChatSettings';
import { useFetchStoreBranding } from '../../../widget/src/app/hooks/useFetchStoreBranding';
import type { Message } from '../../../widget/src/app/components/ChatWidget';
import '../../../widget/src/styles/index.css';

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function postParent(type: string, payload?: Record<string, unknown>) {
  try {
    window.parent?.postMessage({ source: 'fuqah-widget', type, ...payload }, '*');
  } catch {
    /* ignore */
  }
}

export function WidgetChatPage() {
  const { themeSettings, position, isLoaded } = useFetchChatSettings();
  const branding = useFetchStoreBranding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>(generateConversationId);

  const theme = useMemo(() => getThemeById(ACTIVE_THEME_ID) ?? THEMES[0], []);

  // Tell the parent (widget-loader bubble) when we are ready / want to close
  useEffect(() => {
    postParent('ready');
  }, []);

  const handleClose = () => {
    setMessages([]);
    setConversationId(generateConversationId());
    postParent('close', { cleared: true });
  };

  const handleReturn = () => {
    postParent('close', { cleared: false });
  };

  if (!isLoaded || !branding.isLoaded) {
    return <div className="w-full h-full bg-white" />;
  }

  // Fill the iframe; ChatWindow positions itself absolutely. We force a
  // contained anchor so it always paints inside the iframe viewport.
  return (
    <div
      className="chat-root"
      style={{ position: 'fixed', inset: 0, background: '#fff' }}
      dir="rtl"
    >
      <div
        style={{
          position: 'absolute',
          right: position === 'bottom-right' ? 0 : 'auto',
          left: position === 'bottom-left' ? 0 : 'auto',
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <ChatWindow
          theme={theme}
          position={position}
          onClose={handleClose}
          onReturnToChat={handleReturn}
          storeName={branding.storeName}
          storeLogo={branding.storeLogo}
          storeIcon={branding.storeIcon}
          storeId={branding.storeName /* unused server-side; conv ties to tenant */}
          conversationId={conversationId}
          onConversationIdChange={setConversationId}
          messages={messages}
          setMessages={setMessages}
          themeSettings={themeSettings}
        />
      </div>
    </div>
  );
}

export default WidgetChatPage;