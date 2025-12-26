/* AXIS BLUE • Field Console (single-file app logic)
   - Auth gate
   - Config modal stored locally
   - Day → Visit workflow
   - GPS capture at start day + start/end visit
   - Scan + photo stubs by category
   - Morning report + EOV + EOD outputs (copyable)
*/

const $ = (id)=>document.getElementById(id);

const state = {
  cfg: { url:"", key:"" },
  day: null,
  activeVisit: null,
  visitTimer: null,
  stores: []
};

// ---------- Foreknown stores (address now, lat/lon later) ----------
const FOREKNOWN = [
  { id:"WM1492", name:"Walmart 1492", address:"14000 E Exposition Ave, Aurora, CO 80012", deliveryUsually:"yes", lat:null, lon:null },
  { id:"KS00014", name:"King Soopers 00014", address:"655 Peoria St, Aurora, CO 80011", deliveryUsually:"no", lat:null, lon:null },
  { id:"FD3477", name:"Family Dollar 3477", address:"620 Peoria St, Aurora, CO 80011", deliveryUsually:"no", lat:null, lon:null },
  { id:"TG1471", name:"Target SC 1471", address:"14200 E Ellsworth Ave, Aurora, CO 80012", deliveryUsually:"no", lat:null, lon:null }
];

function nowISO(){ return new Date().toISOString(); }

function setChip(id, text, cls){
  const el = $(id);
  el.textContent = text;
  el.className = el.className.replace(/\bpill-\w+\b/g,"").trim();
  el.classList.add("pill");
  if(cls) el.classList.add(cls);
}

function logLine(s){
  const out = $("output");
  out.textContent += s + "\n";
  out.scrollTop = out.scrollHeight;
}

function setMsg(el, msg){ el.textContent = msg || ""; }

// ---------- Local storage ----------
const LS_CFG = "axisblue_cfg_v1";
const LS_STORES = "axisblue_stores_v1";
const LS_HISTORY = "axisblue_history_v1";

function loadLocal(){
  try{
    const cfg = JSON.parse(localStorage.getItem(LS_CFG) || "{}");
    if(cfg.url) state.cfg.url = cfg.url;
    if(cfg.key) state.cfg.key = cfg.key;

    const stores = JSON.parse(localStorage.getItem(LS_STORES) || "[]");
    state.stores = [...FOREKNOWN, ...stores.filter(s=>s && s.id && !FOREKNOWN.find(f=>f.id===s.id))];

  }catch(e){
    state.stores = [...FOREKNOWN];
  }
}
function saveCfg(){
  localStorage.setItem(LS_CFG, JSON.stringify({url:state.cfg.url, key:state.cfg.key}));
}
function saveStores(){
  const custom = state.stores.filter(s=>!FOREKNOWN.find(f=>f.id===s.id));
  localStorage.setItem(LS_STORES, JSON.stringify(custom));
}
function pushHistory(entry){
  const arr = JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
  arr.unshift(entry);
  localStorage.setItem(LS_HISTORY, JSON.stringify(arr.slice(0,25)));
}

// ---------- Geo ----------
function getGeoOnce(timeoutMs=9000){
  return new Promise((resolve)=>{
    if(!navigator.geolocation) return resolve({ok:false, ts:nowISO(), err:"Geolocation unsupported"});
    const opts={enableHighAccuracy:true, timeout:timeoutMs, maximumAge:15000};
    navigator.geolocation.getCurrentPosition(
      (pos)=>resolve({
        ok:true,
        ts:nowISO(),
        lat:pos.coords.latitude,
        lon:pos.coords.longitude,
        acc_m:Math.round(pos.coords.accuracy||0)
      }),
      (err)=>resolve({ok:false, ts:nowISO(), err: err?.message || "Location error"}),
      opts
    );
  });
}
function fmtCoord(obj){
  if(!obj || !obj.ok) return obj?.err ? `ERR (${obj.err})` : "n/a";
  return `${obj.lat.toFixed(6)}, ${obj.lon.toFixed(6)} (±${obj.acc_m}m)`;
}

// ---------- UI ----------
function populateStoreSelect(){
  const sel = $("storeSelect");
  sel.innerHTML = "";
  state.stores.forEach(s=>{
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = `${s.name} • ${s.address}`;
    sel.appendChild(o);
  });
}

function showConfig(open=true){
  $("configModal").classList.toggle("hidden", !open);
  $("cfgUrl").value = state.cfg.url || "";
  $("cfgKey").value = state.cfg.key || "";
  setMsg($("cfgMsg"), "");
}

