/*
  supabaseClient.js
  Loads Supabase JS via CDN and exposes window.supabase (client) once Config is saved.
*/

(function(){
  const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"\;
  const s = document.createElement("script");
  s.src = CDN;
  s.defer = true;
  s.onload = ()=>{ window.__supabaseLibLoaded = true; };
  s.onerror = ()=>{ window.__supabaseLibLoaded = false; };
  document.head.appendChild(s);

  window.initSupabaseClient = function(url, anonKey){
    try{
      if(!window.supabase){ window.supabase = null; }
      if(!window.supabasejs && !window.supabase){ /* lib not ready */ }
      const lib = window.supabase || window.supabasejs || window.supabase;
      const createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient
                        : (window.supabasejs && window.supabasejs.createClient) ? window.supabasejs.createClient
                        : null;
      if(!createClient) return {ok:false, err:"Supabase library not loaded"};
      window.supabase = createClient(url, anonKey, { auth: { persistSession:true, autoRefreshToken:true }});
      return {ok:true};
    }catch(e){
      return {ok:false, err: String(e?.message || e)};
    }
  };
})();
