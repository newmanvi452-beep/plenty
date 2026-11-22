import { useState } from "react";
import { Logo } from "./Logo";
import { submitSupport } from "./sync/admin";
import { SUPPORT_EMAIL } from "./PrivacyPage";

const FAQ: [string, React.ReactNode][] = [
  ["I didn’t get my sign-in code.", <>Check your spam or junk folder, then ask for a new code (the old one stops working). The email comes from “Serves 20”. If it still doesn’t arrive after a few minutes, write to us from the address you’re signing in with.</>],
  ["How do I get my purchase back on a new phone?", <>In the iPhone app, tap <b>Restore purchase</b> on the unlock screen. If you bought on the website, tap <b>Already purchased? Sign in</b> and use the same email.</>],
  ["Can I use Serves 20 on my computer and my phone?", <>Yes. Sign in with the same email on each device and your menus, recipes, checklists and notes follow you.</>],
  ["My guest says the link doesn’t work.", <>Shared menus only work while sharing is on. If you tapped <b>Stop sharing</b>, the link stops working. Share the menu again to get a new link.</>],
  ["How do I take someone off Who’s bringing what?", <>On the Menu screen, tap the ✕ next to their dish. If they signed up through your link, their sign-up is removed from the shared menu too.</>],
  ["How do I delete my account?", <>Open your profile (the circle at the top right), sign in, and tap <b>Delete my account</b>. Your login, saved plans and every menu you shared are erased right away.</>],
  ["How do I get a refund?", <>Purchases made in the iPhone app are refunded by Apple at <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>. For website purchases, write to us within 14 days. See <a href="#/terms">Terms &amp; refunds</a>.</>],
  ["Are the amounts and cooking times safe to rely on?", <>They’re good starting points for planning, not a substitute for your own judgment. Check cooking times, food safety and any allergies yourself.</>],
];

function ContactForm() {
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [err, setErr] = useState("");
  const send = async () => { setBusy(true); setErr(""); try { await submitSupport(email.trim(), name.trim(), msg.trim()); setSent(true); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t send that."); } setBusy(false); };
  if (sent) return <p className="sub" role="status"><b>Thank you.</b> We got your message and will reply to {email.trim()} within a day or two.</p>;
  return (<>
    <div className="field"><label htmlFor="sup-name">Your name (optional)</label><input id="sup-name" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
    <div className="field"><label htmlFor="sup-email">Your email</label><input id="sup-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={200} value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} /></div>
    <div className="field"><label htmlFor="sup-msg">How can we help?</label><textarea id="sup-msg" rows={5} maxLength={4000} value={msg} onChange={(e) => { setMsg(e.target.value); setErr(""); }} style={{ width: "100%", borderRadius: 12, border: "1.5px solid #E3CDB1", padding: 12, font: "inherit" }} /></div>
    <button className="btn" disabled={busy || !/.+@.+\..+/.test(email.trim()) || msg.trim().length < 5} onClick={send}>{busy ? "Sending…" : "Send message"}</button>
    {err && <p className="err" role="alert">{err}</p>}
  </>);
}

/** Help and contact: plain language, reachable without signing in (address ends in #/support). */
export default function SupportPage() {
  return (
    <div className="app">
      <header className="top"><div className="brand"><Logo size={40} /><div><h1>Support</h1><p>Serves 20 · we’re happy to help</p></div></div></header>
      <main>
        <section className="card" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18 }}>Contact us</h2>
          <p className="sub">Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Tell us what you were doing and what you saw, and which device you use. We read every message and usually reply within a day or two.</p>
        </section>
        <section className="card" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18 }}>Or send a message here</h2>
          <p className="sub">It goes straight to us. We use your email only to reply.</p>
          <ContactForm />
        </section>
        <section className="card" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18 }}>Common questions</h2>
          {FAQ.map(([q, a]) => <div key={q}><b>{q}</b><p className="sub" style={{ marginTop: 4 }}>{a}</p></div>)}
        </section>
        <p className="sub" style={{ textAlign: "center" }}><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms &amp; refunds</a> · <a href="./">Back to Serves 20</a></p>
      </main>
    </div>
  );
}
