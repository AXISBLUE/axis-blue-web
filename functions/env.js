export async function onRequestGet({ request, env }) {
  const url = env.SUPABASE_URL || "";
  const key = env.SUPABASE_ANON_KEY || "";

  const u = new URL(request.url);
  const debug = u.searchParams.get("debug") === "1";

  const body = debug
    ? { supabaseUrl: url, supabaseAnonKey: key }
    : { ok: true, hasSupabaseUrl: !!url, hasAnonKey: !!key };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
