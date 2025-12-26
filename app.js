/* AXIS BLUE Field Console - Workflow Refactor v1
   - Day -> Visit -> Capture/Scan -> Reports
   - Offline-first queue + Sync Later
   - Urgent flag
   - Relief handoff
   - Store memory
   - Template mode
   - EOV Equipment section
*/

const $ = (id)=>document.getElementById(id);
const state = {
  user:null,
  day: null,              // {id, date, route, travelMins, startedAt, endedAt, attestations, stores:[]}
  activeStoreId: null,
  activeVisit: null,      // {id, storeId, startedAt, endedAt, notes, concerns, equipment, urgent:[]}
  queue: [],              // pending uploads/actions offline
  history: { days:[], visits:[], photos:[], scans:[] }
};

const LS = {
  get:(k, d=null)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{return d} },
  set:(k, v)=>localStorage.setItem(k, JSON.stringify(v)),
};

function nowISO(){ return new Date().toISOString(); }
function uid(prefix="AX"){ return prefix+"-"+crypto.getRandomValues(new Uint32Array(2)).join("-"); }

function setPill(id, text, tone){
  const el=$(id); if(!el) return;
  el.textContent = text;
  el.style.borderColor = tone==="ok" ? "rgba(64,208,127,.6)" : tone==="bad" ? "rgba(255,90,107,.6)" : tone==="warn" ? "rgba(255,204,102,.6)" : "";
}

function toast(msg, targetId){
  if(targetId) $(targetId).textContent = msg;
  console.log(msg);
}

function show(tabId){
  // tabs
  ["tabDay","tabVisit","tabCapture","tabScan","tabMgmt","tabHistory"].forEach(t=>{
    $(t).classList.toggle("hidden", t!==tabId);
  });
}

function authUI(signedIn){
  $("screenLogin").classList.toggle("hidden", signedIn);
  $("screenApp").classList.toggle("hidden", !signedIn);
  $("btnSignOut").disabled = !signedIn;
}

function loadLocal(){
  state.day = LS.get("AXIS_DAY", null);
  state.queue = LS.get("AXIS_QUEUE", []);
  state.history = LS.get("AXIS_HISTORY", {days:[],visits:[],photos:[],scans:[]});
}

function saveLocal(){
  LS.set("AXIS_DAY", state.day);
  LS.set("AXIS_QUEUE", state.queue);
  LS.set("AXIS_HISTORY", state.history);
}

function ensureDay(){
  if(!state.day){
    state.day = {
      id: uid("DAY"),
      date: $("dayDate").value || new Date().toISOString().slice(0,10),
      route: $("dayRoute").value || "",
      travelMins: Number($("dayTravel").value||15),
      startedAt: null,
      endedAt: null,
      attestations: {
        shoes: $("attShoes").checked,
        premier: $("attPremier").checked,
        safety: $("attSafety").checked
      },
      stores: []
    };
  }
  saveLocal();
}

