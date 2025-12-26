export async function onRequest({ next }) {
  const res = await next();
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;

  const text = await res.text();
  const sha = (process.env.CF_PAGES_COMMIT_SHA || "dev").slice(0,7);
  const body = text.replace(/__BUILD_ID__/g, sha);
  return new Response(body, {
    status: res.status,
    headers: res.headers
  });
}
