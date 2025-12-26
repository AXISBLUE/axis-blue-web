/* AXIS BLUE — Web Online (Test) — app.js
   Cloudflare Pages + Functions + Supabase Auth
*/
let supabaseClient = null;

const $ = (id) => document.getElementById(id);

function toast(msg, kind = "info") {
  const el = $("toast");
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function setStatus(text) {
  $("status").textContent = text;
}

function setSignedInUI(user) {
  const signedIn = !!user;
  $("who").textContent = signedIn ? user.email : "Not signed in";
  $("btnSignIn").disabled = signedIn;
  $("btnSignOut").disabled = !signedIn;
  $("btnBeginDay").disabled = !signedIn;
  $("merchName").disabled = !signedIn;
  $("dayDate").disabled = !signedIn;
}

async function getConfig() {
  // Prefer secure mode (just presence), but we need actual values to init Supabase.
  // So we call debug=1 from same-origin Functions, not hardcoded into git.
  const r = await fetch("/env?debug=1", { cache: "no-store" });
  if (!r.ok) throw new Error(`Env endpoint failed: ${r.status}`);
  const j = await r.json();
  if (!j.supabaseUrl || !j.supabaseAnonKey) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY at runtime.");
  return j;
}

async function init() {
  setStatus("Initializing…");

  // quick sanity: Functions responding?
  const h = await fetch("/health", { cache: "no-store" });
  if (!h.ok) throw new Error(`/health failed (${h.status}). Pages Functions not deploying.`);
  
  const cfg = await getConfig();

  if (!window.supabase) throw new Error("Supabase JS not loaded.");

  supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  // restore session
  const { data: { user } } = await supabaseClient.auth.getUser();
  setSignedInUI(user);

  setStatus("Ready.");
}

async function signIn() {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    toast("Enter email + password.", "warn");
    return;
  }

  $("btnSignIn").disabled = true;
  setStatus("Signing in…");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSignedInUI(data.user);
    toast("Signed in.", "ok");
    setStatus("Ready.");
  } catch (e) {
    // This is where your “Network error” should become a real message.
    console.error(e);
    toast(e?.message || "Sign-in failed.", "err");
    setStatus("Auth error.");
  } finally {
    $("btnSignIn").disabled = false;
  }
}

async function signOut() {
  $("btnSignOut").disabled = true;
  setStatus("Signing out…");
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    setSignedInUI(null);
    toast("Signed out.", "ok");
    setStatus("Ready.");
  } catch (e) {
    console.error(e);
    toast(e?.message || "Sign-out failed.", "err");
    setStatus("Auth error.");
  } finally {
    $("btnSignOut").disabled = false;
  }
}

async function beginDay() {
  const merchName = $("merchName").value.trim();
  const dayDate = $("dayDate").value;

  if (!merchName || !dayDate) {
    toast("Merchandiser name + date required.", "warn");
    return;
  }

  setStatus("Creating Day…");
  $("btnBeginDay").disabled = true;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not signed in.");

    const row = {
      user_id: user.id,
      user_email: user.email,
      merch_name: merchName,
      day_date: dayDate,
      status: "active",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from("axis_days")
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    $("activeDay").textContent = `${data.day_date} • ${data.merch_name}`;
    toast("Day started.", "ok");
    setStatus("Ready.");
  } catch (e) {
    console.error(e);
    toast(e?.message || "Begin Day failed.", "err");
    setStatus("DB error.");
  } finally {
    $("btnBeginDay").disabled = false;
  }
}

window.addEventListener("load", async () => {
  $("btnSignIn").addEventListener("click", signIn);
  $("btnSignOut").addEventListener("click", signOut);
  $("btnBeginDay").addEventListener("click", beginDay);

  // defaults
  const today = new Date();
  $("dayDate").value = today.toISOString().slice(0, 10);
  $("merchName").value = $("merchName").value || "Gabriel Kearns";

  try {
    await init();
  } catch (e) {
    console.error(e);
    toast(e?.message || "Init failed.", "err");
    setStatus("Init failed.");
  }
});
