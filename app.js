/* AXIS BLUE — Multi-day local storage (Phase 1)
   - Stores data by date ("day records") in localStorage
   - Lets you load prior days
   - Generates EVS/EOD TXT with legal + soft launch banner
   - No backend yet (supabase sync later)
*/

const AXIS_DB_KEY = "axisblue_db_v1";

const STORES = [
  { id: "WM1492", name: "Walmart 1492", address: "14000 E Exposition Ave Aurora CO 80012", delivery: "usually yes" },
  { id: "KS00014", name: "King Soopers 00014", address: "655 Peoria St Aurora CO 80011", delivery: "usually no" },
  { id: "FD3477", name: "Family Dollar 3477", address: "620 Peoria St Aurora CO 80011", delivery: "usually no" },
  { id: "TGT1471", name: "Target SC 1471", address: "14200 E Ellsworth Ave Aurora CO 80012", delivery: "usually no" }
];

function $(id){ return document.getElementById(id); }
function nowISO(){ return new Date().toISOString(); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

function download(name, data, mime="text/plain"){
  const blob = new Blob([data], {type:mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function loadDB(){
  try { return JSON.parse(localStorage.getItem(AXIS_DB_KEY) || "{}"); }
  catch { return {}; }
}

function saveDB(db){
  localStorage.setItem(AXIS_DB_KEY, JSON.stringify(db));
}

function ensureDB(){
  const db = loadDB();
  if (!db.meta) db.meta = { created: nowISO(), version:"v1" };
  if (!db.days) db.days = {};           // key: YYYY-MM-DD -> dayRecord
  if (!db.currentDay) db.currentDay = null;
  saveDB(db);
  return db;
}

function ensureDay(db, date){
  if (!db.days[date]){
    db.days[date] = {
      date,
      merchandiser: "",
      created: nowISO(),
      visits: [],
      activeVisitId: null
    };
  }
  return db.days[date];
}

function storeById(id){ return STORES.find(s => s.id === id); }

function renderStores(){
  const el = $("store");
  el.innerHTML = "";
  STORES.forEach(s=>{
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    el.appendChild(o);
  });
}

function renderDayPicker(){
  const db = ensureDB();
  const el = $("dayPicker");
  const dates = Object.keys(db.days).sort().reverse();

  el.innerHTML = "";
  if (!dates.length){
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "(no saved days yet)";
    el.appendChild(o);
    return;
  }

  dates.forEach(d=>{
    const o = document.createElement("option");
    o.value = d;
    o.textContent = d;
    el.appendChild(o);
  });

  // default picker selection
  if (db.currentDay && dates.includes(db.currentDay)) el.value = db.currentDay;
}

function getCurrent(){
  const db = ensureDB();
  const date = db.currentDay || $("date").value || todayISO();
  const day = ensureDay(db, date);
  return { db, date, day };
}

function setStatusUI(){
  $("host").textContent = window.location.host || "unknown";
  const { db, date, day } = getCurrent();
  $("dayLoaded").textContent = db.currentDay || "(none)";
  if (day.activeVisitId){
    const v = day.visits.find(x => x.id === day.activeVisitId);
    $("activeVisitState").textContent = v ? v.storeId : "unknown";
  } else {
    $("activeVisitState").textContent = "none";
  }
}

function hydrateHeaderFromCurrent(){
  const { db, day } = getCurrent();
  $("date").value = db.currentDay || $("date").value || todayISO();
  $("merchandiser").value = day.merchandiser || "";
}

function validateHeader(day){
  if (!day.merchandiser?.trim()) return "Merchandiser is required.";
  if (!day.date?.trim()) return "Date is required.";
  return null;
}

function escapeHTML(str){
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function snippet(t){
  if (!t) return "(none)";
  const s = t.trim();
  if (!s) return "(none)";
  return s.length > 140 ? s.slice(0,140) + "…" : s;
}

function renderLog(){
  const { day } = getCurrent();
  const el = $("liveLog");
  el.innerHTML = "";

  if (!day.visits.length){
    el.innerHTML = `<div class="pill">No visits yet. Start one above.</div>`;
    return;
  }

  day.visits.slice().reverse().forEach(v=>{
    const ended = v.ended ? `<span class="ok">ENDED</span>` : `<span class="warn">IN PROGRESS</span>`;
    const urgent = v.urgent ? ` · <span class="warn">URGENT</span>` : "";
    const html = `
      <div class="visit">
        <h3>${escapeHTML(v.storeName)}</h3>
        <div class="meta mono">${ended}${urgent}</div>
        <div class="kv">
          <b>Start</b><div class="mono">${escapeHTML(v.started)}</div>
          <b>End</b><div class="mono">${escapeHTML(v.ended || "(in progress)")}</div>
          <b>Sales</b><div>${escapeHTML(snippet(v.salesOpp))}</div>
          <b>Inventory</b><div>${escapeHTML(snippet(v.inventoryConcerns))}</div>
          <b>PSR/MSR</b><div>${escapeHTML(snippet(v.repQuestions))}</div>
        </div>
      </div>
    `;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    el.appendChild(wrap);
  });
}

function renderAll(){
  renderDayPicker();
  setStatusUI();
  renderLog();
}

/* Actions */
window.saveHeaderOnly = () => {
  const { db, date, day } = getCurrent();
  day.date = $("date").value || date;
  day.merchandiser = $("merchandiser").value.trim();
  saveDB(db);
  renderAll();
};

window.beginDay = () => {
  const db = ensureDB();
  const date = $("date").value || todayISO();
  const day = ensureDay(db, date);

  day.date = date;
  day.merchandiser = $("merchandiser").value.trim();

  db.currentDay = date;
  saveDB(db);
  renderAll();

  if (!day.merchandiser) return alert("Begin Day saved. Add merchandiser name when ready.");
  alert(`Day loaded: ${date}`);
};

window.loadSelectedDay = () => {
  const db = ensureDB();
  const date = $("dayPicker").value;
  if (!date) return alert("No saved day selected.");
  ensureDay(db, date);
  db.currentDay = date;
  saveDB(db);

  $("date").value = date;
  hydrateHeaderFromCurrent();
  renderAll();
  alert(`Loaded day: ${date}`);
};

window.startVisit = () => {
  const { db, date, day } = getCurrent();

  // force day to be set
  day.date = db.currentDay || $("date").value || date;
  day.merchandiser = $("merchandiser").value.trim();

  const err = validateHeader(day);
  if (err) return alert(err);

  const storeId = $("store").value;
  const st = storeById(storeId);

  const visit = {
    id: "VISIT_" + Math.random().toString(16).slice(2) + "_" + Date.now(),
    storeId,
    storeName: st?.name || storeId,
    address: st?.address || "",
    delivery: st?.delivery || "",
    started: nowISO(),
    ended: null,
    urgent: $("urgentFlag").value === "yes",
    salesOpp: $("salesOpp").value.trim(),
    inventoryConcerns: $("inventoryConcerns").value.trim(),
    repQuestions: $("repQuestions").value.trim()
  };

  day.visits.push(visit);
  day.activeVisitId = visit.id;

  // lock current day
  db.currentDay = day.date;

  saveDB(db);
  renderAll();
  alert(`Visit started: ${visit.storeName}`);
};

window.endVisit = () => {
  const { db, day } = getCurrent();
  if (!day.activeVisitId) return alert("No active visit to end.");

  const v = day.visits.find(x => x.id === day.activeVisitId);
  if (!v){
    day.activeVisitId = null;
    saveDB(db);
    renderAll();
    return alert("Active visit missing. Session repaired.");
  }

  v.urgent = $("urgentFlag").value === "yes";
  v.salesOpp = $("salesOpp").value.trim();
  v.inventoryConcerns = $("inventoryConcerns").value.trim();
  v.repQuestions = $("repQuestions").value.trim();
  v.ended = nowISO();

  day.activeVisitId = null;

  saveDB(db);
  renderAll();
  alert(`Visit ended: ${v.storeName}`);
};

window.clearVisitForm = () => {
  $("urgentFlag").value = "no";
  $("salesOpp").value = "";
  $("inventoryConcerns").value = "";
  $("repQuestions").value = "";
};

window.resetAll = () => {
  if (!confirm("Reset local data? This clears all saved days on this device/browser.")) return;
  localStorage.removeItem(AXIS_DB_KEY);
  ensureDB();
  $("date").value = todayISO();
  $("merchandiser").value = "";
  renderStores();
  renderAll();
};

/* Exports with Soft Launch + Legal */
function legalBlock(){
  return [
    "LEGAL: Internal operational tooling for field execution support. Do not upload confidential, regulated, or customer-proprietary data.",
    "Logs are stored locally unless explicitly connected to approved storage services.",
    "SOFT PRODUCT LAUNCH: Feature set is operational and evolving. Feedback drives iteration."
  ].join("\n");
}

function evsText(day, v){
  const lines = [];
  lines.push("AXIS FIELD EXECUTION REPORT");
  lines.push("STORE VISIT SUMMARY");
  lines.push("SOFT PRODUCT LAUNCH — OPERATIONAL WORKFLOW (EVOLVING)");
  lines.push("");
  lines.push(`Merchandiser: ${day.merchandiser}`);
  lines.push(`Date: ${day.date}`);
  lines.push(`Store: ${v.storeName} (${v.storeId})`);
  if (v.address) lines.push(`Address: ${v.address}`);
  if (v.delivery) lines.push(`Delivery pattern: ${v.delivery}`);
  lines.push(`Start: ${v.started}`);
  lines.push(`End: ${v.ended || "(in progress)"}`);
  lines.push("");

  if (v.urgent){
    lines.push("URGENT ISSUE FLAG: YES");
    lines.push("");
  }

  lines.push("SALES OPPORTUNITIES");
  lines.push(v.salesOpp ? v.salesOpp : "(none)");
  lines.push("");

  lines.push("INVENTORY CONCERNS / SKUs");
  lines.push(v.inventoryConcerns ? v.inventoryConcerns : "(none)");
  lines.push("");

  lines.push("QUESTIONS / COMMENTS FOR PSR/MSR");
  lines.push(v.repQuestions ? v.repQuestions : "(none)");
  lines.push("");

  lines.push("PHOTOS");
  lines.push("Attached in additional documents to conserve file size.");
  lines.push("");
  lines.push(legalBlock());
  return lines.join("\n");
}

window.downloadEVSForLast = () => {
  const { day } = getCurrent();
  if (!day.visits.length) return alert("No visits yet.");
  const v = day.visits[day.visits.length - 1];
  const txt = evsText(day, v);
  const safeStore = (v.storeName || "store").replace(/[^a-z0-9]+/gi, "_");
  download(`EVS_${safeStore}_${day.date}.txt`, txt, "text/plain");
};

window.downloadEOD = () => {
  const { day } = getCurrent();
  if (!day.date) day.date = $("date").value || todayISO();
  if (!day.merchandiser) day.merchandiser = $("merchandiser").value.trim();
  const err = validateHeader(day);
  if (err) return alert(err);

  const lines = [];
  lines.push("AXIS FIELD EXECUTION REPORT");
  lines.push("END OF DAY SUMMARY");
  lines.push("SOFT PRODUCT LAUNCH — OPERATIONAL WORKFLOW (EVOLVING)");
  lines.push("");
  lines.push(`Merchandiser: ${day.merchandiser}`);
  lines.push(`Date: ${day.date}`);
  lines.push("");

  if (!day.visits.length){
    lines.push("(No visits logged.)");
    lines.push("");
    lines.push(legalBlock());
    return download(`EOD_${day.date}.txt`, lines.join("\n"), "text/plain");
  }

  // only concerns: sales opps, inventory, other comments + urgent
  day.visits.forEach((v, idx)=>{
    lines.push(`STOP ${idx + 1}: ${v.storeName} (${v.storeId})`);
    if (v.urgent) lines.push("!! URGENT FLAGGED ISSUE !!");

    if (v.salesOpp?.trim()){
      lines.push("Sales opportunities:");
      lines.push(v.salesOpp.trim());
    }
    if (v.inventoryConcerns?.trim()){
      lines.push("Inventory concerns / SKUs:");
      lines.push(v.inventoryConcerns.trim());
    }
    if (v.repQuestions?.trim()){
      lines.push("Other comments / questions for PSR/MSR:");
      lines.push(v.repQuestions.trim());
    }

    if (!v.salesOpp?.trim() && !v.inventoryConcerns?.trim() && !v.repQuestions?.trim() && !v.urgent){
      lines.push("(No concerns noted.)");
    }
    lines.push("");
  });

  lines.push(legalBlock());
  download(`EOD_${day.date}.txt`, lines.join("\n"), "text/plain");
};

window.downloadJSON = () => {
  const db = ensureDB();
  download(`AXISBLUE_LOCAL_DB_${todayISO()}.json`, JSON.stringify(db, null, 2), "application/json");
};

/* Boot */
document.addEventListener("DOMContentLoaded", ()=>{
  ensureDB();
  renderStores();

  $("date").value = todayISO();
  $("host").textContent = window.location.host || "unknown";

  // load current day if exists
  const db = ensureDB();
  if (db.currentDay){
    $("date").value = db.currentDay;
  }
  hydrateHeaderFromCurrent();
  renderAll();
});
