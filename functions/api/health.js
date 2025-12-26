export async function onRequestGet({ env }) {
  const ok = !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY;
  return new Response(JSON.stringify({
    ok,
    hasSupabaseUrl: !!env.SUPABASE_URL,
    hasAnonKey: !!env.SUPABASE_ANON_KEY
  }), { headers: { "content-type": "application/json" }});
}
