// axis-blue-web/app.js
import { supabase } from "./supabaseClient.js";

/**
 * AXIS BLUE – App Test (static UI + Supabase)
 * This file focuses on:
 * - Auth (sign-in/sign-out)
 * - Begin Day (axis_days)
 * - Start Visit (axis_visits)
 * - UI feedback (status + toast)
 *
 * NOTE: Your Supabase tables must exist:
 * - public.axis_days (id uuid PK, user_id uuid, day_date date/text, merchandiser_name text, created_at timestamptz default now())
 * - public.axis_visits (id uuid PK, user_id uuid, day_id uuid, store_name text, started_at timestamptz default now())
 */

// --------------------
// Tiny DOM helpers
// --------------------
const $ = (sel) => document.querySelector(sel);

function setStatus(msg, type = "info") {
  const el = $("#status");
  if (!el) return;
  el.textContent = msg;
  el.dataset.type = type;
}

function toast(msg, type = "info", ms = 2200) {
  let wrap = $("#toast");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast";
    wrap.style.position = "fixed";
    wrap.style.left = "50%";
    wrap.style.bottom = "22px";
    wrap.style.transform = "translateX(-50%)";
    wrap.style.padding = "10px 14px";
    wrap.style.borderRadius = "10px";
    wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    wrap.style.fontSize = "14px";
    wrap.style.zIndex = "9999";
    wrap.style.border = "1px solid rgba(255,255,255,0.14)";
    wrap.style.backdropFilter = "blur(10px)";
    wrap.style.display = "none";
    document.body.appendChild(wrap);
  }

  wrap.style.display = "block";
  wrap.style.opacity = "1";
  wrap.style.background = type === "error" ? "rgba(140, 30, 30, 0.65)"
    : type === "success" ? "rgba(20, 110, 55, 0.65)"
    : "rgba(20, 35, 65, 0.65)";
  wrap.textContent = msg;

  window.clearTimeout(wrap._t);
  wrap._t = window.setTimeout(() => {
    wrap.style.opacity = "0";
    window.setTimeout(() => (wrap.style.display = "none"), 250);
  }, ms);
}

// --------------------
// App state
// --------------------
const state = {
  user: null,
  day: null,      // { id, day_date, merchandiser_name }
  visit: null,    // { id, store_name }
};

const stores = [
  "Walmart 1492",
  "King Soopers 00014",
  "Family Dollar 3477",
  "Target SC 1471",
];

// --------------------
// Auth
// --------------------
async function refreshUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    state.user = null;
    return null;
  }
  state.user = data?.user ?? null;
  return state.user;
}

function requireUser() {
  if (!state.user) {
    toast("Please sign in first.", "error");
    throw new Error("Not signed in");
  }
  return state.user;
}

async function signIn(email, password) {
  setStatus("Signing in…");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setStatus("Sign-in failed.", "error");
    toast(error.message || "Sign-in failed.", "error");
    return;
  }
  await refreshUser();
  setStatus("Signed in.", "success");
  toast("Signed in ✓", "success");
  render();
  return data;
}

async function signOut() {
  setStatus("Signing out…");
  const { error } = await supabase.auth.signOut();
  if (error) {
    setStatus("Sign-out failed.", "error");
    toast(error.message || "Sign-out failed.", "error");
    return;
  }
  state.user = null;
  state.day = null;
  state.visit = null;
  setStatus("Signed out.", "info");
  toast("Signed out.", "info");
  render();
}

// --------------------
// Data actions (the real “fix” is adding user_id)
// --------------------
async function beginDay() {
  const user = requireUser();

  const merchName = ($("#merchName")?.value || "").trim();
  if (!merchName) {
    toast("Enter merchandiser name.", "error");
    $("#merchName")?.focus();
    return;
  }

  const dayDate = $("#dayDate")?.value || new Date().toISOString().slice(0, 10);

  setStatus("Creating day record…");

  const row = {
    user_id: user.id,
    day_date: dayDate,
    merchandiser_name: merchName,
  };

  const { data, error } = await supabase
    .from("axis_days")
    .insert([row])
    .select("id, day_date, merchandiser_name")
    .single();

  if (error) {
    setStatus("Begin Day failed.", "error");
    toast(`Begin Day failed: ${error.message}`, "error", 3500);
    return;
  }

  state.day = data;
  state.visit = null;

  setStatus(`Day started (${data.day_date}).`, "success");
  toast("Begin Day ✓", "success");
  render();
}

