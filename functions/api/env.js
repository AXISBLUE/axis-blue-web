export async function onRequest() {
  const SUPABASE_URL = (typeof SUPABASE_URL !== "undefined") ? SUPABASE_URL : "";
  const SUPABASE_ANON_KEY = (typeof SUPABASE_ANON_KEY !== "undefined") ? SUPABASE_ANON_KEY : "";
  return new Response(JSON.stringify({ SUPABASE_URL, SUPABASE_ANON_KEY }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
