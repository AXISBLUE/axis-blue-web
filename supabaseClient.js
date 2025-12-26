/* AXIS BLUE: Supabase client bootstrap (non-bundled Pages build)
   - Stores URL/anonKey locally (localStorage) via Config modal
   - Exposes window.supabase when ready
*/
(function(){
  const LS_KEY = "AXISBLUE_SUPABASE_CFG";

  function readCfg(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
    catch(e){ return null; }
  }
  function writeCfg(cfg){
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  function hasLib(){
    return !!(window.supabase && window.supabase.auth); // already created
  }

  function createClient(cfg){
    if(!window.supabasejs || !window.supabasejs.createClient){
      return { ok:false, reason:"supabasejs library missing" };
    }
    if(!cfg || !cfg.url || !cfg.anon){
      return { ok:false, reason:"config missing" };
    }
    try{
      window.supabase = window.supabasejs.createClient(cfg.url, cfg.anon, {
        auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });
      window.__axis_cfg = cfg;
      return { ok:true };
    }catch(e){
      window.supabase = null;
      return { ok:false, reason:String(e) };
    }
  }

  // Public helpers for app.js
  window.AxisCfg = {
    LS_KEY,
    readCfg,
    writeCfg,
    hasLib,
    createClient
  };

  // Attempt auto-init from saved cfg on load
  const cfg = readCfg();
  if(cfg){ createClient(cfg); }
})();
