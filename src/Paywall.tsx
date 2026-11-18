import { Logo, Wordmark } from "./Logo";
import { PRICE_LABEL, EntitlementApi } from "./sync/useEntitlement";

/** Shown instead of the planner until the account has bought Serves 20. */
export default function Paywall({ ent, signedIn, email, signIn, children }: { ent: EntitlementApi; signedIn: boolean; email: string; signIn: () => void; children?: React.ReactNode }) {
  return (
    <div className="app solo">
      <main style={{ justifyContent: "center", paddingTop: 40 }}>
        <section className="card" style={{ gap: 14, textAlign: "center", alignItems: "center" }}>
          <Logo size={72} />
          <h1 style={{ fontSize: 34 }}><Wordmark /></h1>
          <p className="sub" style={{ fontSize: 16, margin: 0 }}>Plan the feast, shop once, cook calmly.</p>
          {ent.checking ? <p className="sub" role="status">{ent.justPaid ? "Thanks! Finishing up…" : "Checking your account…"}</p> : (<>
            <ul className="sub" style={{ textAlign: "left", margin: 0, paddingLeft: 20, fontSize: 15 }}>
              <li>A menu sized for your guests, with a shopping list and a cooking plan</li>
              <li>Share a menu so guests can sign up to bring a dish</li>
              <li>Saved to your account on every phone and computer</li>
              <li>One price, yours for good. No subscription.</li>
            </ul>
            {signedIn
              ? <button className="btn" style={{ width: "100%" }} disabled={ent.busy} onClick={ent.buy}>{ent.busy ? "Opening checkout…" : `Unlock Serves 20 · ${PRICE_LABEL}`}</button>
              : <button className="btn" style={{ width: "100%" }} onClick={signIn}>Sign in to unlock · {PRICE_LABEL}</button>}
            {ent.error && <p className="err" role="alert">{ent.error}</p>}
            {signedIn
              ? <p className="sub" style={{ margin: 0 }}>Signed in as {email}. Already bought it with another email? <button className="linkbtn" style={{ minHeight: 0 }} onClick={signIn}>Switch account</button></p>
              : <button className="linkbtn" onClick={signIn}>Already bought? Sign in</button>}
            <p className="sub" style={{ margin: 0 }}><a href="#/terms">Terms &amp; refunds</a> · <a href="#/privacy">Privacy</a></p>
          </>)}
        </section>
      </main>
      {children}
    </div>
  );
}
