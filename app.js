let ENV = null;

// UI helpers
const $ = (id) => document.getElementById(id);
const setMsg = (id, text, kind) => {
  const el = $(id);
  el.textContent = text || "";
  el.classList.remove("ok","err");
  if (kind) el.classList.add(kind);
};

function setLocked(locked) {
  const card = $("appCard");
  if (locked) {
    card.classList.remove("unlocked");
    card.classList.add("locked");
    card.setAttribute("aria-hidden", "true");
    $("appMeta").textContent = "Locked until sign-in succeeds.";
  } else {
    card.classList.add("unlocked");
    card.classList.remove("locked");
    card.setAttribute("aria-hidden", "false");
    $("appMeta").textContent = "Unlocked. Run your day.";
  }
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tabPane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.tab).classList.add("active");

      // when opening Capture tab, attempt auto-scan
      if (btn.dataset.tab === "tabCapture") {
        tryAutoStartScan();
      }
    });
  });
}

// App state
let activeDayId = null;
let activeVisitId = null;
let oosItems = [];
let captures = [];

function setActiveDay(id) {
  activeDayId = id;
  $("activeDayId").textContent = id || "None";
}
function setActiveVisit(id) {
  activeVisitId = id;
  $("activeVisitId").textContent = id || "None";
  $("visitStatus").textContent = id ? "Active" : "No active visit";
}

function parseStoreValue(v) {
  // "WM1492|Walmart 1492|address"
  const [code, name, address] = (v || "").split("|");
  return { code, name, address };
}

// Camera scan
let scanStream = null;
let scanLoopRunning = false;
let detector = null;

function showScanMeta(t) { $("scanMeta").textContent = t; }

async function stopScan() {
  scanLoopRunning = false;
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
  $("scanVideo").srcObject = null;
  showScanMeta("Stopped");
}

