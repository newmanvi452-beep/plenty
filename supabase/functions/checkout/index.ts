// Edge function "checkout" (JWT verification ON). A signed-in user asks to buy Serves 20 and gets back
// a Stripe Checkout address. Secrets needed: STRIPE_SECRET_KEY. (SUPABASE_URL and the service key are built in.)
const SITE = "https://serves20.com";
const PRICE_CENTS = 999;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, stripe = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripe) return json({ error: "Payments aren’t set up yet." }, 503);
  const auth = req.headers.get("Authorization") || "";
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, Authorization: auth } });
  if (!who.ok) return json({ error: "Please sign in first." }, 401);
  const user = await who.json() as { id: string; email?: string };
  // Already bought? Don't charge twice.
  const have = await fetch(`${url}/rest/v1/entitlements?user_id=eq.${user.id}&select=user_id`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
  if (have.ok && (await have.json()).length) return json({ already: true });
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(PRICE_CENTS),
    "line_items[0][price_data][product_data][name]": "Serves 20 (one-time purchase)",
    "line_items[0][price_data][product_data][description]": "Works on the website and in the app. Yours for good.",
    client_reference_id: user.id,
    success_url: `${SITE}/?paid=1#/app`,
    cancel_url: `${SITE}/#/app`,
  });
  if (user.email) form.set("customer_email", user.email);
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${stripe}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const out = await r.json();
  if (!r.ok || !out.url) return json({ error: "Couldn’t start checkout. Please try again." }, 502);
  return json({ url: out.url });
});
