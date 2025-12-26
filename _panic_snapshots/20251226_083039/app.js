(function () {
  const \$ = (id) => document.getElementById(id);
  const log = (el, msg) => { el.textContent = msg; };

  const envBadge = $("envBadge");
  const healthBadge = $("healthBadge");
  const authBadge = $("authBadge");
  const statusText = $("statusText");
  const footStatus = $("footStatus");

  const appCard = $("appCard");

  // Modal
  const modalBack = $("modalBack");
  const cfgUrl = $("cfgUrl");
  const cfgKey = $("cfgKey");
  const cfgPhotos = $("cfgPhotos");
  const cfgEvents = $("cfgEvents");
  const cfgLog = $("cfgLog");

  function badge(el, type, text){
    el.className = "badge " + type;
    el.textContent = text;
  }

  function openModal(){
    const c = window.AxisConfig.get() || {};
    cfgUrl.value = c.url || "";
    cfgKey.value = c.anonKey || "";
    cfgPhotos.value = c.photosBucket || "work-photos";
    cfgEvents.value = c.eventsBucket || "events";
    modalBack.style.display = "flex";
    appendCfgLog("Opened config.");
  }
  function closeModal(){ modalBack.style.display = "none"; }

  function appendCfgLog(m){
    const ts = new Date().toLocaleTimeString();
    const cur = cfgLog.textContent === "—" ? "" : (cfgLog.textContent + "\n");
    cfgLog.textContent = cur + `[${ts}] ${m}`;
  }

  async function pingEnv(){
    try{
      const r = await fetch("/api/env", { cache: "no-store" });
      const j = await r.json();
      if(j && j.ok){
        badge(envBadge, "good", "OK");
        return true;
      }
      badge(envBadge, "bad", "ERR");
      return false;
    }catch(e){
      badge(envBadge, "bad", "ERR");
      return false;
    }
  }

  async function pingHealth(){
    try{
      const r = await fetch("/api/health", { cache: "no-store" });
      const j = await r.json();
      if(j && j.ok){
        badge(healthBadge, "good", "OK");
        return true;
      }
      badge(healthBadge, "bad", "ERR");
      return false;
    }catch(e){
      badge(healthBadge, "bad", "ERR");
      return false;
    }
  }

  function unlockApp(){
    appCard.style.opacity = "1";
    appCard.style.pointerEvents = "auto";
  }
  function lockApp(){
    appCard.style.opacity = ".55";
    appCard.style.pointerEvents = "none";
  }

  function setTabs(){
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(t=>{
      t.addEventListener("click", ()=>{
        tabs.forEach(x=>x.classList.remove("active"));
        t.classList.add("active");
        const name = t.getAttribute("data-tab");
        ["day","visit","capture","intel","mgmt","history"].forEach(n=>{
          const el = document.getElementById("tab_"+n);
          el.style.display = (n===name) ? "block" : "none";
        });
      });
    });
  }

  // Simple Run Day list (local only until auth works)
  const storeList = $("storeList");
  const storeInput = $("storeInput");
  const btnAddStore = $("btnAddStore");
  const morningOut = $("morningOut");
  const btnMorning = $("btnMorning");
  const btnCopyMorning = $("btnCopyMorning");
  const morningNotes = $("morningNotes");

  let stores = [];

  function renderStores(){
    if(!stores.length){ storeList.textContent = "0 items"; return; }
    storeList.textContent = stores.map((s,i)=>`${i+1}. ${s}`).join("\n");
  }

  btnAddStore.addEventListener("click", ()=>{
    const v = (storeInput.value||"").trim();
    if(!v) return;
    stores.push(v);
    storeInput.value = "";
    renderStores();
  });

  btnMorning.addEventListener("click", ()=>{
    const notes = (morningNotes.value||"").trim();
    const out = [
      "AXIS BLUE — Morning Rundown",
      `Date: ${new Date().toLocaleDateString()}`,
      "",
      "Stores:",
      ...(stores.length ? stores.map((s,i)=>`- ${s} (est: ___ min)`) : ["- (none)"]),
      "",
      "Notes / priorities:",
      notes || "(none)",
      "",
      "Attestations:",
      "- PREMIER steps will be completed per visit",
      "- Safety shoes compliant: YES",
      "",
      "Total time estimate:",
      "- Travel: ___ min",
      "- Store time: ___ min",
      "- Total: ___ min",
    ].join("\n");
    morningOut.textContent = out;
  });

  btnCopyMorning.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(morningOut.textContent || "");
      badge(statusText, "good", "Copied");
      setTimeout(()=>badge(statusText, "warn", "Waiting…"), 1200);
    }catch{
      badge(statusText, "bad", "Copy failed");
      setTimeout(()=>badge(statusText, "warn", "Waiting…"), 1400);
    }
  });

  // Buttons
  $("btnConfig").addEventListener("click", openModal);
  $("cfgClose").addEventListener("click", closeModal);

  $("cfgSave").addEventListener("click", async ()=>{
    const u = cfgUrl.value.trim();
    const k = cfgKey.value.trim();
    const pb = (cfgPhotos.value.trim() || "work-photos");
    const eb = (cfgEvents.value.trim() || "events");

    if(!u || !k){
      appendCfgLog("Missing URL or Anon Key.");
      badge(authBadge, "warn", "CFG");
      return;
    }
    window.AxisConfig.set({ url:u, anonKey:k, photosBucket:pb, eventsBucket:eb });
    appendCfgLog("Saved config locally.");
    badge(authBadge, "warn", "CFG");
    badge(statusText, "warn", "Re-init…");

    const init = await window.AxisConfig.initSupabase();
    if(init.ok){
      footStatus.textContent = "supabase: ready";
      badge(statusText, "good", "Config OK");
    }else{
      footStatus.textContent = "supabase: needs config";
      badge(statusText, "bad", "Config fail");
    }
    setTimeout(()=>badge(statusText, "warn", "Waiting…"), 1500);
  });

  $("cfgClear").addEventListener("click", ()=>{
    localStorage.removeItem(window.AxisConfig.KEY);
    appendCfgLog("Cleared local config.");
    cfgUrl.value = ""; cfgKey.value = "";
    badge(authBadge, "warn", "CFG");
    footStatus.textContent = "supabase: pending";
    lockApp();
  });

  $("btnEnv").addEventListener("click", ()=>window.open("/api/env","_blank"));
  $("btnHealth").addEventListener("click", ()=>window.open("/api/health","_blank"));
  $("btnDiagnostics").addEventListener("click", ()=>alert("Diagnostics: open /api/env and /api/health.\nConfig is stored locally.\nAuth unlocks the dashboard."));
  $("btnDiag2").addEventListener("click", ()=>alert("Diagnostics: open /api/env and /api/health.\nIf ENV/HEALTH are OK but login fails, it’s auth/session or Supabase config."));

  // Auth
  const btnSignIn = $("btnSignIn");
  const btnSignOutTop = $("btnSignOutTop");
  const email = $("email");
  const password = $("password");

  async function refreshSession(){
    if(!window.supabase){
      badge(authBadge, "warn", "CFG");
      lockApp();
      return;
    }
    try{
      const { data } = await window.supabase.auth.getSession();
      const user = data?.session?.user?.email;
      if(user){
        badge(authBadge, "good", "OK");
        btnSignOutTop.disabled = false;
        unlockApp();
      }else{
        badge(authBadge, "warn", "OUT");
        btnSignOutTop.disabled = true;
        lockApp();
      }
    }catch(e){
      badge(authBadge, "bad", "ERR");
      lockApp();
    }
  }

  btnSignIn.addEventListener("click", async ()=>{
    if(!window.supabase){
      badge(statusText, "bad", "No config");
      openModal();
      return;
    }
    const e = email.value.trim();
    const p = password.value.trim();
    if(!e || !p){
      badge(statusText, "bad", "Missing");
      return;
    }
    badge(statusText, "warn", "Signing in…");
    try{
      const { error } = await window.supabase.auth.signInWithPassword({ email: e, password: p });
      if(error){
        badge(statusText, "bad", "Auth failed");
        badge(authBadge, "bad", "ERR");
        lockApp();
        return;
      }
      badge(statusText, "good", "Signed in");
      await refreshSession();
      setTimeout(()=>badge(statusText, "warn", "Waiting…"), 1200);
    }catch(e2){
      badge(statusText, "bad", "Auth error");
      badge(authBadge, "bad", "ERR");
      lockApp();
    }
  });

  btnSignOutTop.addEventListener("click", async ()=>{
    if(!window.supabase) return;
    badge(statusText, "warn", "Signing out…");
    try{
      await window.supabase.auth.signOut();
      badge(statusText, "good", "Signed out");
      await refreshSession();
      setTimeout(()=>badge(statusText, "warn", "Waiting…"), 1200);
    }catch{
      badge(statusText, "bad", "Signout err");
    }
  });

  // Init
  (async function boot(){
    setTabs();
    renderStores();

    badge(statusText, "warn", "Waiting…");
    await pingEnv();
    await pingHealth();

    // Initialize Supabase if config exists
    const init = await window.AxisConfig.initSupabase();
    if(init.ok){
      footStatus.textContent = "supabase: ready";
      badge(authBadge, "warn", "OUT");
      await refreshSession();
    }else{
      footStatus.textContent = "supabase: needs config";
      badge(authBadge, "warn", "CFG");
      lockApp();
    }

    // Keep session fresh
    setInterval(refreshSession, 4000);
  })();
})();
