/*
  AXIS BLUE Supabase client loader
  - Uses window.AXIS_SUPABASE_URL and window.AXIS_SUPABASE_ANON_KEY if present.
  - Falls back to placeholders so UI still loads even if config is missing.
*/
(function(){
  const u = window.AXIS_SUPABASE_URL || localStorage.getItem("AXIS_SUPABASE_URL") || "";
  const k = window.AXIS_SUPABASE_ANON_KEY || localStorage.getItem("AXIS_SUPABASE_ANON_KEY") || "";

  window.__SUPA_CFG__ = { url:u, key:k };

  // Load supabase-js from CDN (keeps repo simple for Pages)
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"\;
  s.onload = () => {
    if (!u || !k){
      window.supabase = null;
      window.__SUPA_ERR__ = "Supabase URL / anon key not set";
      return;
    }
    window.supabase = window.supabasejs.createClient(u, k, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
  };
  document.head.appendChild(s);
})();