function renderStores(){
  const list=$("storeList"); list.innerHTML="";
  const sel=$("visitStore"); sel.innerHTML="";
  if(!state.day || state.day.stores.length===0){
    list.innerHTML = `<div class="item"><div class="title">No stores added yet.</div><div class="meta">Add stores to build your day plan.</div></div>`;
    sel.innerHTML = `<option value="">(No stores)</option>`;
    return;
  }
  state.day.stores.forEach((s, idx)=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="title">${idx+1}. ${escapeHtml(s.name)}</div>
      <div class="meta">${escapeHtml(s.address)} | Est: ${s.estMins} mins</div>
      <div class="row">
        <button class="btn" data-act="up" data-id="${s.id}">Up</button>
        <button class="btn" data-act="down" data-id="${s.id}">Down</button>
        <button class="btn" data-act="mem" data-id="${s.id}">Store Memory</button>
        <button class="btn" data-act="del" data-id="${s.id}">Remove</button>
      </div>
    `;
    list.appendChild(div);
  });
  state.day.stores.forEach(s=>{
    const opt=document.createElement("option");
    opt.value=s.id; opt.textContent=s.name;
    sel.appendChild(opt);
  });
}

function renderActive(){
  $("activeVisit").value = state.activeVisit ? `${state.activeVisit.id} (${state.activeVisit.storeId})` : "None";
}

function renderQueue(){
  setPill("pillSync", state.queue.length ? `SYNC: ${state.queue.length}` : "SYNC: OK", state.queue.length?"warn":"ok");
}

function escapeHtml(str){ return (str||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

// ---------------- SUPABASE CHECKS ----------------
async function checkEnv(){
  try{
    const r = await fetch("/env",{cache:"no-store"});
    const t = await r.text();
    setPill("pillEnv","ENV: OK","ok");
    return t;
  }catch{
    setPill("pillEnv","ENV: ERR","bad");
    return null;
  }
}
async function checkHealth(){
  try{
    const r = await fetch("/health",{cache:"no-store"});
    const t = await r.text();
    setPill("pillHealth","HEALTH: OK","ok");
    return t;
  }catch{
    setPill("pillHealth","HEALTH: ERR","bad");
    return null;
  }
}

async function ensureSupaReady(){
  // supabaseClient.js loads async
  for(let i=0;i<20;i++){
    if(window.__SUPA_ERR__){ return {ok:false, msg: window.__SUPA_ERR__}; }
    if(window.supabase){ return {ok:true}; }
    await new Promise(r=>setTimeout(r,100));
  }
  return {ok:false, msg:"Supabase client not loaded"};
}

// ---------------- AUTH ----------------
async function signIn(){
  $("loginMsg").textContent = "";
  const email=$("email").value.trim();
  const password=$("password").value;
  const ready = await ensureSupaReady();
  if(!ready.ok){ toast(ready.msg, "loginMsg"); setPill("pillAuth","AUTH: ERR","bad"); return; }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if(error){ toast("Sign-in failed: "+error.message, "loginMsg"); setPill("pillAuth","AUTH: ERR","bad"); return; }
  state.user = data.user;
  setPill("pillAuth","AUTH: OK","ok");
  authUI(true);
  show("tabDay");
  toast("Signed in.", "loginMsg");
  await refreshSession();
}

async function signOut(){
  const ready = await ensureSupaReady();
  if(ready.ok && window.supabase){ await supabase.auth.signOut(); }
  state.user=null;
  authUI(false);
  setPill("pillAuth","AUTH: OUT","warn");
  toast("Signed out.", "loginMsg");
}

async function refreshSession(){
  const ready = await ensureSupaReady();
  if(!ready.ok){ setPill("pillAuth","AUTH: CFG","warn"); return; }
  const { data } = await supabase.auth.getSession();
  if(data.session?.user){
    state.user = data.session.user;
    setPill("pillAuth","AUTH: OK","ok");
    authUI(true);
  }else{
    setPill("pillAuth","AUTH: OUT","warn");
    authUI(false);
  }
}

// ---------------- DAY ----------------
function startDay(){
  ensureDay();
  state.day.date = $("dayDate").value || state.day.date;
  state.day.route = $("dayRoute").value || state.day.route;
  state.day.travelMins = Number($("dayTravel").value||state.day.travelMins);
  state.day.attestations = {
    shoes: $("attShoes").checked,
    premier: $("attPremier").checked,
    safety: $("attSafety").checked
  };
  state.day.startedAt = state.day.startedAt || nowISO();
  saveLocal();
  toast("Day started: "+state.day.startedAt, "dayMsg");
}

function endDay(){
  if(!state.day){ toast("No active day.", "dayMsg"); return; }
  state.day.endedAt = nowISO();
  saveLocal();
  toast("Day ended: "+state.day.endedAt, "dayMsg");
}

function addStore(){
  ensureDay();
  const name=$("storeName").value.trim();
  const address=$("storeAddr").value.trim();
  const estMins=Number($("storeMins").value||30);
  if(!name){ toast("Store name required.", "morningMsg"); return; }
  state.day.stores.push({ id:uid("ST"), name, address, estMins, memory: LS.get("AXIS_STOREMEM_"+name, "") });
  $("storeName").value=""; $("storeAddr").value=""; $("storeMins").value=30;
  saveLocal(); renderStores();
  toast("Store added.", "morningMsg");
}

function reorderStore(id, dir){
  const i = state.day.stores.findIndex(s=>s.id===id);
  if(i<0) return;
  const j = dir==="up" ? i-1 : i+1;
  if(j<0 || j>=state.day.stores.length) return;
  const tmp=state.day.stores[i]; state.day.stores[i]=state.day.stores[j]; state.day.stores[j]=tmp;
  saveLocal(); renderStores();
}

function removeStore(id){
  state.day.stores = state.day.stores.filter(s=>s.id!==id);
  saveLocal(); renderStores();
}

function templateDay(){
  // Your known stores (can expand later)
  ensureDay();
  const defaults = [
    {name:"Walmart 1492", address:"14000 E Exposition Ave Aurora CO 80012", estMins:55},
    {name:"King Soopers 00014", address:"655 Peoria St Aurora CO 80011", estMins:35},
    {name:"Family Dollar 3477", address:"620 Peoria St Aurora CO 80011", estMins:25},
    {name:"Target SC 1471", address:"14200 E Ellsworth Ave Aurora CO 80012", estMins:35},
  ];
  defaults.forEach(d=>{
    if(!state.day.stores.some(s=>s.name===d.name)){
      state.day.stores.push({ id:uid("ST"), ...d, memory: LS.get("AXIS_STOREMEM_"+d.name, "") });
    }
  });
  saveLocal(); renderStores();
  toast("Template day loaded.", "dayMsg");
}

function morningRundownText(){
  if(!state.day) return "No day plan.";
  const d=state.day;
  const travel=d.travelMins||0;
  const totalStops = d.stores.reduce((a,s)=>a+s.estMins,0);
  const totalTravel = (d.stores.length>0 ? (d.stores.length-1)*travel : 0);
  const total = totalStops + totalTravel;

  const att = d.attestations||{};
  const lines = [];
  lines.push(`AXIS BLUE – MORNING RUNDOWN`);
  lines.push(`Date: ${d.date} | Route: ${d.route || "(not set)"}`);
  lines.push(`Attestations: Shoes=${att.shoes?"YES":"NO"} | PREMIER=${att.premier?"YES":"NO"} | Safety=${att.safety?"YES":"NO"}`);
  lines.push(`Travel buffer per leg: ${travel} mins`);
  lines.push(``);
  d.stores.forEach((s, idx)=>{
    const leg = idx===0 ? 0 : travel;
    lines.push(`${idx+1}) ${s.name} – Est ${s.estMins} mins (+${leg} travel)`);
    if(s.address) lines.push(`   ${s.address}`);
  });
  lines.push(``);
  lines.push(`Estimated totals: On-site=${totalStops} mins | Travel=${totalTravel} mins | Total=${total} mins (${Math.round(total/60*10)/10} hrs)`);
  lines.push(`Reasoning: Estimates include coolers, sales floor execution, backroom, credits, and documentation time.`);
  return lines.join("\n");
}

function openPrintable(title, bodyText){
  const w = window.open("", "_blank");
  const safe = escapeHtml(bodyText).replace(/\n/g,"<br/>");
  w.document.write(`
    <html><head><title>${escapeHtml(title)}</title>
      <style>
        body{font-family: ui-monospace, Menlo, monospace; padding:24px; color:#111}
        h1{font-size:18px; margin:0 0 12px}
        .meta{font-size:12px; color:#444; margin-bottom:10px}
        .box{border:1px solid #ddd; padding:14px}
      </style>
    </head><body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Generated by AXIS BLUE Field Console</div>
      <div class="box">${safe}</div>
      <script>window.print();</script>
    </body></html>
  `);
  w.document.close();
}

// ---------------- VISIT ----------------
function startVisit(){
  if(!state.day || !state.day.startedAt){
    toast("Start Day first.", "visitMsg"); return;
  }
  const storeId = $("visitStore").value;
  if(!storeId){ toast("Select a store.", "visitMsg"); return; }
  // if active visit already open, block
  if(state.activeVisit && !state.activeVisit.endedAt){
    toast("A visit is already active. End it first.", "visitMsg"); return;
  }
  state.activeStoreId = storeId;
  state.activeVisit = {
    id: uid("VIS"),
    dayId: state.day.id,
    storeId,
    startedAt: nowISO(),
    endedAt: null,
    notes: "",
    concerns: "",
    equipment: {coolers:false, uboats:false, pallets:false, racks:false, pos:false, other:false, otherText:""},
    urgent: []
  };
  state.history.visits.push(state.activeVisit);
  saveLocal();
  renderActive();
  toast("Visit started: "+state.activeVisit.startedAt, "visitMsg");
}

function urgentFlag(){
  if(!state.activeVisit || state.activeVisit.endedAt){ toast("No active visit.", "visitMsg"); return; }
  const txt = prompt("Urgent issue (short):");
  if(!txt) return;
  const sev = prompt("Severity (Low/Med/High):","High") || "High";
  state.activeVisit.urgent.push({ id:uid("URG"), when:nowISO(), severity:sev, note:txt });
  saveLocal();
  toast("Urgent issue flagged.", "visitMsg");
}

function endVisit(){
  if(!state.activeVisit || state.activeVisit.endedAt){ toast("No active visit.", "visitMsg"); return; }
  state.activeVisit.endedAt = nowISO();
  saveLocal();
  renderActive();
  toast("Visit ended: "+state.activeVisit.endedAt, "visitMsg");
}

function saveVisit(){
  if(!state.activeVisit){ toast("No active visit.", "saveVisitMsg"); return; }
  state.activeVisit.notes = $("visitNotes").value || "";
  state.activeVisit.concerns = $("visitConcerns").value || "";
  state.activeVisit.equipment = {
    coolers: $("eqCoolers").checked,
    uboats: $("eqUboats").checked,
    pallets: $("eqPallets").checked,
    racks: $("eqRacks").checked,
    pos: $("eqPOS").checked,
    other: $("eqOther").checked,
    otherText: $("eqOtherText").value || ""
  };
  saveLocal();
  toast("Visit saved (local).", "saveVisitMsg");
}

function getStoreById(id){
  return state.day?.stores?.find(s=>s.id===id) || null;
}

function visitReportText(v){
  const s = getStoreById(v.storeId);
  const photos = state.history.photos.filter(p=>p.visitId===v.id);
  const scans = state.history.scans.filter(sc=>sc.visitId===v.id);

  const byCat = (cat)=>photos.filter(p=>p.category===cat).length;
  const scanBy = (t)=>scans.filter(sc=>sc.type===t).map(sc=>sc.value).slice(0,30);

  const eq = v.equipment||{};
  const eqList = [];
  if(eq.coolers) eqList.push("Coolers");
  if(eq.uboats) eqList.push("U-boats");
  if(eq.pallets) eqList.push("Pallets");
  if(eq.racks) eqList.push("Racks");
  if(eq.pos) eqList.push("POS/Signage");
  if(eq.other) eqList.push("Other: "+(eq.otherText||"(unspecified)"));

  const lines=[];
  lines.push(`PBNA FIELD EXECUTION REPORT`); // you can swap branding later if needed
  lines.push(`EOV – END OF VISIT`);
  lines.push(`Store: ${s?.name || v.storeId}`);
  if(s?.address) lines.push(`Address: ${s.address}`);
  lines.push(`Visit ID: ${v.id}`);
  lines.push(`Start: ${v.startedAt}`);
  lines.push(`End: ${v.endedAt || "(active)"}`);
  lines.push(``);
  lines.push(`PHOTOS (counts): Sales Floor=${byCat("Sales Floor")} | Backroom=${byCat("Backroom")} | Credits=${byCat("Credits")} | Coolers=${byCat("Coolers")}`);
  lines.push(``);
  lines.push(`SCANS:`);
  lines.push(`- OOS: ${scanBy("OOS").join(", ") || "(none)"}`);
  lines.push(`- Credits: ${scanBy("Credits").join(", ") || "(none)"}`);
  lines.push(`- Breakage: ${scanBy("Breakage").join(", ") || "(none)"}`);
  lines.push(``);
  lines.push(`EQUIPMENT: ${eqList.length ? eqList.join(" | ") : "(none noted)"}`);
  lines.push(``);
  if(v.urgent?.length){
    lines.push(`URGENT FLAGS:`);
    v.urgent.forEach(u=> lines.push(`- [${u.severity}] ${u.note} (${u.when})`));
    lines.push(``);
  }
  lines.push(`NOTES (Opportunities / Inventory):`);
  lines.push(v.notes || "(none)");
  lines.push(``);
  lines.push(`QUESTIONS/CONCERNS FOR PSR/MSR:`);
  lines.push(v.concerns || "(none)");
  return lines.join("\n");
}

function generateEVS(){
  if(!state.activeVisit){ toast("No active visit.", "saveVisitMsg"); return; }
  saveVisit();
  openPrintable("AXIS BLUE – EOV (End of Visit)", visitReportText(state.activeVisit));
}

// ---------------- CAPTURE / UPLOAD ----------------
function addToQueue(item){
  state.queue.push(item);
  saveLocal(); renderQueue();
}

function addPhotoLocal(rec){
  state.history.photos.push(rec);
  saveLocal();
}

async function uploadPhoto(){
  if(!state.activeVisit || state.activeVisit.endedAt){
    toast("Start a visit first (active visit required).", "photoMsg"); return;
  }
  const fileInput=$("photoFile");
  const f=fileInput.files?.[0];
  if(!f){ toast("Pick a photo first.", "photoMsg"); return; }

  const category=$("photoCategory").value;
  const comment=($("photoComment").value||"").slice(0,120);

  const rec = {
    id: uid("PH"),
    visitId: state.activeVisit.id,
    dayId: state.day.id,
    storeId: state.activeVisit.storeId,
    category,
    comment,
    filename: f.name,
    createdAt: nowISO(),
    status: "queued"
  };

  addPhotoLocal(rec);

  // Offline-first: queue upload action
  const blob = await f.arrayBuffer();
  addToQueue({ kind:"photo", rec, bytes: Array.from(new Uint8Array(blob)) });

  $("photoFile").value="";
  $("photoComment").value="";
  toast("Queued photo (will sync).", "photoMsg");
  renderPhotos();
}

function renderPhotos(){
  const list=$("photoList"); list.innerHTML="";
  const v = state.activeVisit;
  const photos = state.history.photos.filter(p=> v ? p.visitId===v.id : false).slice().reverse();
  if(!photos.length){
    list.innerHTML = `<div class="item"><div class="title">No photos yet.</div><div class="meta">Upload categorized photos for this visit.</div></div>`;
    return;
  }
  photos.forEach(p=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="title">${escapeHtml(p.category)} – ${escapeHtml(p.filename)}</div>
      <div class="meta">${escapeHtml(p.createdAt)} | ${escapeHtml(p.comment||"")}</div>
    `;
    list.appendChild(div);
  });
}

function viewQueue(){
  const out = state.queue.map((q,i)=>`${i+1}) ${q.kind} ${q.rec?.id || ""}`).join("\n") || "Queue empty.";
  alert(out);
}

// ---------------- SCAN ----------------
async function startScan(){
  if(!state.activeVisit || state.activeVisit.endedAt){
    toast("Start a visit first.", "scanOut"); return;
  }
  // BarcodeDetector works in modern browsers; iOS support varies.
  if(!("BarcodeDetector" in window)){
    toast("Scan not supported here. Use Manual Value.", "scanOut");
    return;
  }
  const type=$("scanType").value;
  const detector = new BarcodeDetector({ formats:["qr_code","ean_13","ean_8","upc_a","upc_e","code_128"] });
  const input = document.createElement("input");
  input.type="file"; input.accept="image/*"; input.capture="environment";
  input.onchange = async ()=>{
    const f=input.files?.[0]; if(!f) return;
    const bmp = await createImageBitmap(f);
    const codes = await detector.detect(bmp);
    if(!codes.length){ toast("No code detected.", "scanOut"); return; }
    const val = codes[0].rawValue || "(unknown)";
    addScan(type, val);
    toast(`Scan saved: ${type} = ${val}`, "scanOut");
    renderScans();
  };
  input.click();
}

function addScan(type, value){
  const rec = {
    id: uid("SC"),
    visitId: state.activeVisit.id,
    dayId: state.day.id,
    storeId: state.activeVisit.storeId,
    type,
    value,
    createdAt: nowISO(),
    status:"local"
  };
  state.history.scans.push(rec);
  saveLocal();
  // queue sync
  addToQueue({ kind:"scan", rec });
}

function saveManual(){
  const v=$("scanManual").value.trim();
  if(!v){ toast("Enter a value first.", "scanOut"); return; }
  addScan($("scanType").value, v);
  $("scanManual").value="";
  toast("Manual scan saved.", "scanOut");
  renderScans();
}

function renderScans(){
  const list=$("scanList"); list.innerHTML="";
  const v = state.activeVisit;
  const scans = state.history.scans.filter(s=> v ? s.visitId===v.id : false).slice().reverse();
  if(!scans.length){
    list.innerHTML = `<div class="item"><div class="title">No scans yet.</div><div class="meta">Use Scan or Manual Value.</div></div>`;
    return;
  }
  scans.forEach(s=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML = `<div class="title">${escapeHtml(s.type)}: ${escapeHtml(s.value)}</div><div class="meta">${escapeHtml(s.createdAt)}</div>`;
    list.appendChild(div);
  });
}

