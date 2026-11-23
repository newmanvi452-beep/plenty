// Edge function "stripe-webhook" (JWT verification OFF: Stripe calls it, not a signed-in user).
// Secrets needed: STRIPE_WEBHOOK_SECRET (the whsec_... value of the webhook endpoint).
// Events to send to it: checkout.session.completed and charge.refunded.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function validSignature(body: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"], sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`)));
  return sigs.some((s) => s.length === expected.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET"), url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!secret) return new Response("not configured", { status: 503 });
  const body = await req.text();
  if (!(await validSignature(body, req.headers.get("stripe-signature") || "", secret))) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(body);
  const h = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid" && event.data.object.client_reference_id) {
    const o = event.data.object;
    const r = await fetch(`${url}/rest/v1/entitlements?on_conflict=user_id`, { method: "POST", headers: { ...h, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ user_id: o.client_reference_id, source: event.livemode === false ? "stripe-test" : "stripe", ref: o.payment_intent }) });
    if (!r.ok) return new Response("db error", { status: 500 }); // Stripe retries
  } else if (event.type === "charge.refunded" && event.data.object.refunded && event.data.object.payment_intent) {
    await fetch(`${url}/rest/v1/entitlements?ref=eq.${encodeURIComponent(event.data.object.payment_intent)}`, { method: "DELETE", headers: h });
  }
  return new Response("ok");
});
