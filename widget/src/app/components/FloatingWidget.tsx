/**
 * FloatingWidget — Anchors bubble + chat window at a fixed corner.
 *
 * Messages state is lifted here so that "Return to Chat" can close
 * the UI but preserve the conversation for when the user reopens.
 *
 * Each conversation gets a unique conversationId (client-generated placeholder).
 * In production, the backend creates the real ID via POST /conversations
 * and the widget stores it for all subsequent API calls.
 *
 * Platform-aware positioning: automatically detects floating bottom bars
 * on e-commerce platforms (Zid, Salla, Shopify, etc.) and adjusts the
 * widget position smoothly so it never overlaps with them.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { AnimatePresence } from "motion/react";
import { ChatBubble } from "./ChatBubble";
import { ChatWindow } from "./ChatWindow";
import { WelcomeBubble } from "./WelcomeBubble";
import type { Theme } from "../types/theme";
import type { Message } from "./ChatWidget";
import type { ThemeSettings } from "../types/themeSettings";
import { usePlatformBottomBar } from "../hooks/usePlatformBottomBar";
import { trackEvent, startConversation } from "../utils/analytics";

interface FloatingWidgetProps {
  theme: Theme;
  position: "bottom-right" | "bottom-left";
  storeName?: string;
  /** Store logo — wide banner for empty state (recommended 1024×256, max 2MB, jpeg/jpg/png) */
  storeLogo?: string;
  /** Store icon — 32×32px avatar for header and agent messages (max 2MB, jpeg/jpg/png) */
  storeIcon?: string;
  /** Store ID for backend integration */
  storeId?: string;
  /** Theme settings for Light/Dark mode and custom colors */
  themeSettings?: ThemeSettings;
}

const DEFAULT_LOGO =
  "https://images.unsplash.com/photo-1634578198204-a3a28778cfb6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzdG9yZSUyMHNob3AlMjBsb2dvfGVufDF8fHx8MTc3NTk3MTAzNHww&ixlib=rb-4.1.0&q=80&w=1080";

const DEFAULT_ICON = DEFAULT_LOGO;

/**
 * Generate a temporary client-side conversation ID.
 * In production, replace with: await api.createConversation(storeId)
 */
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function FloatingWidget({
  theme,
  position,
  storeName = "Fuqah AI",
  storeLogo,
  storeIcon,
  storeId = "store_default",
  themeSettings,
}: FloatingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Lifted messages state — persists across open/close cycles
  const [messages, setMessages] = useState<Message[]>([]);
  // Conversation ID — generated on first open, reset on full close
  const conversationIdRef = useRef<string>(
    generateConversationId(),
  );
  // Ref for the touch-blocking overlay
  const overlayRef = useRef<HTMLDivElement>(null);

  // Platform-aware bottom offset (detects floating bottom bars on Zid, Salla, etc.)
  const platformBottomOffset = usePlatformBottomBar();

  const evCtx = () => ({ storeId, conversationId: conversationIdRef.current });

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    trackEvent('widget.opened', { storeId, conversationId: conversationIdRef.current });
    if (messages.length === 0) {
      startConversation({ storeId, conversationId: conversationIdRef.current });
    }
  }, [storeId, messages.length]);

  /** Full close — clears conversation and generates new ID for next session */
  const handleFullClose = useCallback(() => {
    trackEvent('widget.closed', evCtx(), { cleared: true });
    setIsOpen(false);
    setMessages([]);
    conversationIdRef.current = generateConversationId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  /** Return to chat — hides UI but keeps messages and conversation ID */
  const handleReturnClose = useCallback(() => {
    trackEvent('widget.closed', evCtx(), { cleared: false });
    setIsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Fire welcome_bubble.shown once per mount when the bubble is visible
  useEffect(() => {
    if (!isOpen && themeSettings?.welcomeBubbleEnabled) {
      trackEvent('welcome_bubble.shown', evCtx());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSettings?.welcomeBubbleEnabled]);

  // ── Block touch events on the overlay (non-passive) ────────────────────
  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !isOpen) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    el.addEventListener("touchstart", block, {
      passive: false,
    });
    return () => {
      el.removeEventListener("touchmove", block);
      el.removeEventListener("touchstart", block);
    };
  }, [isOpen]);

  // ── Lock body scroll while chat is open ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const prev = document.body.style.cssText;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return () => {
      document.body.style.cssText = prev;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const isRight = position === "bottom-right";

  return (
    <div
      className="fixed"
      style={{
        width: "60px",
        height: "60px",
        zIndex: 9999,
        [isRight ? "right" : "left"]: "20px",
        bottom: `${20 + platformBottomOffset}px`,
        transition: "bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Full-screen touch-blocking overlay when chat is open */}
      {isOpen && (
        <div
          ref={overlayRef}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "transparent",
            touchAction: "none",
          }}
        />
      )}

      <AnimatePresence>
        {isOpen && (
          <ChatWindow
            theme={theme}
            position={position}
            onClose={handleFullClose}
            onReturnToChat={handleReturnClose}
            storeName={storeName}
            storeLogo={storeLogo}
            storeIcon={storeIcon}
            storeId={storeId}
            conversationId={conversationIdRef.current}
            messages={messages}
            setMessages={setMessages}
            themeSettings={themeSettings}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && themeSettings?.welcomeBubbleEnabled && (
          <WelcomeBubble
            key="welcome-bubble"
            line1={themeSettings?.welcomeBubbleLine1 || 'مرحباً 👋'}
            line2={themeSettings?.welcomeBubbleLine2 || 'كيف يمكنني مساعدتك؟'}
            position={position}
            isDarkMode={themeSettings?.mode === 'dark'}
            onClick={() => { trackEvent('welcome_bubble.clicked', evCtx()); handleOpen(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <ChatBubble
            theme={theme}
            position={position}
            onClick={handleOpen}
            widgetOuterColor={themeSettings?.widgetOuterColor}
            widgetInnerColor={themeSettings?.widgetInnerColor}
          />
        )}
      </AnimatePresence>
    </div>
  );
}