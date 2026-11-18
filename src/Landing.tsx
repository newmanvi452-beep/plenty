import { Logo, Wordmark } from "./Logo";
import { CONTACT_EMAIL } from "./PrivacyPage";
import { PAYWALL_ON, PRICE_LABEL } from "./sync/useEntitlement";

const FEATURES: [string, string][] = [
  ["A menu that fits your guests", "Say how many are coming and what time you’re eating. Serves 20 suggests how many of each dish to make, for Thanksgiving or any party."],
  ["One shopping list", "Every ingredient from every dish, combined and sorted by aisle, so you shop once."],
  ["A cooking plan, hour by hour", "Tasks for the days before and a countdown for the big day, so everything lands on the table together."],
  ["Guests sign up to bring a dish", "Share a link. Guests pick what to bring, no account needed, and you see who has what."],
  ["Add your own recipes", "Snap a photo of a recipe card or type it in, and it joins the menu and the list."],
  ["On every device", "Sign in with just your email, no password, and your plans follow you from phone to computer."],
];

/** The front page of serves20.com for first-time visitors. People who already use the app go straight to it. */
export default function Landing() {
  const open = () => { location.hash = "#/app"; };
  return (
    <div className="land">
      <header className="land-top">
        <div className="brand"><Logo size={40} /><h1 className="wm"><Wordmark /></h1></div>
        <button className="btn ghost" onClick={open}>{PAYWALL_ON ? "Sign in" : "Open the app"}</button>
      </header>

      <section className="land-hero">
        <p className="kicker">Thanksgiving &amp; party planner</p>
        <h2>Plan the feast.<br />Shop once.<br />Cook calmly.</h2>
        <p className="land-lead">Tell Serves 20 how many are coming. It builds the menu, the shopping list and the cooking schedule, and lets your guests sign up to bring a dish.</p>
        <div className="land-cta">
          <button className="btn" onClick={open}>{PAYWALL_ON ? `Get Serves 20 · ${PRICE_LABEL}` : "Open the app"}</button>
          {PAYWALL_ON && <span className="sub">One-time purchase. No subscription.</span>}
        </div>
      </section>

      <section className="land-grid" aria-label="What it does">
        {FEATURES.map(([t, b]) => <div className="card" key={t}><h3 style={{ fontSize: 19 }}>{t}</h3><p className="sub" style={{ fontSize: 15 }}>{b}</p></div>)}
      </section>

      {PAYWALL_ON && (
        <section className="land-price card">
          <h2>{PRICE_LABEL}, once.</h2>
          <p className="sub" style={{ fontSize: 16 }}>Buy it here and use it on the website. An iPhone app is on the way, and the same account will unlock it there too, at no extra cost. Not happy? Ask within 14 days for a refund.</p>
          <button className="btn" onClick={open}>Get Serves 20</button>
        </section>
      )}

      <footer className="land-foot">
        <a href="#/support">Support</a><a href="#/privacy">Privacy</a><a href="#/terms">Terms &amp; refunds</a><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}