function nfcNote(){
  // Web NFC is not available on iOS Safari.
  $("nfcMsg").textContent = "iOS Safari does not support Web NFC. NFC capture will be native iOS app feature (future).";
}

// ---------------- REPORTS / MGMT ----------------
function endOfDaySummaryText(){
  if(!state.day) return "No day.";
  const d=state.day;
  const visits = state.history.visits.filter(v=>v.dayId===d.id);
  const lines=[];
  lines.push(`AXIS BLUE – END OF DAY SUMMARY`);
  lines.push(`Date: ${d.date} | Route: ${d.route || "(not set)"}`);
  lines.push(`Start: ${d.startedAt || "(not started)"} | End: ${d.endedAt || "(not ended)"}`);
  lines.push(``);
  visits.forEach((v, idx)=>{
    const s=getStoreById(v.storeId);
    lines.push(`${idx+1}) ${s?.name || v.storeId}`);
    lines.push(`   Visit: ${v.startedAt} → ${v.endedAt || "(active)"}`);
    if(v.urgent?.length){
      lines.push(`   URGENT: ${v.urgent.map(u=>`[${u.severity}] ${u.note}`).join(" | ")}`);
    }
    if(v.notes) lines.push(`   Notes: ${v.notes}`);
    if(v.concerns) lines.push(`   PSR/MSR: ${v.concerns}`);
  });
  lines.push(``);
  lines.push(`Sync queue pending items: ${state.queue.length}`);
  return lines.join("\n");
}