async function startScan() {
  if (!window.isSecureContext) {
    showScanMeta("Camera requires HTTPS.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showScanMeta("Camera not supported here.");
    return;
  }

  // BarcodeDetector support varies; we’ll use it when available
  if (!("BarcodeDetector" in window)) {
    showScanMeta("BarcodeDetector not supported on this browser. Use manual entry or file upload fallback.");
    return;
  }

  detector = new BarcodeDetector({
    formats: ["qr_code","ean_13","ean_8","upc_a","upc_e","code_128"]
  });

  scanStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });

  const video = $("scanVideo");
  video.srcObject = scanStream;
  await video.play();

  scanLoopRunning = true;
  showScanMeta("Scanning… (QR + barcode)");

  const tick = async () => {
    if (!scanLoopRunning) return;
    try {
      const codes = await detector.detect(video);
      if (codes?.length) {
        const val = codes[0].rawValue || "";
        $("capDetected").value = val;
        // also help OOS field while user is on Visit tab
        // (non-invasive: only fill if empty)
        if (!$("oosItem").value) $("oosItem").value = val;
      }
    } catch (e) {
      // ignore detection glitches
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function tryAutoStartScan() {
  // Attempt autostart. If blocked by permissions, user can press Enable button.
  try {
    if (scanStream) return;
    await startScan();
  } catch (e) {
    showScanMeta("Tap “Enable Camera Scan” to grant permission.");
  }
}

// Data ops (Supabase)
async function requireSupabase() {
  if (!window.supabase || !window.supabase.createClient) throw new Error("supabase-js not loaded");
  if (!window.supabaseClientReady) throw new Error("supabase client not ready");
}

async function upsertDay({ merch_name, day_date }) {
  await requireSupabase();
  const user = (await supabase.auth.getUser()).data.user;
  const payload = {
    user_id: user.id,
    merch_name,
    day_date,
    status: "ACTIVE",
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from("days")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function loadActiveDay() {
  await requireSupabase();
  const user = (await supabase.auth.getUser()).data.user;
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function startVisit({ store_code, store_name, store_address, note }) {
  await requireSupabase();
  if (!activeDayId) throw new Error("No active day. Start Day first.");
  const user = (await supabase.auth.getUser()).data.user;
  const payload = {
    user_id: user.id,
    day_id: activeDayId,
    store_code, store_name, store_address,
    note: note || null,
    status: "ACTIVE"
  };
  const { data, error } = await supabase
    .from("visits")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function endVisit() {
  await requireSupabase();
  if (!activeVisitId) throw new Error("No active visit.");
  const { error } = await supabase
    .from("visits")
    .update({ status: "ENDED", ended_at: new Date().toISOString() })
    .eq("id", activeVisitId);
  if (error) throw error;
}

async function addIssue({ type, item, qty, note }) {
  await requireSupabase();
  if (!activeVisitId) throw new Error("Start a visit first.");
  const user = (await supabase.auth.getUser()).data.user;
  const payload = {
    user_id: user.id,
    day_id: activeDayId,
    visit_id: activeVisitId,
    type, item, qty: qty ?? null, note: note ?? null
  };
  const { data, error } = await supabase
    .from("issues")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function saveCaptureRecord({ category, label, detected_code, nfc_payload, photo_data_url }) {
  await requireSupabase();
  if (!activeVisitId) throw new Error("Start a visit first.");
  const user = (await supabase.auth.getUser()).data.user;

  const payload = {
    user_id: user.id,
    day_id: activeDayId,
    visit_id: activeVisitId,
    category, label,
    detected_code: detected_code || null,
    nfc_payload: nfc_payload || null,
    photo_data_url
  };

  const { data, error } = await supabase
    .from("captures")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function renderOOS() {
  const wrap = $("oosList");
  wrap.innerHTML = "";
  oosItems.forEach((x) => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = `${x.type} • ${x.item} • qty=${x.qty ?? "n/a"} • ${x.note ?? ""}`;
    wrap.appendChild(div);
  });
}

function renderCaptures() {
  const wrap = $("capList");
  wrap.innerHTML = "";
  captures.slice().reverse().forEach((x) => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = `${x.category} • ${x.label ?? ""} • code=${x.detected_code ?? ""} • nfc=${x.nfc_payload ?? ""}`;
    wrap.appendChild(div);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Boot
(async function main() {
  // date default
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  $("dayDate").value = `${yyyy}-${mm}-${dd}`;

  wireTabs();
  setLocked(true);

  // Init env + supabase
  try {
    ENV = await initSupabase();
    window.supabaseClientReady = true;
    $("envStatus").textContent = "env: ready";
  } catch (e) {
    $("envStatus").textContent = "env: FAILED";
    setMsg("authMsg", String(e.message || e), "err");
    return;
  }

  // NFC shortcut param support: ?nfc=PAYLOAD
  const params = new URLSearchParams(location.search);
  const nfc = params.get("nfc");
  if (nfc) $("capNfc").value = nfc;

  // Auth wiring
  $("btnSignIn").addEventListener("click", async () => {
    setMsg("authMsg", "Signing in…");
    try {
      const email = $("authEmail").value.trim();
      const password = $("authPassword").value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const u = (await supabase.auth.getUser()).data.user;
      $("authMeta").textContent = `Signed in as ${u.email}`;
      setMsg("authMsg", "Signed in.", "ok");
      setLocked(false);

      // After auth, try to load active day (non-blocking)
      const day = await loadActiveDay();
      if (day) setActiveDay(day.id);

    } catch (e) {
      setLocked(true);
      $("authMeta").textContent = "Signed out";
      setMsg("authMsg", String(e.message || e), "err");
    }
  });

  $("btnSignOut").addEventListener("click", async () => {
    setMsg("authMsg", "Signing out…");
    try {
      await supabase.auth.signOut();
      setLocked(true);
      $("authMeta").textContent = "Signed out";
      setMsg("authMsg", "Signed out.", "ok");
      setActiveDay(null);
      setActiveVisit(null);
      await stopScan();
    } catch (e) {
      setMsg("authMsg", String(e.message || e), "err");
    }
  });

  // Day
  $("btnBeginDay").addEventListener("click", async () => {
    setMsg("dayMsg", "Creating day…");
    try {
      const merch_name = $("dayMerchName").value.trim() || "Merchandiser";
      const day_date = $("dayDate").value;
      const d = await upsertDay({ merch_name, day_date });
      setActiveDay(d.id);
      setMsg("dayMsg", "Day created + active.", "ok");
    } catch (e) {
      setMsg("dayMsg", String(e.message || e), "err");
    }
  });

  $("btnLoadDay").addEventListener("click", async () => {
    setMsg("dayMsg", "Loading active day…");
    try {
      const d = await loadActiveDay();
      if (!d) { setMsg("dayMsg", "No active day found.", "err"); return; }
      setActiveDay(d.id);
      setMsg("dayMsg", "Loaded active day.", "ok");
    } catch (e) {
      setMsg("dayMsg", String(e.message || e), "err");
    }
  });

  // Visit
  $("btnStartVisit").addEventListener("click", async () => {
    setMsg("visitMsg", "Starting visit…");
    try {
      const v = $("visitStore").value;
      if (!v) throw new Error("Pick a store.");
      const { code, name, address } = parseStoreValue(v);
      const note = $("visitNote").value.trim();
      const row = await startVisit({ store_code: code, store_name: name, store_address: address, note });
      setActiveVisit(row.id);
      setMsg("visitMsg", "Visit started.", "ok");
    } catch (e) {
      setMsg("visitMsg", String(e.message || e), "err");
    }
  });

  $("btnEndVisit").addEventListener("click", async () => {
    setMsg("visitMsg", "Ending visit…");
    try {
      await endVisit();
      setActiveVisit(null);
      setMsg("visitMsg", "Visit ended.", "ok");
    } catch (e) {
      setMsg("visitMsg", String(e.message || e), "err");
    }
  });

  // Issues (OOS/BREAKAGE/OOD)
  $("btnAddOOS").addEventListener("click", async () => {
    setMsg("oosMsg", "Saving…");
    try {
      const type = $("oosType").value;
      const item = $("oosItem").value.trim();
      const qty = $("oosQty").value ? Number($("oosQty").value) : null;
      const note = $("oosNote").value.trim() || null;
      if (!item) throw new Error("Item is required.");
      const row = await addIssue({ type, item, qty, note });
      oosItems.push(row);
      renderOOS();
      $("oosItem").value = "";
      $("oosQty").value = "";
      $("oosNote").value = "";
      setMsg("oosMsg", "Saved.", "ok");
    } catch (e) {
      setMsg("oosMsg", String(e.message || e), "err");
    }
  });

  // Capture
  $("btnEnableCamera").addEventListener("click", async () => {
    try { await startScan(); } catch (e) { showScanMeta(String(e.message || e)); }
  });
  $("btnStopCamera").addEventListener("click", stopScan);

  $("btnSaveCapture").addEventListener("click", async () => {
    setMsg("capMsg", "Saving capture…");
    try {
      const file = $("capFile").files?.[0];
      if (!file) throw new Error("Photo is required.");
      const photo_data_url = await fileToDataUrl(file);

      const category = $("capCategory").value;
      const label = $("capLabel").value.trim() || null;
      const detected_code = $("capDetected").value.trim() || null;
      const nfc_payload = $("capNfc").value.trim() || null;

      const row = await saveCaptureRecord({ category, label, detected_code, nfc_payload, photo_data_url });
      captures.push(row);
      renderCaptures();

      $("capFile").value = "";
      $("capLabel").value = "";
      setMsg("capMsg", "Capture saved.", "ok");
    } catch (e) {
      setMsg("capMsg", String(e.message || e), "err");
    }
  });

  // Management output
  $("btnCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("mgmtText").value || "");
      setMsg("mgmtMsg", "Copied.", "ok");
    } catch (e) {
      setMsg("mgmtMsg", "Copy failed on this browser.", "err");
    }
  });

  $("btnEmailDraft").addEventListener("click", () => {
    const subject = encodeURIComponent("AXIS BLUE • Field Summary");
    const body = encodeURIComponent($("mgmtText").value || "");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setMsg("mgmtMsg", "Email draft opened.", "ok");
  });

})();