async function refreshEnvHealth(){
  try{
    const h = await fetch("/api/health?cb="+Date.now()).then(r=>r.json());
    setChip("healthState", h.ok ? "OK" : "BAD", h.ok ? "pill-ok" : "pill-bad");
  }catch{ setChip("healthState","ERR","pill-bad"); }

  try{
    const e = await fetch("/api/env?cb="+Date.now()).then(r=>r.json());
    setChip("envState", (e && e.ok) ? "OK" : "BAD", (e && e.ok) ? "pill-ok" : "pill-bad");
  }catch{ setChip("envState","ERR","pill-bad"); }
}

// ---------- Supabase bootstrap ----------
async function ensureSupabase(){
  if(!state.cfg.url || !state.cfg.key){
    setChip("authState","CFG","pill-warn");
    return {ok:false, err:"Missing Supabase config"};
  }
  const init = window.initSupabaseClient?.(state.cfg.url, state.cfg.key);
  if(!init || !init.ok){
    setChip("authState","NO-LIB","pill-bad");
    return {ok:false, err:init?.err || "Supabase client not loaded"};
  }
  return {ok:true};
}

async function bindAuth(){
  const ok = await ensureSupabase();
  if(!ok.ok) return;

  window.supabase.auth.onAuthStateChange((_event, session)=>{
    if(session){
      setChip("authState","OK","pill-ok");
      $("app").classList.remove("hidden");
    }else{
      setChip("authState","LOCK","pill-warn");
      $("app").classList.add("hidden");
    }
  });

  const { data } = await window.supabase.auth.getSession();
  if(data?.session){
    setChip("authState","OK","pill-ok");
    $("app").classList.remove("hidden");
  }else{
    setChip("authState","LOCK","pill-warn");
    $("app").classList.add("hidden");
  }
}

// ---------- Reports ----------
function morningReport(){
  if(!state.day) return "No active day.";
  const d = state.day;
  const lines = [];
  lines.push("AXIS BLUE • MORNING REPORT");
  lines.push(`Day Start: ${d.start_ts}`);
  lines.push(`Day GPS: ${fmtCoord(d.geo_start)}`);
  lines.push("");
  lines.push("Attestations:");
  lines.push(`- PREMIER steps planned: ${d.attest_premier ? "YES" : "NO"}`);
  lines.push(`- Safety shoes: ${d.attest_shoes ? "YES" : "NO"}`);
  lines.push("");
  lines.push("Planned Stores:");
  let totalMin = 0;
  d.plan.forEach((p,i)=>{
    totalMin += (p.est_min || 0);
    lines.push(`${i+1}. ${p.store.name} • ${p.store.address}`);
    lines.push(`   Est: ${p.est_min} min • Reason: ${p.reason || "n/a"}`);
    if(p.store.lat && p.store.lon) lines.push(`   Store GPS: ${p.store.lat}, ${p.store.lon}`);
  });
  lines.push("");
  lines.push(`Total Planned Time: ${totalMin} minutes`);
  lines.push("");
  lines.push("Notes: Generated for management visibility. Times are estimates.");
  return lines.join("\n");
}

function eovReport(v){
  if(!v) return "No visit.";
  const lines = [];
  lines.push("AXIS BLUE • END OF VISIT REPORT (EOV)");
  lines.push(`Store: ${v.store.name} • ${v.store.address}`);
  lines.push(`Visit ID: ${v.id}`);
  lines.push(`Start: ${v.start_ts}`);
  lines.push(`End: ${v.end_ts || "IN PROGRESS"}`);
  lines.push(`Check-in GPS: ${fmtCoord(v.geo_in)}`);
  lines.push(`Check-out GPS: ${fmtCoord(v.geo_out)}`);
  lines.push("");
  lines.push("Equipment:");
  lines.push(`- Coolers: ${v.equipment.coolers || "n/a"}`);
  lines.push(`- U-Boats: ${v.equipment.uboats || "n/a"}`);
  lines.push(`- Other: ${v.equipment.other || "n/a"}`);
  lines.push("");
  lines.push("Scans:");
  if(!v.scans.length) lines.push("- None");
  v.scans.forEach(s=>{
    lines.push(`- [${s.type}] ${s.value} (${s.ts})`);
  });
  lines.push("");
  lines.push("Photo Stubs:");
  if(!v.photos.length) lines.push("- None");
  v.photos.forEach(p=>{
    lines.push(`- [${p.cat}] ${p.note || "no note"} (${p.ts})`);
  });
  lines.push("");
  lines.push("Disclaimer: Internal workflow tooling. Not an official product of any corporation.");
  return lines.join("\n");
}

