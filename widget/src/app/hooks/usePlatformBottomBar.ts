/**
 * usePlatformBottomBar — Detects floating bottom bars on e-commerce platforms
 * (Zid, Salla, Shopify, WooCommerce, etc.) and returns the offset the widget
 * should apply so it never overlaps with them.
 *
 * Detection strategy (robust, platform-agnostic):
 * 1. Known CSS selectors for popular platforms (Zid, Salla, etc.)
 * 2. Generic heuristic: scan for position:fixed/sticky elements anchored to
 *    the bottom of the viewport with a meaningful height.
 * 3. MutationObserver + periodic re-scan to catch bars that appear/disappear
 *    on scroll or after async rendering.
 *
 * Returns a `bottomOffset` in pixels — the height of the detected bar (0 if none).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Gap between the widget and the detected bar */
const GAP = 12;

/** Minimum element height to consider it a "bottom bar" */
const MIN_BAR_HEIGHT = 40;

/** Maximum height — ignore elements taller than this (probably full modals) */
const MAX_BAR_HEIGHT = 200;

/** How often to re-scan (ms) — acts as a safety net alongside MutationObserver */
const POLL_INTERVAL = 1500;

/**
 * Well-known selectors for floating bottom bars on popular platforms.
 * These are tried first for fast, reliable detection.
 */
const KNOWN_SELECTORS: string[] = [
  // ── Zid ──
  '.product-actions-bar',
  '.zid-product-sticky-bar',
  '.sticky-add-to-cart',
  '.sticky-atc-bar',
  '.product-sticky-bar',
  '.product-bottom-bar',
  '[data-sticky-add-to-cart]',
  '.zid-sticky-bar',
  '.add-to-cart-bar',
  '.mobile-product-actions',
  '.mobile-add-to-cart',
  // ── Salla ──
  '.s-product-sticky-bar',
  '.salla-sticky-bar',
  '.s-cart-sticky',
  '.salla-bottom-bar',
  '.s-bottom-bar',
  '[data-salla-sticky]',
  // ── Shopify ──
  '.shopify-sticky-bar',
  '.product-sticky-form',
  // ── Generic / common themes ──
  '.fixed-bottom-bar',
  '.sticky-bottom-bar',
  '.bottom-action-bar',
  '.mobile-bottom-bar',
  '.floating-bottom-bar',
  '#bottom-bar',
  '#sticky-add-to-cart',
];

/** Check if an element looks like a bottom bar based on computed styles */
function isBottomBar(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const pos = style.position;

  // Must be fixed or sticky
  if (pos !== 'fixed' && pos !== 'sticky') return false;

  // Must be visible
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  const rect = el.getBoundingClientRect();

  // Must have a meaningful height
  if (rect.height < MIN_BAR_HEIGHT || rect.height > MAX_BAR_HEIGHT) return false;

  // Must be anchored near the bottom of the viewport
  const viewportH = window.innerHeight;
  const distanceFromBottom = viewportH - rect.bottom;
  if (distanceFromBottom > 10) return false; // allow small rounding

  // Must span a significant width (> 50% of viewport) — skip narrow widgets
  if (rect.width < window.innerWidth * 0.5) return false;

  return true;
}

/**
 * Scan the DOM for the tallest visible bottom bar and return its height.
 */
function detectBottomBarHeight(): number {
  let maxHeight = 0;

  // 1) Check known selectors first
  for (const sel of KNOWN_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (isBottomBar(el)) {
          const h = el.getBoundingClientRect().height;
          if (h > maxHeight) maxHeight = h;
        }
      }
    } catch {
      // Invalid selector on this page — skip
    }
  }

  // 2) If nothing found via known selectors, run generic heuristic
  if (maxHeight === 0) {
    // Only scan direct children of body + a few levels deep to keep it fast
    const candidates = document.querySelectorAll(
      'body > *, body > * > *, [class*="sticky"], [class*="fixed"], [class*="bottom"]'
    );
    for (const el of candidates) {
      if (isBottomBar(el)) {
        const h = el.getBoundingClientRect().height;
        if (h > maxHeight) maxHeight = h;
      }
    }
  }

  return maxHeight;
}

export function usePlatformBottomBar(): number {
  const [bottomOffset, setBottomOffset] = useState(0);
  const prevHeightRef = useRef(0);

  const scan = useCallback(() => {
    const h = detectBottomBarHeight();
    if (h !== prevHeightRef.current) {
      prevHeightRef.current = h;
      setBottomOffset(h > 0 ? h + GAP : 0);
    }
  }, []);

  useEffect(() => {
    // Initial scan
    scan();

    // Periodic polling as a safety net
    const interval = setInterval(scan, POLL_INTERVAL);

    // MutationObserver for instant reaction to DOM changes
    const observer = new MutationObserver(() => {
      // Debounce slightly to batch rapid mutations
      requestAnimationFrame(scan);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Also listen to scroll (bars may appear/disappear on scroll)
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(scan, 100);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Resize
    window.addEventListener('resize', scan, { passive: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', scan);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [scan]);

  return bottomOffset;
}