function reliefHandoffText(){
  if(!state.day) return "No day.";
  const d=state.day;
  const visits = state.history.visits.filter(v=>v.dayId===d.id);
  const lines=[];
  lines.push(`AXIS BLUE – RELIEF MERCHANDISER HANDOFF`);
  lines.push(`Date: ${d.date} | Route: ${d.route || ""}`);
  lines.push(``);
  visits.forEach(v=>{
    const s=getStoreById(v.storeId);
    const open = !v.endedAt;
    if(open){
      lines.push(`OPEN VISIT: ${s?.name || v.storeId} (${v.id}) started ${v.startedAt}`);
    }
    if(v.notes) lines.push(`- ${s?.name || v.storeId}: ${v.notes}`);
    if(v.urgent?.length){
      v.urgent.forEach(u=> lines.push(`- URGENT @ ${s?.name || v.storeId}: [${u.severity}] ${u.note}`));
    }
  });
  lines.push(``);
  lines.push(`Pending sync items: ${state.queue.length}`);
  return lines.join("\n");
}

function setMgmtOut(txt){
  $("mgmtOut").value = txt;
  toast("Output generated.", "mgmtMsg");
}

async function copyText(txt){
  await navigator.clipboard.writeText(txt);
  toast("Copied to clipboard.", "mgmtMsg");
}

