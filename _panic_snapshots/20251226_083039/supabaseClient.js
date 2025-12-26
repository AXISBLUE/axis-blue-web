(function () {
  const KEY = "AXIS_SUPABASE_CONFIG";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function getLocalConfig() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }

  function setLocalConfig(cfg) {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  }

  async function fetchEnvConfig() {
    try {
      const r = await fetch("/api/env", { cache: "no-store" });
      const j = await r.json();
      if (j && j.ok && j.SUPABASE_URL && j.SUPABASE_ANON_KEY === "SET") {
        // We can't see the raw anon key from /api/env (by design),
        // so env config isn't enough alone. Local config is primary.
        return { ok: true, envOnly: true, url: j.SUPABASE_URL };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  async function initSupabase() {
    window.supabase = null;
    window.__axisSupabase = {
      status: "INIT",
      local: getLocalConfig(),
      env: null
    };

    // Load Supabase JS CDN
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    window.supabasejs = window.supabasejs || window.supabase; // some builds expose differently

    const local = getLocalConfig();
    if (local && local.url && local.anonKey) {
      try {
        window.supabase = window.supabasejs.createClient(local.url, local.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        window.__axisSupabase.status = "READY_LOCAL";
        return { ok: true, mode: "local" };
      } catch (e) {
        window.__axisSupabase.status = "ERR_LOCAL";
        window.__axisSupabase.error = String(e);
        return { ok: false, error: String(e) };
      }
    }

    const env = await fetchEnvConfig();
    window.__axisSupabase.env = env;
    window.__axisSupabase.status = "NEEDS_CONFIG";
    return { ok: false, needsConfig: true };
  }

  window.AxisConfig = {
    KEY,
    get: getLocalConfig,
    set: setLocalConfig,
    initSupabase
  };
})();
