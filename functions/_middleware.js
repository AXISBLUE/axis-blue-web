export async function onRequest(context) {
  const res = await context.next();
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self), nfc=(self)");
  return new Response(res.body, { status: res.status, headers });
}
