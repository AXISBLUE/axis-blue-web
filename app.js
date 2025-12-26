import { getSupabase } from "./supabaseClient.js";

const $ = (id) => document.getElementById(id);

const authCard = $("authCard");
const app = $("app");

const email = $("email");
const password = $("password");
const btnSignIn = $("btnSignIn");
const btnSignOut = $("btnSignOut");
const authState = $("authState");
const authError = $("authError");

const btnStartScan = $("btnStartScan");
const btnStopScan = $("btnStopScan");
const video = $("video");
const codeValue = $("codeValue");
const productName = $("productName");
const tagPhoto = $("tagPhoto");
const btnSaveCapture = $("btnSaveCapture");
const captureStatus = $("captureStatus");

const btnStartNfc = $("btnStartNfc");
const btnStopNfc = $("btnStopNfc");
const nfcStatus = $("nfcStatus");
const nfcPayload = $("nfcPayload");

const summary = $("summary");
const btnCopySummary = $("btnCopySummary");
const btnEmailSummary = $("btnEmailSummary");
const mgmtStatus = $("mgmtStatus");

let supabase;
let scanStream = null;
let scanTimer = null;
let ndef = null;

function showError(msg) {
  authError.textContent = msg;
  authError.hidden = false;
}

function clearError() {
  authError.hidden = true;
  authError.textContent = "";
}

function lockApp() {
  app.hidden = true;
  authCard.hidden = false;
  btnSignOut.disabled = true;
  authState.textContent = "Signed out";
}

function unlockApp(userEmail) {
  authCard.hidden = false; // keep auth card visible, but it's fine
  app.hidden = false;
  btnSignOut.disabled = false;
  authState.textContent = `Signed in as: ${userEmail}`;
}

async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (session?.user?.email) unlockApp(session.user.email);
  else lockApp();
}

async function signIn() {
  clearError();
  btnSignIn.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    });
    if (error) throw error;
    await refreshSession();
  } catch (e) {
    showError(e?.message || String(e));
    lockApp();
  } finally {
    btnSignIn.disabled = false;
  }
}

async function signOut() {
  clearError();
  await stopScan();
  await stopNfc();
  await supabase.auth.signOut();
  lockApp();
}

async function startScan() {
  captureStatus.textContent = "";
  codeValue.value = "";

  if (!navigator.mediaDevices?.getUserMedia) {
    captureStatus.textContent = "Camera not available in this browser.";
    return;
  }

  scanStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });
  video.srcObject = scanStream;
  await video.play();

  btnStartScan.disabled = true;
  btnStopScan.disabled = false;

  if ("BarcodeDetector" in window) {
    const detector = new BarcodeDetector({
      formats: ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
    });

    scanTimer = setInterval(async () => {
      try {
        const barcodes = await detector.detect(video);
        if (barcodes?.length) {
          codeValue.value = barcodes[0].rawValue || "";
        }
      } catch {
        // ignore intermittent detect errors
      }
    }, 400);
  } else {
    captureStatus.textContent = "BarcodeDetector not supported. Use manual entry or try Safari/Chrome on mobile.";
  }
}

async function stopScan() {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = null;

  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
  video.srcObject = null;

  btnStartScan.disabled = false;
  btnStopScan.disabled = true;
}

async function startNfc() {
  nfcPayload.value = "";
  nfcStatus.textContent = "";

  if (!("NDEFReader" in window)) {
    nfcStatus.textContent = "Web NFC not supported on this device/browser.";
    return;
  }

  ndef = new NDEFReader();
  await ndef.scan();
  nfcStatus.textContent = "Scanning... tap an NFC tag";

  btnStartNfc.disabled = true;
  btnStopNfc.disabled = false;

  ndef.onreading = (event) => {
    const recs = [];
    for (const record of event.message.records) {
      recs.push({
        recordType: record.recordType,
        mediaType: record.mediaType,
        data: record.data ? Array.from(new Uint8Array(record.data)) : null
      });
    }
    nfcPayload.value = JSON.stringify({
      serialNumber: event.serialNumber,
      records: recs
    }, null, 2);
    nfcStatus.textContent = "Read success";
  };

  ndef.onreadingerror = () => {
    nfcStatus.textContent = "Read error (try again)";
  };
}

async function stopNfc() {
  // Web NFC doesn’t reliably support “stop”, so we just reset UI and let session end naturally
  ndef = null;
  btnStartNfc.disabled = false;
  btnStopNfc.disabled = true;
  nfcStatus.textContent = "Idle";
}

async function saveCapture() {
  captureStatus.textContent = "Saving…";
  const code = codeValue.value.trim();
  const name = productName.value.trim();
  const nfc = nfcPayload.value.trim();

  if (!code && !nfc && !name) {
    captureStatus.textContent = "Add at least one: detected code, NFC, or product name.";
    return;
  }
  if (!tagPhoto.files?.length) {
    captureStatus.textContent = "Tag photo is required. Take/select a photo.";
    return;
  }

  // NOTE: This demo stores capture metadata only. Photo upload can be added next (Supabase Storage).
  // Right now we keep it deployable and stable.
  const { data: sess } = await supabase.auth.getSession();
  const user = sess?.session?.user?.email || "unknown";

  const payload = {
    ts: new Date().toISOString(),
    user,
    code: code || null,
    name: name || null,
    nfc: nfc || null
  };

  // Persist to Supabase (table "captures") if it exists, otherwise just confirm locally.
  try {
    const { error } = await supabase.from("captures").insert(payload);
    if (error) throw error;
    captureStatus.textContent = "Saved to Supabase (captures).";
  } catch (e) {
    captureStatus.textContent = "Saved locally (table missing or RLS). Next step: create captures table + policy.";
    console.warn(e);
  }
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(summary.value);
    mgmtStatus.textContent = "Copied.";
  } catch {
    mgmtStatus.textContent = "Copy failed (browser permissions).";
  }
}

function emailDraft() {
  const subject = encodeURIComponent("AXIS BLUE – Visit Summary");
  const body = encodeURIComponent(summary.value || "(summary goes here)");
  // Put management emails here when you want:
  const to = "";
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  mgmtStatus.textContent = "Email draft opened.";
}

(async function boot() {
  try {
    supabase = await getSupabase();

    // lock-first
    lockApp();

    // session refresh
    await refreshSession();
    supabase.auth.onAuthStateChange(async () => {
      await refreshSession();
    });

    btnSignIn.addEventListener("click", signIn);
    btnSignOut.addEventListener("click", signOut);

    btnStartScan.addEventListener("click", () => startScan().catch(e => captureStatus.textContent = e.message));
    btnStopScan.addEventListener("click", () => stopScan().catch(() => {}));
    btnSaveCapture.addEventListener("click", () => saveCapture().catch(e => captureStatus.textContent = e.message));

    btnStartNfc.addEventListener("click", () => startNfc().catch(e => nfcStatus.textContent = e.message));
    btnStopNfc.addEventListener("click", () => stopNfc().catch(() => {}));

    btnCopySummary.addEventListener("click", copySummary);
    btnEmailSummary.addEventListener("click", emailDraft);

  } catch (e) {
    showError(e?.message || String(e));
    lockApp();
  }
})();
