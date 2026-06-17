/**
 * Fuqah AI Chat Widget — Embeddable Script
 * Version: 4.7.33 (Hostinger embed: instant paint via localStorage cache +
 *                  single round-trip widget-bootstrap. Bubble shows in
 *                  <200ms on repeat visits and ~1 RTT on first visit;
 *                  20s poll + tab-focus live refresh kept from 4.7.32.)
 *
 * Usage:
 *   <script src="https://widget.fuqah.net/widget.js" charset="UTF-8" data-store-id="STORE_ID"></script>
 *
 * The script reads data-store-id, fetches settings + branding from Supabase,
 * then builds the entire chat widget DOM dynamically.
 */
(function () {
  'use strict';
  var FQ_INLINE_CSS = "/**\n * Fuqah AI Chat Widget — Embeddable Styles\n * Version: 3.0.0\n * All classes prefixed with .fq- to avoid conflicts with host page\n */\n\n/* ── Google Fonts ─────────────────────────────────────────────── */\n@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');\n\n/* ── CSS Variables (defaults, overridden by JS) ──────────────── */\n:root {\n  --fq-main-color: #000000;\n  --fq-position: right;\n}\n\n/* ── Reset inside widget ─────────────────────────────────────── */\n.fq-widget-root, .fq-widget-root * {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n.fq-widget-root {\n  font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Arial, sans-serif;\n  font-size: 14px;\n  line-height: 1.5;\n  direction: rtl;\n}\n\n/* ── Scrollbar hidden ────────────────────────────────────────── */\n.fq-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }\n.fq-no-scrollbar::-webkit-scrollbar { display: none; }\n\n.fq-ticket-locked .fq-screen-back { display: none !important; }\n\n/* ── Bubble ──────────────────────────────────────────────────── */\n.fq-bubble {\n  position: fixed;\n  z-index: 2147483646;\n  width: 60px;\n  height: 60px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  padding: 0;\n  border-radius: 50%;\n  transition: transform 0.2s ease, bottom 0.35s cubic-bezier(0.4,0,0.2,1);\n  -webkit-tap-highlight-color: transparent;\n  outline: none;\n}\n.fq-bubble:hover { transform: scale(1.1); }\n.fq-bubble:active { transform: scale(0.9); }\n.fq-bubble.fq-right { right: 20px; }\n.fq-bubble.fq-left { left: 20px; }\n.fq-bubble svg { width: 100%; height: 100%; display: block; }\n\n/* ── Bubble animation ────────────────────────────────────────── */\n@keyframes fq-bubble-in {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}\n@keyframes fq-bubble-out {\n  from { transform: scale(1); opacity: 1; }\n  to { transform: scale(0); opacity: 0; }\n}\n.fq-bubble-enter { animation: fq-bubble-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }\n.fq-bubble-exit { animation: fq-bubble-out 0.2s ease forwards; }\n\n/* ── Chat Window ─────────────────────────────────────────────── */\n.fq-chat-window {\n  position: fixed;\n  z-index: 2147483647;\n  border-radius: 24px;\n  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Arial, sans-serif;\n  transition: bottom 0.35s cubic-bezier(0.4,0,0.2,1);\n}\n/* Desktop positioning */\n.fq-chat-window.fq-right { right: 20px; }\n.fq-chat-window.fq-left { left: 20px; }\n.fq-chat-window.fq-desktop {\n  width: 400px;\n  max-height: 580px;\n}\n/* Mobile — fullscreen */\n.fq-chat-window.fq-mobile {\n  top: 8px;\n  left: 8px;\n  right: 8px;\n  bottom: 8px;\n  width: auto;\n  height: auto;\n  border-radius: 24px;\n}\n\n/* ── Window animation ────────────────────────────────────────── */\n@keyframes fq-window-in {\n  from { opacity: 0; transform: scale(0.6); }\n  to { opacity: 1; transform: scale(1); }\n}\n@keyframes fq-window-out {\n  from { opacity: 1; transform: scale(1); }\n  to { opacity: 0; transform: scale(0.6); }\n}\n.fq-window-enter { animation: fq-window-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }\n.fq-window-exit { animation: fq-window-out 0.2s ease forwards; }\n\n/* ── Touch overlay ───────────────────────────────────────────── */\n.fq-touch-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483645;\n  background: transparent;\n  touch-action: none;\n}\n\n/* ── Header ──────────────────────────────────────────────────── */\n.fq-header {\n  padding: 12px 16px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-shrink: 0;\n  direction: rtl;\n}\n.fq-header-info {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n.fq-header-icon {\n  width: 32px;\n  height: 32px;\n  border-radius: 50%;\n  object-fit: cover;\n  border: 2px solid rgba(255,255,255,0.25);\n  flex-shrink: 0;\n}\n.fq-header-name {\n  font-size: 15px;\n  font-weight: 600;\n  color: #FFFFFF;\n  line-height: 1.3;\n}\n.fq-header-status {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin-top: 2px;\n}\n.fq-header-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: #22c55e;\n  flex-shrink: 0;\n}\n.fq-header-status-text {\n  font-size: 11px;\n  color: rgba(255,255,255,0.6);\n}\n.fq-header-actions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n.fq-header-btn {\n  width: 36px;\n  height: 36px;\n  border: none;\n  background: transparent;\n  color: #FFFFFF;\n  cursor: pointer;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition: background 0.15s;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-header-btn:hover { background: rgba(255,255,255,0.13); }\n\n/* ── Messages area ───────────────────────────────────────────── */\n.fq-messages {\n  flex: 1;\n  overflow-y: auto;\n  padding: 16px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  overscroll-behavior: contain;\n  -webkit-overflow-scrolling: touch;\n  touch-action: pan-y;\n}\n\n/* ── Empty state ─────────────────────────────────────────────── */\n.fq-empty {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  padding: 48px 16px;\n}\n.fq-empty-logo {\n  width: 100%;\n  max-width: 280px;\n  max-height: 80px;\n  object-fit: contain;\n  border-radius: 8px;\n  margin-bottom: 24px;\n}\n.fq-empty-title {\n  font-size: 18px;\n  font-weight: 600;\n  text-align: center;\n  margin-bottom: 8px;\n}\n.fq-empty-subtitle {\n  font-size: 14px;\n  text-align: center;\n  line-height: 1.6;\n}\n\n/* ── Message row ─────────────────────────────────────────────── */\n.fq-msg-row {\n  display: flex;\n  gap: 10px;\n  align-items: flex-start;\n  direction: ltr;\n}\n.fq-msg-row.fq-store { justify-content: flex-start; }\n.fq-msg-row.fq-customer { justify-content: flex-end; }\n\n.fq-msg-avatar {\n  width: 32px;\n  height: 32px;\n  border-radius: 50%;\n  object-fit: cover;\n  border: 2px solid #e5e7eb;\n  flex-shrink: 0;\n  margin-top: 2px;\n}\n\n.fq-msg-content {\n  display: flex;\n  flex-direction: column;\n  max-width: 75%;\n  min-width: 0;\n}\n.fq-msg-row.fq-store .fq-msg-content { align-items: flex-start; }\n.fq-msg-row.fq-customer .fq-msg-content { align-items: flex-end; }\n\n.fq-msg-bubble {\n  padding: 10px 16px;\n  border-radius: 16px;\n  box-shadow: 0 1px 3px rgba(0,0,0,0.08);\n  word-break: break-word;\n  overflow-wrap: break-word;\n  direction: rtl;\n}\n.fq-msg-row.fq-store .fq-msg-bubble { border-top-left-radius: 6px; }\n.fq-msg-row.fq-customer .fq-msg-bubble { border-top-right-radius: 6px; }\n\n.fq-msg-text {\n  font-size: 14px;\n  line-height: 1.6;\n  margin: 0;\n  letter-spacing: 0.01em;\n  white-space: pre-wrap;\n  word-break: break-word;\n  overflow-wrap: break-word;\n}\n.fq-msg-text a {\n  color: #3b82f6;\n  text-decoration: underline;\n  cursor: pointer;\n  word-break: break-all;\n}\n\n/* ── Message attachment ──────────────────────────────────────── */\n.fq-msg-attachment img {\n  max-width: 200px;\n  width: 100%;\n  height: auto;\n  border-radius: 12px;\n  display: block;\n  margin-bottom: 8px;\n}\n.fq-msg-file {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 10px;\n  border-radius: 12px;\n  background: rgba(255,255,255,0.15);\n  margin-bottom: 8px;\n}\n.fq-msg-file-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.fq-msg-file-size { font-size: 11px; opacity: 0.6; }\n.fq-msg-file-dl {\n  padding: 4px;\n  border-radius: 50%;\n  background: rgba(255,255,255,0.2);\n  border: none;\n  cursor: pointer;\n  flex-shrink: 0;\n  display: flex;\n  text-decoration: none;\n  color: inherit;\n}\n\n/* ── Feedback (thumbs) ───────────────────────────────────────── */\n.fq-feedback {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding-top: 3px;\n}\n.fq-feedback-btn {\n  padding: 4px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  border-radius: 50%;\n  transition: background 0.15s;\n  display: flex;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-feedback-btn:hover { background: #f3f4f6; }\n.fq-feedback-btn svg { width: 14px; height: 14px; stroke-width: 2; }\n\n/* ── Ticket success badge ────────────────────────────────────── */\n.fq-ticket-success {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 10px 16px;\n  border-radius: 16px;\n  border-top-left-radius: 6px;\n  font-size: 13px;\n  color: #16a34a;\n  direction: rtl;\n}\n\n/* ── Typing indicator ────────────────────────────────────────── */\n.fq-typing-row {\n  display: flex;\n  gap: 10px;\n  align-items: flex-start;\n  direction: ltr;\n}\n.fq-typing-bubble {\n  padding: 12px 16px;\n  border-radius: 16px;\n  border-top-left-radius: 6px;\n  display: flex;\n  gap: 4px;\n  align-items: center;\n}\n.fq-typing-dot {\n  width: 8px;\n  height: 8px;\n  background: #FFFFFF;\n  border-radius: 50%;\n  opacity: 0.85;\n  animation: fq-bounce 0.6s infinite alternate;\n}\n.fq-typing-dot:nth-child(2) { animation-delay: 0.15s; }\n.fq-typing-dot:nth-child(3) { animation-delay: 0.3s; }\n@keyframes fq-bounce {\n  from { transform: translateY(0); }\n  to { transform: translateY(-6px); }\n}\n\n/* ── Input area ──────────────────────────────────────────────── */\n.fq-input-area {\n  padding: 10px 14px 12px;\n  flex-shrink: 0;\n}\n.fq-input-row {\n  display: flex;\n  align-items: flex-end;\n  gap: 8px;\n  border-radius: 24px;\n  padding: 5px 5px 5px 8px;\n  direction: ltr;\n}\n.fq-attach-btn {\n  width: 34px;\n  height: 34px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n  transition: background 0.15s;\n  color: #9ca3af;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-attach-btn:hover { background: rgba(0,0,0,0.05); }\n.fq-attach-btn:disabled { opacity: 0.5; cursor: not-allowed; }\n.fq-msg-textarea {\n  flex: 1;\n  background: transparent;\n  border: none;\n  outline: none;\n  resize: none;\n  font-size: 16px;\n  line-height: 1.5;\n  max-height: 120px;\n  min-height: 34px;\n  padding: 6px 0;\n  font-family: inherit;\n  direction: rtl;\n  touch-action: manipulation;\n}\n.fq-msg-textarea::placeholder { color: #9ca3af; }\n.fq-send-btn {\n  width: 36px;\n  height: 36px;\n  border: none;\n  border-radius: 50%;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n  transition: all 0.2s ease;\n  color: #FFFFFF;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }\n\n/* ── Attachment preview ──────────────────────────────────────── */\n.fq-attach-preview {\n  margin-bottom: 8px;\n  padding: 12px;\n  border-radius: 12px;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  direction: ltr;\n}\n.fq-attach-preview img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }\n.fq-attach-preview-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.fq-attach-preview-size { font-size: 11px; color: #9ca3af; }\n.fq-attach-remove {\n  padding: 4px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  border-radius: 50%;\n  flex-shrink: 0;\n  display: flex;\n  transition: background 0.15s;\n  color: #6b7280;\n}\n.fq-attach-remove:hover { background: rgba(0,0,0,0.08); }\n\n/* ── Footer ──────────────────────────────────────────────────── */\n.fq-footer {\n  padding: 6px 14px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  direction: ltr;\n  flex-shrink: 0;\n  user-select: none;\n}\n.fq-footer-logo { width: 16px; height: 16px; flex-shrink: 0; }\n.fq-footer-link {\n  font-size: 10.5px;\n  letter-spacing: 0.01em;\n  white-space: nowrap;\n  direction: rtl;\n  text-decoration: none;\n  cursor: pointer;\n  transition: color 0.15s ease;\n}\n.fq-footer-link strong { font-weight: 600; }\n\n/* ── Confirmation modal ──────────────────────────────────────── */\n.fq-modal-overlay {\n  position: fixed;\n  inset: 0;\n  background: rgba(0,0,0,0.5);\n  z-index: 2147483647;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 16px;\n  touch-action: none;\n  font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Arial, sans-serif;\n  direction: rtl;\n}\n.fq-modal-card {\n  width: 100%;\n  max-width: 340px;\n  border-radius: 16px;\n  overflow: hidden;\n  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);\n}\n.fq-modal-accent { height: 4px; }\n.fq-modal-body { padding: 24px; }\n.fq-modal-close-row { display: flex; justify-content: flex-end; margin-bottom: 4px; }\n.fq-modal-close-btn {\n  padding: 6px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  border-radius: 50%;\n  display: flex;\n  transition: background 0.15s;\n}\n.fq-modal-center { text-align: center; margin-bottom: 24px; }\n.fq-modal-icon-wrap {\n  width: 56px;\n  height: 56px;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  margin: 0 auto 16px;\n}\n.fq-modal-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }\n.fq-modal-desc { font-size: 13px; line-height: 1.7; }\n.fq-modal-actions { display: flex; flex-direction: column; gap: 10px; }\n.fq-modal-btn {\n  width: 100%;\n  padding: 12px 16px;\n  border-radius: 12px;\n  font-size: 14px;\n  font-weight: 700;\n  border: none;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  transition: all 0.15s;\n  font-family: inherit;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-modal-btn:active { transform: scale(0.98); }\n.fq-modal-btn-secondary {\n  font-size: 13px;\n  font-weight: 600;\n  border: 1.5px solid;\n}\n.fq-modal-btn-tertiary {\n  font-size: 13px;\n  font-weight: 600;\n  border: 1.5px solid;\n  background: transparent;\n}\n\n/* ── Rating screen ───────────────────────────────────────────── */\n.fq-screen {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  direction: rtl;\n}\n.fq-screen-accent { height: 4px; flex-shrink: 0; }\n.fq-screen-header {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 12px 16px;\n  flex-shrink: 0;\n}\n.fq-screen-back {\n  padding: 6px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  border-radius: 50%;\n  display: flex;\n  transition: background 0.15s;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-screen-title { font-size: 15px; font-weight: 700; }\n.fq-screen-body {\n  flex: 1;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n.fq-screen-actions {\n  flex-shrink: 0;\n  padding: 8px 24px 16px;\n}\n.fq-screen-btn {\n  width: 100%;\n  padding: 12px;\n  border-radius: 12px;\n  font-size: 14px;\n  font-weight: 700;\n  border: none;\n  cursor: pointer;\n  font-family: inherit;\n  transition: all 0.15s;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-screen-btn:hover { opacity: 0.9; }\n.fq-screen-btn:active { transform: scale(0.98); }\n.fq-screen-btn:disabled { opacity: 0.35; cursor: not-allowed; }\n.fq-screen-btn-secondary {\n  width: 100%;\n  padding: 10px;\n  border-radius: 12px;\n  font-size: 13px;\n  font-weight: 500;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  margin-top: 8px;\n  font-family: inherit;\n  transition: all 0.15s;\n}\n\n/* ── Stars ────────────────────────────────────────────────────── */\n.fq-stars {\n  display: flex;\n  gap: 8px;\n  margin-bottom: 8px;\n}\n.fq-star {\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  padding: 0;\n  transition: transform 0.15s;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-star:hover { transform: scale(1.1); }\n.fq-star:active { transform: scale(0.95); }\n.fq-star svg { width: 36px; height: 36px; transition: all 0.15s; }\n\n/* ── Ticket form (inline + fullscreen) ───────────────────────── */\n.fq-phone-row {\n  display: flex;\n  align-items: center;\n  border-radius: 12px;\n  overflow: visible;\n  direction: ltr;\n  transition: border-color 0.15s;\n}\n.fq-country-btn {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 0 10px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  min-width: 80px;\n  font-family: inherit;\n  -webkit-tap-highlight-color: transparent;\n}\n.fq-country-code { font-size: 13px; font-weight: 600; flex: 1; text-align: left; }\n.fq-country-chevron { transition: transform 0.15s; flex-shrink: 0; }\n.fq-country-chevron.fq-open { transform: rotate(180deg); }\n.fq-country-dropdown {\n  position: absolute;\n  top: 100%;\n  left: 0;\n  margin-top: 4px;\n  width: 220px;\n  z-index: 1000;\n  max-height: 220px;\n  overflow-y: auto;\n  border-radius: 12px;\n  box-shadow: 0 20px 40px -4px rgba(0,0,0,0.15);\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior: contain;\n  touch-action: pan-y;\n}\n.fq-country-item {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 14px;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  text-align: left;\n  font-family: inherit;\n  transition: background 0.1s;\n}\n.fq-country-item-name { font-size: 13px; font-weight: 500; }\n.fq-country-item-dial { font-size: 12px; margin-left: auto; }\n.fq-phone-input {\n  flex: 1;\n  border: none;\n  background: transparent;\n  outline: none;\n  padding: 12px;\n  font-size: 16px;\n  letter-spacing: 0.04em;\n  min-width: 0;\n  font-family: inherit;\n  direction: ltr;\n}\n.fq-phone-error { font-size: 12px; color: #ef4444; margin-top: 6px; }\n\n/* ── Inline ticket form ──────────────────────────────────────── */\n.fq-inline-ticket {\n  border-radius: 16px;\n  padding: 12px;\n  margin-top: 8px;\n  width: 270px;\n  direction: ltr;\n}\n.fq-inline-ticket .fq-phone-row { margin-bottom: 8px; height: 44px; }\n.fq-inline-ticket .fq-country-btn { min-width: 82px; gap: 6px; height: 100%; padding: 0 10px; }\n.fq-inline-ticket .fq-country-code { font-size: 12px; line-height: 1; }\n.fq-inline-ticket .fq-phone-input { padding: 0 12px; font-size: 15px; height: 100%; text-align: left; line-height: 1; letter-spacing: 0.02em; }\n.fq-inline-submit {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 9px 12px;\n  border-radius: 12px;\n  border: none;\n  cursor: pointer;\n  font-size: 13px;\n  font-weight: 700;\n  font-family: inherit;\n  transition: all 0.15s;\n}\n.fq-inline-submit:hover { opacity: 0.9; }\n.fq-inline-submit:active { transform: scale(0.98); }\n\n/* ── Ticket created screen ───────────────────────────────────── */\n.fq-ticket-card {\n  width: 100%;\n  border-radius: 16px;\n  padding: 16px;\n  margin-bottom: 24px;\n}\n.fq-ticket-card-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n.fq-ticket-card-row + .fq-ticket-card-row { margin-top: 12px; }\n.fq-ticket-card-row:first-child { padding-bottom: 12px; margin-bottom: 0; }\n.fq-ticket-label { font-size: 13px; display: flex; align-items: center; gap: 8px; }\n.fq-ticket-badge {\n  padding: 4px 12px;\n  border-radius: 999px;\n  font-size: 13px;\n  font-weight: 700;\n}\n.fq-ticket-status {\n  padding: 4px 12px;\n  border-radius: 999px;\n  font-size: 12px;\n  font-weight: 600;\n  color: #16a34a;\n}\n.fq-ticket-value { font-size: 13px; font-weight: 600; }\n.fq-dl-btn {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 10px;\n  border-radius: 12px;\n  font-size: 13px;\n  font-weight: 500;\n  background: transparent;\n  cursor: pointer;\n  font-family: inherit;\n  margin-top: 10px;\n  transition: all 0.15s;\n}\n\n/* ── Country flag SVG ────────────────────────────────────────── */\n.fq-flag {\n  flex-shrink: 0 !important;\n  border-radius: 3px !important;\n  overflow: hidden !important;\n  display: inline-block !important;\n  object-fit: cover !important;\n  object-position: center !important;\n  align-self: center !important;\n  vertical-align: middle !important;\n  padding: 0 !important;\n  margin: 0 !important;\n  border: 0 !important;\n  position: static !important;\n  transform: none !important;\n}\n\n/* ── Thank you animation ─────────────────────────────────────── */\n.fq-thankyou {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  padding: 32px;\n  direction: rtl;\n}\n.fq-thankyou-emoji { font-size: 56px; line-height: 1; margin-bottom: 20px; }\n\n/* ── Welcome bubble (above floating bubble) ───────────────────────── */\n.fq-welcome-bubble {\n  position: fixed;\n  width: max-content;\n  max-width: min(180px, calc(100vw - 40px));\n  padding: 7px 22px 7px 10px;\n  border-radius: 14px;\n  cursor: pointer;\n  direction: rtl;\n  white-space: nowrap;\n  user-select: none;\n  z-index: 10000;\n  -webkit-tap-highlight-color: transparent;\n  font-family: 'IBM Plex Sans Arabic', sans-serif;\n  opacity: 0;\n  transform: translateY(6px) scale(0.92);\n  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);\n}\n.fq-welcome-right { right: 22px; }\n.fq-welcome-left  { left: 22px; }\n.fq-welcome-visible { opacity: 1; transform: translateY(0) scale(1); }\n.fq-welcome-l1 {\n  display: block;\n  font-size: 12px;\n  font-weight: 700;\n  line-height: 1.25;\n}\n.fq-welcome-l2 {\n  display: block;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 1.3;\n  margin-top: 1px;\n}\n.fq-welcome-close {\n  position: absolute;\n  top: 3px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  border: none;\n  background: transparent;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0;\n}\n.fq-welcome-right .fq-welcome-close { left: 3px; }\n.fq-welcome-left  .fq-welcome-close { right: 3px; }\n.fq-welcome-tail {\n  position: absolute;\n  bottom: -5px;\n  width: 10px;\n  height: 10px;\n  transform: rotate(45deg);\n}\n.fq-welcome-right .fq-welcome-tail { right: 18px; }\n.fq-welcome-left  .fq-welcome-tail { left: 18px; }\n\n/* ── Inactivity prompt (inline in messages area) ──────────────────── */\n.fq-inactivity {\n  border-radius: 14px;\n  padding: 14px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  align-items: stretch;\n  direction: rtl;\n  animation: fqFadeUp 0.25s ease;\n}\n@keyframes fqFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n.fq-inactivity-head { display: flex; flex-direction: column; gap: 2px; text-align: center; }\n.fq-inactivity-title { font-size: 14px; font-weight: 600; }\n.fq-inactivity-sub { font-size: 12px; }\n.fq-inactivity-actions { display: flex; gap: 8px; }\n.fq-inactivity-continue,\n.fq-inactivity-end {\n  flex: 1;\n  border-radius: 10px;\n  padding: 10px 12px;\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  font-family: inherit;\n  border: none;\n  transition: opacity 0.15s, transform 0.1s;\n}\n.fq-inactivity-end { background: transparent; }\n.fq-inactivity-continue:hover, .fq-inactivity-end:hover { opacity: 0.9; }\n.fq-inactivity-continue:active, .fq-inactivity-end:active { transform: scale(0.98); }\n\n\n/* === appended overrides (style.css) === */\n/* ========================================\n   Messages Area — ALWAYS WHITE background\n   Scrollbar hidden in ALL browsers\n   ======================================== */\n\n/* Wrapper clips the scrollbar completely */\n.chat-widget-messages-wrapper {\n    flex: 1;\n    overflow: hidden;\n    position: relative;\n    background: #FFFFFF; /* always white — all 7 themes */\n}\n\n.chat-widget-messages {\n    position: absolute;\n    inset: 0;\n    /* Shift left so scrollbar is clipped by wrapper's overflow:hidden */\n    right: 0;\n    left: -20px;\n    overflow-y: scroll;\n    padding: 16px 16px 16px 36px;\n    display: flex;\n    flex-direction: column;\n    gap: 12px;\n    background: #FFFFFF; /* always white */\n    scroll-behavior: auto;\n\n    /* Firefox */\n    scrollbar-width: none;\n    /* IE/Edge */\n    -ms-overflow-style: none;\n\n    /* Prevent scroll from leaking to background page */\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n    touch-action: pan-y;\n}";


  // ═══════════════════════════════════════════════════════════════════
  // 1. READ CONFIG FROM SCRIPT TAG
  // ═══════════════════════════════════════════════════════════════════
  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  function detectPlatform() {
    try {
      if (window.salla && window.salla.config && typeof window.salla.config.get === 'function') {
        var sid = window.salla.config.get('store.id');
        if (sid) return 'salla';
      }
      if (window.Salla && window.Salla.config && window.Salla.config.store && window.Salla.config.store.id) return 'salla';
    } catch (e) {}
    try {
      if (window.zid && window.zid.store_uuid) return 'zid';
      if (document.querySelector('meta[name="zid-store-id"], meta[name="store-uuid"]')) return 'zid';
    } catch (e) {}
    return scriptTag.getAttribute('data-platform') || 'zid';
  }

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUuid(v) { return typeof v === 'string' && UUID_RE.test(v); }
  function cleanAttr(v) {
    if (v == null) return '';
    v = String(v).trim();
    // Skip unrendered Liquid placeholders like "{{store.id}}"
    if (v.indexOf('{{') !== -1) return '';
    return v;
  }

  // Returns { store_id, store_uuid } — store_id is numeric/short, store_uuid is a UUID.
  function detectStoreIds(platform) {
    var sidAttr = cleanAttr(scriptTag.getAttribute('data-store-id') || scriptTag.getAttribute('data-external-id'));
    var suidAttr = cleanAttr(scriptTag.getAttribute('data-store-uuid'));
    var sid = '';
    var suid = '';
    if (suidAttr && isUuid(suidAttr)) suid = suidAttr;
    if (sidAttr) {
      if (isUuid(sidAttr)) { if (!suid) suid = sidAttr; }
      else { sid = sidAttr; }
    }
    if (sid || suid) return { store_id: sid || null, store_uuid: suid || null };

    try {
      if (platform === 'salla' && window.salla && window.salla.config && typeof window.salla.config.get === 'function') {
        var s1 = window.salla.config.get('store.id');
        if (s1) return { store_id: String(s1), store_uuid: null };
      }
      if (platform === 'salla' && window.Salla && window.Salla.config && window.Salla.config.store && window.Salla.config.store.id) {
        return { store_id: String(window.Salla.config.store.id), store_uuid: null };
      }
    } catch (e) {}

    try {
      if (window.zid) {
        if (window.zid.store_id) sid = String(window.zid.store_id);
        if (window.zid.store_uuid) suid = String(window.zid.store_uuid);
      }
      if (!sid) {
        var mNum = document.querySelector('meta[name="zid-merchant-id"], meta[name="zid-store-numeric-id"]');
        if (mNum && mNum.content) sid = String(mNum.content).trim();
      }
      if (!suid) {
        var mUuid = document.querySelector('meta[name="store-uuid"], meta[name="zid-store-uuid"]');
        if (mUuid && mUuid.content) suid = String(mUuid.content).trim();
      }
      // legacy meta — may hold either numeric or uuid
      if (!sid && !suid) {
        var mLegacy = document.querySelector('meta[name="zid-store-id"]');
        if (mLegacy && mLegacy.content) {
          var mv = String(mLegacy.content).trim();
          if (isUuid(mv)) suid = mv; else sid = mv;
        }
      }
    } catch (e) {}

    try {
      var sp = new URLSearchParams(window.location.search);
      if (!sid) {
        var spSid = sp.get('store_id') || sp.get('external_id') || sp.get('tenant_id');
        if (spSid && !isUuid(spSid)) sid = spSid;
        else if (spSid && !suid) suid = spSid;
      }
      if (!suid) {
        var spSuid = sp.get('store_uuid');
        if (spSuid && isUuid(spSuid)) suid = spSuid;
      }
    } catch (e) {}

    if (!sid && !suid) sid = 'default';
    return { store_id: sid || null, store_uuid: suid || null };
  }

  var PLATFORM = detectPlatform();
  var __ids = detectStoreIds(PLATFORM);
  var STORE_ID = __ids.store_id;
  var STORE_UUID = __ids.store_uuid;
  // Best identifier for tenant resolution (legacy paths expect a non-null string)
  var STORE_EXTERNAL_ID = STORE_ID || STORE_UUID || 'default';
  // Root domain of the storefront — used as a last-resort tenant identifier
  // when the snippet didn't render {{store.id}} / {{store.uuid}}.
  var STORE_DOMAIN = (function () {
    try {
      var h = (window.location && window.location.hostname) || '';
      return h ? h.replace(/^www\./i, '').toLowerCase() : '';
    } catch (e) { return ''; }
  })();
  console.log('[Fuqah] Loader starting, platform=' + PLATFORM + ' storeId=' + STORE_ID + ' storeUuid=' + STORE_UUID + ' domain=' + STORE_DOMAIN);
  if (PLATFORM === 'zid' && !STORE_ID) {
    console.info('[Fuqah] Note: numeric store.id not provided by snippet (Liquid likely did not render data-store-id). Will resolve via UUID/domain and backfill from backend.');
  }

  // Capture Zid storefront customer (window.customer / window.customerAsync).
  // Per https://docs.zid.sa/doc-649611 this is the only reliable global
  // exposed to App-injected snippets at page load.
  function snapshotZidCustomer() {
    try {
      var c = window.customer;
      if (c && (c.id || c.email || c.mobile)) {
        return {
          id: c.id != null ? String(c.id) : null,
          name: c.name || [c.firstname, c.lastname].filter(Boolean).join(' ') || null,
          email: c.email || null,
          mobile: c.mobile || null,
        };
      }
    } catch (e) {}
    return null;
  }
  var ZID_CUSTOMER = snapshotZidCustomer();
  try {
    if (!ZID_CUSTOMER && window.customerAsync && typeof window.customerAsync.then === 'function') {
      window.customerAsync.then(function () { ZID_CUSTOMER = snapshotZidCustomer(); }).catch(function () {});
    }
  } catch (e) {}
  var BASE_URL = (function () {
    var src = scriptTag.getAttribute('src') || '';
    var idx = src.lastIndexOf('/');
    return idx > 0 ? src.substring(0, idx) : '.';
  })();
  console.log('[Fuqah] BASE_URL=' + BASE_URL);

  // Supabase config
  var SUPABASE_PROJECT = 'kdrcgusinkqgwaafcgnw';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcmNndXNpbmtxZ3dhYWZjZ253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDg1NzEsImV4cCI6MjA5Mjg4NDU3MX0.90d40LUVe1yqZMtHlDCq6RDlSLYpyrdrTb-On4zsfg0';
  var FUNCTIONS_BASE = 'https://' + SUPABASE_PROJECT + '.supabase.co/functions/v1';
  var REST_BASE = 'https://' + SUPABASE_PROJECT + '.supabase.co/rest/v1';
  var TENANT_ID = null;
  var AUTH_HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY };
  var REST_HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // v4.7.33 — instant-paint cache key (per platform/external_id)
  var FQ_CACHE_KEY = 'fuqah_widget_cache_' + PLATFORM + '_' + (STORE_EXTERNAL_ID || 'default');

  // ── Direct Supabase REST helpers ─────────────────────────────────
  function isUuid(v) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }

  function restCreateTicket(payload, cb) {
    // v3.7: create tickets through the widget-events edge function.
    // Direct REST inserts from storefront browsers are blocked by RLS, so using
    // the service-role-backed endpoint is the correct storefront path.
    var convId = isUuid(payload.conversation_id) ? payload.conversation_id : null;
    var body = {
      event: 'ticket.created',
      platform: PLATFORM,
      store_id: STORE_ID,
      store_uuid: STORE_UUID,
      domain: STORE_DOMAIN,
      tenant_id: TENANT_ID,
      conversation_id: convId,
      payload: {
        subject: payload.subject || 'تذكرة من المتجر',
        message: payload.description || payload.message || '',
        phone: payload.customer_phone || payload.phone || null,
        customer_name: payload.customer_name || null,
      },
    };
    fetch(FUNCTIONS_BASE + '/widget-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then(function (r) {
        return r.text().then(function (txt) {
          var data = {};
          try { data = txt ? JSON.parse(txt) : {}; } catch (_) { data = { message: txt }; }
          if (!r.ok || data.ok === false) {
            console.warn('[Fuqah] ticket create HTTP ' + r.status + ':', data);
            cb && cb(null, { status: r.status, message: data.message || data.error || ('HTTP ' + r.status), code: data.code || null });
            return null;
          }
          return data;
        });
      })
      .then(function (data) {
        if (!data) return;
        var code = data.display_code || (data.ticket_number ? 'TKT-' + data.ticket_number : null);
        if (code) state.ticketId = '#' + code;
        cb && cb({ id: data.ticket_id, number: data.ticket_number, display_code: code }, null);
      })
      .catch(function (e) {
        console.warn('[Fuqah] ticket create failed:', e && e.message || e);
        cb && cb(null, { message: (e && e.message) || 'network error' });
      });
  }

  // v4.7.25 — route through widget-events (service-role) so RLS doesn't drop the write
  function restSubmitRating(rating, comment) {
    if (!state.conversationId) return;
    var body = JSON.stringify({
      event: 'rating.submitted',
      tenant_id: TENANT_ID,
      platform: PLATFORM,
      store_id: STORE_ID,
      conversation_id: state.conversationId,
      payload: { stars: rating, comment: comment || null },
    });
    try {
      fetch(FUNCTIONS_BASE + '/widget-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        },
        body: body,
        keepalive: true,
      }).catch(function (e) { console.warn('[Fuqah] rating submit failed:', e && e.message || e); });
    } catch (e) {}
  }

  function restCloseConversation(reason) {
    if (!state.conversationId) return;
    var map = {
      customer_manual: 'manual',
      ai_request: 'ai',
      idle: 'inactivity',
      rating_skip: 'rating_skip',
      inactivity_manual: 'inactivity',
    };
    var widgetReason = map[reason] || 'manual';
    var body = JSON.stringify({
      event: 'conversation.closed',
      tenant_id: TENANT_ID,
      platform: PLATFORM,
      store_id: STORE_ID,
      conversation_id: state.conversationId,
      payload: { reason: widgetReason },
    });
    // sendBeacon survives tab close; falls back to keepalive fetch.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        var blob = new Blob([body], { type: 'text/plain' });
        if (navigator.sendBeacon(FUNCTIONS_BASE + '/widget-events', blob)) return;
      } catch (e) {}
    }
    try {
      fetch(FUNCTIONS_BASE + '/widget-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        },
        body: body,
        keepalive: true,
      }).catch(function (e) { console.warn('[Fuqah] close sync failed:', e && e.message || e); });
    } catch (e) {}
  }

  // v4.7.25 — thumbs up/down feedback on AI bubbles
  function sendMessageFeedback(messageId, value) {
    if (!state.conversationId || !messageId) return;
    try {
      fetch(FUNCTIONS_BASE + '/widget-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          event: 'message.feedback',
          tenant_id: TENANT_ID,
          platform: PLATFORM,
          store_id: STORE_ID,
          conversation_id: state.conversationId,
          payload: { messageId: messageId, feedback: value },
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function restLoadHistory(cb) {
    if (!state.conversationId) { cb && cb([]); return; }
    var url = REST_BASE + '/conversations_messages?conversation_id=eq.' + encodeURIComponent(state.conversationId)
      + '&order=created_at.asc&limit=50&select=id,sender,body,created_at,kind';
    fetch(url, { headers: AUTH_HEADERS })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { cb && cb(rows || []); })
      .catch(function () { cb && cb([]); });
  }

  function persistConversationId(id) {
    try { if (id) localStorage.setItem('fuqah_conversation_id', id); } catch (e) {}
  }
  function loadPersistedConversationId() {
    try { return localStorage.getItem('fuqah_conversation_id') || null; } catch (e) { return null; }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. DEFAULT SETTINGS (fallback if API fails)
  // ═══════════════════════════════════════════════════════════════════
  var settings = {
    bubbleVisible: true,
    mode: 'light',
    mainColor: '#000000',
    widgetOuterColor: '#000000',
    widgetInnerColor: '#FFFFFF',
    position: 'bottom-right',
    storeName: 'Fuqah AI',
    storeLogo: null,
    storeIcon: null,
    welcomeBubbleEnabled: true,
    welcomeBubbleLine1: 'مرحباً 👋',
    welcomeBubbleLine2: 'كيف يمكنني مساعدتك؟',
    inactivityEnabled: true,
    inactivityPromptSeconds: 90,
    inactivityCloseSeconds: 60,
    ratingInactivitySeconds: 120,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. COLOR PALETTES
  // ═══════════════════════════════════════════════════════════════════
  var LIGHT = {
    chatBg: '#FFFFFF', chatBorder: '#e5e7eb', msgBg: '#FFFFFF',
    userBubbleBg: '#f3f4f6', userBubbleText: '#1f2937',
    inputBg: '#FFFFFF', inputRowBg: '#f3f4f6', inputBorder: '#e5e7eb',
    inputText: '#1f2937', inputPlaceholder: '#9ca3af',
    primaryText: '#1f2937', secondaryText: '#6b7280',
    footerBg: '#f9fafb', footerBorder: '#e5e7eb', footerText: '#9ca3af', footerBrand: '#6b7280',
  };
  var DARK = {
    chatBg: '#1e293b', chatBorder: '#334155', msgBg: '#1e293b',
    userBubbleBg: '#334155', userBubbleText: '#f1f5f9',
    inputBg: '#0f172a', inputRowBg: '#0f172a', inputBorder: '#334155',
    inputText: '#f1f5f9', inputPlaceholder: '#64748b',
    primaryText: '#f1f5f9', secondaryText: '#94a3b8',
    footerBg: '#0f172a', footerBorder: '#334155', footerText: '#64748b', footerBrand: '#94a3b8',
  };

  function mc() { return settings.mode === 'dark' ? DARK : LIGHT; }
  function isDark() { return settings.mode === 'dark'; }

  // ═══════════════════════════════════════════════════════════════════
  // 4. PHONE VALIDATION
  // ═══════════════════════════════════════════════════════════════════
  var PHONE_RULES = {
    SA: { prefixes: ['05'], length: 10, error: 'رقم السعودية يجب أن يبدأ بـ 05 ويتكون من 10 أرقام' },
    AE: { prefixes: ['05','04','02','03','06','07','09'], length: 10, error: 'رقم الإمارات يجب أن يبدأ بـ 05 ويتكون من 10 أرقام' },
    KW: { prefixes: ['5','6','9'], length: 8, error: 'رقم الكويت يجب أن يبدأ بـ 5 أو 6 أو 9 ويتكون من 8 أرقام' },
    QA: { prefixes: ['3','5','6','7'], length: 8, error: 'رقم قطر يجب أن يتكون من 8 أرقام' },
    BH: { prefixes: ['3','6'], length: 8, error: 'رقم البحرين يجب أن يبدأ بـ 3 أو 6 ويتكون من 8 أرقام' },
    OM: { prefixes: ['7','9'], length: 8, error: 'رقم عُمان يجب أن يبدأ بـ 7 أو 9 ويتكون من 8 أرقام' },
    YE: { prefixes: ['7'], length: 9, error: 'رقم اليمن يجب أن يبدأ بـ 7 ويتكون من 9 أرقام' },
    IQ: { prefixes: ['07'], length: 11, error: 'رقم العراق يجب أن يبدأ بـ 07 ويتكون من 11 رقماً' },
    JO: { prefixes: ['07'], length: 10, error: 'رقم الأردن يجب أن يبدأ بـ 07 ويتكون من 10 أرقام' },
    EG: { prefixes: ['01'], length: 11, error: 'رقم مصر يجب أن يبدأ بـ 01 ويتكون من 11 رقماً' },
  };
  var COUNTRIES = [
    { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', placeholder: '05xxxxxxxx' },
    { code: 'AE', name: 'UAE', dialCode: '+971', placeholder: '05xxxxxxxx' },
    { code: 'KW', name: 'Kuwait', dialCode: '+965', placeholder: '5xxxxxxxx' },
    { code: 'QA', name: 'Qatar', dialCode: '+974', placeholder: '3xxxxxxxx' },
    { code: 'BH', name: 'Bahrain', dialCode: '+973', placeholder: '3xxxxxxxx' },
    { code: 'OM', name: 'Oman', dialCode: '+968', placeholder: '9xxxxxxxx' },
    { code: 'YE', name: 'Yemen', dialCode: '+967', placeholder: '7xxxxxxxx' },
    { code: 'IQ', name: 'Iraq', dialCode: '+964', placeholder: '7xxxxxxxx' },
    { code: 'JO', name: 'Jordan', dialCode: '+962', placeholder: '7xxxxxxxx' },
    { code: 'EG', name: 'Egypt', dialCode: '+20', placeholder: '01xxxxxxxx' },
  ];

  function validatePhone(countryCode, rawPhone) {
    var cleaned = rawPhone.replace(/\D/g, '');
    var rule = PHONE_RULES[countryCode];
    if (!rule) return cleaned.length >= 7 ? { valid: true, error: '' } : { valid: false, error: 'يرجى إدخال رقم هاتف صحيح' };
    if (cleaned.length !== rule.length) return { valid: false, error: rule.error };
    var ok = rule.prefixes.some(function (p) { return cleaned.indexOf(p) === 0; });
    if (!ok) return { valid: false, error: rule.error };
    return { valid: true, error: '' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. STATE
  // ═══════════════════════════════════════════════════════════════════
  var state = {
    isOpen: false,
    messages: [],
    isTyping: false,
    currentScreen: 'chat', // chat | ticket-form | ticket-created | rating
    showModal: false,
    ticketCreated: false,
    ticketSource: 'form',
    ticketId: '#TKT-' + Math.floor(10000 + Math.random() * 90000),
    conversationId: 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    attachment: null,
    rating: 0,
    hoveredRating: 0,
    feedback: '',
    bottomOffset: 0,
    showInactivityPrompt: false,
    inactivityActivityBump: 0,
    inactivityPromptTimer: null,
    inactivityCloseTimer: null,
    ratingInactivityTimer: null,
    messageFeedback: {},
    welcomeBubbleDismissed: false,
    pendingTicketTimer: null,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 6. UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function isMobile() { return window.innerWidth < 640; }
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function svg(html, w, h) {
    var wrap = el('span');
    wrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w || 20) + '" height="' + (h || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + html + '</svg>';
    return wrap.firstChild;
  }

  // URL detection in text
  var URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  var IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?[^\s]*)?$/i;
  var IMG_HOST_RE = /(media\.zid\.store|cdn\.salla\.sa|cdn\.youcan\.shop|images\.unsplash\.com|picsum\.photos|cloudinary\.com|imgur\.com)/i;
  function isImgUrl(u) {
    try {
      var url = u.indexOf('http') === 0 ? u : 'https://' + u;
      var p = new URL(url);
      return IMG_EXT_RE.test(p.pathname) || IMG_HOST_RE.test(p.hostname);
    } catch (e) { return false; }
  }
  function textWithLinks(text) {
    var parts = text.split(URL_RE);
    var frag = document.createDocumentFragment();
    parts.forEach(function (part) {
      if (part.match(URL_RE)) {
        var href = part.indexOf('http') === 0 ? part : 'https://' + part;
        if (isImgUrl(part)) {
          var aImg = el('a');
          aImg.href = href;
          aImg.target = '_blank';
          aImg.rel = 'noopener noreferrer';
          aImg.style.cssText = 'display:block;margin:4px 0;';
          aImg.onclick = function (e) { e.stopPropagation(); };
          var imgEl = el('img');
          imgEl.src = href;
          imgEl.alt = '';
          imgEl.loading = 'lazy';
          imgEl.style.cssText = 'max-width:220px;width:100%;height:auto;border-radius:12px;display:block;';
          imgEl.onerror = function () {
            aImg.removeChild(imgEl);
            aImg.textContent = part;
            aImg.style.cssText = 'color:#3b82f6;text-decoration:underline;cursor:pointer;word-break:break-all;';
          };
          aImg.appendChild(imgEl);
          frag.appendChild(aImg);
          return;
        }
        var a = el('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = part;
        a.style.cssText = 'color:#3b82f6;text-decoration:underline;cursor:pointer;word-break:break-all;';
        a.onclick = function (e) { e.stopPropagation(); };
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    return frag;
  }

  // Country flag — bulletproof renderer (v3.7.1)
  // Uses an <img> with data-URI SVG so the flag has intrinsic dimensions
  // and CANNOT be stretched/shifted by any host page flex layout.
  function flagSVG(code, size) {
    size = size || 22;
    var w = size;
    var h = Math.round(size * 0.7273 * 100) / 100; // 22:16 ≈ standard flag ratio
    var content = '';
    switch (code) {
      case 'SA': content = '<rect width="40" height="30" fill="#006C35"/><rect x="6" y="9" width="3" height="1.4" rx=".7" fill="#FFF"/><rect x="10" y="9" width="5" height="1.4" rx=".7" fill="#FFF"/><rect x="16" y="9" width="3" height="1.4" rx=".7" fill="#FFF"/><rect x="20" y="9" width="6" height="1.4" rx=".7" fill="#FFF"/><rect x="27" y="9" width="4" height="1.4" rx=".7" fill="#FFF"/><rect x="8" y="12" width="4" height="1.4" rx=".7" fill="#FFF"/><rect x="13" y="12" width="6" height="1.4" rx=".7" fill="#FFF"/><rect x="20" y="12" width="3" height="1.4" rx=".7" fill="#FFF"/><rect x="24" y="12" width="7" height="1.4" rx=".7" fill="#FFF"/><rect x="6" y="20" width="24" height="1.6" rx=".8" fill="#FFF"/><polygon points="30,20.8 33,19.2 33,22.4" fill="#FFF"/><rect x="32" y="19.6" width="1.2" height="2.4" rx=".4" fill="#FFF"/>'; break;
      case 'AE': content = '<rect width="40" height="10" fill="#00732F"/><rect y="10" width="40" height="10" fill="#FFF"/><rect y="20" width="40" height="10" fill="#000"/><rect width="10" height="30" fill="#F00"/>'; break;
      case 'KW': content = '<rect width="40" height="10" fill="#007A3D"/><rect y="10" width="40" height="10" fill="#FFF"/><rect y="20" width="40" height="10" fill="#CE1126"/><polygon points="0,0 12,7.5 12,22.5 0,30" fill="#000"/>'; break;
      case 'QA': content = '<rect width="40" height="30" fill="#8A1538"/><polygon points="0,0 14,0 18,3.33 14,6.66 18,10 14,13.33 18,16.66 14,20 18,23.33 14,26.66 18,30 14,30 0,30" fill="#FFF"/>'; break;
      case 'BH': content = '<rect width="40" height="30" fill="#CE1126"/><polygon points="0,0 12,0 16,3 12,6 16,9 12,12 16,15 12,18 16,21 12,24 16,27 12,30 0,30" fill="#FFF"/>'; break;
      case 'OM': content = '<rect width="40" height="10" fill="#FFF"/><rect y="10" width="40" height="10" fill="#DB161B"/><rect y="20" width="40" height="10" fill="#008000"/><rect width="12" height="30" fill="#DB161B"/><rect x="3" y="1.5" width="6" height="6" rx="1" fill="#FFF" opacity=".5"/>'; break;
      case 'YE': content = '<rect width="40" height="10" fill="#CE1126"/><rect y="10" width="40" height="10" fill="#FFF"/><rect y="20" width="40" height="10" fill="#000"/>'; break;
      case 'IQ': content = '<rect width="40" height="10" fill="#CE1126"/><rect y="10" width="40" height="10" fill="#FFF"/><rect y="20" width="40" height="10" fill="#000"/><rect x="10" y="12" width="20" height="6" rx="1" fill="#007A3D" opacity=".85"/>'; break;
      case 'JO': content = '<rect width="40" height="10" fill="#000"/><rect y="10" width="40" height="10" fill="#FFF"/><rect y="20" width="40" height="10" fill="#007A3D"/><polygon points="0,0 18,15 0,30" fill="#CE1126"/><circle cx="7" cy="15" r="2" fill="#FFF"/>'; break;
      case 'EG': content = '<rect width="40" height="10" fill="#CE1126"/><rect y="10" width="40" height="10" fill="#FFF"/><rect y="20" width="40" height="10" fill="#000"/><circle cx="20" cy="15" r="3.5" fill="#C09300" opacity=".85"/>'; break;
      default: content = '<rect width="40" height="30" fill="#e5e7eb"/><text x="20" y="18" text-anchor="middle" font-size="10" fill="#6b7280">' + esc(code) + '</text>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30" preserveAspectRatio="xMidYMid slice" width="40" height="30">' + content + '</svg>';
    var dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
    var img = document.createElement('img');
    img.className = 'fq-flag';
    img.setAttribute('alt', code);
    img.setAttribute('role', 'img');
    img.setAttribute('width', w);
    img.setAttribute('height', h);
    img.src = dataUri;
    // Inline styles with !important — overrides host page CSS, parent flex stretch, etc.
    img.style.cssText = [
      'display:inline-block !important',
      'width:' + w + 'px !important',
      'height:' + h + 'px !important',
      'min-width:' + w + 'px !important',
      'max-width:' + w + 'px !important',
      'min-height:' + h + 'px !important',
      'max-height:' + h + 'px !important',
      'flex:0 0 ' + w + 'px !important',
      'align-self:center !important',
      'object-fit:cover !important',
      'object-position:center !important',
      'border:0 !important',
      'border-radius:3px !important',
      'padding:0 !important',
      'margin:0 !important',
      'vertical-align:middle !important',
      'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06) !important',
      'background:transparent !important',
      'position:static !important',
      'transform:none !important',
      'top:auto !important',
      'left:auto !important',
      'box-sizing:border-box !important',
      ''
    ].join(';');
    return img;
  }

  // Fuqah footer SVG
  var FUQAH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" class="fq-footer-logo"><defs><radialGradient id="fq-g" cx="250" cy="250" fx="250" fy="250" r="349.5" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#00fff4"/><stop offset=".1" stop-color="#00f5f1"/><stop offset=".27" stop-color="#00ddec"/><stop offset=".49" stop-color="#01b5e3"/><stop offset=".74" stop-color="#027ed6"/><stop offset="1" stop-color="#043cc8"/></radialGradient></defs><path fill="url(#fq-g)" d="M84.82,211.75h24.95v24.95h-24.95v-24.95ZM59.88,211.75h24.95v-24.95h-24.95v24.95ZM84.82,186.8h24.95v-24.95h-24.95v24.95ZM59.88,161.86h24.95v-24.95h-24.95v24.95ZM84.82,136.91h24.95v-24.95h-24.95v24.95ZM109.77,111.97h24.95v-24.95h-24.95v24.95ZM134.71,136.91h24.95v-24.95h-24.95v24.95ZM159.66,111.97h24.95v-24.95h-24.95v24.95ZM134.71,87.02h24.95v-24.95h-24.95v24.95ZM184.61,87.02h24.95v-24.95h-24.95v24.95ZM209.55,111.97h24.95v-24.95h-24.95v24.95ZM213.41,212.58h24.95v-24.95h-24.95v24.95ZM209.55,62.07h24.95v-24.95h-24.95v24.95ZM34.93,236.7h24.95v-24.95h-24.95v24.95ZM236.7,415.18v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM211.75,440.12v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM186.8,415.18v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM161.86,440.12v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM136.91,415.18v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM111.97,390.23v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM136.91,365.29v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM111.97,340.34v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM87.02,365.29v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM87.02,315.39v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM111.97,290.45v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM62.07,290.45v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM236.7,465.07v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM415.18,263.3h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM440.12,288.25h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM390.23,388.03h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM340.34,388.03h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM365.29,412.98h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM315.39,412.98h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM290.45,388.03h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM290.45,437.93h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM465.07,263.3h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM263.3,84.82v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM288.25,59.88v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM313.2,84.82v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM338.14,59.88v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM363.09,84.82v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM388.03,109.77v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM363.09,134.71v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM388.03,159.66v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM412.98,134.71v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM412.98,184.61v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM388.03,209.55v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM437.93,209.55v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM263.3,34.93v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM263.3,187.63v24.95s72.48,0,72.48,0v-24.95s-72.48,0-72.48,0ZM164.22,237.53v24.95s171.57,0,171.57,0v-24.95s-171.57,0-171.57,0ZM164.22,287.42v24.95s83.65,0,83.65,0v-24.95s-83.65,0-83.65,0Z"/></svg>';

  // Bubble SVG icon
  var BUBBLE_PATH = 'M500,217.35c-156.1,0-282.65,126.55-282.65,282.65s126.55,282.65,282.65,282.65v68.68s282.65-77.5,282.65-351.33c0-156.11-126.55-282.65-282.65-282.65Z';

  // ═══════════════════════════════════════════════════════════════════
  // 7. PLATFORM BOTTOM BAR DETECTION
  // ═══════════════════════════════════════════════════════════════════
  var KNOWN_SELECTORS = [
    '.product-actions-bar','.zid-product-sticky-bar','.sticky-add-to-cart',
    '.sticky-atc-bar','.product-sticky-bar','.product-bottom-bar',
    '[data-sticky-add-to-cart]','.zid-sticky-bar','.add-to-cart-bar',
    '.mobile-product-actions','.mobile-add-to-cart',
    '.s-product-sticky-bar','.salla-sticky-bar','.s-cart-sticky',
    '.salla-bottom-bar','.s-bottom-bar','[data-salla-sticky]',
    '.shopify-sticky-bar','.product-sticky-form',
    '.fixed-bottom-bar','.sticky-bottom-bar','.bottom-action-bar',
    '.mobile-bottom-bar','.floating-bottom-bar','#bottom-bar','#sticky-add-to-cart',
  ];

  function detectBottomBar() {
    var maxH = 0;
    KNOWN_SELECTORS.forEach(function (sel) {
      try {
        var els = document.querySelectorAll(sel);
        for (var i = 0; i < els.length; i++) {
          var s = window.getComputedStyle(els[i]);
          if ((s.position === 'fixed' || s.position === 'sticky') && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) !== 0) {
            var r = els[i].getBoundingClientRect();
            if (r.height >= 40 && r.height <= 200 && (window.innerHeight - r.bottom) <= 10 && r.width >= window.innerWidth * 0.5) {
              if (r.height > maxH) maxH = r.height;
            }
          }
        }
      } catch (e) { /* skip */ }
    });
    if (maxH === 0) {
      var cands = document.querySelectorAll('body > *, [class*="sticky"], [class*="fixed"], [class*="bottom"]');
      for (var i = 0; i < cands.length; i++) {
        var s = window.getComputedStyle(cands[i]);
        if ((s.position === 'fixed' || s.position === 'sticky') && s.display !== 'none' && s.visibility !== 'hidden') {
          var r = cands[i].getBoundingClientRect();
          if (r.height >= 40 && r.height <= 200 && (window.innerHeight - r.bottom) <= 10 && r.width >= window.innerWidth * 0.5) {
            if (r.height > maxH) maxH = r.height;
          }
        }
      }
    }
    return maxH;
  }

  if (typeof window !== 'undefined' && !window.__fqResizeBound) {
    window.__fqResizeBound = true;
    window.addEventListener('resize', function(){ try { if (dom.window && state.isOpen) updatePositions(); } catch(e){} });
  }
  function scanBottomBar() {
    var h = detectBottomBar();
    state.bottomOffset = h > 0 ? h + 12 : 0;
    updateBubblePosition();
    try { if (dom.window && state.isOpen) updatePositions(); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════
  // 8. BODY SCROLL LOCK
  // ═══════════════════════════════════════════════════════════════════
  var savedScrollY = 0, savedBodyCSS = '', blockDocTouch = null;

  function lockBody() {
    savedScrollY = window.scrollY;
    savedBodyCSS = document.body.style.cssText;
    if (!isMobile()) return;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedScrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    blockDocTouch = function (e) {
      var w = document.getElementById('fq-chat-window');
      if (w && w.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', blockDocTouch, { passive: false });
  }

  function unlockBody() {
    if (blockDocTouch) { document.removeEventListener('touchmove', blockDocTouch); blockDocTouch = null; }
    document.body.style.cssText = savedBodyCSS;
    window.scrollTo(0, savedScrollY);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. DOWNLOAD AS IMAGE
  // ═══════════════════════════════════════════════════════════════════
  function downloadAsImage(type) {
    var W = 800, P = 40, LH = 24, GAP = 16;
    var msgs = state.messages;
    var name = settings.storeName;
    var dark = isDark();
    var bg = dark ? '#1e293b' : '#FFFFFF';
    var txt = dark ? '#f1f5f9' : '#1f2937';
    var sec = dark ? '#94a3b8' : '#6b7280';
    var accent = dark ? '#3b82f6' : '#0ea5e9';
    var sep = dark ? '#334155' : '#e5e7eb';
    var sMBg = dark ? '#334155' : '#f3f4f6';
    var cMBg = dark ? '#1e40af' : '#dbeafe';

    var c0 = document.createElement('canvas'); c0.width = W; c0.height = 100;
    var ctx0 = c0.getContext('2d');
    ctx0.font = '14px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
    var mw = W - P * 2;

    function wrap(ctx, t, max) {
      var words = t.split(' '), lines = [], cur = '';
      words.forEach(function (w) {
        var test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > max && cur) { lines.push(cur); cur = w; }
        else cur = test;
      });
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    }

    var h = P + 36 + GAP + 2 + GAP;
    var metaCount = 4 + (type === 'ticket' ? 2 : 0);
    h += metaCount * LH + GAP + 2 + GAP;
    msgs.forEach(function (m) {
      var sender = m.sender === 'store' ? name : 'العميل';
      var time = m.timestamp ? m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
      var full = '[' + time + '] ' + sender + ': ' + (m.text || '[مرفق]');
      h += wrap(ctx0, full, mw - 16).length * LH + 8;
    });
    h += GAP + 2 + GAP + LH + P;

    var c = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = h * dpr;
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, h);

    var y = P;
    ctx.fillStyle = accent;
    ctx.font = 'bold 22px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
    ctx.textAlign = 'center';
    var title = type === 'ticket' ? 'سجل التذكرة — ' + name : 'سجل المحادثة — ' + name;
    ctx.fillText(title, W / 2, y + 22); y += 36 + GAP;
    ctx.fillStyle = sep; ctx.fillRect(P, y, W - P * 2, 2); y += 2 + GAP;

    ctx.textAlign = 'right';
    ctx.font = '14px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
    var mx = W - P;
    var meta = [['معرّف المحادثة', state.conversationId]];
    if (type === 'ticket') meta.push(['رقم التذكرة', state.ticketId]);
    meta.push(['المتجر', name], ['التاريخ', new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })], ['عدد الرسائل', '' + msgs.length]);
    if (type === 'ticket') meta.push(['الحالة', 'مفتوحة']);
    meta.forEach(function (m) {
      ctx.fillStyle = sec; ctx.fillText(m[0] + ': ', mx, y + 16);
      var lw = ctx.measureText(m[0] + ': ').width;
      ctx.fillStyle = txt; ctx.font = 'bold 14px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
      ctx.fillText(m[1], mx - lw, y + 16);
      ctx.font = '14px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
      y += LH;
    });
    y += GAP;
    ctx.fillStyle = sep; ctx.fillRect(P, y, W - P * 2, 2); y += 2 + GAP;

    msgs.forEach(function (m) {
      var isCust = m.sender === 'customer';
      var sender = isCust ? 'العميل' : name;
      var time = m.timestamp ? m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
      var full = '[' + time + '] ' + sender + ': ' + (m.text || '[مرفق]');
      var lines = wrap(ctx, full, mw - 16);
      var ph = lines.length * LH + 8;
      ctx.fillStyle = isCust ? cMBg : sMBg;
      ctx.beginPath();
      var rx = P, ry = y - 2, rw = W - P * 2, rh = ph, rr = 8;
      ctx.moveTo(rx + rr, ry); ctx.lineTo(rx + rw - rr, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
      ctx.lineTo(rx + rw, ry + rh - rr);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
      ctx.lineTo(rx + rr, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
      ctx.lineTo(rx, ry + rr);
      ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = txt;
      ctx.font = '14px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
      lines.forEach(function (l) { ctx.fillText(l, mx - 8, y + 14); y += LH; });
      y += 8;
    });

    y += GAP;
    ctx.fillStyle = sep; ctx.fillRect(P, y, W - P * 2, 2); y += 2 + GAP;
    ctx.fillStyle = sec;
    ctx.font = '13px "IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('مدعوم من فقاعة AI — www.fuqah.ai', W / 2, y + 14);

    c.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var prefix = type === 'ticket' ? 'تذكرة-' + state.ticketId : 'محادثة-' + state.conversationId;
      a.download = prefix + '-' + name + '.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. LOAD CSS
  // ═══════════════════════════════════════════════════════════════════
  function loadCSS() {
    var s = document.createElement('style');
    s.setAttribute('data-fuqah', 'inline');
    s.textContent = FQ_INLINE_CSS;
    document.head.appendChild(s);
    console.log('[Fuqah] Inline CSS injected (' + FQ_INLINE_CSS.length + ' chars)');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 11. DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════
  var dom = {};

  function cleanupWidgetDom() {
    try {
      hideWelcomeBubble();
    } catch (e) {}
    try {
      ['fq-widget-root', 'fq-bubble', 'fq-chat-window', 'fq-overlay'].forEach(function (id) {
        var node = document.getElementById(id);
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
      document.querySelectorAll('.fq-widget-root,.fq-bubble,.fq-chat-window,.fq-touch-overlay,.fq-welcome-bubble,.fq-modal-overlay,.fq-modal').forEach(function (node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
    } catch (e) {}
    try { unlockBody(); } catch (e) {}
    dom = {};
    state.isOpen = false;
    state.showModal = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 12. BUILD DOM
  // ═══════════════════════════════════════════════════════════════════
  function buildWidget() {
    if (settings.bubbleVisible === false) {
      cleanupWidgetDom();
      return;
    }
    cleanupWidgetDom();
    // Root container
    var root = el('div', 'fq-widget-root');
    root.id = 'fq-widget-root';

    // ── Bubble ──
    var bubble = el('button', 'fq-bubble fq-bubble-enter');
    bubble.id = 'fq-bubble';
    bubble.setAttribute('aria-label', 'فتح المحادثة');
    updateBubbleSVG(bubble);
    bubble.onclick = function () { openChat(); };
    if (settings.bubbleVisible !== false) { root.appendChild(bubble); }
    dom.bubble = bubble;

    // ── Welcome bubble (above bubble icon) ──
    renderWelcomeBubble(root);

    // ── Touch overlay ──
    var overlay = el('div', 'fq-touch-overlay');
    overlay.id = 'fq-overlay';
    overlay.style.display = 'none';
    root.appendChild(overlay);
    dom.overlay = overlay;

    // ── Chat window ──
    var win = el('div', 'fq-chat-window fq-no-scrollbar');
    win.id = 'fq-chat-window';
    win.style.display = 'none';
    win.setAttribute('dir', 'rtl');

    // Inner container for height
    var inner = el('div');
    inner.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;height:100%;';
    win.appendChild(inner);
    dom.windowInner = inner;

    root.appendChild(win);
    dom.window = win;

    // ── Modal overlay (initially hidden) ──
    dom.modalOverlay = null;

    if (!document.body) {
      console.error('[Fuqah] FATAL: document.body not available. Cannot inject widget.');
      return;
    }
    document.body.appendChild(root);
    dom.root = root;

    console.log('[Fuqah] DOM built. root=' + !!dom.root + ' bubble=' + !!dom.bubble + ' window=' + !!dom.window + ' overlay=' + !!dom.overlay);

    renderChatScreen();
    updatePositions();
  }

  function updateBubbleSVG(bubble) {
    var outer = settings.widgetOuterColor;
    var inner = settings.widgetInnerColor;
    var isWhite = outer === '#FFFFFF' || outer === '#ffffff';
    bubble.style.boxShadow = isWhite
      ? '0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)'
      : '0 4px 24px ' + outer + '60';
    bubble.innerHTML = '<svg viewBox="0 0 1000 1000" style="width:100%;height:100%"><circle fill="' + esc(outer) + '" cx="500" cy="500" r="475"/><path fill="' + esc(inner) + '" d="' + BUBBLE_PATH + '"/></svg>';
  }

  function updateBubblePosition() {
    if (!dom.bubble) return;
    dom.bubble.style.bottom = (20 + state.bottomOffset) + 'px';
    if (dom.welcomeBubble) dom.welcomeBubble.style.bottom = (84 + state.bottomOffset) + 'px';
  }

  function updatePositions() {
    var isRight = settings.position === 'bottom-right';
    var pos = isRight ? 'fq-right' : 'fq-left';
    if (dom.bubble) {
      dom.bubble.className = 'fq-bubble ' + pos + (state.isOpen ? '' : ' fq-bubble-enter');
      dom.bubble.style.bottom = (20 + state.bottomOffset) + 'px';
    }
    if (dom.window) {
      var mob = isMobile();
      dom.window.className = 'fq-chat-window fq-no-scrollbar ' + pos + (mob ? ' fq-mobile' : ' fq-desktop');
      if (!mob) {
        var _bottomGap = state.bottomOffset > 0 ? state.bottomOffset : 20;
        var _topGap = 16;
        var _desired = 580;
        var _avail = (window.innerHeight || 800) - _bottomGap - _topGap;
        var _h = _avail < 360 ? Math.max(240, _avail) : Math.min(_desired, _avail);
        dom.window.style.bottom = _bottomGap + 'px';
        dom.window.style.minHeight = '0';
        dom.window.style.maxHeight = _desired + 'px';
        dom.window.style.height = _h + 'px';
        dom.window.style.transformOrigin = isRight ? 'right bottom' : 'left bottom';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 13. RENDER SCREENS
  // ═══════════════════════════════════════════════════════════════════
  function clearInner() {
    while (dom.windowInner.firstChild) dom.windowInner.removeChild(dom.windowInner.firstChild);
      try { if (dom.window) dom.window.classList.remove('fq-ticket-locked'); } catch (e) {}
  }

  function renderChatScreen() {
    clearInner();
    // Leaving the rating screen must cancel its idle timer.
    if (state.currentScreen === 'rating' && state.ratingInactivityTimer) {
      clearTimeout(state.ratingInactivityTimer);
      state.ratingInactivityTimer = null;
    }
    state.currentScreen = 'chat';
    var c = mc();

    dom.window.style.background = c.chatBg;
    dom.window.style.borderColor = c.chatBorder;
    dom.window.style.border = '1px solid ' + c.chatBorder;

    // Header
    var header = buildHeader();
    dom.windowInner.appendChild(header);

    // Messages
    var msgs = el('div', 'fq-messages fq-no-scrollbar');
    msgs.id = 'fq-messages';
    msgs.style.background = c.msgBg;
    msgs.setAttribute('data-chat-scrollable', '');
    msgs.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
    dom.windowInner.appendChild(msgs);
    dom.messages = msgs;

    renderMessages();

    // Input
    var inputArea = buildInput();
    dom.windowInner.appendChild(inputArea);

    // Footer
    dom.windowInner.appendChild(buildFooter());

    scrollToBottom();
  }

  // ── HEADER ──
  function buildHeader() {
    var c = mc();
    var header = el('div', 'fq-header');
    header.style.background = settings.mainColor;

    var info = el('div', 'fq-header-info');
    if (settings.storeIcon) {
      var icon = el('img', 'fq-header-icon');
      icon.src = settings.storeIcon;
      icon.alt = settings.storeName;
      info.appendChild(icon);
    }
    var textDiv = el('div');
    var name = el('h2', 'fq-header-name');
    name.textContent = settings.storeName;
    textDiv.appendChild(name);
    var statusDiv = el('div', 'fq-header-status');
    statusDiv.innerHTML = '<div class="fq-header-dot"></div><span class="fq-header-status-text">وكيل الذكاء الاصطناعي</span>';
    textDiv.appendChild(statusDiv);
    info.appendChild(textDiv);
    header.appendChild(info);

    var actions = el('div', 'fq-header-actions');
    // Download btn
    var dlBtn = el('button', 'fq-header-btn');
    dlBtn.setAttribute('aria-label', 'تحميل المحادثة');
    dlBtn.appendChild(svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 18, 18));
    dlBtn.onclick = function () { downloadAsImage('chat'); };
    actions.appendChild(dlBtn);
    // Close btn
    var closeBtn = el('button', 'fq-header-btn');
    closeBtn.setAttribute('aria-label', 'إغلاق');
    closeBtn.appendChild(svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 18, 18));
    closeBtn.onclick = function () { handleCloseClick(); };
    actions.appendChild(closeBtn);
    header.appendChild(actions);

    return header;
  }

  // ── MESSAGES RENDERING ──
  function renderMessages() {
    if (!dom.messages) return;
    dom.messages.innerHTML = '';
    if (state.messages.length === 0) {
      dom.messages.appendChild(buildEmptyState());
    } else {
      state.messages.forEach(function (m) {
        dom.messages.appendChild(buildMessage(m));
      });
    }
    if (state.isTyping) dom.messages.appendChild(buildTyping());
    if (state.showInactivityPrompt) dom.messages.appendChild(buildInactivityPrompt());
    // Scroll anchor
    var anchor = el('div');
    anchor.style.cssText = 'height:1px;flex-shrink:0;';
    dom.messages.appendChild(anchor);
    scrollToBottom();
  }

  function buildEmptyState() {
    var c = mc();
    var wrap = el('div', 'fq-empty');
    if (settings.storeLogo) {
      var img = el('img', 'fq-empty-logo');
      img.src = settings.storeLogo;
      img.alt = 'Store Logo';
      if (isDark()) img.style.filter = 'brightness(0.95)';
      wrap.appendChild(img);
    }
    var t = el('h3', 'fq-empty-title');
    t.textContent = 'مرحباً، كيف أستطيع أن أساعدك؟';
    t.style.color = c.primaryText;
    wrap.appendChild(t);
    var s = el('p', 'fq-empty-subtitle');
    s.textContent = 'نحن هنا للإجابة على جميع استفساراتك';
    s.style.color = c.secondaryText;
    wrap.appendChild(s);
    return wrap;
  }

  function buildMessage(m) {
    var c = mc();
    var isStore = m.sender === 'store';

    // Ticket success
    if (m.type === 'ticket-success') {
      var row = el('div', 'fq-msg-row fq-store');
      if (settings.storeIcon) { var av = el('img', 'fq-msg-avatar'); av.src = settings.storeIcon; av.alt = 'Store'; row.appendChild(av); }
      var content = el('div', 'fq-msg-content');
      var badge = el('div', 'fq-ticket-success');
      badge.style.background = isDark() ? '#052e16' : '#f0fdf4';
      badge.style.border = '1px solid ' + (isDark() ? '#166534' : '#bbf7d0');
      badge.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      var span = el('span');
      span.textContent = m.text || 'تم إرسال طلبك بنجاح';
      badge.appendChild(span);
      content.appendChild(badge);
      content.appendChild(buildFeedback(m.id));
      row.appendChild(content);
      return row;
    }

    // Ticket form
    if (m.type === 'ticket-form') {
      var row = el('div', 'fq-msg-row fq-store');
      if (settings.storeIcon) { var av = el('img', 'fq-msg-avatar'); av.src = settings.storeIcon; av.alt = 'Store'; row.appendChild(av); }
      var content = el('div', 'fq-msg-content');
      content.style.maxWidth = '85%';
      var bubble = el('div', 'fq-msg-bubble');
      bubble.style.background = settings.mainColor;
      bubble.style.color = '#FFFFFF';
      var p = el('p', 'fq-msg-text');
      p.appendChild(textWithLinks(m.text));
      bubble.appendChild(p);
      content.appendChild(bubble);

      if (m.ticketFormSubmitted) {
        var successBadge = el('div', 'fq-ticket-success');
        successBadge.style.background = isDark() ? '#052e16' : '#f0fdf4';
        successBadge.style.border = '1px solid ' + (isDark() ? '#166534' : '#bbf7d0');
        successBadge.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>تم إرسال طلبك بنجاح</span>';
        content.appendChild(successBadge);
      } else {
        content.appendChild(buildInlineTicketForm(m));
      }
      content.appendChild(buildFeedback(m.id));
      row.appendChild(content);
      return row;
    }

    // Regular message
    var row = el('div', 'fq-msg-row ' + (isStore ? 'fq-store' : 'fq-customer'));
    if (isStore && settings.storeIcon) {
      var av = el('img', 'fq-msg-avatar'); av.src = settings.storeIcon; av.alt = 'Store'; row.appendChild(av);
    }
    var content = el('div', 'fq-msg-content');
    var bubble = el('div', 'fq-msg-bubble');
    bubble.style.background = isStore ? settings.mainColor : c.userBubbleBg;
    bubble.style.color = isStore ? '#FFFFFF' : c.userBubbleText;

    if (m.attachment) {
      if (m.attachment.type === 'image') {
        var imgWrap = el('div', 'fq-msg-attachment');
        var img = el('img');
        img.src = m.attachment.url;
        img.alt = m.attachment.name;
        imgWrap.appendChild(img);
        bubble.appendChild(imgWrap);
      } else {
        var fileDiv = el('div', 'fq-msg-file');
        fileDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
        var fi = el('div');
        fi.style.cssText = 'flex:1;min-width:0;';
        fi.innerHTML = '<div class="fq-msg-file-name">' + esc(m.attachment.name) + '</div>' + (m.attachment.size ? '<div class="fq-msg-file-size">' + (m.attachment.size / 1024).toFixed(1) + ' KB</div>' : '');
        fileDiv.appendChild(fi);
        var dlA = el('a', 'fq-msg-file-dl');
        dlA.href = m.attachment.url;
        dlA.download = m.attachment.name;
        dlA.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        fileDiv.appendChild(dlA);
        bubble.appendChild(fileDiv);
      }
    }
    if (m.text) {
      var p = el('p', 'fq-msg-text');
      p.appendChild(textWithLinks(m.text));
      bubble.appendChild(p);
    }
    content.appendChild(bubble);
    if (isStore && m.productCards && m.productCards.length) {
      content.appendChild(buildProductCards(m.productCards));
    }
    if (isStore) content.appendChild(buildFeedback(m.id));
    row.appendChild(content);
    return row;
  }

  function buildProductCards(cards) {
    var c = mc();
    var wrap = el('div');
    wrap.style.cssText = 'display:flex;gap:8px;margin-top:8px;overflow-x:auto;max-width:100%;padding-bottom:4px;direction:rtl;scrollbar-width:thin;';
    for (var i = 0; i < cards.length; i++) {
      var p = cards[i] || {};
      var card = el('div');
      card.style.cssText = 'flex:0 0 160px;width:160px;border-radius:14px;overflow:hidden;background:' + (isDark() ? '#1e293b' : '#ffffff') + ';box-shadow:0 1px 4px rgba(0,0,0,0.10);display:flex;flex-direction:column;border:1px solid ' + (isDark() ? '#334155' : '#e5e7eb') + ';';
      if (p.image_url) {
        var img = el('img');
        img.src = p.image_url;
        img.alt = p.name || '';
        img.loading = 'lazy';
        img.style.cssText = 'width:100%;height:120px;object-fit:cover;display:block;background:' + (isDark() ? '#0f172a' : '#f3f4f6') + ';';
        img.onerror = function () { this.style.display = 'none'; };
        card.appendChild(img);
      }
      var body = el('div');
      body.style.cssText = 'padding:8px 10px;display:flex;flex-direction:column;gap:4px;flex:1;';
      var name = el('div');
      name.textContent = String(p.name || '');
      name.style.cssText = 'font-size:12px;font-weight:600;line-height:1.4;color:' + (isDark() ? '#f1f5f9' : '#1f2937') + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px;';
      body.appendChild(name);
      var priceRow = el('div');
      priceRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
      var hasSale = p.sale_price && String(p.sale_price).length && String(p.sale_price) !== String(p.price);
      if (hasSale) {
        var sale = el('span');
        sale.textContent = String(p.sale_price);
        sale.style.cssText = 'font-size:12px;font-weight:700;color:' + settings.mainColor + ';';
        priceRow.appendChild(sale);
        var old = el('span');
        old.textContent = String(p.price);
        old.style.cssText = 'font-size:11px;color:#9ca3af;text-decoration:line-through;';
        priceRow.appendChild(old);
      } else if (p.price) {
        var pr = el('span');
        pr.textContent = String(p.price);
        pr.style.cssText = 'font-size:12px;font-weight:700;color:' + (isDark() ? '#e2e8f0' : '#1f2937') + ';';
        priceRow.appendChild(pr);
      }
      body.appendChild(priceRow);
      if (p.url) {
        var btn = el('a');
        btn.href = p.url;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.textContent = 'عرض المنتج';
        btn.style.cssText = 'margin-top:auto;display:block;text-align:center;padding:6px 10px;border-radius:10px;background:' + settings.mainColor + ';color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;cursor:pointer;';
        body.appendChild(btn);
      }
      card.appendChild(body);
      wrap.appendChild(card);
    }
    return wrap;
  }

  function buildFeedback(msgId) {
    var c = mc();
    var wrap = el('div', 'fq-feedback');
    var feedbackState = { value: (state.messageFeedback && state.messageFeedback[msgId]) || null };

    var downBtn = el('button', 'fq-feedback-btn');
    downBtn.setAttribute('aria-label', 'تقييم سلبي');
    downBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#d1d5db"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>';
    if (isDark()) downBtn.onmouseover = function () { this.style.background = '#334155'; };
    else downBtn.onmouseover = function () { this.style.background = '#f3f4f6'; };
    downBtn.onmouseout = function () { this.style.background = 'transparent'; };
    downBtn.onclick = function () {
      feedbackState.value = feedbackState.value === 'down' ? null : 'down';
      state.messageFeedback[msgId] = feedbackState.value;
      updateFeedbackUI();
      sendMessageFeedback(msgId, feedbackState.value);
    };

    var upBtn = el('button', 'fq-feedback-btn');
    upBtn.setAttribute('aria-label', 'تقييم إيجابي');
    upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#d1d5db"><path d="M7 10V22"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
    if (isDark()) upBtn.onmouseover = function () { this.style.background = '#334155'; };
    else upBtn.onmouseover = function () { this.style.background = '#f3f4f6'; };
    upBtn.onmouseout = function () { this.style.background = 'transparent'; };
    upBtn.onclick = function () {
      feedbackState.value = feedbackState.value === 'up' ? null : 'up';
      state.messageFeedback[msgId] = feedbackState.value;
      updateFeedbackUI();
      sendMessageFeedback(msgId, feedbackState.value);
    };

    function updateFeedbackUI() {
      var dSvg = downBtn.querySelector('svg');
      var uSvg = upBtn.querySelector('svg');
      dSvg.setAttribute('stroke', feedbackState.value === 'down' ? '#ef4444' : '#d1d5db');
      dSvg.setAttribute('fill', feedbackState.value === 'down' ? '#ef4444' : 'none');
      uSvg.setAttribute('stroke', feedbackState.value === 'up' ? settings.mainColor : '#d1d5db');
      uSvg.setAttribute('fill', feedbackState.value === 'up' ? settings.mainColor : 'none');
    }

    wrap.appendChild(downBtn);
    wrap.appendChild(upBtn);
    // Paint persisted choice so re-renders keep the selected thumb.
    try { updateFeedbackUI(); } catch (e) {}
    return wrap;
  }

  function buildTyping() {
    var row = el('div', 'fq-typing-row');
    if (settings.storeIcon) {
      var av = el('img', 'fq-msg-avatar'); av.src = settings.storeIcon; av.alt = 'Store'; row.appendChild(av);
    }
    var bubble = el('div', 'fq-typing-bubble');
    bubble.style.background = settings.mainColor;
    bubble.innerHTML = '<div class="fq-typing-dot"></div><div class="fq-typing-dot"></div><div class="fq-typing-dot"></div>';
    row.appendChild(bubble);
    return row;
  }

  // ── INLINE TICKET FORM ──
  function buildInlineTicketForm(msg) {
    var c = mc();
    var selectedCountry = COUNTRIES[0];
    var wrap = el('div', 'fq-inline-ticket');
    wrap.style.background = isDark() ? '#0f172a' : '#f8fafc';
    wrap.style.border = '1px solid ' + (isDark() ? '#334155' : '#e2e8f0');

    var phoneRow = el('div', 'fq-phone-row');
    phoneRow.style.border = '1.5px solid ' + (isDark() ? '#475569' : '#d1d5db');
    phoneRow.style.background = isDark() ? '#1e293b' : '#fff';
    phoneRow.style.height = '44px';

    // Country selector
    var countryWrap = el('div');
    countryWrap.style.cssText = 'position:relative;flex-shrink:0;';
    var countryBtn = el('button', 'fq-country-btn');
    countryBtn.style.borderRight = '1.5px solid ' + (isDark() ? '#334155' : '#e5e7eb');
    countryBtn.style.minWidth = '82px';
    countryBtn.style.height = '100%';
    countryBtn.style.padding = '0 10px';
    var flagEl = flagSVG(selectedCountry.code, 20);
    countryBtn.appendChild(flagEl);
    var codeSpan = el('span', 'fq-country-code');
    codeSpan.textContent = selectedCountry.code;
    codeSpan.style.color = isDark() ? '#cbd5e1' : '#374151';
    codeSpan.style.fontSize = '12px';
    countryBtn.appendChild(codeSpan);
    var chevron = el('span', 'fq-country-chevron');
    chevron.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    countryBtn.appendChild(chevron);
    countryWrap.appendChild(countryBtn);
    phoneRow.appendChild(countryWrap);

    // Phone input
    var phoneInput = el('input', 'fq-phone-input');
    phoneInput.type = 'tel';
    phoneInput.inputMode = 'numeric';
    phoneInput.placeholder = selectedCountry.placeholder;
    phoneInput.style.color = isDark() ? '#f1f5f9' : '#1f2937';
    phoneInput.style.caretColor = settings.mainColor;
    phoneInput.style.padding = '0 12px';
    phoneInput.style.fontSize = '15px';
    phoneInput.style.height = '100%';
    phoneInput.style.textAlign = 'left';
    phoneInput.style.lineHeight = '1';
    phoneRow.appendChild(phoneInput);
    wrap.appendChild(phoneRow);

    // Error
    var errorEl = el('p', 'fq-phone-error');
    errorEl.style.display = 'none';
    wrap.appendChild(errorEl);

    // Submit
    var submitBtn = el('button', 'fq-inline-submit');
    submitBtn.style.background = settings.mainColor;
    submitBtn.style.color = '#FFFFFF';
    submitBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> إرسال الرقم';

    // Dropdown
    var dropdown = null;

    countryBtn.onclick = function () {
      if (dropdown) { dropdown.remove(); dropdown = null; chevron.classList.remove('fq-open'); return; }
      chevron.classList.add('fq-open');
      dropdown = el('div', 'fq-country-dropdown');
      dropdown.style.background = isDark() ? '#1e293b' : '#FFFFFF';
      dropdown.style.border = '1px solid ' + (isDark() ? '#334155' : '#e5e7eb');
      dropdown.style.width = '200px';
      COUNTRIES.forEach(function (ctry) {
        var item = el('button', 'fq-country-item');
        if (selectedCountry.code === ctry.code) item.style.background = settings.mainColor + '0d';
        item.appendChild(flagSVG(ctry.code, 17));
        var n = el('span', 'fq-country-item-name');
        n.textContent = ctry.code;
        n.style.color = isDark() ? '#cbd5e1' : '#374151';
        item.appendChild(n);
        var d = el('span', 'fq-country-item-dial');
        d.textContent = ctry.dialCode;
        d.style.color = isDark() ? '#64748b' : '#9ca3af';
        item.appendChild(d);
        item.onmouseover = function () { if (selectedCountry.code !== ctry.code) this.style.background = isDark() ? '#334155' : '#f9fafb'; };
        item.onmouseout = function () { this.style.background = selectedCountry.code === ctry.code ? settings.mainColor + '0d' : 'transparent'; };
        item.onclick = function () {
          selectedCountry = ctry;
          flagEl.replaceWith(flagSVG(ctry.code, 20));
          flagEl = countryBtn.querySelector('.fq-flag');
          codeSpan.textContent = ctry.code;
          phoneInput.value = '';
          phoneInput.placeholder = ctry.placeholder;
          dropdown.remove();
          dropdown = null;
          chevron.classList.remove('fq-open');
          phoneInput.focus();
        };
        dropdown.appendChild(item);
      });
      countryWrap.appendChild(dropdown);
    };

    phoneInput.oninput = function () {
      phoneInput.value = phoneInput.value.replace(/[^\d\s]/g, '');
      errorEl.style.display = 'none';
    };
    phoneInput.onkeydown = function (e) { if (e.key === 'Enter') doSubmit(); };

    function doSubmit() {
      var cleaned = phoneInput.value.replace(/\D/g, '');
      var result = validatePhone(selectedCountry.code, cleaned);
      if (!result.valid) { errorEl.textContent = result.error; errorEl.style.display = 'block'; phoneInput.focus(); return; }
      errorEl.style.display = 'none';
      handleInlineTicketSubmit(cleaned, selectedCountry.dialCode, msg);
    }

    submitBtn.onclick = doSubmit;
    wrap.appendChild(submitBtn);

    // Close dropdown on outside click
    document.addEventListener('mousedown', function handler(e) {
      if (dropdown && !countryWrap.contains(e.target)) {
        dropdown.remove(); dropdown = null; chevron.classList.remove('fq-open');
      }
    });

    return wrap;
  }

  // ── INPUT AREA ──
  function buildInput() {
    var c = mc();
    var area = el('div', 'fq-input-area');
    area.style.borderTop = '1px solid ' + c.inputBorder;
    area.style.background = c.inputBg;

    // Attachment preview (hidden)
    var attachPreview = el('div', 'fq-attach-preview');
    attachPreview.style.display = 'none';
    attachPreview.style.background = isDark() ? '#0f172a' : '#f9fafb';
    attachPreview.style.border = '1px solid ' + c.inputBorder;
    area.appendChild(attachPreview);
    dom.attachPreview = attachPreview;

    // Input row
    var row = el('div', 'fq-input-row');
    row.style.background = c.inputRowBg;
    row.style.border = '1px solid ' + c.inputBorder;

    // File input (hidden)
    var fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt';
    fileInput.style.display = 'none';
    // v4.7.25 — rating/close via widget-events + thumbs feedback + pagehide close
  // v4.7.24 — client-side image compression + base64 dataUrl for vision
    function blobToDataUrl(blob, cb) {
      try {
        var fr = new FileReader();
        fr.onload = function () { cb(String(fr.result || '')); };
        fr.onerror = function () { cb(''); };
        fr.readAsDataURL(blob);
      } catch (e) { cb(''); }
    }
    fileInput.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var isImage = file.type.indexOf('image') === 0;
      // Non-images and small images: skip compression
      if (!isImage || file.size <= 200 * 1024) {
        var url0 = URL.createObjectURL(file);
        state.attachment = { type: isImage ? 'image' : 'file', url: url0, name: file.name, size: file.size };
        if (isImage) {
          state.attachment.compressing = true;
          renderAttachPreview();
          updateSendState();
          blobToDataUrl(file, function (du) {
            if (state.attachment && state.attachment.url === url0) {
              state.attachment.dataUrl = du;
              state.attachment.compressing = false;
              renderAttachPreview();
              updateSendState();
            }
          });
          return;
        }
        renderAttachPreview();
        updateSendState();
        return;
      }
      // Show interim preview + disable send while compressing
      state.attachment = { type: 'image', url: URL.createObjectURL(file), name: file.name, size: file.size, compressing: true };
      renderAttachPreview();
      updateSendState();
      compressImage(file, 1024, 0.72, function (blob) {
        var finalBlob = (blob && blob.size < file.size) ? blob : file;
        var finalName = (blob && blob.size < file.size) ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
        var url = URL.createObjectURL(finalBlob);
        state.attachment = { type: 'image', url: url, name: finalName, size: finalBlob.size, compressing: true };
        renderAttachPreview();
        updateSendState();
        blobToDataUrl(finalBlob, function (du) {
          if (state.attachment && state.attachment.url === url) {
            state.attachment.dataUrl = du;
            state.attachment.compressing = false;
            renderAttachPreview();
            updateSendState();
          }
        });
      });
    };

    function compressImage(file, maxSide, quality, cb) {
      try {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            try {
              var longest = Math.max(img.width, img.height);
              var scale = longest > maxSide ? maxSide / longest : 1;
              var w = Math.round(img.width * scale);
              var h = Math.round(img.height * scale);
              var canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              var ctx = canvas.getContext('2d');
              if (!ctx) { cb(null); return; }
              ctx.drawImage(img, 0, 0, w, h);
              canvas.toBlob(function (blob) { cb(blob); }, 'image/jpeg', quality);
            } catch (err) { console.log('[Fuqah] compress failed', err); cb(null); }
          };
          img.onerror = function () { cb(null); };
          img.src = String(reader.result);
        };
        reader.onerror = function () { cb(null); };
        reader.readAsDataURL(file);
      } catch (err) { console.log('[Fuqah] compress threw', err); cb(null); }
    }
    area.appendChild(fileInput);
    dom.fileInput = fileInput;

    // Attach btn
    var attachBtn = el('button', 'fq-attach-btn');
    attachBtn.setAttribute('aria-label', 'إرفاق ملف');
    attachBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
    attachBtn.onclick = function () { fileInput.click(); };
    row.appendChild(attachBtn);
    dom.attachBtn = attachBtn;

    // Textarea
    var textarea = el('textarea', 'fq-msg-textarea fq-no-scrollbar');
    textarea.placeholder = 'اكتب رسالتك...';
    textarea.rows = 1;
    textarea.setAttribute('dir', 'rtl');
    textarea.style.color = c.inputText;
    textarea.style.caretColor = settings.mainColor;
    textarea.oninput = function () {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      updateSendState();
    };
    // Desktop: Enter = send, Shift+Enter = newline. Mobile: Enter = newline.
    textarea.onkeydown = function (e) {
      if (e.key === 'Enter') {
        var touch = 'ontouchstart' in window && window.innerWidth < 1024;
        if (touch) return;
        if (!e.shiftKey) { e.preventDefault(); doSend(); }
      }
    };
    row.appendChild(textarea);
    dom.textarea = textarea;

    // Send btn
    var sendBtn = el('button', 'fq-send-btn');
    sendBtn.setAttribute('aria-label', 'إرسال');
    sendBtn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
    sendBtn.disabled = true;
    sendBtn.onclick = function () { doSend(); };
    row.appendChild(sendBtn);
    dom.sendBtn = sendBtn;

    area.appendChild(row);
    updateSendState();
    return area;
  }

  function updateSendState() {
    if (!dom.sendBtn || !dom.textarea) return;
    var can = (dom.textarea.value.trim() || (state.attachment && !state.attachment.compressing)) && !state.isTyping;
    dom.sendBtn.disabled = !can;
    dom.sendBtn.style.background = can ? settings.mainColor : settings.mainColor + '30';
    dom.sendBtn.style.boxShadow = can ? '0 2px 8px ' + settings.mainColor + '40' : 'none';
    dom.sendBtn.style.opacity = can ? '1' : '0.6';
  }

  function renderAttachPreview() {
    if (!dom.attachPreview || !state.attachment) return;
    dom.attachPreview.innerHTML = '';
    dom.attachPreview.style.display = 'flex';
    var att = state.attachment;
    if (att.type === 'image') {
      var img = el('img'); img.src = att.url; img.alt = att.name;
      img.style.cssText = 'width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;';
      dom.attachPreview.appendChild(img);
    } else {
      var fIcon = el('span');
      fIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
      dom.attachPreview.appendChild(fIcon.firstChild);
    }
    var info = el('div');
    info.style.cssText = 'flex:1;min-width:0;';
    info.innerHTML = '<div class="fq-attach-preview-name">' + esc(att.name) + '</div>' + (att.size ? '<div class="fq-attach-preview-size">' + (att.size / 1024).toFixed(1) + ' KB</div>' : '');
    dom.attachPreview.appendChild(info);
    var rmBtn = el('button', 'fq-attach-remove');
    rmBtn.setAttribute('aria-label', 'إزالة المرفق');
    rmBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    rmBtn.onclick = function () { state.attachment = null; dom.attachPreview.style.display = 'none'; dom.fileInput.value = ''; updateSendState(); };
    dom.attachPreview.appendChild(rmBtn);
  }

  function buildFooter() {
    var c = mc();
    var footer = el('div', 'fq-footer');
    footer.style.background = c.footerBg;
    footer.style.borderTop = '1px solid ' + c.footerBorder;
    footer.innerHTML = FUQAH_SVG;
    var a = el('a', 'fq-footer-link');
    a.href = 'https://www.fuqah.ai';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.color = c.footerText;
    a.innerHTML = 'مدعوم من <strong style="color:' + c.footerBrand + '">فقاعة AI</strong>';
    a.onmouseover = function () { this.style.color = isDark() ? '#cbd5e1' : '#6b7280'; };
    a.onmouseout = function () { this.style.color = c.footerText; };
    footer.appendChild(a);
    return footer;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 14. SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════
  // ── Arabic normalization + intent helpers (v4.7.7) ─────────────────
  function normalizeAr(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[.!؟?،,؛:]/g, '')
      .replace(/\s+/g, ' ');
  }
  function isTicketOfferText(text) {
    var n = normalizeAr(text);
    var hasSupport = n.indexOf('خدمه العملاء') !== -1 || n.indexOf('الدعم') !== -1 || n.indexOf('الدعم الفني') !== -1;
    var hasTicket = n.indexOf('تذكره') !== -1 || n.indexOf('طلب دعم') !== -1;
    var hasContact = n.indexOf('يتواصل') !== -1 || n.indexOf('سيتواصل') !== -1 || n.indexOf('التواصل') !== -1 || n.indexOf('تواصل') !== -1 || n.indexOf('يتصل') !== -1 || n.indexOf('اكلم') !== -1 || n.indexOf('احول') !== -1;
    var asksPhone = n.indexOf('رقم هاتفك') !== -1 || n.indexOf('رقم جوالك') !== -1 || n.indexOf('رقمك') !== -1 || n.indexOf('هاتفك') !== -1 || n.indexOf('جوالك') !== -1;
    return n.indexOf('يتواصل معك احد موظفي خدمه العملاء') !== -1
        || n.indexOf('يتواصل معك موظف خدمه العملاء') !== -1
        || n.indexOf('اكلم خدمه العملاء') !== -1
        || n.indexOf('احول لخدمه العملاء') !== -1
        || (hasSupport && (hasContact || asksPhone || hasTicket))
        || (hasTicket && (hasContact || asksPhone || n.indexOf('انشاء') !== -1 || n.indexOf('رفع') !== -1))
        || (n.indexOf('customer service') !== -1 && (n.indexOf('contact') !== -1 || n.indexOf('ticket') !== -1 || n.indexOf('phone') !== -1))
        || (n.indexOf('support') !== -1 && (n.indexOf('contact') !== -1 || n.indexOf('ticket') !== -1 || n.indexOf('phone') !== -1));
  }
  function isShortAffirmative(text) {
    var n = normalizeAr(text);
    return /^(نعم|اي|اي نعم|ايه|ايوه|ايوا|تمام|تم|اكيد|موافق|yes|yeah|yep|ok|okay|sure)$/.test(n);
  }
  // v4.7.8 — short negative reply to "هل تحتاج مساعدة إضافية؟"
  function isShortNegative(text) {
    var n = normalizeAr(text);
    return /^(لا|لأ|لا شكرا|لا شكرن|كفايه|كفايه شكرا|مشكور|مشكوره|مشكورين|تمام شكرا|شكرا|شكرن|no|nope|nah|nothing|that's all|thats all|im good|i'm good)$/.test(n);
  }
  // v4.7.8 — "do you need anything else?" detector
  function isCloseOfferText(text) {
    var n = normalizeAr(text);
    return n.indexOf('هل تحتاج اي مساعده اخري') !== -1
        || n.indexOf('هل تحتاج اي مساعده اخرى') !== -1
        || n.indexOf('هل تحتاج مساعده اضافيه') !== -1
        || n.indexOf('هل تحتاج مساعده اخري') !== -1
        || n.indexOf('هل تحتاج لمساعده اخري') !== -1
        || n.indexOf('في اي شي تاني') !== -1
        || n.indexOf('في شي ثاني') !== -1
        || (n.indexOf('do you need') !== -1 && (n.indexOf('any other help') !== -1 || n.indexOf('anything else') !== -1));
  }
  // v4.7.14 — farewell reply detector: AI's closing message after user says no/شكرا
  function isCloseDoneReply(text) {
    var n = normalizeAr(text);
    if (!n) return false;
    return n.indexOf('شكرا لتواصلك معنا') !== -1
        || n.indexOf('شكرن لتواصلك معنا') !== -1
        || n.indexOf('يومك سعيد') !== -1
        || n.indexOf('في امان الله') !== -1
        || n.indexOf('في امان لله') !== -1
        || n.indexOf('نتمني لك يوما سعيدا') !== -1
        || n.indexOf('سعدنا بخدمتك') !== -1
        || n.indexOf('سعدنا بتواصلك') !== -1
        || n.indexOf('have a great day') !== -1
        || n.indexOf('have a nice day') !== -1
        || n.indexOf('thanks for contacting') !== -1;
  }
  function hasOpenTicketForm() {
    for (var i = 0; i < state.messages.length; i++) {
      var m = state.messages[i];
      if (m && m.type === 'ticket-form' && !m.ticketFormSubmitted) return true;
    }
    return false;
  }
  function lastStoreMessage() {
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i] && state.messages[i].sender === 'store') return state.messages[i];
    }
    return null;
  }

  function appendInlineTicketForm(trigger) {
    if (state.ticketCreated) {
      state.messages.push({
        id: 'dup-' + Date.now(),
        text: 'تم إنشاء تذكرة مسبقاً لهذه المحادثة.',
        sender: 'store', timestamp: new Date(), type: 'ticket-success',
      });
      return;
    }
    if (hasOpenTicketForm()) return;
    state.messages.push({
      id: 'ticket-form-' + Date.now(),
      text: 'يرجى إدخال رقم هاتفك ليتم إنشاء تذكرة دعم لك:',
      sender: 'store', timestamp: new Date(),
      type: 'ticket-form', ticketFormSubmitted: false,
    });
    state.ticketSource = 'inline';
  }

  // v4.7.19 — merge multi-line input into ONE message and ONE webhook call
  function doSend() {
    var raw = dom.textarea.value || '';
    var att = state.attachment;
    // Trim trailing/leading whitespace but PRESERVE internal newlines.
    // Collapse 3+ consecutive newlines into 2 and drop blank-only lines at edges.
    var text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');

    if (!text && !att) return;

    // Reset input immediately
    state.attachment = null;
    dom.textarea.value = '';
    dom.textarea.style.height = 'auto';
    if (dom.attachPreview) dom.attachPreview.style.display = 'none';
    if (dom.fileInput) dom.fileInput.value = '';

    state.messages.push({
      id: '' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      text: text,
      sender: 'customer',
      attachment: att,
      timestamp: new Date(),
    });
    state.isTyping = true;
    renderMessages();
    bumpActivity();
    setInputDisabled(true);

    sendToBackend(text, att, function (aiText, attachments, intent, aiMessageId) {
      try {
        // v4.7.28 — when offering a ticket, suppress the AI prose so we only show
        // the green ticket-form prompt (avoids duplicate red+green messages).
        // v4.7.29 — detect ticket-offer either via backend intent OR via AI prose
        // (in case the LLM returned the prompt as text without setting intent).
        var _looksLikeTicketOffer = !!(aiText && /تذكرة/.test(aiText) && /(ادخل|أدخل|إدخال).{0,40}(رقم.{0,5}(هاتف|جوّال|جوال)|جوّال|جوال)/.test(aiText));
        var _offerTicket = (intent === 'offer_ticket' || _looksLikeTicketOffer) && !state.ticketCreated && !hasOpenTicketForm();
        if (_offerTicket) {
          appendInlineTicketForm('backend');
        } else {
          pushAiMessage(aiText, attachments, aiMessageId);
        }
        state.isTyping = false;
        if (intent === 'closed') {
          setTimeout(function () {
            if (state.ticketCreated) renderTicketCreatedScreen();
            else renderRatingScreen();
          }, 2000);
        }
        setInputDisabled(false);
        renderMessages();
        bumpActivity();
      } catch (e) {
        console.warn('[Fuqah] doSend handler error:', e && e.message || e);
        state.isTyping = false;
        setInputDisabled(false);
        try { renderMessages(); } catch (e2) {}
      }
    });
  }

  // v4.7.15 — end conversation without showing rating
  function endConversationNoRating(reason) {
    if (state.conversationEnded) return;
    state.conversationEnded = true;
    try { restCloseConversation(reason || 'customer_manual'); } catch (e) {}
    if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
    if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
    state.showInactivityPrompt = false;
    if (dom.textarea) { dom.textarea.disabled = true; dom.textarea.placeholder = 'تم إنهاء المحادثة'; }
    if (dom.attachBtn) dom.attachBtn.disabled = true;
    if (typeof updateSendState === 'function') updateSendState();
    try { renderMessages(); } catch (e) {}
  }

  
  // ── Mock AI reply picker — mirrors React app logic ──
  function pickMockAiReply(userText, hasAttachment) {
    if (hasAttachment) return 'شكراً لإرسال الملف! سنقوم بمراجعته والرد عليك قريباً.';
    var lower = (userText || '').toLowerCase();
    var keywords = ['تذكرة', 'تذاكر', 'رقم', 'طلب', 'شكوى', 'هاتف', 'جوال', 'موبايل'];
    var wantsPhone = false;
    for (var i = 0; i < keywords.length; i++) {
      if ((userText || '').indexOf(keywords[i]) !== -1) { wantsPhone = true; break; }
    }
    if (lower.indexOf('{{number}}') !== -1) wantsPhone = true;
    if (wantsPhone) {
      return 'تفضّل، أدخل رقم هاتفك حتى نتمكن من متابعة طلبك:\n{{number}}';
    }
    return 'شكراً لتواصلك معنا! كيف يمكنني مساعدتك اليوم؟';
  }

  // ── Push AI message. UI actions are handled only through action.type. ──
  function pushAiMessage(rawText, attachments, aiMessageId) {
    var cleaned = String(rawText || '').replace(/\{\{\s*number\s*\}\}/gi, '').replace(/\n{3,}/g, '\n\n').trim();

    // v4.7.16 — once ended, drop any further bubbles entirely.
    if (state.conversationEnded) {
      return;
    }

    var productCards = [];
    if (attachments && attachments.length) {
      for (var ai = 0; ai < attachments.length && productCards.length < 5; ai++) {
        var att = attachments[ai];
        if (att && att.type === 'product_card') productCards.push(att);
      }
    }
    state.messages.push({
      id: aiMessageId || ('' + (Date.now() + 1)),
      text: cleaned,
      sender: 'store', timestamp: new Date(),
      productCards: productCards.length ? productCards : null,
    });
  }

  function setInputDisabled(disabled) {
    if (dom.textarea) { dom.textarea.disabled = disabled; dom.textarea.placeholder = disabled ? 'جاري الكتابة...' : 'اكتب رسالتك...'; }
    if (dom.attachBtn) dom.attachBtn.disabled = disabled;
    updateSendState();
  }

  function handleInlineTicketSubmit(phone, dialCode, msg) {
    if (state.ticketCreated) {
      state.messages.push({ id: 'dup-' + Date.now(), text: 'تم إنشاء تذكرة مسبقاً لهذه المحادثة.', sender: 'store', timestamp: new Date(), type: 'ticket-success' });
      state.messages.forEach(function (m) { if (m.type === 'ticket-form' && !m.ticketFormSubmitted) m.ticketFormSubmitted = true; });
      renderMessages();
      return;
    }
    state.messages.forEach(function (m) { if (m.type === 'ticket-form' && !m.ticketFormSubmitted) m.ticketFormSubmitted = true; });
    renderMessages();
    restCreateTicket({
      conversation_id: state.conversationId,
      subject: 'طلب من المحادثة',
      description: msg || '',
      customer_phone: (dialCode || '') + (phone || ''),
    }, function (row, err) {
      if (!row) {
        state.messages.push({
          id: 'ticket-error-' + Date.now(),
          text: 'تعذّر إنشاء التذكرة، يرجى المحاولة مرة أخرى.',
          sender: 'store', timestamp: new Date(),
        });
        renderMessages();
        return;
      }
      state.ticketCreated = true;
      if (row && (row.display_code || row.number)) {
        state.ticketId = '#' + (row.display_code || ('TKT-' + row.number));
      }
      // v4.7.29 — removed duplicate blue "تم استلام رقمك" bubble; the green inline success badge is enough.
      renderMessages();
      if (state.pendingTicketTimer) { clearTimeout(state.pendingTicketTimer); state.pendingTicketTimer = null; }
      state.pendingTicketTimer = setTimeout(function () {
        state.pendingTicketTimer = null;
        if (state.ticketCreated && !state.conversationEnded) renderTicketCreatedScreen();
      }, 1200);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 15. CLOSE FLOW
  // ═══════════════════════════════════════════════════════════════════
  function handleCloseClick() {
    if (state.messages.length === 0) { closeChat(); return; }
    showConfirmModal();
  }

  function showConfirmModal() {
    if (dom.modalOverlay) dom.modalOverlay.remove();
    var c = mc();
    var accentColor = settings.mainColor;

    var overlay = el('div', 'fq-modal-overlay');
    overlay.onclick = function (e) { if (e.target === overlay) { overlay.remove(); dom.modalOverlay = null; } };

    var card = el('div', 'fq-modal-card');
    card.style.background = isDark() ? '#1e293b' : '#FFFFFF';

    var accent = el('div', 'fq-modal-accent');
    accent.style.background = accentColor;
    card.appendChild(accent);

    var body = el('div', 'fq-modal-body');

    // Close X
    var closeRow = el('div', 'fq-modal-close-row');
    var closeBtn = el('button', 'fq-modal-close-btn');
    closeBtn.style.color = isDark() ? '#64748b' : '#9ca3af';
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = function () { overlay.remove(); dom.modalOverlay = null; };
    closeRow.appendChild(closeBtn);
    body.appendChild(closeRow);

    // Center content
    var center = el('div', 'fq-modal-center');
    var iconWrap = el('div', 'fq-modal-icon-wrap');
    iconWrap.style.background = accentColor + (isDark() ? '20' : '10');
    iconWrap.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + accentColor + '" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>';
    center.appendChild(iconWrap);
    var title = el('h3', 'fq-modal-title');
    title.textContent = 'إغلاق المحادثة';
    title.style.color = isDark() ? '#f1f5f9' : '#1f2937';
    center.appendChild(title);
    var desc = el('p', 'fq-modal-desc');
    desc.textContent = 'يمكنك رفع تذكرة، إغلاق المحادثة، أو العودة لاحقاً';
    desc.style.color = isDark() ? '#94a3b8' : '#9ca3af';
    center.appendChild(desc);
    body.appendChild(center);

    // Actions
    var actions = el('div', 'fq-modal-actions');

    // Close chat
    var closeChat_ = el('button', 'fq-modal-btn');
    closeChat_.style.background = accentColor;
    closeChat_.style.color = '#FFFFFF';
    closeChat_.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg> إغلاق المحادثة';
    closeChat_.onclick = function () {
      try { overlay.remove(); } catch(e){}
      dom.modalOverlay = null;
      showRatingBeforeClose('user_x_close');
    };
    actions.appendChild(closeChat_);

    // Return to chat
    var returnBtn = el('button', 'fq-modal-btn fq-modal-btn-secondary');
    returnBtn.style.background = isDark() ? '#0f172a' : '#f9fafb';
    returnBtn.style.borderColor = isDark() ? '#334155' : '#e5e7eb';
    returnBtn.style.color = isDark() ? '#cbd5e1' : '#4b5563';
    returnBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg> سأعود للمحادثة';
    returnBtn.onclick = function () { overlay.remove(); dom.modalOverlay = null; closeChat(); };
    actions.appendChild(returnBtn);

    // Create ticket
    var ticketBtn = el('button', 'fq-modal-btn fq-modal-btn-tertiary');
    ticketBtn.style.borderColor = isDark() ? '#334155' : '#e5e7eb';
    ticketBtn.style.color = isDark() ? '#94a3b8' : '#6b7280';
    ticketBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg> رفع تذكرة';
    ticketBtn.onclick = function () { overlay.remove(); dom.modalOverlay = null; state.ticketSource = 'form'; renderCreateTicketScreen(); };
    actions.appendChild(ticketBtn);

    body.appendChild(actions);
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    dom.modalOverlay = overlay;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 16. RATING SCREEN
  // ═══════════════════════════════════════════════════════════════════
  function renderRatingScreen() {
    clearInner();
    state.currentScreen = 'rating';
    state.rating = 0;
    state.feedback = '';
    // Rating-screen idle timer: on expiry perform the exact same action as
    // the "تخطي وإغلاق" button — close immediately and reset for next open.
    if (state.ratingInactivityTimer) { clearTimeout(state.ratingInactivityTimer); state.ratingInactivityTimer = null; }
    var ratingIdleMs = Math.max(30, settings.ratingInactivitySeconds || 120) * 1000;
    state.ratingInactivityTimer = setTimeout(function () {
      state.ratingInactivityTimer = null;
      try { restCloseConversation('rating_skip'); } catch (e) {}
      try { resetConversationForNextOpen(); } catch (e) {}
    }, ratingIdleMs);
    var c = mc();
    var accentColor = settings.mainColor;
    var pageBg = isDark() ? '#1e293b' : '#FFFFFF';
    dom.window.style.background = pageBg;

    var screen = el('div', 'fq-screen');

    // Accent
    var accent = el('div', 'fq-screen-accent');
    accent.style.background = accentColor;
    screen.appendChild(accent);

    // Header
    var header = el('div', 'fq-screen-header');
    header.style.borderBottom = '1px solid ' + (isDark() ? '#334155' : '#f3f4f6');
    var backBtn = el('button', 'fq-screen-back');
    backBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#94a3b8' : '#6b7280') + '" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    backBtn.onclick = function () { renderChatScreen(); };
    header.appendChild(backBtn);
    var title = el('h3', 'fq-screen-title');
    title.textContent = 'تقييم التجربة';
    title.style.color = isDark() ? '#f1f5f9' : '#1f2937';
    header.appendChild(title);
    screen.appendChild(header);

    // Body
    var body = el('div', 'fq-screen-body fq-no-scrollbar');
    body.setAttribute('data-chat-scrollable', '');
    body.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:20px 24px 16px;';

    var emoji = el('div');
    emoji.style.cssText = 'font-size:40px;line-height:1;margin-bottom:12px;';
    emoji.textContent = '⭐';
    body.appendChild(emoji);

    var t = el('h3');
    t.textContent = 'قيّم تجربتك';
    t.style.cssText = 'font-size:18px;font-weight:700;color:' + c.primaryText + ';margin-bottom:6px;';
    body.appendChild(t);

    var d = el('p');
    d.textContent = 'كيف كانت تجربتك مع ' + settings.storeName + '؟';
    d.style.cssText = 'font-size:13px;line-height:1.6;color:' + c.secondaryText + ';margin-bottom:16px;';
    body.appendChild(d);

    // Stars
    var starsDiv = el('div', 'fq-stars');
    var labels = { 1: 'سيئة جداً', 2: 'سيئة', 3: 'مقبولة', 4: 'جيدة', 5: 'ممتازة' };
    var labelEl = el('p');
    labelEl.style.cssText = 'font-size:13px;font-weight:600;color:' + accentColor + ';min-height:20px;opacity:0;margin-bottom:16px;';

    for (var i = 1; i <= 5; i++) {
      (function (star) {
        var btn = el('button', 'fq-star');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="' + (isDark() ? '#4b5563' : '#e5e7eb') + '" stroke="' + (isDark() ? '#4b5563' : '#e5e7eb') + '" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
        btn.onclick = function () {
          state.rating = star;
          updateStarsUI();
          labelEl.textContent = labels[star] || '';
          labelEl.style.opacity = '1';
          submitBtn.disabled = false;
        };
        starsDiv.appendChild(btn);
      })(i);
    }
    body.appendChild(starsDiv);
    body.appendChild(labelEl);

    function updateStarsUI() {
      var stars = starsDiv.querySelectorAll('.fq-star svg');
      for (var j = 0; j < stars.length; j++) {
        var active = j < state.rating;
        stars[j].setAttribute('fill', active ? '#facc15' : (isDark() ? '#4b5563' : '#e5e7eb'));
        stars[j].setAttribute('stroke', active ? '#facc15' : (isDark() ? '#4b5563' : '#e5e7eb'));
      }
    }

    // Feedback
    var textareaWrap = el('div');
    textareaWrap.style.cssText = 'width:100%;margin-bottom:16px;';
    var ta = el('textarea');
    ta.placeholder = 'أخبرنا برأيك... (اختياري)';
    ta.rows = 3;
    ta.setAttribute('dir', 'rtl');
    ta.style.cssText = 'width:100%;padding:14px;border-radius:12px;resize:none;font-size:14px;border:1.5px solid ' + (isDark() ? '#334155' : '#e5e7eb') + ';outline:none;background:' + (isDark() ? '#0f172a' : '#f9fafb') + ';color:' + c.primaryText + ';font-family:inherit;line-height:1.55;';
    ta.onfocus = function () { this.style.borderColor = accentColor; };
    ta.onblur = function () { this.style.borderColor = isDark() ? '#334155' : '#e5e7eb'; };
    ta.oninput = function () { state.feedback = this.value; };
    textareaWrap.appendChild(ta);
    body.appendChild(textareaWrap);

    screen.appendChild(body);

    // Actions
    var actionsDiv = el('div', 'fq-screen-actions');
    actionsDiv.style.borderTop = '1px solid ' + (isDark() ? '#334155' : '#f3f4f6');
    actionsDiv.style.background = pageBg;

    var submitBtn = el('button', 'fq-screen-btn');
    submitBtn.textContent = 'إرسال التقييم';
    submitBtn.disabled = true;
    submitBtn.style.background = accentColor;
    submitBtn.style.color = '#FFFFFF';
    submitBtn.onclick = function () {
      if (state.rating === 0) return;
      restSubmitRating(state.rating, '');
      // Show thank you
      clearInner();
      var ty = el('div', 'fq-thankyou');
      ty.style.background = pageBg;
      ty.innerHTML = '<div class="fq-thankyou-emoji">✨</div><h3 style="font-size:20px;font-weight:700;color:' + c.primaryText + ';margin-bottom:8px">شكراً لك!</h3><p style="font-size:14px;line-height:1.6;color:' + c.secondaryText + '">نقدّر وقتك ونسعى دائماً<br>لتقديم خدمة أفضل</p>';
      dom.windowInner.appendChild(ty);
      dom.windowInner.appendChild(buildFooter());
      setTimeout(function () { resetConversationForNextOpen(); }, 1600);
    };
    actionsDiv.appendChild(submitBtn);

    var skipBtn = el('button', 'fq-screen-btn-secondary');
    skipBtn.textContent = 'تخطي وإغلاق';
    skipBtn.style.color = isDark() ? '#94a3b8' : '#9ca3af';
    skipBtn.onclick = function () { try { restCloseConversation('rating_skip'); } catch(e){} resetConversationForNextOpen(); };
    actionsDiv.appendChild(skipBtn);

    screen.appendChild(actionsDiv);

    // Footer
    screen.appendChild(buildFooter());
    dom.windowInner.appendChild(screen);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 17. CREATE TICKET SCREEN
  // ═══════════════════════════════════════════════════════════════════
  function renderCreateTicketScreen() {
    clearInner();
    state.currentScreen = 'ticket-form';
    // v4.7.28 — no idle timer on the ticket-form screen either.
    if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
    if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
    state.showInactivityPrompt = false;
    var c = mc();
    var accentColor = settings.mainColor;
    var pageBg = isDark() ? '#1e293b' : '#FFFFFF';
    dom.window.style.background = pageBg;

    var screen = el('div', 'fq-screen');
    var accent = el('div', 'fq-screen-accent');
    accent.style.background = accentColor;
    screen.appendChild(accent);

    // Header
    var header = el('div', 'fq-screen-header');
    header.style.borderBottom = '1px solid ' + (isDark() ? '#334155' : '#f3f4f6');
    var backBtn = el('button', 'fq-screen-back');
    backBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#94a3b8' : '#6b7280') + '" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    backBtn.onclick = function () { renderChatScreen(); };
    header.appendChild(backBtn);
    var title = el('h3', 'fq-screen-title');
    title.textContent = 'رفع تذكرة دعم';
    title.style.color = c.primaryText;
    header.appendChild(title);
    screen.appendChild(header);

    // Body
    var body = el('div', 'fq-screen-body fq-no-scrollbar');
    body.setAttribute('data-chat-scrollable', '');
    body.style.cssText = 'display:flex;flex-direction:column;padding:20px;';

    // Icon
    var iconWrap = el('div');
    iconWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
    var iconBox = el('div');
    iconBox.style.cssText = 'width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:' + accentColor + (isDark() ? '20' : '12');
    iconBox.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' + accentColor + '" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
    iconWrap.appendChild(iconBox);
    body.appendChild(iconWrap);

    var desc = el('p');
    desc.style.cssText = 'text-align:center;font-size:13px;color:' + c.secondaryText + ';line-height:1.7;margin-bottom:24px;';
    desc.textContent = 'أدخل رقم هاتفك وسيتواصل معك فريق ' + settings.storeName;
    body.appendChild(desc);

    if (state.ticketCreated) {
      // Already created
      var box = el('div');
      box.style.cssText = 'width:100%;border-radius:16px;padding:20px;text-align:center;background:' + (isDark() ? '#052e16' : '#f0fdf4') + ';border:1.5px solid ' + (isDark() ? '#166534' : '#bbf7d0');
      var p = el('p');
      p.style.cssText = 'font-size:14px;color:#16a34a;font-weight:600;line-height:1.7;';
      p.textContent = 'تم إنشاء تذكرة مسبقاً لهذه المحادثة.';
      box.appendChild(p);
      body.appendChild(box);

      body.appendChild(el('div')).style.cssText = 'height:16px;';

      var okBtn = el('button', 'fq-screen-btn');
      okBtn.textContent = 'حسناً، شكراً';
      okBtn.style.cssText = 'background:' + accentColor + ';color:#FFF;margin-bottom:10px;width:100%;padding:14px;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;';
      okBtn.onclick = function () { renderChatScreen(); };
      body.appendChild(okBtn);
    } else {
      // Phone label
      var label = el('p');
      label.textContent = 'رقم الهاتف';
      label.style.cssText = 'font-size:13px;font-weight:600;color:' + (isDark() ? '#cbd5e1' : '#374151') + ';margin-bottom:8px;';
      body.appendChild(label);

      var selectedCountry = COUNTRIES[0];
      var phoneRow = el('div', 'fq-phone-row');
      phoneRow.style.border = '1.5px solid ' + (isDark() ? '#475569' : '#d1d5db');
      phoneRow.style.background = isDark() ? '#0f172a' : '#f9fafb';

      var countryWrap = el('div');
      countryWrap.style.cssText = 'position:relative;flex-shrink:0;';
      var countryBtn = el('button', 'fq-country-btn');
      countryBtn.style.borderRight = '1.5px solid ' + (isDark() ? '#334155' : '#e5e7eb');
      countryBtn.style.minWidth = '88px';
      var flagEl = flagSVG(selectedCountry.code, 22);
      countryBtn.appendChild(flagEl);
      var codeSpan = el('span', 'fq-country-code');
      codeSpan.textContent = selectedCountry.code;
      codeSpan.style.color = isDark() ? '#cbd5e1' : '#374151';
      countryBtn.appendChild(codeSpan);
      var chevron = el('span', 'fq-country-chevron');
      chevron.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      countryBtn.appendChild(chevron);
      countryWrap.appendChild(countryBtn);
      phoneRow.appendChild(countryWrap);

      var phoneInput = el('input', 'fq-phone-input');
      phoneInput.type = 'tel';
      phoneInput.inputMode = 'numeric';
      phoneInput.placeholder = selectedCountry.placeholder;
      phoneInput.style.color = isDark() ? '#f1f5f9' : '#1f2937';
      phoneInput.style.caretColor = accentColor;
      phoneRow.appendChild(phoneInput);
      body.appendChild(phoneRow);

      var errorEl = el('p', 'fq-phone-error');
      errorEl.style.display = 'none';
      body.appendChild(errorEl);

      var dropdown = null;
      countryBtn.onclick = function () {
        if (dropdown) { dropdown.remove(); dropdown = null; chevron.classList.remove('fq-open'); return; }
        chevron.classList.add('fq-open');
        dropdown = el('div', 'fq-country-dropdown');
        dropdown.style.background = isDark() ? '#1e293b' : '#FFFFFF';
        dropdown.style.border = '1px solid ' + (isDark() ? '#334155' : '#e5e7eb');
        COUNTRIES.forEach(function (ctry) {
          var item = el('button', 'fq-country-item');
          if (selectedCountry.code === ctry.code) item.style.background = accentColor + '0d';
          item.appendChild(flagSVG(ctry.code, 20));
          var n = el('span', 'fq-country-item-name');
          n.textContent = ctry.code;
          n.style.color = isDark() ? '#cbd5e1' : '#374151';
          item.appendChild(n);
          var d = el('span', 'fq-country-item-dial');
          d.textContent = ctry.dialCode;
          d.style.color = isDark() ? '#64748b' : '#9ca3af';
          item.appendChild(d);
          item.onclick = function () {
            selectedCountry = ctry;
            var newFlag = flagSVG(ctry.code, 22);
            flagEl.replaceWith(newFlag);
            flagEl = newFlag;
            codeSpan.textContent = ctry.code;
            phoneInput.value = '';
            phoneInput.placeholder = ctry.placeholder;
            dropdown.remove(); dropdown = null; chevron.classList.remove('fq-open');
            phoneInput.focus();
          };
          dropdown.appendChild(item);
        });
        countryWrap.appendChild(dropdown);
      };
      document.addEventListener('mousedown', function h2(e) {
        if (dropdown && !countryWrap.contains(e.target)) { dropdown.remove(); dropdown = null; chevron.classList.remove('fq-open'); }
      });

      phoneInput.oninput = function () { phoneInput.value = phoneInput.value.replace(/[^\d\s]/g, ''); errorEl.style.display = 'none'; };
      phoneInput.onkeydown = function (e) { if (e.key === 'Enter') doSubmitTicket(); };

      body.appendChild(el('div')).style.cssText = 'height:16px;';

      var submitBtn = el('button', 'fq-screen-btn');
      submitBtn.textContent = 'إرسال التذكرة';
      submitBtn.style.cssText = 'background:' + accentColor + ';color:#FFF;margin-bottom:10px;width:100%;padding:14px;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;';
      submitBtn.onclick = function () { doSubmitTicket(); };
      body.appendChild(submitBtn);

      function doSubmitTicket() {
        var cleaned = phoneInput.value.replace(/\D/g, '');
        var result = validatePhone(selectedCountry.code, cleaned);
        if (!result.valid) { errorEl.textContent = result.error; errorEl.style.display = 'block'; phoneInput.focus(); return; }
        errorEl.style.display = 'none';
        if (submitBtn.disabled) return;
        var originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'wait';
        submitBtn.textContent = 'جارٍ الإرسال...';
        restCreateTicket({
          conversation_id: state.conversationId,
          subject: 'تذكرة من نموذج المتجر',
          description: '',
          customer_phone: (selectedCountry.dialCode || selectedCountry.code || '') + cleaned,
        }, function (row, err) {
          if (!row) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '';
            submitBtn.style.cursor = 'pointer';
            submitBtn.textContent = originalLabel;
            errorEl.textContent = (err && err.message) ? ('تعذّر إنشاء التذكرة: ' + (err.status ? '(' + err.status + ') ' : '') + err.message.slice(0,140)) : 'تعذّر إنشاء التذكرة، حاول مرة أخرى';
            errorEl.style.display = 'block';
            return;
          }
          state.ticketCreated = true;
          if (row && (row.display_code || row.number)) {
            state.ticketId = '#' + (row.display_code || ('TKT-' + row.number));
          }
          // v4.7.29 — removed duplicate blue "تم استلام رقمك" bubble.
          renderTicketCreatedScreen();
        });
      }
    }

    screen.appendChild(body);
    screen.appendChild(buildFooter());
    dom.windowInner.appendChild(screen);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 18. TICKET CREATED SCREEN
  // ═══════════════════════════════════════════════════════════════════
  function renderTicketCreatedScreen() {
    clearInner();
    state.currentScreen = 'ticket-created';
    // v4.7.29 — lock the back-arrow CSS for this screen.
    try { if (dom.window) dom.window.classList.add('fq-ticket-locked'); } catch (e) {}
    // v4.7.28 — no idle timer on the ticket screen.
    if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
    if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
    state.showInactivityPrompt = false;
    var c = mc();
    var accentColor = settings.mainColor;
    var pageBg = isDark() ? '#1e293b' : '#FFFFFF';
    dom.window.style.background = pageBg;

    var screen = el('div', 'fq-screen');
    var accent = el('div', 'fq-screen-accent');
    accent.style.background = accentColor;
    screen.appendChild(accent);

    // Header
    var header = el('div', 'fq-screen-header');
    header.style.borderBottom = '1px solid ' + (isDark() ? '#334155' : '#f3f4f6');
    // v4.7.28 — back arrow removed on the ticket-created screen.
    // Once a ticket is raised the customer cannot go back into chat.
    var title = el('h3', 'fq-screen-title');
    title.textContent = 'تم إنشاء التذكرة';
    title.style.color = c.primaryText;
    header.appendChild(title);
    screen.appendChild(header);

    // Body
    var body = el('div', 'fq-screen-body fq-no-scrollbar');
    body.setAttribute('data-chat-scrollable', '');
    body.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:20px 24px;';

    var iconWrap = el('div');
    iconWrap.style.cssText = 'width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:20px;background:' + accentColor + (isDark() ? '20' : '12');
    iconWrap.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="' + accentColor + '" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    body.appendChild(iconWrap);

    var t1 = el('h3');
    t1.textContent = 'تم تحويل محادثتك إلى تذكرة';
    t1.style.cssText = 'font-size:17px;font-weight:700;color:' + c.primaryText + ';margin-bottom:8px;text-align:center;';
    body.appendChild(t1);
    var d1 = el('p');
    d1.innerHTML = 'سيتولى فريق ' + esc(settings.storeName) + ' متابعة طلبك<br>وسنرد عليك في أقرب وقت ممكن';
    d1.style.cssText = 'font-size:13px;line-height:1.7;color:' + c.secondaryText + ';text-align:center;margin-bottom:24px;';
    body.appendChild(d1);

    // Card
    var card = el('div', 'fq-ticket-card');
    card.style.background = isDark() ? '#0f172a' : '#f9fafb';
    card.style.border = '1.5px solid ' + (isDark() ? '#334155' : '#e5e7eb');

    var row1 = el('div', 'fq-ticket-card-row');
    row1.style.borderBottom = '1px solid ' + (isDark() ? '#334155' : '#e5e7eb');
    row1.innerHTML = '<span class="fq-ticket-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> رقم التذكرة</span>';
    var badge = el('span', 'fq-ticket-badge');
    badge.textContent = state.ticketId;
    badge.style.background = accentColor + (isDark() ? '20' : '12');
    badge.style.color = accentColor;
    row1.appendChild(badge);
    card.appendChild(row1);

    var row2 = el('div', 'fq-ticket-card-row');
    row2.innerHTML = '<span class="fq-ticket-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> الحالة</span>';
    var statusBadge = el('span', 'fq-ticket-status');
    statusBadge.textContent = 'مفتوحة';
    statusBadge.style.background = isDark() ? '#052e16' : '#f0fdf4';
    statusBadge.style.border = '1px solid ' + (isDark() ? '#166534' : '#bbf7d0');
    row2.appendChild(statusBadge);
    card.appendChild(row2);

    var row3 = el('div', 'fq-ticket-card-row');
    row3.innerHTML = '<span class="fq-ticket-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (isDark() ? '#64748b' : '#9ca3af') + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> وقت الاستجابة</span>';
    var val = el('span', 'fq-ticket-value');
    val.textContent = 'خلال 24 ساعة';
    val.style.color = isDark() ? '#cbd5e1' : '#374151';
    row3.appendChild(val);
    card.appendChild(row3);

    body.appendChild(card);
    screen.appendChild(body);

    // Actions
    var actions = el('div', 'fq-screen-actions');
    actions.style.borderTop = '1px solid ' + (isDark() ? '#334155' : '#f3f4f6');
    actions.style.background = pageBg;

    var closeBtn = el('button', 'fq-screen-btn');
    closeBtn.textContent = 'حسناً، شكراً لك';
    closeBtn.style.background = accentColor;
    closeBtn.style.color = '#FFFFFF';
    closeBtn.style.marginBottom = '10px';
    closeBtn.onclick = function () {
      // v4.7.22 — ticket acknowledged: hard reset for a brand-new chat on next open
      try { restCloseConversation('user_ticket_acknowledged'); } catch(e){}
      resetConversationForNextOpen();
    };
    actions.appendChild(closeBtn);

    var dlBtn = el('button', 'fq-dl-btn');
    dlBtn.style.border = '1.5px solid ' + (isDark() ? '#334155' : '#e5e7eb');
    dlBtn.style.color = isDark() ? '#94a3b8' : '#6b7280';
    dlBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> تحميل التذكرة';
    dlBtn.onclick = function () { downloadAsImage('ticket'); };
    actions.appendChild(dlBtn);

    screen.appendChild(actions);
    screen.appendChild(buildFooter());
    dom.windowInner.appendChild(screen);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 19. OPEN / CLOSE
  // ═══════════════════════════════════════════════════════════════════
  function openChat() {
    if (settings.bubbleVisible === false) {
      cleanupWidgetDom();
      return;
    }
    if (!dom.bubble || !dom.overlay || !dom.window) return;
    state.isOpen = true;
    bumpActivity();
    try {
      if (TENANT_ID) {
        fetch(FUNCTIONS_BASE + '/widget-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
          body: JSON.stringify({ event: 'bubble.click', platform: PLATFORM, store_id: STORE_ID, store_uuid: STORE_UUID, domain: STORE_DOMAIN, tenant_id: TENANT_ID }),
          keepalive: true,
        }).catch(function(){});
      }
    } catch (e) {}
    hideWelcomeBubble();
    dom.bubble.style.display = 'none';
    dom.overlay.style.display = 'block';
    dom.window.style.display = 'flex';
    dom.window.classList.add('fq-window-enter');
    dom.window.classList.remove('fq-window-exit');
    updatePositions();
    lockBody();
    // v4.7.21 — always render the current screen so we never leave stale UI behind
    try {
      if (state.currentScreen === 'rating') renderRatingScreen();
      else if (state.currentScreen === 'ticket-form') renderCreateTicketScreen();
      else if (state.currentScreen === 'ticket-created' && state.ticketCreated) renderTicketCreatedScreen();
      else renderChatScreen();
    } catch (e) { try { renderChatScreen(); } catch (e2) {} }
  }

  function closeChat() {
    // Return to chat — hide but keep messages
    state.isOpen = false;
    dom.window.classList.add('fq-window-exit');
    dom.window.classList.remove('fq-window-enter');
    dom.overlay.style.display = 'none';
    unlockBody();
    setTimeout(function () {
      if (!state.isOpen) {
        if (settings.bubbleVisible === false) {
          cleanupWidgetDom();
          return;
        }
        if (dom.window) dom.window.style.display = 'none';
        if (dom.bubble) {
          dom.bubble.style.display = 'block';
          dom.bubble.className = 'fq-bubble fq-bubble-enter ' + (settings.position === 'bottom-right' ? 'fq-right' : 'fq-left');
        }
        if (dom.root) renderWelcomeBubble(dom.root);
      }
    }, 200);
  }


  // v4.7.22 — show rating screen as the close gate. Does NOT mark conversation ended,
  // so the rating UI renders cleanly instead of the "تم إنهاء المحادثة" disabled input.
  function showRatingBeforeClose(reason) {
    try {
      if (state.pendingTicketTimer) { clearTimeout(state.pendingTicketTimer); state.pendingTicketTimer = null; }
      if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
      if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
      state.showInactivityPrompt = false;
      state.conversationEnded = false;
      if (dom.modalOverlay) { try { dom.modalOverlay.remove(); } catch(e){} dom.modalOverlay = null; }
      state.currentScreen = 'chat';
      renderRatingScreen();
    } catch (e) { console.warn('[Fuqah] showRatingBeforeClose failed:', e); }
  }

  // v4.7.22 — clear all per-conversation state and close the widget, so the very next
  // open shows a brand-new empty chat (never the old ticket-created or ended screen).
  function resetConversationForNextOpen() {
    try { localStorage.removeItem('fuqah_conversation_id'); } catch (e) {}
    state.messages = [];
    state.ticketCreated = false;
    state.currentScreen = 'chat';
    state.conversationEnded = false;
    state.ticketSource = 'form';
    state.rating = 0;
    state.hoveredRating = 0;
    state.feedback = '';
    state.attachment = null;
    state.isTyping = false;
    state.showModal = false;
    state.showInactivityPrompt = false;
    state.conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    state.ticketId = '#TKT-' + Math.floor(10000 + Math.random() * 90000);
    if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
    if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
    if (state.pendingTicketTimer) { clearTimeout(state.pendingTicketTimer); state.pendingTicketTimer = null; }
    if (state.ratingInactivityTimer) { clearTimeout(state.ratingInactivityTimer); state.ratingInactivityTimer = null; }
    state.messageFeedback = {};
    if (dom.textarea) { dom.textarea.disabled = false; dom.textarea.placeholder = 'اكتب رسالتك...'; }
    if (dom.attachBtn) dom.attachBtn.disabled = false;
    try { renderChatScreen(); } catch (e) {}
    closeChat();
  }

  function fullClose() {
    try { localStorage.removeItem('fuqah_conversation_id'); } catch (e) {}
    state.isOpen = false;
    state.messages = [];
    state.ticketCreated = false;
    state.currentScreen = 'chat';
    state.conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    state.ticketId = '#TKT-' + Math.floor(10000 + Math.random() * 90000);
    // v4.7.20 — full per-conversation reset so next open is a brand-new chat
    state.conversationEnded = false;
    state.ticketSource = 'form';
    state.rating = 0;
    state.hoveredRating = 0;
    state.feedback = '';
    state.attachment = null;
    state.isTyping = false;
    state.showModal = false;
    state.showInactivityPrompt = false;
    if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
    if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
    if (state.pendingTicketTimer) { clearTimeout(state.pendingTicketTimer); state.pendingTicketTimer = null; }
    if (state.ratingInactivityTimer) { clearTimeout(state.ratingInactivityTimer); state.ratingInactivityTimer = null; }
    state.messageFeedback = {};
    // v4.7.21 — immediately rebuild the chat screen so the next open is guaranteed fresh
    try { renderChatScreen(); } catch(e) {}
    dom.window.classList.add('fq-window-exit');
    dom.window.classList.remove('fq-window-enter');
    dom.overlay.style.display = 'none';
    unlockBody();
    setTimeout(function () {
      if (!state.isOpen) {
        if (settings.bubbleVisible === false) {
          cleanupWidgetDom();
          return;
        }
        if (dom.window) dom.window.style.display = 'none';
        if (dom.bubble) {
          dom.bubble.style.display = 'block';
          dom.bubble.className = 'fq-bubble fq-bubble-enter ' + (settings.position === 'bottom-right' ? 'fq-right' : 'fq-left');
        }
        if (dom.root) renderWelcomeBubble(dom.root);
      }
    }, 200);
  }

  function scrollToBottom() {
    if (!dom.messages) return;
    dom.messages.scrollTop = dom.messages.scrollHeight;
    requestAnimationFrame(function () { if (dom.messages) dom.messages.scrollTop = dom.messages.scrollHeight; });
    setTimeout(function () { if (dom.messages) dom.messages.scrollTop = dom.messages.scrollHeight; }, 150);
  }


  // ═══════════════════════════════════════════════════════════════════
  // 19b. WELCOME BUBBLE
  // ═══════════════════════════════════════════════════════════════════
  function renderWelcomeBubble(root) {
    if (settings.bubbleVisible === false) return;
    if (!root) return;
    if (!settings.welcomeBubbleEnabled) return;
    if (state.welcomeBubbleDismissed) return;
    var l1 = (settings.welcomeBubbleLine1 || '').trim();
    var l2 = (settings.welcomeBubbleLine2 || '').trim();
    if (!l1 && !l2) return;

    if (dom.welcomeBubble) { dom.welcomeBubble.remove(); dom.welcomeBubble = null; }

    var isRight = settings.position === 'bottom-right';
    var dark = isDark();
    var bg = dark ? '#1e293b' : '#FFFFFF';
    var color = dark ? '#f1f5f9' : '#111827';
    var subColor = dark ? '#cbd5e1' : '#4b5563';
    var border = dark ? '#334155' : '#e5e7eb';

    var wrap = el('div', 'fq-welcome-bubble ' + (isRight ? 'fq-welcome-right' : 'fq-welcome-left'));
    wrap.style.background = bg;
    wrap.style.color = color;
    wrap.style.border = '1px solid ' + border;
    wrap.style.boxShadow = dark ? '0 6px 18px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.12)';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', 'فتح المحادثة');
    wrap.style.bottom = (84 + state.bottomOffset) + 'px';

    if (l1) {
      var s1 = el('span', 'fq-welcome-l1');
      s1.textContent = l1;
      s1.style.color = color;
      wrap.appendChild(s1);
    }
    if (l2) {
      var s2 = el('span', 'fq-welcome-l2');
      s2.textContent = l2;
      s2.style.color = subColor;
      wrap.appendChild(s2);
    }

    var closeBtn = el('button', 'fq-welcome-close');
    closeBtn.style.color = dark ? '#94a3b8' : '#9ca3af';
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.setAttribute('aria-label', 'إغلاق رسالة الترحيب');
    closeBtn.onclick = function (e) {
      e.stopPropagation();
      state.welcomeBubbleDismissed = true;
      if (dom.welcomeBubble) { dom.welcomeBubble.remove(); dom.welcomeBubble = null; }
    };
    wrap.appendChild(closeBtn);

    var tail = el('span', 'fq-welcome-tail');
    tail.style.background = bg;
    tail.style.borderRight = '1px solid ' + border;
    tail.style.borderBottom = '1px solid ' + border;
    wrap.appendChild(tail);

    wrap.onclick = function () {
      hideWelcomeBubble();
      openChat();
    };

    setTimeout(function () { wrap.classList.add('fq-welcome-visible'); }, 500);

    root.appendChild(wrap);
    dom.welcomeBubble = wrap;
  }

  function hideWelcomeBubble() {
    if (dom.welcomeBubble) { dom.welcomeBubble.remove(); dom.welcomeBubble = null; }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 19c. INACTIVITY PROMPT (3-stage timer)
  // ═══════════════════════════════════════════════════════════════════
  function bumpActivity() {
    state.inactivityActivityBump++;
    state.showInactivityPrompt = false;
    if (state.inactivityPromptTimer) { clearTimeout(state.inactivityPromptTimer); state.inactivityPromptTimer = null; }
    if (state.inactivityCloseTimer) { clearTimeout(state.inactivityCloseTimer); state.inactivityCloseTimer = null; }
    scheduleInactivityPrompt();
  }

  function scheduleInactivityPrompt() {
    if (!settings.inactivityEnabled) return;
    if (!state.isOpen) return;
    // v4.7.28 — idle timer is chat-only; tickets/rating screens must not auto-close.
    if (state.currentScreen !== 'chat') return;
    if (state.ticketCreated) return;
    if (state.messages.length === 0) return;
    if (state.isTyping) return;
    var startBump = state.inactivityActivityBump;
    var promptMs = Math.max(30, settings.inactivityPromptSeconds || 90) * 1000;
    state.inactivityPromptTimer = setTimeout(function () {
      if (state.inactivityActivityBump !== startBump) return;
      state.showInactivityPrompt = true;
      renderMessages();
      scheduleInactivityClose();
    }, promptMs);
  }

  function scheduleInactivityClose() {
    var closeMs = Math.max(15, settings.inactivityCloseSeconds || 60) * 1000;
    state.inactivityCloseTimer = setTimeout(function () {
      state.showInactivityPrompt = false;
      showRatingBeforeClose('inactivity_auto');
    }, closeMs);
  }

  function buildInactivityPrompt() {
    var dark = isDark();
    var bg = dark ? '#0f172a' : '#f9fafb';
    var border = dark ? '#334155' : '#e5e7eb';
    var text = dark ? '#f1f5f9' : '#1f2937';
    var secondary = dark ? '#94a3b8' : '#6b7280';
    var darkBtn = dark ? '#FFFFFF' : '#000000';
    var darkBtnText = dark ? '#0f172a' : '#FFFFFF';
    var accent = settings.mainColor || darkBtn;

    var wrap = el('div', 'fq-inactivity');
    wrap.style.background = bg;
    wrap.style.border = '1px solid ' + border;

    var head = el('div', 'fq-inactivity-head');
    var t1 = el('span', 'fq-inactivity-title');
    t1.textContent = 'هل ما زلت معنا؟ 👋';
    t1.style.color = text;
    var t2 = el('span', 'fq-inactivity-sub');
    t2.textContent = 'لاحظنا عدم وجود نشاط، هل تود متابعة المحادثة؟';
    t2.style.color = secondary;
    head.appendChild(t1); head.appendChild(t2);
    wrap.appendChild(head);

    var actions = el('div', 'fq-inactivity-actions');
    var contBtn = el('button', 'fq-inactivity-continue');
    contBtn.textContent = 'متابعة المحادثة';
    contBtn.style.background = accent;
    contBtn.style.color = settings.mainColor ? '#FFFFFF' : darkBtnText;
    contBtn.onclick = function () { bumpActivity(); renderMessages(); };
    var endBtn = el('button', 'fq-inactivity-end');
    endBtn.textContent = 'إنهاء المحادثة';
    endBtn.style.color = text;
    endBtn.style.border = '1px solid ' + border;
    endBtn.onclick = function () {
      showRatingBeforeClose('inactivity_manual');
    };
    actions.appendChild(contBtn); actions.appendChild(endBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  // 20. FETCH SETTINGS FROM SUPABASE
  // ═══════════════════════════════════════════════════════════════════
  function cacheBust(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
  }

  function fetchConfig(callback) {
    var url = cacheBust(
      FUNCTIONS_BASE + '/widget-bootstrap?platform=' + encodeURIComponent(PLATFORM)
      + '&external_id=' + encodeURIComponent(STORE_EXTERNAL_ID)
      + (STORE_DOMAIN ? '&domain=' + encodeURIComponent(STORE_DOMAIN) : '')
    );
    fetch(url, { cache: 'no-store', headers: AUTH_HEADERS })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.tenant_id) {
          console.warn('[Fuqah] widget-bootstrap: no tenant for storeId=' + STORE_ID + ' storeUuid=' + STORE_UUID + ' domain=' + STORE_DOMAIN);
          callback();
          return;
        }
        TENANT_ID = res.tenant_id;
        console.log('[Fuqah] Resolved tenant=' + TENANT_ID + ' active=' + res.is_active);
        if (res.store_id && !STORE_ID) { STORE_ID = String(res.store_id); console.info('[Fuqah] Backfilled storeId: ' + STORE_ID); }
        if (res.store_uuid && !STORE_UUID) { STORE_UUID = String(res.store_uuid); }
        if (res.cfg) {
          applyConfigPayload(res.cfg);
          console.log('[Fuqah] Config OK: name=' + settings.storeName + ' main=' + settings.mainColor + ' mode=' + settings.mode + ' pos=' + settings.position + ' visible=' + settings.bubbleVisible);
          // Cache for instant paint on next visit
          try {
            window.localStorage && window.localStorage.setItem(FQ_CACHE_KEY, JSON.stringify({
              tenant_id: res.tenant_id,
              store_id: STORE_ID || null,
              store_uuid: STORE_UUID || null,
              updated_at: res.updated_at || null,
              cfg: res.cfg,
              ts: Date.now(),
            }));
          } catch (e) {}
        }
        callback();
      })
      .catch(function (err) {
        console.warn('[Fuqah] Bootstrap fetch failed (using defaults):', err && err.message || err);
        callback();
      });
  }

  // Write a widget-config response into `settings`. Returns true if any
  // visually relevant field changed.
  function applyConfigPayload(s) {
    if (!s) return false;
    var before = JSON.stringify({
      a: settings.mainColor, b: settings.mode, c: settings.widgetOuterColor,
      d: settings.widgetInnerColor, e: settings.position, f: settings.welcomeBubbleEnabled,
      g: settings.welcomeBubbleLine1, h: settings.welcomeBubbleLine2,
      i: settings.storeName, j: settings.storeLogo, k: settings.storeIcon,
      l: settings.bubbleVisible,
    });
    if (s.primary_color) settings.mainColor = s.primary_color;
    // theme_mode/preview_mode may flip back to light, so honor both
    if (s.theme_mode === 'dark' || s.preview_mode === 'dark') {
      settings.mode = 'dark';
    } else if (s.theme_mode === 'light' || s.preview_mode === 'light') {
      settings.mode = 'light';
    }
    if (s.widget_outer_color) settings.widgetOuterColor = s.widget_outer_color;
    if (s.widget_inner_color) settings.widgetInnerColor = s.widget_inner_color;
    settings.position = (s.position === 'left') ? 'bottom-left' : 'bottom-right';
    if (typeof s.welcome_bubble_enabled === 'boolean') settings.welcomeBubbleEnabled = s.welcome_bubble_enabled;
    if (s.welcome_bubble_line1) settings.welcomeBubbleLine1 = s.welcome_bubble_line1;
    if (s.welcome_bubble_line2) settings.welcomeBubbleLine2 = s.welcome_bubble_line2;
    if (typeof s.inactivity_enabled === 'boolean') settings.inactivityEnabled = s.inactivity_enabled;
    if (typeof s.inactivity_prompt_seconds === 'number') settings.inactivityPromptSeconds = s.inactivity_prompt_seconds;
    if (typeof s.inactivity_close_seconds === 'number') settings.inactivityCloseSeconds = s.inactivity_close_seconds;
    if (typeof s.rating_inactivity_seconds === 'number') settings.ratingInactivitySeconds = s.rating_inactivity_seconds;
    if (s.workspace_name) settings.storeName = s.workspace_name;
    if (s.logo_url) settings.storeLogo = s.logo_url;
    if (s.icon_url) settings.storeIcon = s.icon_url;
    settings.bubbleVisible = s.bubble_visible === false ? false : true;
    var after = JSON.stringify({
      a: settings.mainColor, b: settings.mode, c: settings.widgetOuterColor,
      d: settings.widgetInnerColor, e: settings.position, f: settings.welcomeBubbleEnabled,
      g: settings.welcomeBubbleLine1, h: settings.welcomeBubbleLine2,
      i: settings.storeName, j: settings.storeLogo, k: settings.storeIcon,
      l: settings.bubbleVisible,
    });
    return before !== after;
  }

  // Re-fetch widget-config only (skip widget-resolve once we have a tenant)
  // and re-render the bubble if anything visual changed AND the chat window
  // is closed (we avoid re-rendering mid-conversation to prevent flicker).
  var _refreshing = false;
  function refreshConfigLive() {
    if (_refreshing) return;
    if (!TENANT_ID) return; // boot fetch hasn't resolved a tenant yet
    _refreshing = true;
    fetch(cacheBust(FUNCTIONS_BASE + '/widget-config?tenant_id=' + TENANT_ID), {
      cache: 'no-store', headers: AUTH_HEADERS,
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (!s) return;
        var changed = applyConfigPayload(s);
        if (!changed) return;
        if (settings.bubbleVisible === false) {
          cleanupWidgetDom();
          return;
        }
        // Don't re-render while the chat window is open — it would wipe
        // the current conversation UI. The new settings will apply next
        // time the user opens the bubble.
        if (state && state.isOpen) return;
        try {
          console.log('[Fuqah] Live settings change detected, re-rendering bubble');
          buildWidget();
        } catch (e) {
          console.warn('[Fuqah] Live re-render failed:', e && e.message || e);
        }
      })
      .catch(function (err) {
        console.warn('[Fuqah] Live config refresh failed:', err && err.message || err);
      })
      .then(function () { _refreshing = false; });
  }

  // Wire visibility / focus / interval triggers exactly once.
  var _liveWired = false;
  function wireLiveConfigRefresh() {
    if (_liveWired) return;
    _liveWired = true;
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') refreshConfigLive();
      });
      window.addEventListener('focus', refreshConfigLive);
      setInterval(function () {
        if (document.visibilityState === 'visible') refreshConfigLive();
      }, 20000);
      console.log('[Fuqah] Live config refresh wired (focus + visibility + 20s poll)');
    } catch (e) {
      console.warn('[Fuqah] Failed to wire live config refresh:', e && e.message || e);
    }
  }

  // Visitor id (persists across sessions for grouping conversations)
  function getVisitorId() {
    try {
      var k = 'fuqah_visitor_id';
      var v = localStorage.getItem(k);
      if (!v) {
        v = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 'v_' + Date.now().toString(36);
    }
  }

  // v4.7.24 — forward image attachments to chat-ai for vision
  function sendToBackend(text, attachment, callback) {
    var history = (state.messages || []).slice(-10).map(function (m) {
      return { sender: m.sender === 'customer' ? 'customer' : 'ai', text: m.text || '' };
    });
    var payload = {
      platform: PLATFORM,
      store_id: STORE_ID,
      store_uuid: STORE_UUID,
      domain: STORE_DOMAIN,
      visitor: ZID_CUSTOMER,
      tenant_id: TENANT_ID,
      conversation_id: state.conversationId,
      visitor_id: getVisitorId(),
      message: text,
      history: history,
    };
    if (attachment && attachment.dataUrl && attachment.type === 'image') {
      payload.attachments = [{
        url: attachment.dataUrl,
        name: attachment.name || 'image.jpg',
        content_type: 'image/jpeg',
        size: attachment.size || 0,
      }];
    }
    fetch(FUNCTIONS_BASE + '/chat-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && data.conversation_id) {
          state.conversationId = data.conversation_id;
        }
        // v4.7.16 — backend is the single brain: act on data.intent only
        var atts = (data && Array.isArray(data.attachments)) ? data.attachments : [];
        var intent = (data && typeof data.intent === 'string') ? data.intent : 'continue';
        var aiMsgId = data && data.ai_message_id ? data.ai_message_id : null;
        callback(data && data.reply ? String(data.reply) : 'عذراً، حدث خطأ مؤقت. حاول مرة أخرى.', atts, intent, aiMsgId);
      })
      .catch(function (err) {
        console.warn('[Fuqah] chat-ai failed:', err && err.message || err);
        callback('عذراً، تعذّر الاتصال. حاول مرة أخرى.', [], 'continue', null);
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 21. INIT
  // ═══════════════════════════════════════════════════════════════════
  function init() {
    console.log('[Fuqah] init() starting. document.body=' + !!document.body);
    loadCSS();

    function onLoaded() {
      console.log('[Fuqah] Config done. Building widget DOM...');
      {
        if (settings.bubbleVisible === false) {
          cleanupWidgetDom();
          window.__FUQAH_WIDGET_LOADED__ = false;
          window.__FUQAH_WIDGET_CONFIG__ = { platform: PLATFORM, storeId: STORE_ID, storeUuid: STORE_UUID, domain: STORE_DOMAIN, tenantId: TENANT_ID, bubbleVisible: false, version: '4.7.25' };
          console.log('[Fuqah] Widget v4.7.25 hidden by dashboard setting');
          return;
        }
        buildWidget();

        // Verify critical elements exist
        if (!dom.root || !dom.bubble || !dom.window) {
          console.error('[Fuqah] FATAL: Widget DOM build failed. root=' + !!dom.root + ' bubble=' + !!dom.bubble + ' window=' + !!dom.window);
          return;
        }

        // Platform bottom bar detection
        scanBottomBar();
        setInterval(scanBottomBar, 1500);
        window.addEventListener('scroll', function () { setTimeout(scanBottomBar, 100); }, { passive: true });
        window.addEventListener('resize', function () { scanBottomBar(); updatePositions(); }, { passive: true });

        // Mark as loaded for verification
        window.__FUQAH_WIDGET_LOADED__ = true;
        window.__FUQAH_WIDGET_CONFIG__ = { platform: PLATFORM, storeId: STORE_ID, storeUuid: STORE_UUID, domain: STORE_DOMAIN, tenantId: TENANT_ID, mainColor: settings.mainColor, mode: settings.mode, position: settings.position, storeName: settings.storeName, bubbleVisible: settings.bubbleVisible, version: '4.7.33' };

        console.log('[Fuqah] Widget v4.7.33 ready ✓  platform=' + PLATFORM + ' store=' + STORE_ID + ' uuid=' + STORE_UUID + ' domain=' + STORE_DOMAIN + ' bubble visible=' + settings.bubbleVisible + ' at ' + settings.position);
        console.log('[Fuqah] Verify: document.getElementById("fq-bubble")=', document.getElementById('fq-bubble'));

        // v3.5: never restore prior conversations on page load.
        // A page refresh always starts a fresh chat.
        try { localStorage.removeItem('fuqah_conversation_id'); } catch (e) {}

        // v4.7.32 — live settings refresh so dashboard changes appear
        // without a page reload.
        wireLiveConfigRefresh();
      }
    }

    fetchConfig(onLoaded);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 22. PUBLIC API
  // ═══════════════════════════════════════════════════════════════════
  window.FuqahChat = {
    open: function () { if (!state.isOpen) openChat(); },
    close: function () { if (state.isOpen) closeChat(); },
    toggle: function () { state.isOpen ? closeChat() : openChat(); },
    getMessages: function () { return state.messages; },
    getStoreId: function () { return STORE_ID; },
  };

  // ═══════════════════════════════════════════════════════════════════
  // BOOT — handles script in <head> (before body) or <body>
  // ═══════════════════════════════════════════════════════════════════
  // Verification snippet — paste in DevTools console:
  // console.log({ loaded: !!window.__FUQAH_WIDGET_LOADED__, config: window.__FUQAH_WIDGET_CONFIG__, bubble: document.getElementById('fq-bubble'), container: document.getElementById('fq-chat-window') });

  if (document.body) {
    console.log('[Fuqah] Boot: body available, calling init() now');
    init();
  } else {
    console.log('[Fuqah] Boot: body NOT ready, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', function () {
      console.log('[Fuqah] Boot: DOMContentLoaded fired, calling init()');
      init();
    });
  }


  // v4.7.25 — close conversation on tab close / hide so dashboard reflects within ~1s
  (function attachTabCloseHandler() {
    var fired = false;
    function fire() {
      if (fired || !state || !state.conversationId) return;
      fired = true;
      try { restCloseConversation('idle'); } catch (e) {}
    }
    try {
      window.addEventListener('pagehide', fire);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') fire();
      });
    } catch (e) {}
  })();

})();
