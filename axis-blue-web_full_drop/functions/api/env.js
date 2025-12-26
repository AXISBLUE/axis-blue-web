export const onRequest = async () => {
  // Do NOT leak secrets. Only report presence.
  return new Response(JSON.stringify({
    ok:true,
    SUPABASE_URL: (process.env.SUPABASE_URL ? process.env.SUPABASE_URL : null),
    SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY ? "SET" : null)
  }), { headers: { "content-type":"application/json" }});
};