function eodReport(){
  if(!state.day) return "No active day.";
  const d = state.day;
  const lines=[];
  lines.push("AXIS BLUE • END OF DAY REPORT (EOD)");
  lines.push(`Day Start: ${d.start_ts}`);
  lines.push(`Day End: ${d.end_ts || "IN PROGRESS"}`);
  lines.push(`Day Start GPS: ${fmtCoord(d.geo_start)}`);
  lines.push("");
  lines.push(`Visits Completed: ${d.visits.length}`);
  d.visits.forEach((v,i)=>{
    lines.push(`${i+1}. ${v.store.name} • ${v.start_ts} → ${v.end_ts || "IN PROGRESS"}`);
  });
  lines.push("");
  lines.push("Disclaimer: Internal workflow tooling. Not an official product of any corporation.");
  return lines.join("\n");
}

// ---------- Day / Visit lifecycle ----------
function newId(){
  // simple UUIDv4-ish (good enough for client-side ids)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==="x" ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function visitTick(){
  if(!state.activeVisit) return;
  const start = new Date(state.activeVisit.start_ts).getTime();
  const sec = Math.max(0, Math.floor((Date.now()-start)/1000));
  const mm = String(Math.floor(sec/60)).padStart(2,"0");
  const ss = String(sec%60).padStart(2,"0");
  $("visitClock").textContent = `Active: ${state.activeVisit.store.name} • ${mm}:${ss}`;
}

async function startDay(){
  const geo = await getGeoOnce();
  setChip("gpsState", geo.ok ? "OK" : "ERR", geo.ok ? "pill-ok" : "pill-bad");

  // build plan from current store selection list (simple: default all stores in dropdown)
  const plan = state.stores.map(s=>({
    store:s,
    est_min: 35,
    reason:"standard visit"
  }));

  state.day = {
    id: newId(),
    start_ts: nowISO(),
    geo_start: geo,
    attest_premier: true,
    attest_shoes: true,
    plan,
    visits: []
  };
  logLine("DAY STARTED: "+state.day.start_ts);
}

async function startVisit(){
  if(!state.day) return logLine("Start Day first.");

  const selId = $("storeSelect").value;
  const store = state.stores.find(s=>s.id===selId) || state.stores[0];
  if(!store) return logLine("No store selected.");

  const geoIn = await getGeoOnce();
  setChip("gpsState", geoIn.ok ? "OK" : "ERR", geoIn.ok ? "pill-ok" : "pill-bad");

  const v = {
    id:newId(),
    store,
    start_ts: nowISO(),
    end_ts:null,
    geo_in: geoIn,
    geo_out: null,
    scans: [],
    photos: [],
    equipment: { coolers:"", uboats:"", other:"" }
  };
  state.activeVisit = v;
  state.day.visits.push(v);

  if(state.visitTimer) clearInterval(state.visitTimer);
  state.visitTimer = setInterval(visitTick, 1000);
  visitTick();

  logLine(`VISIT START: ${store.name} (${v.id})`);
}

async function endVisit(){
  if(!state.activeVisit) return logLine("No active visit.");
  const geoOut = await getGeoOnce();
  state.activeVisit.geo_out = geoOut;
  state.activeVisit.end_ts = nowISO();

  setChip("gpsState", geoOut.ok ? "OK" : "ERR", geoOut.ok ? "pill-ok" : "pill-bad");

  logLine("VISIT ENDED: "+state.activeVisit.end_ts);
  logLine("");
  logLine(eovReport(state.activeVisit));
  logLine("");

  pushHistory({ type:"EOV", ts: state.activeVisit.end_ts, store: state.activeVisit.store.name, text: eovReport(state.activeVisit) });

  state.activeVisit = null;
  $("visitClock").textContent = "No active visit";
  if(state.visitTimer) clearInterval(state.visitTimer);
}

function addPhotoStub(cat){
  if(!state.activeVisit) return logLine("Start a visit first.");
  const note = $("photoNote").value.trim();
  state.activeVisit.photos.push({ cat, note: note.slice(0,120), ts: nowISO() });
  logLine(`PHOTO STUB ADDED: [${cat}] ${note || "(no note)"}`);
  $("photoNote").value = "";
}

function addScan(){
  if(!state.activeVisit) return logLine("Start a visit first.");
  const type = $("scanType").value;
  const value = $("scanValue").value.trim();
  if(!value) return;
  state.activeVisit.scans.push({ type, value, ts: nowISO() });
  logLine(`SCAN ADDED: [${type}] ${value}`);
  $("scanValue").value = "";
}

