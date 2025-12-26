export async function onRequestGet(context) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = context.env;

  return new Response(JSON.stringify({
    SUPABASE_URL: SUPABASE_URL || "",
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || ""
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
