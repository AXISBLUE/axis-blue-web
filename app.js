/* AXIS BLUE — Web Online (Test)
   app.js — wires Supabase auth + Day + Visit + Notes
*/

let supabase = null;

const $ = (id) => document.getElementById(id);

const toast = (msg) => {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (el.style.display = "none"), 2600);
};

const state = {
  user: null,
  activeDay: null,
  activeVisit: null,
};

// ----------------------------
// Supabase init (from /env)
// ----------------------------
async function initSupabase() {
  const r = await fetch("/env", { cache: "no-store" });
  if (!r.ok) throw new Error(`/env failed (${r.status})`);

  const cfg = await r.json();

  // MUST be returned by your Pages Function (/functions/env.js)
  // shape:
  // { supabaseUrl: "...", supabaseAnonKey: "..." }
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("Supabase config missing from /env. Need supabaseUrl + supabaseAnonKey.");
  }

  supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

function uiLockAll() {
  $("btnSignOut").disabled = true;
  $("btnBeginDay").disabled = true;
  $("btnLoadActiveDay").disabled = true;

  $("storeSelect").disabled = true;
  $("btnStartVisit").disabled = true;
  $("visitNotes").disabled = true;
  $("btnSaveNotes").disabled = true;

  $("btnGenerateEVS").disabled = true;
  $("btnGeneratePDR").disabled = true;
}

function uiSignedIn() {
  $("btnSignOut").disabled = false;
  $("btnBeginDay").disabled = false;
  $("btnLoadActiveDay").disabled = false;
}

function uiDayActive() {
  $("storeSelect").disabled = false;
  $("btnStartVisit").disabled = false;
}

function uiVisitActive() {
  $("visitNotes").disabled = false;
  $("btnSaveNotes").disabled = false;
}

async function refreshUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  state.user = data.user || null;
  $("who").textContent = state.user ? state.user.email : "Not signed in";
  return state.user;
}

// ----------------------------
// Auth
// ----------------------------
async function signIn() {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) return toast("Enter email + password.");

  $("btnSignIn").disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    await refreshUser();
    uiSignedIn();
    toast(`Signed in as ${state.user.email}`);

    // Autoload any active day
    await loadActiveDay();
  } catch (e) {
    console.error(e);
    toast(`Sign-in failed: ${e.message}`);
  } finally {
    $("btnSignIn").disabled = false;
  }
}

async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error(e);
  }

  state.user = null;
  state.activeDay = null;
  state.activeVisit = null;

  $("activeDayText").textContent = "None";
  $("activeVisitText").textContent = "None";
  $("visitNotes").value = "";

  uiLockAll();
  $("who").textContent = "Not signed in";
  toast("Signed out.");
}

// ----------------------------
// Day
// ----------------------------
async function beginDay() {
  if (!state.user) return toast("Sign in first.");

  const merchName = ($("merchName").value || "").trim() || "Merchandiser";
  const dayDate = $("dayDate").value || new Date().toISOString().slice(0, 10);

  try {
    // close any other active days for this user (simple guard)
    await supabase
      .from("axis_days")
      .update({ status: "closed" })
      .eq("user_id", state.user.id)
      .eq("status", "active");

    const payload = {
      user_id: state.user.id,
      user_email: state.user.email,
      merch_name: merchName,
      day_date: dayDate,
      status: "active",
    };

    const { data, error } = await supabase
      .from("axis_days")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    state.activeDay = data;
    $("activeDayText").textContent = `${data.day_date} (${data.id.slice(0, 8)}…)`;
    toast("Day started.");
    uiDayActive();

    // clear any stale visit
    state.activeVisit = null;
    $("activeVisitText").textContent = "None";
    $("visitNotes").value = "";
    $("visitNotes").disabled = true;
    $("btnSaveNotes").disabled = true;
  } catch (e) {
    console.error(e);
    toast(`Begin Day failed: ${e.message}`);
  }
}

async function loadActiveDay() {
  if (!state.user) return;

  try {
    const { data, error } = await supabase
      .from("axis_days")
      .select("*")
      .eq("user_id", state.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      state.activeDay = null;
      $("activeDayText").textContent = "None";
      return toast("No active day found.");
    }

    state.activeDay = data[0];
    $("activeDayText").textContent = `${state.activeDay.day_date} (${state.activeDay.id.slice(0, 8)}…)`;
    uiDayActive();
    toast("Active day loaded.");
  } catch (e) {
    console.error(e);
    toast(`Load Active Day failed: ${e.message}`);
  }
}

// ----------------------------
// Visit + Notes
// ----------------------------
async function startVisit() {
  if (!state.user) return toast("Sign in first.");
  if (!state.activeDay) return toast("Start or load a Day first.");

  const storeName = $("storeSelect").value;
  if (!storeName) return toast("Pick a store.");

  try {
    const payload = {
      user_id: state.user.id,
      day_id: state.activeDay.id,
      store_name: storeName,
      notes: "",
    };

    const { data, error } = await supabase
      .from("axis_visits")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    state.activeVisit = data;
    $("activeVisitText").textContent = `${data.store_name} (${data.id.slice(0, 8)}…)`;
    $("visitNotes").value = "";
    uiVisitActive();
    toast("Visit started.");
  } catch (e) {
    console.error(e);
    toast(`Start Visit failed: ${e.message}`);
  }
}

async function saveNotes() {
  if (!state.activeVisit) return toast("Start a visit first.");

  const notes = $("visitNotes").value;

  try {
    const { error } = await supabase
      .from("axis_visits")
      .update({ notes })
      .eq("id", state.activeVisit.id);

    if (error) throw error;
    toast("Notes saved.");
  } catch (e) {
    console.error(e);
    toast(`Save notes failed: ${e.message}`);
  }
}

// ----------------------------
// Boot
// ----------------------------
async function boot() {
  uiLockAll();

  // sensible defaults
  if ($("dayDate")) $("dayDate").value = new Date().toISOString().slice(0, 10);
  if ($("merchName") && !$("merchName").value) $("merchName").value = "Gabriel Kearns";

  // wire buttons
  $("btnSignIn").addEventListener("click", signIn);
  $("btnSignOut").addEventListener("click", signOut);
  $("btnBeginDay").addEventListener("click", beginDay);
  $("btnLoadActiveDay").addEventListener("click", loadActiveDay);
  $("btnStartVisit").addEventListener("click", startVisit);
  $("btnSaveNotes").addEventListener("click", saveNotes);

  await initSupabase();

  // restore session if present
  await refreshUser();
  if (state.user) {
    uiSignedIn();
    toast(`Signed in as ${state.user.email}`);
    await loadActiveDay();
  } else {
    toast("Ready. Sign in to begin.");
  }
}

boot().catch((e) => {
  console.error(e);
  toast(`Init failed: ${e.message}`);
});
