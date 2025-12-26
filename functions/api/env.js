export async function onRequest(context) {
  try {
    const url = context.env.SUPABASE_URL || "";
    const key = context.env.SUPABASE_ANON_KEY || "";
    return new Response(JSON.stringify({
      ok: true,
      SUPABASE_URL: url,
      SUPABASE_ANON_KEY: key ? "SET" : "MISSING"
    }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
