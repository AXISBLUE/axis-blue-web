/* global SUPABASE_URL, SUPABASE_ANON_KEY */
let supabase = null;

async function loadEnv() {
  const r = await fetch("/api/env", { cache: "no-store" });
  if (!r.ok) throw new Error("env endpoint failed");
  return r.json();
}

async function initSupabase() {
  const env = await loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in Cloudflare env.");
  }

  // Load supabase-js from CDN at runtime (simple for Pages).
  // Note: This is fine for a private test environment.
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  s.onload = () => {
    supabase = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  };
  document.head.appendChild(s);

  // wait until created
  await new Promise((resolve) => {
    const t = setInterval(() => {
      if (supabase) { clearInterval(t); resolve(); }
    }, 30);
  });

  return env;
}
