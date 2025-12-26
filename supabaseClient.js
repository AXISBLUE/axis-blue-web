// axis-blue-web/supabaseClient.js
// Builds the Supabase client using config returned by /env (Cloudflare Pages Function)

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

async function loadEnv() {
  const res = await fetch("/env", { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to load /env (${res.status}). ${txt}`);
  }
  return res.json();
}

export const supabase = await (async () => {
  const { supabaseUrl, supabaseAnonKey } = await loadEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing supabaseUrl/supabaseAnonKey from /env.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
})();