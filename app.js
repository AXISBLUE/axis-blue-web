(function(){
  const $ = (id)=>document.getElementById(id);

  // UI refs
  const chipEnv=$("chipEnv"), chipHealth=$("chipHealth"), chipAuth=$("chipAuth"), chipSync=$("chipSync");
  const footerSupabase=$("footerSupabase");
  const authStatus=$("authStatus");
  const btnConfig=$("btnConfig"), btnDiagnostics=$("btnDiagnostics"), btnDiagInline=$("btnDiagInline");
  const btnSignIn=$("btnSignIn"), btnSignOut=$("btnSignOut"), btnTestConfig=$("btnTestConfig");
  const email=$("email"), password=$("password");
  const dashboard=$("dashboardCard");

  // ---- Diagnostics helpers
  function setAuthChip(txt, state){
    chipAuth.textContent = "AUTH: " + txt;
    if(state==="ok"){ chipAuth.style.borderColor="rgba(90,200,130,.55)"; }
    else if(state==="err"){ chipAuth.style.borderColor="rgba(220,90,90,.55)"; }
    else { chipAuth.style.borderColor="rgba(210,170,80,.55)"; }
  }
  function setStatus(msg){ authStatus.textContent = msg; }

  async function ping(path){
    try{
      const r=await fetch(path,{cache:"no-store"});
      if(!r.ok) return {ok:false, code:r.status};
      return {ok:true, json: await r.json()};
    }catch(e){ return {ok:false, err:String(e)}; }
  }

  async function refreshChips(){
    const env = await ping("/api/env");
    chipEnv.textContent = env.ok ? "ENV: OK" : "ENV: ERR";
    const health = await ping("/api/health");
    chipHealth.textContent = health.ok ? "HEALTH: OK" : "HEALTH: ERR";
    chipSync.textContent = "SYNC: OK";
  }

  // ---- Config modal (inline, no extra files)
  function openConfig(){
    const cfg = (window.AxisCfg && window.AxisCfg.readCfg()) || {};
    const overlay=document.createElement("div");
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;z-index:9999";
    const box=document.createElement("div");
    box.className="card";
    box.style.maxWidth="520px";
    box.style.width="100%";
    box.innerHTML = `
      <div class="cardTitle" style="font-size:18px;letter-spacing:.08em;font-family:var(--mono);">CONFIG (STORED LOCALLY)</div>
      <div class="cardSubtitle" style="font-family:var(--mono);font-size:12px;">
        Paste your Supabase Project URL and Anon Key. Stored only in your browser (localStorage).
      </div>

      <label class="field">
        <div class="label">Supabase URL</div>
        <input id="cfg_url" placeholder="https://xxxx.supabase.co" value="${(cfg.url||"").replace(/"/g,'&quot;')}"/>
      </label>

      <label class="field" style="margin-top:8px">
        <div class="label">Supabase Anon Key</div>
        <input id="cfg_anon" placeholder="eyJ..." value="${(cfg.anon||"").replace(/"/g,'&quot;')}"/>
      </label>

      <label class="field" style="margin-top:8px">
        <div class="label">Storage bucket for photos</div>
        <input id="cfg_bucket_photos" placeholder="work-photos" value="${(cfg.bucketPhotos||"work-photos").replace(/"/g,'&quot;')}"/>
      </label>

      <label class="field" style="margin-top:8px">
        <div class="label">Storage bucket for event logs</div>
        <input id="cfg_bucket_events" placeholder="events" value="${(cfg.bucketEvents||"events").replace(/"/g,'&quot;')}"/>
      </label>

      <div class="row gap" style="margin-top:12px">
        <button class="btn primary" id="cfg_save">Save</button>
        <button class="btn" id="cfg_close">Close</button>
        <button class="btn ghost right" id="cfg_clear">Clear</button>
      </div>

      <div class="pill" id="cfg_msg" style="margin-top:12px">Waiting…</div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const msg = box.querySelector("#cfg_msg");
    const close = ()=>overlay.remove();

    box.querySelector("#cfg_close").onclick=close;
    box.querySelector("#cfg_clear").onclick=()=>{
      localStorage.removeItem(window.AxisCfg.LS_KEY);
      msg.textContent="Cleared local config.";
      setAuthChip("CFG", "cfg");
      footerSupabase.textContent="supabase: pending";
    };
    box.querySelector("#cfg_save").onclick=()=>{
      const newCfg={
        url: box.querySelector("#cfg_url").value.trim(),
        anon: box.querySelector("#cfg_anon").value.trim(),
        bucketPhotos: box.querySelector("#cfg_bucket_photos").value.trim() || "work-photos",
        bucketEvents: box.querySelector("#cfg_bucket_events").value.trim() || "events",
      };
      window.AxisCfg.writeCfg(newCfg);
      const created = window.AxisCfg.createClient(newCfg);
      if(created.ok){
        msg.textContent="Saved config locally.";
        footerSupabase.textContent="supabase: ready";
        setAuthChip("CFG", "cfg");
      } else {
        msg.textContent="Config saved, but client init failed: " + created.reason;
        footerSupabase.textContent="supabase: error";
        setAuthChip("ERR", "err");
      }
    };
  }

  // ---- Auth logic
  async function ensureSupabaseReady(){
    if(window.supabase && window.supabase.auth){
      footerSupabase.textContent="supabase: ready";
      return {ok:true};
    }
    // If cfg exists but lib missing, call it out loudly
    const cfg = window.AxisCfg && window.AxisCfg.readCfg();
    if(cfg && (!window.supabasejs || !window.supabasejs.createClient)){
      footerSupabase.textContent="supabase: lib missing";
      return {ok:false, reason:"supabase-js lib missing"};
    }
    footerSupabase.textContent = cfg ? "supabase: initializing…" : "supabase: pending";
    return {ok:false, reason: cfg ? "initializing" : "no config"};
  }

  async function signIn(){
    setStatus("Signing in…");
    const ready = await ensureSupabaseReady();
    if(!ready.ok){
      setAuthChip("CFG", "cfg");
      setStatus(ready.reason === "no config" ? "Config required" : ready.reason);
      return;
    }
    try{
      const { data, error } = await window.supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      });
      if(error){
        setAuthChip("ERR","err");
        setStatus("Login failed: " + error.message);
        dashboard.classList.add("dim");
        btnSignOut.disabled = true;
        return;
      }
      setAuthChip(email.value.trim(), "ok");
      setStatus("Signed in.");
      dashboard.classList.remove("dim");
      btnSignOut.disabled = false;
    }catch(e){
      setAuthChip("ERR","err");
      setStatus("Login exception: " + String(e));
    }
  }

  async function signOut(){
    try{
      if(window.supabase && window.supabase.auth){
        await window.supabase.auth.signOut();
      }
    }catch(e){}
    setAuthChip("CFG","cfg");
    setStatus("Signed out.");
    dashboard.classList.add("dim");
    btnSignOut.disabled = true;
  }

  async function testConfig(){
    setStatus("Testing…");
    const env = await ping("/api/env");
    const health = await ping("/api/health");
    const cfg = window.AxisCfg && window.AxisCfg.readCfg();
    const libOk = !!(window.supabasejs && window.supabasejs.createClient);
    const clientOk = !!(window.supabase && window.supabase.auth);

    let parts=[];
    parts.push(env.ok ? "env ok" : "env err");
    parts.push(health.ok ? "health ok" : "health err");
    parts.push(cfg ? "cfg ok" : "cfg missing");
    parts.push(libOk ? "lib ok" : "lib missing");
    parts.push(clientOk ? "client ok" : "client missing");
    setStatus(parts.join(" • "));

    footerSupabase.textContent = clientOk ? "supabase: ready" : (cfg ? "supabase: pending" : "supabase: pending");
  }

  // ---- Tabs skeleton (your deeper features live in your existing build; this keeps the baseline stable)
  function setTab(name){
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active", t.dataset.tab===name));
    ["run","visit","capture","intel","mgmt","history"].forEach(k=>{
      const el = document.getElementById("panel_"+k);
      el.classList.toggle("hidden", k!==name);
    });
  }

  function bootPanels(){
    // Minimal placeholders to keep UI “operable baseline”
    $("panel_run").innerHTML = `
      <div class="pill">Start Day • Add stores • Generate Morning Rundown</div>
      <div style="height:10px"></div>
      <div class="grid2">
        <label class="field"><div class="label">Today's stores (select or add)</div><input placeholder="Add store name…"/></label>
        <label class="field"><div class="label">Template notes / priorities for the day</div><input placeholder="Priorities…"/></label>
      </div>
      <div class="row gap" style="margin-top:10px">
        <button class="btn primary">Start Day</button>
        <button class="btn">End Day</button>
        <div class="pill">day: none</div>
      </div>
    `;
    $("panel_visit").innerHTML = `<div class="pill">Visit workflow (Start/End timestamp + photos by category + OOS/Credits)</div>`;
    $("panel_capture").innerHTML = `<div class="pill">Capture (barcode/QR + tag photo + category + store/visit binding)</div>`;
    $("panel_intel").innerHTML = `<div class="pill">Intelligence (scans → structured notes)</div>`;
    $("panel_mgmt").innerHTML = `<div class="pill">Management outputs (EOV/EOD/EOW exports)</div>`;
    $("panel_history").innerHTML = `<div class="pill">History (days/visits + PDFs)</div>`;
  }

  // ---- Wire up UI
  btnConfig.onclick = openConfig;
  btnDiagnostics.onclick = testConfig;
  btnDiagInline.onclick = testConfig;
  btnTestConfig.onclick = testConfig;
  btnSignIn.onclick = signIn;
  btnSignOut.onclick = signOut;

  document.querySelectorAll(".tab").forEach(t=>{
    t.onclick = ()=>setTab(t.dataset.tab);
  });

  // Boot
  (async function init(){
    await refreshChips();

    // Determine auth state
    const ready = await ensureSupabaseReady();
    if(window.supabase && window.supabase.auth){
      setAuthChip("CFG","cfg");
      setStatus("Ready. Sign in.");
      footerSupabase.textContent="supabase: ready";
    } else {
      setAuthChip("CFG","cfg");
      setStatus(ready.reason === "no config" ? "Config required" : "Waiting…");
    }

    dashboard.classList.add("dim");
    btnSignOut.disabled = true;

    bootPanels();
    setTab("run");
  })();
})();
