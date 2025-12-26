export async function onRequestGet({ env }) {
  const url = env?.SUPABASE_URL || "";
  const key = env?.SUPABASE_ANON_KEY || "";

  // Don't leak if missing, but do return a helpful shape.
  const ok = Boolean(url && key);

  return new Response(
    JSON.stringify(
      ok
        ? { supabaseUrl: url, supabaseAnonKey: key }
        : { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY in Cloudflare Pages Secrets" }
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      status: ok ? 200 : 500,
    }
  );
}
