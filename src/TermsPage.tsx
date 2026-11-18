import { Logo } from "./Logo";
import { CONTACT_EMAIL } from "./PrivacyPage";
import { PRICE_LABEL } from "./sync/useEntitlement";

/** Terms of purchase and refunds: plain language, reachable without signing in (address ends in #/terms). */
export default function TermsPage() {
  return (
    <div className="app">
      <header className="top"><div className="brand"><Logo size={40} /><div><h1>Terms &amp; refunds</h1><p>Serves 20 · updated November 2026</p></div></div></header>
      <main>
        <section className="card" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18 }}>What you’re buying</h2>
          <p className="sub">A one-time purchase of {PRICE_LABEL} (US dollars) that unlocks Serves 20 for your account, with no subscription and no renewal. It works on the website, and on any Serves 20 app we release, when you sign in with the same email.</p>
          <h2 style={{ fontSize: 18 }}>Payment</h2>
          <p className="sub">Card payments on the website are handled by Stripe. We never see or store your card number. Purchases made inside an app store are handled by that store under its own terms.</p>
          <h2 style={{ fontSize: 18 }}>Refunds</h2>
          <p className="sub">If Serves 20 isn’t right for you, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within 14 days of buying and we’ll refund the full price. A refund ends access for that account. Purchases made in an app store are refunded by that store.</p>
          <h2 style={{ fontSize: 18 }}>Your account and your plans</h2>
          <p className="sub">One purchase covers one account, for your own use. Your plans live on your device and, if you sign in, in your account. You can erase your account and everything in it at any time from your profile. Deleting your account does not by itself refund a purchase.</p>
          <h2 style={{ fontSize: 18 }}>As is</h2>
          <p className="sub">Serves 20 gives suggestions for amounts and timing. Check cooking times, food safety and any allergies yourself. We work to keep the service running but can’t promise it will never be interrupted.</p>
          <h2 style={{ fontSize: 18 }}>Questions</h2>
          <p className="sub">Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If these terms change, the date at the top changes.</p>
          <a className="linkbtn" href="./">← Back to Serves 20</a>
        </section>
      </main>
    </div>
  );
}