async function startVisit() {
  const user = requireUser();

  if (!state.day?.id) {
    toast("Begin Day first.", "error");
    return;
  }

  const storeName = $("#storeSelect")?.value || "";
  if (!storeName) {
    toast("Select a store.", "error");
    return;
  }

  setStatus("Starting visit…");

  const row = {
    user_id: user.id,
    day_id: state.day.id,
    store_name: storeName,
    started_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("axis_visits")
    .insert([row])
    .select("id, store_name")
    .single();

  if (error) {
    setStatus("Start Visit failed.", "error");
    toast(`Start Visit failed: ${error.message}`, "error", 3500);
    return;
  }

  state.visit = data;

  setStatus(`Visit started (${data.store_name}).`, "success");
  toast("Start Visit ✓", "success");
  render();
}

// Placeholder buttons so the UI isn’t dead.
function generateEVS() {
  if (!state.visit?.id) return toast("Start a visit first.", "error");
  toast("EVS generation: stub (next step).", "info", 2500);
}
function generatePDR() {
  if (!state.visit?.id) return toast("Start a visit first.", "error");
  toast("PDR generation: stub (next step).", "info", 2500);
}

// --------------------
// Render
// --------------------
function render() {
  // Auth status
  const who = $("#who");
  if (who) who.textContent = state.user ? state.user.email : "Not signed in";

  // Buttons availability
  const signedIn = !!state.user;
  const hasDay = !!state.day?.id;
  const hasVisit = !!state.visit?.id;

  if ($("#btnSignOut")) $("#btnSignOut").disabled = !signedIn;
  if ($("#btnSignIn")) $("#btnSignIn").disabled = signedIn;

  if ($("#btnBeginDay")) $("#btnBeginDay").disabled = !signedIn;
  if ($("#btnStartVisit")) $("#btnStartVisit").disabled = !signedIn || !hasDay;

  if ($("#btnEVS")) $("#btnEVS").disabled = !signedIn || !hasVisit;
  if ($("#btnPDR")) $("#btnPDR").disabled = !signedIn || !hasVisit;

  // Day + visit text
  const dayEl = $("#dayInfo");
  if (dayEl) dayEl.textContent = hasDay ? `${state.day.day_date} • ${state.day.merchandiser_name}` : "No day active";

  const visitEl = $("#visitInfo");
  if (visitEl) visitEl.textContent = hasVisit ? state.visit.store_name : "No visit active";
}

// --------------------
// Boot
// --------------------
function ensureStoreOptions() {
  const sel = $("#storeSelect");
  if (!sel) return;
  if (sel.options.length > 0) return;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select store…";
  sel.appendChild(placeholder);

  for (const s of stores) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
}

function wireUI() {
  ensureStoreOptions();

  $("#btnSignIn")?.addEventListener("click", async () => {
    const email = ($("#email")?.value || "").trim();
    const password = ($("#password")?.value || "").trim();
    if (!email || !password) return toast("Enter email + password.", "error");
    await signIn(email, password);
  });

  $("#btnSignOut")?.addEventListener("click", signOut);
  $("#btnBeginDay")?.addEventListener("click", beginDay);
  $("#btnStartVisit")?.addEventListener("click", startVisit);

  $("#btnEVS")?.addEventListener("click", generateEVS);
  $("#btnPDR")?.addEventListener("click", generatePDR);
}

async function main() {
  wireUI();

  // If a session exists, load user on refresh
  await refreshUser();

  // Keep UI synced to auth changes
  supabase.auth.onAuthStateChange(async () => {
    await refreshUser();
    render();
  });

  // Default date input (nice UX)
  const dayDate = $("#dayDate");
  if (dayDate && !dayDate.value) dayDate.value = new Date().toISOString().slice(0, 10);

  render();
  setStatus("Ready.", "info");
}

main().catch((e) => {
  console.error(e);
  setStatus("App boot error.", "error");
  toast(`Boot error: ${e.message}`, "error", 4000);
});