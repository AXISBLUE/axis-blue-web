// functions/_middleware.js
export async function onRequest(context) {
  const res = await context.next();

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return res;

  const commit =
    (context.env?.CF_PAGES_COMMIT_SHA || context.env?.CF_PAGES_COMMIT_HASH || "").slice(0,7) || "unknown";

  const html = await res.text();
  const out = html.replaceAll("__BUILD_ID__", commit);

  return new Response(out, { status: res.status, headers: res.headers });
}
