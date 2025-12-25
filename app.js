/* AXIS BLUE — Supabase-wired v1
   - Auth (email+password)
   - Tables: axis_days, axis_visits, axis_intel
   - UI: Run Day + Intelligence Lab
*/

const SUPABASE_URL = "https://frhrutiqpshznnyurmlq.supabase.co"\;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaHJ1dGlxcHNoem5ueXVybWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODc0MjksImV4cCI6MjA4MjI2MzQyOX0.3Bhg7iw35aTsXnctpk2m2UDui6PaXUOJKVUmy4SxnNY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stores list
const STORES = [
  { id: "WM1492", name: "Walmart 1492", address: "14000 E Exposition Ave Aurora CO 80012", delivery: "usually yes" },
  { id: "KS00014", name: "King Soopers 00014", address: "655 Peoria St Aurora CO 80011", delivery: "usually no" },
  { id: "FD3477", name: "Family Dollar 3477", address: "620 Peoria St Aurora CO 80011", delivery: "usually no" },
  { id: "TGT1471", name: "Target SC 1471", address: "14200 E Ellsworth Ave Aurora CO 80012", delivery: "usually no" }
];

function $(id){ return document.getElementById(id); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

let state = {
  user: null,
  day: null,        // axis_days row
  activeVisit: null,
  visits: [],
  intel: []
};

function setMode(mode){
  $("modeRun").classList.toggle("hidden", mode !== "run");
  $("modeIntel").classList.toggle("hidden", mode !== "intel");
  $("tabRun").classList.toggle("active", mode === "run");
  $("tabIntel").classList.toggle("active", mode === "intel");
}
window.showMode = (m)=> setMode(m);

function setPills(){
  $("host").textContent = window.location.host || "unknown";
  $("userPill").textContent = state.user ? state.user.email : "signed out";
  $("dbPill").textContent = state.user ? "connected" : "offline";
}

function renderStores(){
  const storeSel = $("store");
  const intelSel = $("intelStore");

  storeSel.innerHTML = "";
  intelSel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "(none)";
  intelSel.appendChild(opt0);

  STORES.forEach(s=>{
    const o1 = document.createElement("option");
    o1.value = s.id;
    o1.textContent = s.name;
    storeSel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = s.id;
    o2.textContent = s.name;
    intelSel.appendChild(o2);
  });
}

function requireAuth(){
  if (!state.user) throw new Error("Not signed in.");
}

function requireDay(){
  if (!state.day) throw new Error("Begin Day first.");
}

function escapeHTML(str){
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function renderRunLog(){
  const el = $("runLog");
  el.innerHTML = "";

  if (!state.visits.length){
    el.innerHTML = `<div style="color:#5b6477">No visits yet.</div>`;
    return;
  }

  state.visits.slice().reverse().forEach(v=>{
    const ended = v.ended_at ? `<span class="statusGood">ENDED</span>` : `<span class="statusWarn">IN PROGRESS</span>`;
    const urgent = v.urgent ? ` · <span class="statusWarn">URGENT</span>` : "";
    el.innerHTML += `
      <div style="padding:12px;border:1px solid #d7e1ff;border-radius:14px;background:#fbfdff;margin-bottom:10px">
        <div style="font-weight:900">${escapeHTML(v.store_name)} <span style="font-size:12px;color:#5b6477">(${escapeHTML(v.store_id)})</span></div>
        <div style="font-size:12px;color:#5b6477">${ended}${urgent}</div>
        <div style="margin-top:8px;font-size:13px">
          <div><b>Sales:</b> ${escapeHTML((v.sales_opp||"").slice(0,140) || "(none)")}</div>
          <div><b>Inventory:</b> ${escapeHTML((v.inventory_concerns||"").slice(0,140) || "(none)")}</div>
          <div><b>PSR/MSR:</b> ${escapeHTML((v.rep_questions||"").slice(0,140) || "(none)")}</div>
        </div>
      </div>
    `;
  });
}

function renderIntelLog(){
  const el = $("intelLog");
  el.innerHTML = "";

  if (!state.intel.length){
    el.innerHTML = `<div style="color:#5b6477">No intel records yet.</div>`;
    return;
  }

  state.intel.slice().reverse().forEach(r=>{
    el.innerHTML += `
      <div style="padding:12px;border:1px solid #d7e1ff;border-radius:14px;background:#fbfdff;margin-bottom:10px">
        <div style="font-weight:900">${escapeHTML(r.identifier_type)} · ${escapeHTML(r.identifier_value || "(no value)")}</div>
        <div style="font-size:12px;color:#5b6477">${escapeHTML(r.store_name || "(no store)")} · ${escapeHTML(r.created_at)}</div>
        <div style="margin-top:8px;font-size:13px">
          <div><b>Payload:</b> ${escapeHTML((r.payload||"").slice(0,160) || "(none)")}</div>
          <div><b>Notes:</b> ${escapeHTML((r.notes||"").slice(0,160) || "(none)")}</div>
        </div>
      </div>
    `;
  });
}

async function refreshFromDB(){
  requireAuth();

  // Load day if exists for selected date
  const dayDate = $("date").value || todayISO();
  const { data: days, error: dayErr } = await supabase
    .from("axis_days")
    .select("*")
    .eq("user_id", state.user.id)
    .eq("day_date", dayDate)
    .limit(1);

  if (dayErr) throw dayErr;

  state.day = days && days.length ? days[0] : null;

  // Load visits + intel for day if day exists
  if (state.day){
    const { data: visits, error: vErr } = await supabase
      .from("axis_visits")
      .select("*")
      .eq("day_id", state.day.id)
      .order("created_at", { ascending: true });

    if (vErr) throw vErr;
    state.visits = visits || [];

    const { data: intel, error: iErr } = await supabase
      .from("axis_intel")
      .select("*")
      .eq("day_id", state.day.id)
      .order("created_at", { ascending: true });

    if (iErr) throw iErr;
    state.intel = intel || [];
  } else {
    state.visits = [];
    state.intel = [];
  }

  $("beginState").textContent = state.day ? "Day active ✅" : "Not started";
  $("beginState").className = state.day ? "statusGood" : "statusBad";

  renderRunLog();
  renderIntelLog();
  setPills();
}

window.refreshFromDB = async ()=>{
  try { await refreshFromDB(); }
  catch(e){ alert(e.message || String(e)); }
};

window.loadToday = async ()=>{
  $("date").value = todayISO();
  await window.refreshFromDB();
};

window.saveHeaderOnly = async ()=>{
  // just store locally in inputs; DB writes happen on Begin Day
};

window.beginDay = async ()=>{
  try{
    requireAuth();

    const merch = ($("merchandiser").value || "").trim();
    const dayDate = $("date").value || todayISO();
    if (!merch) throw new Error("Merchandiser is required.");

    // upsert day
    const payload = {
      user_id: state.user.id,
      day_date: dayDate,
      merchandiser: merch
    };

    const { data, error } = await supabase
      .from("axis_days")
      .upsert(payload, { onConflict: "user_id,day_date" })
      .select("*")
      .limit(1);

    if (error) throw error;

    state.day = data[0];
    await refreshFromDB();
  } catch(e){
    alert(e.message || String(e));
  }
};

window.startVisit = async ()=>{
  try{
    requireAuth();
    requireDay();

    const storeId = $("store").value;
    if (!storeId) throw new Error("Select a store.");

    const st = STORES.find(x => x.id === storeId);
    const urgent = $("urgentFlag").value === "yes";

    const row = {
      user_id: state.user.id,
      day_id: state.day.id,
      store_id: storeId,
      store_name: st?.name || storeId,
      address: st?.address || null,
      delivery: st?.delivery || null,
      urgent,
      sales_opp: ($("salesOpp").value || "").trim(),
      inventory_concerns: ($("inventoryConcerns").value || "").trim(),
      rep_questions: ($("repQuestions").value || "").trim(),
      started_at: new Date().toISOString(),
      ended_at: null
    };

    const { data, error } = await supabase
      .from("axis_visits")
      .insert(row)
      .select("*")
      .limit(1);

    if (error) throw error;

    state.activeVisit = data[0];
    await refreshFromDB();
  } catch(e){
    alert(e.message || String(e));
  }
};

window.endVisit = async ()=>{
  try{
    requireAuth();
    requireDay();
    if (!state.visits.length) throw new Error("No visits yet.");

    // End the most recent in-progress visit
    const last = [...state.visits].reverse().find(v => !v.ended_at);
    if (!last) throw new Error("No in-progress visit to end.");

    const patch = {
      urgent: $("urgentFlag").value === "yes",
      sales_opp: ($("salesOpp").value || "").trim(),
      inventory_concerns: ($("inventoryConcerns").value || "").trim(),
      rep_questions: ($("repQuestions").value || "").trim(),
      ended_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("axis_visits")
      .update(patch)
      .eq("id", last.id);

    if (error) throw error;

    state.activeVisit = null;
    await refreshFromDB();
  } catch(e){
    alert(e.message || String(e));
  }
};

window.clearVisitForm = ()=>{
  $("urgentFlag").value = "no";
  $("salesOpp").value = "";
  $("inventoryConcerns").value = "";
  $("repQuestions").value = "";
};

window.saveIntel = async ()=>{
  try{
    requireAuth();
    requireDay();

    const storeId = $("intelStore").value || null;
    const st = storeId ? STORES.find(x => x.id === storeId) : null;

    const row = {
      user_id: state.user.id,
      day_id: state.day.id,
      store_id: storeId,
      store_name: st?.name || null,
      identifier_type: $("intelType").value,
      identifier_value: ($("intelValue").value || "").trim(),
      payload: ($("intelPayload").value || "").trim(),
      notes: ($("intelNotes").value || "").trim()
    };

    const { error } = await supabase.from("axis_intel").insert(row);
    if (error) throw error;

    $("intelValue").value = "";
    $("intelPayload").value = "";
    $("intelNotes").value = "";
    await refreshFromDB();
  } catch(e){
    alert(e.message || String(e));
  }
};

window.clearIntel = ()=>{
  $("intelStore").value = "";
  $("intelType").value = "NFC";
  $("intelValue").value = "";
  $("intelPayload").value = "";
  $("intelNotes").value = "";
};

window.downloadIntelExport = ()=>{
  const blob = {
    day: state.day,
    intel: state.intel
  };
  const name = `AXIS_INTEL_${$("date").value || todayISO()}.json`;
  const data = JSON.stringify(blob, null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  a.download = name;
  a.click();
};

window.downloadDBBackup = window.downloadDB = async ()=>{
  try{
    requireAuth();
    // This is just a “client snapshot” of what we currently have loaded.
    const blob = { user: state.user, day: state.day, visits: state.visits, intel: state.intel };
    const name = `AXIS_DB_SNAPSHOT_${$("date").value || todayISO()}.json`;
    const data = JSON.stringify(blob, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = name;
    a.click();
  } catch(e){
    alert(e.message || String(e));
  }
};

window.signIn = async ()=>{
  try{
    const email = ($("authEmail").value || "").trim();
    const password = ($("authPass").value || "").trim();
    if (!email || !password) throw new Error("Email and password required.");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    state.user = data.user;
    $("authCard").classList.add("hidden");
    $("modeRun").classList.remove("hidden");
    setMode("run");
    setPills();
    await refreshFromDB();
  } catch(e){
    alert(e.message || String(e));
  }
};

window.signOut = async ()=>{
  await supabase.auth.signOut();
  state = { user:null, day:null, activeVisit:null, visits:[], intel:[] };
  $("authCard").classList.remove("hidden");
  $("modeRun").classList.add("hidden");
  $("modeIntel").classList.add("hidden");
  setPills();
};

async function init(){
  renderStores();
  $("date").value = todayISO();
  $("host").textContent = window.location.host || "unknown";

  const { data } = await supabase.auth.getUser();
  state.user = data.user || null;
  setPills();

  if (state.user){
    $("authCard").classList.add("hidden");
    $("modeRun").classList.remove("hidden");
    setMode("run");
    await refreshFromDB();
  } else {
    $("authCard").classList.remove("hidden");
    setMode("run");
  }
}

init();
