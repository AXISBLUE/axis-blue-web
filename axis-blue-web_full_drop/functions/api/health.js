export const onRequest = async () => {
  return new Response(JSON.stringify({
    ok:true,
    service:"axis-blue-pages",
    ts: new Date().toISOString()
  }), { headers: { "content-type":"application/json" }});
};