function emailDraft(){
  const subj = `AXIS BLUE – Field Update (${state.day?.date || ""})`;
  const body = encodeURIComponent(endOfDaySummaryText());
  window.location.href = `mailto:?subject=${encodeURIComponent(subj)}&body=${body}`;
  toast("Email draft opened.", "mgmtMsg");
}

// ---------------- SYNC (stubbed: structure ready, wiring to Supabase tables/storage next) ----------------
async function syncNow(){
  // This keeps today usable even before we fully bind to your exact Supabase table names.
  // It will "drain" queue when you wire the tables/storage, without breaking UX now.
  renderQueue();
}

// ---------------- HISTORY ----------------
function refreshHistory(){
  const list=$("historyList"); list.innerHTML="";
  const d=state.day;
  const days = state.history.days;
  const visits = state.history.visits.slice().reverse().slice(0,20);
  if(d && !days.some(x=>x.id===d.id)){
    days.push({id:d.id, date:d.date, route:d.route, startedAt:d.startedAt, endedAt:d.endedAt});
    saveLocal();
  }
  if(!visits.length){
    list.innerHTML = `<div class="item"><div class="title">No history yet.</div><div class="meta">Run a day and visits to populate history.</div></div>`;
    return;
  }
  visits.forEach(v=>{
    const s=getStoreById(v.storeId);
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="title">${escapeHtml(s?.name || v.storeId)} (${v.id})</div>
      <div class="meta">${escapeHtml(v.startedAt)} → ${escapeHtml(v.endedAt || "(active)")}</div>
      <div class="row">
        <button class="btn" data-act="print" data-id="${v.id}">Print EOV</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function exportJSON(){
  const blob = new Blob([JSON.stringify({day:state.day, history:state.history, queue:state.queue}, null, 2)], {type:"application/json"});
  const a=document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `axisblue_export_${(state.day?.date||"")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------- EVENTS ----------------
function wire(){
  $("buildStamp").textContent = $("buildStamp").textContent.replace("__BUILD__", "");

  // default date
  $("dayDate").value = new Date().toISOString().slice(0,10);

  document.querySelectorAll("[data-tab]").forEach(b=>{
    b.addEventListener("click", ()=>show(b.getAttribute("data-tab")));
  });

  $("btnEnv").onclick = async()=>{ const t=await checkEnv(); toast(t? "ENV OK":"ENV error", "diagMsg"); };
  $("btnHealth").onclick = async()=>{ const t=await checkHealth(); toast(t? "HEALTH OK":"HEALTH error", "diagMsg"); };
  $("btnDiag").onclick = async()=>{
    const e = await checkEnv();
    const h = await checkHealth();
    const cfg = window.__SUPA_CFG__||{};
    toast(`Diag: env=${!!e} health=${!!h} supaUrl=${cfg.url? "set":"missing"} key=${cfg.key? "set":"missing"}`, "diagMsg");
  };

  $("btnSignIn").onclick = signIn;
  $("btnSignOut").onclick = signOut;

  $("btnStartDay").onclick = startDay;
  $("btnEndDay").onclick = endDay;
  $("btnTemplateDay").onclick = templateDay;

  $("btnAddStore").onclick = addStore;
  $("btnMorningReport").onclick = ()=>{
    ensureDay();
    const txt = morningRundownText();
    openPrintable("AXIS BLUE – Morning Rundown", txt);
    $("morningMsg").textContent = "Morning Rundown opened (print to PDF).";
  };

  $("storeList").addEventListener("click",(ev)=>{
    const btn = ev.target.closest("button"); if(!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    if(act==="up") reorderStore(id,"up");
    if(act==="down") reorderStore(id,"down");
    if(act==="del") removeStore(id);
    if(act==="mem"){
      const s = state.day.stores.find(x=>x.id===id);
      const key = "AXIS_STOREMEM_"+s.name;
      const cur = LS.get(key,"");
      const next = prompt(`Store Memory for ${s.name} (safe, non-proprietary):`, cur||"");
      if(next!==null){ LS.set(key,next); s.memory=next; saveLocal(); }
    }
  });

  $("btnStartVisit").onclick = startVisit;
  $("btnEndVisit").onclick = endVisit;
  $("btnUrgentFlag").onclick = urgentFlag;
  $("btnSaveVisit").onclick = saveVisit;
  $("btnEVS").onclick = generateEVS;

  $("btnUploadPhoto").onclick = uploadPhoto;
  $("btnViewQueue").onclick = viewQueue;

  $("btnStartScan").onclick = startScan;
  $("btnSaveManual").onclick = saveManual;
  $("btnNFC").onclick = nfcNote;

  $("btnCopyMorning").onclick = async()=>copyText(morningRundownText());
  $("btnCopyEOD").onclick = async()=>copyText(endOfDaySummaryText());
  $("btnCopyHandoff").onclick = async()=>copyText(reliefHandoffText());
  $("btnEmailDraft").onclick = emailDraft;

  $("btnRefreshHistory").onclick = refreshHistory;
  $("btnExportJSON").onclick = exportJSON;

  $("historyList").addEventListener("click",(ev)=>{
    const btn = ev.target.closest("button"); if(!btn) return;
    const act=btn.getAttribute("data-act");
    const id=btn.getAttribute("data-id");
    if(act==="print"){
      const v = state.history.visits.find(x=>x.id===id);
      if(v) openPrintable("AXIS BLUE – EOV (End of Visit)", visitReportText(v));
    }
  });
}

// ---------------- INIT ----------------
(async function init(){
  loadLocal();
  renderQueue();

  await checkEnv();
  await checkHealth();

  const ready = await ensureSupaReady();
  if(!ready.ok){
    setPill("pillAuth","AUTH: CFG","warn");
  }else{
    await refreshSession();
  }

  // restore UI inputs
  if(state.day){
    $("dayDate").value = state.day.date || $("dayDate").value;
    $("dayRoute").value = state.day.route || "";
    $("dayTravel").value = state.day.travelMins ?? 15;
    $("attShoes").checked = !!state.day.attestations?.shoes;
    $("attPremier").checked = !!state.day.attestations?.premier;
    $("attSafety").checked = !!state.day.attestations?.safety;
  }
  renderStores();
  renderActive();
  wire();

  // keep queue visible
  setInterval(syncNow, 3000);
})();