async function endDay(){
  if(!state.day) return logLine("No active day.");
  state.day.end_ts = nowISO();
  logLine("DAY ENDED: "+state.day.end_ts);
  logLine("");
  logLine(eodReport());
  pushHistory({ type:"EOD", ts: state.day.end_ts, text: eodReport() });
  state.day = null;
  state.activeVisit = null;
}

// ---------- Buttons ----------
window.addEventListener("DOMContentLoaded", async ()=>{
  loadLocal();
  populateStoreSelect();

  $("btnConfig").onclick = ()=>showConfig(true);
  $("btnCloseConfig").onclick = ()=>showConfig(false);

  $("btnSaveConfig").onclick = async ()=>{
    state.cfg.url = $("cfgUrl").value.trim();
    state.cfg.key = $("cfgKey").value.trim();
    saveCfg();
    setMsg($("cfgMsg"), "Saved. Testing library...");
    const r = await ensureSupabase();
    setMsg($("cfgMsg"), r.ok ? "Supabase ready." : ("Error: "+r.err));
    await bindAuth();
  };

  $("btnTestConfig").onclick = async ()=>{
    const r = await ensureSupabase();
    setMsg($("cfgMsg"), r.ok ? "Supabase client OK." : ("Error: "+r.err));
  };

  $("btnSignIn").onclick = async ()=>{
    setMsg($("loginMsg"), "Signing in…");
    const r = await ensureSupabase();
    if(!r.ok){ setMsg($("loginMsg"), "Config required."); return; }

    const email = $("email").value.trim();
    const password = $("password").value;
    const { error } = await window.supabase.auth.signInWithPassword({ email, password });
    setMsg($("loginMsg"), error ? error.message : "Signed in.");
  };

  $("btnSignOut").onclick = async ()=>{
    if(window.supabase){
      await window.supabase.auth.signOut();
      setMsg($("loginMsg"), "Signed out.");
    }
  };

  $("btnReset").onclick = async ()=>{
    const r = await ensureSupabase();
    if(!r.ok){ setMsg($("loginMsg"), "Config required."); return; }
    const email = $("email").value.trim();
    if(!email){ setMsg($("loginMsg"), "Enter email first."); return; }
    const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    setMsg($("loginMsg"), error ? error.message : "Reset email sent (if account exists).");
  };

  $("btnStartDay").onclick = startDay;
  $("btnMorningReport").onclick = ()=>{
    logLine("");
    logLine(morningReport());
    logLine("");
    pushHistory({ type:"MORNING", ts: nowISO(), text: morningReport() });
  };
  $("btnStartVisit").onclick = startVisit;
  $("btnEndVisit").onclick = endVisit;
  $("btnEOV").onclick = ()=>{
    if(!state.activeVisit) return logLine("No active visit.");
    logLine("");
    logLine(eovReport(state.activeVisit));
    logLine("");
  };
  $("btnEndDay").onclick = endDay;

  // photo category buttons
  document.querySelectorAll('[data-cat]').forEach(btn=>{
    btn.addEventListener("click", ()=>addPhotoStub(btn.getAttribute("data-cat")));
  });
  $("btnAddPhotoStub").onclick = ()=>addPhotoStub("General");
  $("btnAddScan").onclick = addScan;

  $("btnCopy").onclick = async ()=>{
    await navigator.clipboard.writeText($("output").textContent);
    logLine("[copied to clipboard]");
  };
  $("btnClear").onclick = ()=>{ $("output").textContent = ""; };

  $("btnAddStore").onclick = ()=>{
    const name = $("newStoreName").value.trim();
    const address = $("newStoreAddress").value.trim();
    if(!name || !address) return;
    const id = name.toUpperCase().replace(/[^A-Z0-9]+/g,"").slice(0,10) + "_" + Math.floor(Math.random()*1000);
    state.stores.push({ id, name, address, deliveryUsually:"", lat:null, lon:null });
    saveStores();
    populateStoreSelect();
    $("newStoreName").value="";
    $("newStoreAddress").value="";
    logLine(`STORE ADDED: ${name}`);
  };

  $("btnUseStore").onclick = ()=>{
    const sel = $("storeSelect");
    const store = state.stores.find(s=>s.id===sel.value);
    if(store) logLine(`Selected store: ${store.name}`);
  };

  await refreshEnvHealth();
  await bindAuth();

  // If no config saved, open modal to make it obvious
  if(!state.cfg.url || !state.cfg.key) showConfig(true);
});
