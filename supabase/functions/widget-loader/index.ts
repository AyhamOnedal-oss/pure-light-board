// Returns the storefront bootstrapper JS.
// The same script is injected into every Salla/Zid storefront via app snippets.
// At runtime it identifies the store from platform context, resolves the tenant_id,
// fetches the design config, and mounts the launcher in a Shadow DOM.
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "https://pure-light-board.lovable.app";

const LOADER_JS = `
(function () {
  if (window.__fuqahWidgetLoaded) return;
  window.__fuqahWidgetLoaded = true;

  var SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
  var ANON_KEY = ${JSON.stringify(ANON_KEY)};
  var APP_BASE_URL = ${JSON.stringify(APP_BASE_URL)};

  function detectPlatform() {
    // Highest priority: data-* attributes on the loader <script> tag itself.
    // Merchant snippet sets data-platform="zid" data-store-id="{{store.id}}".
    try {
      var candidates = [];
      if (document.currentScript) candidates.push(document.currentScript);
      var nodeList = document.querySelectorAll('script[src*="widget.js"], script[src*="widget-loader"]');
      for (var i = nodeList.length - 1; i >= 0; i--) candidates.push(nodeList[i]);
      for (var j = 0; j < candidates.length; j++) {
        var s = candidates[j];
        if (!s || !s.getAttribute) continue;
        var plat = s.getAttribute("data-platform");
        var sidRaw = s.getAttribute("data-store-id");
        var suidRaw = s.getAttribute("data-store-uuid");
        var sid = sidRaw && sidRaw.indexOf("{{") === -1 ? String(sidRaw).trim() : "";
        var suid = suidRaw && suidRaw.indexOf("{{") === -1 ? String(suidRaw).trim() : "";
        if (plat && (sid || suid)) {
          return { platform: plat, store_id: sid || null, store_uuid: suid || null, external_id: sid || suid };
        }
      }
    } catch (e) {}
    try {
      if (window.salla && window.salla.config && typeof window.salla.config.get === "function") {
        var sid = window.salla.config.get("store.id");
        if (sid) return { platform: "salla", store_id: String(sid), store_uuid: null, external_id: String(sid) };
      }
      if (window.Salla && window.Salla.config && window.Salla.config.store) {
        var sId = String(window.Salla.config.store.id);
        return { platform: "salla", store_id: sId, store_uuid: null, external_id: sId };
      }
    } catch (e) {}
    try {
      var meta = document.querySelector('meta[name="zid-store-id"], meta[name="store-uuid"]');
      if (meta && meta.content) {
        var mv = String(meta.content);
        var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mv);
        return { platform: "zid", store_id: isUuid ? null : mv, store_uuid: isUuid ? mv : null, external_id: mv };
      }
      if (window.zid) {
        if (window.zid.store_id) return { platform: "zid", store_id: String(window.zid.store_id), store_uuid: window.zid.store_uuid ? String(window.zid.store_uuid) : null, external_id: String(window.zid.store_id) };
        if (window.zid.store_uuid) return { platform: "zid", store_id: null, store_uuid: String(window.zid.store_uuid), external_id: String(window.zid.store_uuid) };
      }
      // Fuqah snippet sets these from Zid theme tokens {{store.id}} / {{store.uuid}}
      if (window.__FUQAH_ZID_STORE_ID) return { platform: "zid", store_id: String(window.__FUQAH_ZID_STORE_ID), store_uuid: window.__FUQAH_ZID_STORE_UUID ? String(window.__FUQAH_ZID_STORE_UUID) : null, external_id: String(window.__FUQAH_ZID_STORE_ID) };
      if (window.__FUQAH_ZID_STORE_UUID) return { platform: "zid", store_id: null, store_uuid: String(window.__FUQAH_ZID_STORE_UUID), external_id: String(window.__FUQAH_ZID_STORE_UUID) };
    } catch (e) {}
    return null;
  }

  function api(path) {
    path += (path.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now();
    return fetch(SUPABASE_URL + "/functions/v1" + path, {
      cache: "no-store",
      headers: { "apikey": ANON_KEY, "Authorization": "Bearer " + ANON_KEY },
    }).then(function (r) { return r.json(); });
  }

  function postEvent(name, tenantId) {
    try {
      fetch(SUPABASE_URL + "/functions/v1/widget-events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY, "Authorization": "Bearer " + ANON_KEY },
        body: JSON.stringify({ event: name, tenant_id: tenantId }),
        keepalive: true,
      });
    } catch (e) {}
  }

  function mount(tenantId, ctx, cfg) {
    var existing = document.getElementById("fuqah-widget-host");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var existingIframe = document.getElementById("fuqah-widget-iframe");
    if (existingIframe && existingIframe.parentNode) existingIframe.parentNode.removeChild(existingIframe);
    var legacyRoot = document.getElementById("fq-widget-root");
    if (legacyRoot && legacyRoot.parentNode) legacyRoot.parentNode.removeChild(legacyRoot);
    var legacyWelcome = document.getElementById("fq-welcome-bubble");
    if (legacyWelcome && legacyWelcome.parentNode) legacyWelcome.parentNode.removeChild(legacyWelcome);
    var legacyBubble = document.getElementById("fq-bubble");
    if (legacyBubble && legacyBubble.parentNode) legacyBubble.parentNode.removeChild(legacyBubble);
    var legacyWindow = document.getElementById("fq-chat-window");
    if (legacyWindow && legacyWindow.parentNode) legacyWindow.parentNode.removeChild(legacyWindow);
    var legacyOverlay = document.getElementById("fq-overlay");
    if (legacyOverlay && legacyOverlay.parentNode) legacyOverlay.parentNode.removeChild(legacyOverlay);
    try {
      document.querySelectorAll(".fq-widget-root,.fq-welcome-bubble,.fq-bubble,.fq-chat-window,.fq-touch-overlay").forEach(function (node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
    } catch (e) {}
    cfg = cfg || {};
    if (cfg.bubble_visible === false) { return; }
    var host = document.createElement("div");
    host.id = "fuqah-widget-host";
    host.style.cssText = "all: initial; position: fixed; z-index: 2147483647;";
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: "open" });

    var pos = (cfg && cfg.position) === "left" ? "left" : "right";
    var ox = (cfg && cfg.bubble_offset_x) || 20;
    var oy = (cfg && cfg.bubble_offset_y) || 20;
    var size = (cfg && cfg.bubble_size) || 60;
    var outer = (cfg && cfg.widget_outer_color) || "#000000";
    var inner = (cfg && cfg.widget_inner_color) || "#FFFFFF";

    var style = document.createElement("style");
    style.textContent =
      ".fq-host{position:fixed;" + pos + ":" + ox + "px;bottom:" + oy + "px;}" +
      ".fq-bubble{width:" + size + "px;height:" + size + "px;border-radius:50%;" +
      "background:" + outer + ";display:flex;align-items:center;justify-content:center;" +
      "cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);transition:transform .15s;}" +
      ".fq-bubble:hover{transform:scale(1.06);}" +
      ".fq-bubble svg{width:55%;height:55%;color:" + inner + ";}" +
      ".fq-welcome{position:absolute;bottom:" + (size + 12) + "px;" + pos + ":0;" +
      "background:#fff;color:#111;padding:10px 14px;border-radius:12px;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.12);max-width:240px;font:14px system-ui;" +
      "white-space:pre-line;}" +
      ".fq-iframe{position:fixed;" + pos + ":" + ox + "px;bottom:" + (oy + size + 12) + "px;" +
      "width:380px;height:600px;max-height:80vh;border:none;border-radius:16px;" +
      "box-shadow:0 16px 48px rgba(0,0,0,.22);background:#fff;display:none;}" +
      "@media (max-width: 480px){.fq-iframe{width:calc(100vw - 24px);" + pos + ":12px;}}";
    root.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "fq-host";
    root.appendChild(wrap);

    if (cfg && cfg.welcome_bubble_enabled) {
      var welcome = document.createElement("div");
      welcome.className = "fq-welcome";
      welcome.textContent = (cfg.welcome_bubble_line1 || "") + "\\n" + (cfg.welcome_bubble_line2 || "");
      wrap.appendChild(welcome);
      setTimeout(function () { welcome.style.display = "none"; }, 8000);
    }

    var bubble = document.createElement("div");
    bubble.className = "fq-bubble";
    bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    wrap.appendChild(bubble);

    // Iframe is created lazily on first bubble click — saves a full chat
    // bundle download on every storefront page load, and lets the bubble
    // paint without competing with the storefront for bandwidth.
    var iframe = null;
    var open = false;
    function ensureIframe() {
      if (iframe) return iframe;
      iframe = document.createElement("iframe");
      iframe.className = "fq-iframe";
      iframe.id = "fuqah-widget-iframe";
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
      iframe.setAttribute("title", "Chat");
      var qs =
        "platform=" + encodeURIComponent(ctx.platform) +
        "&store_id=" + encodeURIComponent(ctx.store_id || ctx.external_id) +
        "&tenant_id=" + encodeURIComponent(tenantId || "");
      if (ctx.store_uuid) qs += "&store_uuid=" + encodeURIComponent(ctx.store_uuid);
      iframe.src = APP_BASE_URL + "/widget/chat?" + qs;
      document.body.appendChild(iframe);
      return iframe;
    }
    bubble.addEventListener("click", function () {
      ensureIframe();
      open = !open;
      iframe.style.display = open ? "block" : "none";
      if (open) postEvent("bubble.click", tenantId);
    });

    postEvent("bubble.shown", tenantId);

    if (cfg && cfg.auto_open_delay && cfg.auto_open_delay > 0) {
      setTimeout(function () {
        if (!open) bubble.click();
      }, cfg.auto_open_delay * 1000);
    }
  }

  function boot() {
    var ctx = detectPlatform();
    if (!ctx) { console.warn("fuqah: no platform context"); return; }

    // Expose store context globally so the bundled widget can read it without a round-trip.
    try {
      window.__FUQAH_STORE_CTX = {
        platform: ctx.platform,
        store_id: ctx.store_id || ctx.external_id,
        store_uuid: ctx.store_uuid || null,
      };
    } catch (e) {}

    // Preconnect to Supabase + app origin so the upcoming fetch and
    // (later) chat iframe share an already-warm TLS connection.
    try {
      var head = document.head || document.getElementsByTagName("head")[0];
      if (head) {
        ["preconnect", "dns-prefetch"].forEach(function (rel) {
          [SUPABASE_URL, APP_BASE_URL].forEach(function (href) {
            if (!href) return;
            var l = document.createElement("link");
            l.rel = rel; l.href = href;
            if (rel === "preconnect") l.setAttribute("crossorigin", "");
            head.appendChild(l);
          });
        });
      }
    } catch (e) {}

    // ── Instant paint: hydrate from localStorage cache so the bubble shows
    // in < 200ms on repeat visits instead of waiting for the resolve+config
    // round-trip (which can take 10+ seconds on edge cold starts).
    var cacheKey = "fuqah_widget_cache_" + ctx.platform + "_" + (ctx.external_id || "");
    var cached = null;
    try {
      var raw = window.localStorage && window.localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}
    var mounted = false;
    var mountedSkeleton = false;
    if (cached && cached.tenant_id && cached.cfg) {
      try { window.__FUQAH_TENANT_ID = cached.tenant_id; } catch (e) {}
      try { mount(cached.tenant_id, ctx, cached.cfg); mounted = true; } catch (e) {}
    }
    // First-visit instant paint: render a default bubble immediately so the
    // user always sees the launcher within ~100ms, regardless of network.
    if (!mounted) {
      try {
        mount(null, ctx, {
          position: "right",
          bubble_offset_x: 20,
          bubble_offset_y: 20,
          bubble_size: 60,
          widget_outer_color: "#000000",
          widget_inner_color: "#FFFFFF",
          welcome_bubble_enabled: false,
          bubble_visible: true,
        });
        mountedSkeleton = true;
      } catch (e) {}
    }

    api("/widget-bootstrap?platform=" + ctx.platform + "&external_id=" + encodeURIComponent(ctx.external_id || ""))
      .then(function (res) {
        if (!res || !res.tenant_id || !res.is_active || !res.cfg) {
          // Tenant unknown/inactive — drop the skeleton so we don't show a
          // bubble that can't actually chat.
          if (mountedSkeleton) {
            var stale = document.getElementById("fuqah-widget-host");
            if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
          }
          return;
        }
        try { window.__FUQAH_TENANT_ID = res.tenant_id; } catch (e) {}
        var fresh = res.cfg;
        var freshUpdatedAt = res.updated_at || null;
        try {
          window.localStorage && window.localStorage.setItem(cacheKey, JSON.stringify({
            tenant_id: res.tenant_id,
            cfg: fresh,
            updated_at: freshUpdatedAt,
            ts: Date.now(),
          }));
        } catch (e) {}
        // Re-mount whenever we showed a skeleton, the tenant changed, or the
        // design row's updated_at moved — catches every visual setting.
        var prevUpdatedAt = cached && cached.updated_at;
        var changed =
          mountedSkeleton ||
          !cached ||
          cached.tenant_id !== res.tenant_id ||
          prevUpdatedAt !== freshUpdatedAt;
        if (changed) {
          mount(res.tenant_id, ctx, fresh);
        }
      })
      .catch(function (e) { console.error("fuqah loader error", e); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`;

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(LOADER_JS, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
});