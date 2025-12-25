/* AXIS BLUE — Web Online (Test) */

const AXIS_KEY = "axisblue_session_v1";

const STORES = [
  { id: "WM1492", name: "Walmart 1492" },
  { id: "KS00014", name: "King Soopers 00014" },
  { id: "FD3477", name: "Family Dollar 3477" },
  { id: "TGT1471", name: "Target SC 1471" }
];

function $(id) {
  return document.getElementById(id);
}

function loadSession() {
  return JSON.parse(localStorage.getItem(AXIS_KEY) || "{}");
}

function saveSession(s) {
  localStorage.setItem(AXIS_KEY, JSON.stringify(s));
}

function ensureSession() {
  let s = loadSession();
  if (!s.created) {
    s = {
      merchandiser: "",
      date: "",
      visits: [],
      created: new Date().toISOString()
    };
    saveSession(s);
  }
  return s;
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

window.beginRoute = () => {
  const s = ensureSession();
  s.merchandiser = $("merchandiser").value;
  s.date = $("date").value;
  saveSession(s);
  alert("Route started");
};

window.startVisit = () => {
  const s = ensureSession();
  const store = $("store").value;
  s.visits.push({
    store,
    started: new Date().toISOString()
  });
  saveSession(s);
  alert("Visit started: " + store);
};

window.generateEVS = () => {
  const s = ensureSession();
  const data = JSON.stringify(s, null, 2);
  download("EVS.json", data);
};

window.generatePDR = () => {
  const s = ensureSession();
  const data = JSON.stringify(s, null, 2);
  download("PDR.json", data);
};

function download(name, data) {
  const blob = new Blob([data]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

document.addEventListener("DOMContentLoaded", () => {
  renderStores();
});
