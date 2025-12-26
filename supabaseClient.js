import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client = null;

export async function getSupabase() {
  if (_client) return _client;

  const res = await fetch("/api/env", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load runtime config from /api/env");
  }
  const cfg = await res.json();

  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in runtime config");
  }

  _client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  return _client;
}
