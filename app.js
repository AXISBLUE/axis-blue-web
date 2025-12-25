/* AXIS BLUE — Phase 1 (No-backend operational) */

const AXIS_KEY = "axisblue_session_v2";

const STORES = [
  { id: "WM1492", name: "Walmart 1492", address: "14000 E Exposition Ave Aurora CO 80012", delivery: "usually yes" },
  { id: "KS00014", name: "King Soopers 00014", address: "655 Peoria St Aurora CO 80011", delivery: "usually no" },
  { id: "FD3477", name: "Family Dollar 3477", address: "620 Peoria St Aurora CO 80011", delivery: "usually no" },
  { id: "TGT1471", name: "Target SC 1471", address: "14200 E Ellsworth Ave Aurora CO 80012", delivery: "usually no" }
];

function $(id) { return document.getElementById(id); }

function nowISO() { return new Date().toISOString(); }

function download(name, data, mime = "text/plain") {
  const blob = new Blob([data], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function loadSession() {
  return JSON.parse(localStorage.getItem(AXIS_KEY) || "{}");
}

function saveSession(s) {
  localStorage.setItem(AXIS_KEY, JSON.stringify(s));
  renderAll();
}

function ensureSession() {
  let s = loadSession();
  if (!s.created) {
    s = { created: nowISO(), merchandiser: "", date: "", visits: [], activeVisitId: null };
    saveSession(s);
  }
  return s;
}

function storeById(id) {
  return STORES.find(x => x.id === id);
}

function renderStores() {
  const el = $("store");
  el.innerHTML = "";
  STORES.forEach(s => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    el.appendChild(o);
  });
}

function hydrateHeaderInputs() {
  const s = ensureSession();
  $("merchandiser").value = s.merchandiser || "";
  $("date").value = s.date || new Date().toISOString().slice(0,10);
}

function validateHeader(s) {
  if (!s.merchandiser?.trim()) return "Merchandiser name is required.";
  if (!s.date?.trim()) return "Date is required.";
  return null;
}

/* Actions */
window.saveHeaderOnly = () => {
  const s = ensureSession();
  s.merchandiser = $("merchandiser").value.trim();
  s.date = $("date").value;
  saveSession(s);
};

window.beginRoute = () => {
  const s = ensureSession();
  s.merchandiser = $("merchandiser").value.trim();
  s.date = $("date").value;
  const err = validateHeader(s);
  if (err) return alert(err);
  saveSession(s);
  alert("Route started");
};

window.startVisit = () => {
  const s = ensureSession();
  s.merchandiser = $("merchandiser").value.trim();
  s.date = $("date").value;
  const err = validateHeader(s);
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

  s.visits.push(visit);
  s.activeVisitId = visit.id;
  saveSession(s);
  alert("Visit started: " + visit.storeName);
};

window.endVisit = () => {
  const s = ensureSession();
  if (!s.activeVisitId) return alert("No active visit to end.");

  const v = s.visits.find(x => x.id === s.activeVisitId);
  if (!v) {
    s.activeVisitId = null;
    saveSession(s);
    return alert("Active visit missing. Session repaired.");
  }

  // update fields from form on end (so you can fill during visit)
  v.urgent = $("urgentFlag").value === "yes";
  v.salesOpp = $("salesOpp").value.trim();
  v.inventoryConcerns = $("inventoryConcerns").value.trim();
  v.repQuestions = $("repQuestions").value.trim();

  v.ended = nowISO();
  s.activeVisitId = null;
  saveSession(s);

  alert("Visit ended: " + v.storeName);
};

window.clearVisitForm = () => {
  $("urgentFlag").value = "no";
  $("salesOpp").value = "";
  $("inventoryConcerns").value = "";
  $("repQuestions").value = "";
};

window.resetAll = () => {
  if (!confirm("Reset local session? This clears visits from this browser.")) return;
  localStorage.removeItem(AXIS_KEY);
  ensureSession();
  hydrateHeaderInputs();
  renderAll();
};

/* Exports */
function evsTextFromVisit(s, v) {
  const lines = [];
  lines.push("AXIS FIELD EXECUTION REPORT");
  lines.push("STORE VISIT SUMMARY");
  lines.push("");
  lines.push(`Merchandiser: ${s.merchandiser}`);
  lines.push(`Date: ${s.date}`);
  lines.push(`Store: ${v.storeName} (${v.storeId})`);
  if (v.address) lines.push(`Address: ${v.address}`);
  if (v.delivery) lines.push(`Delivery pattern: ${v.delivery}`);
  lines.push(`Start: ${v.started}`);
  lines.push(`End: ${v.ended || "(in progress)"}`);
  lines.push("");

  if (v.urgent) {
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

  return lines.join("\n");
}

window.downloadEVSForLast = () => {
  const s = ensureSession();
  if (!s.visits.length) return alert("No visits yet.");
  const v = s.visits[s.visits.length - 1];
  const txt = evsTextFromVisit(s, v);
  const safeStore = (v.storeName || "store").replace(/[^a-z0-9]+/gi, "_");
  download(`EVS_${safeStore}_${s.date}.txt`, txt, "text/plain");
};

window.downloadEOD = () => {
  const s = ensureSession();
  const err = validateHeader(s);
  if (err) return alert(err);

  const lines = [];
  lines.push("AXIS FIELD EXECUTION REPORT");
  lines.push("END OF DAY SUMMARY");
  lines.push("");
  lines.push(`Merchandiser: ${s.merchandiser}`);
  lines.push(`Date: ${s.date}`);
  lines.push("");

  if (!s.visits.length) {
    lines.push("(No visits logged.)");
    return download(`EOD_${s.date}.txt`, lines.join("\n"), "text/plain");
  }

  // Per your preference: only concerns (sales opportunities, inventory, other comments)
  s.visits.forEach((v, idx) => {
    lines.push(`STOP ${idx + 1}: ${v.storeName} (${v.storeId})`);
    if (v.urgent) lines.push("!! URGENT FLAGGED ISSUE !!");

    if (v.salesOpp?.trim()) {
      lines.push("Sales opportunities:");
      lines.push(v.salesOpp.trim());
    }

    if (v.inventoryConcerns?.trim()) {
      lines.push("Inventory concerns / SKUs:");
      lines.push(v.inventoryConcerns.trim());
    }

    if (v.repQuestions?.trim()) {
      lines.push("Other comments / questions for PSR/MSR:");
      lines.push(v.repQuestions.trim());
    }

    if (!v.salesOpp?.trim() && !v.inventoryConcerns?.trim() && !v.repQuestions?.trim() && !v.urgent) {
      lines.push("(No concerns noted.)");
    }

    lines.push("");
  });

  download(`EOD_${s.date}.txt`, lines.join("\n"), "text/plain");
};

window.downloadJSON = () => {
  const s = ensureSession();
  download(`AXIS_SESSION_${s.date || "no-date"}.json`, JSON.stringify(s, null, 2), "application/json");
};

/* Rendering */
function renderStates() {
  const s = ensureSession();

  $("host").textContent = window.location.host || "unknown";
  $("sessionState").textContent = s.created ? "active" : "none";

  if (s.activeVisitId) {
    const v = s.visits.find(x => x.id === s.activeVisitId);
    $("activeVisitState").textContent = v ? `${v.storeId}` : "unknown";
  } else {
    $("activeVisitState").textContent = "none";
  }
}

function renderLog() {
  const s = ensureSession();
  const el = $("liveLog");
  el.innerHTML = "";

  if (!s.visits.length) {
    el.innerHTML = `<div class="pill">No visits yet. Start one above.</div>`;
    return;
  }

  s.visits.slice().reverse().forEach(v => {
    const ended = v.ended ? `<span class="ok">ENDED</span>` : `<span class="warn">IN PROGRESS</span>`;
    const urgent = v.urgent ? ` · <span class="warn">URGENT</span>` : "";
    const html = `
      <div class="visit">
        <h3>${v.storeName}</h3>
        <div class="meta mono">${ended}${urgent}</div>
        <div class="kv">
          <b>Start</b><div class="mono">${v.started}</div>
          <b>End</b><div class="mono">${v.ended || "(in progress)"}</div>
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

function snippet(t) {
  if (!t) return "(none)";
  const s = t.trim();
  if (!s) return "(none)";
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}

function escapeHTML(str) {
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function renderAll() {
  renderStates();
  renderLog();
}

document.addEventListener("DOMContentLoaded", () => {
  renderStores();
  ensureSession();
  hydrateHeaderInputs();
  renderAll();
});
