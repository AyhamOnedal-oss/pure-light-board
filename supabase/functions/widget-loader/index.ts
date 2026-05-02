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
    try {
      if (window.salla && window.salla.config && typeof window.salla.config.get === "function") {
        var sid = window.salla.config.get("store.id");
        if (sid) return { platform: "salla", external_id: String(sid) };
      }
      if (window.Salla && window.Salla.config && window.Salla.config.store) {
        return { platform: "salla", external_id: String(window.Salla.config.store.id) };
      }
    } catch (e) {}
    try {
      var meta = document.querySelector('meta[name="zid-store-id"], meta[name="store-uuid"]');
      if (meta && meta.content) return { platform: "zid", external_id: meta.content };
      if (window.zid && window.zid.store_uuid) return { platform: "zid", external_id: window.zid.store_uuid };
    } catch (e) {}
    return null;
  }

  function api(path) {
    return fetch(SUPABASE_URL + "/functions/v1" + path, {
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

  function mount(tenantId, cfg) {
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

    var iframe = document.createElement("iframe");
    iframe.className = "fq-iframe";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    iframe.setAttribute("title", "Chat");
    iframe.src = APP_BASE_URL + "/widget/chat?tenant_id=" + encodeURIComponent(tenantId);
    document.body.appendChild(iframe);

    var open = false;
    bubble.addEventListener("click", function () {
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

    api("/widget-resolve?platform=" + ctx.platform + "&external_id=" + encodeURIComponent(ctx.external_id))
      .then(function (res) {
        if (!res || !res.tenant_id || !res.is_active) { return; }
        return api("/widget-config?tenant_id=" + res.tenant_id).then(function (cfg) {
          mount(res.tenant_id, cfg || {});
        });
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
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
});