import { Logo, Wordmark } from "./Logo";
import { EntitlementApi } from "./sync/useEntitlement";

/** The "Unlock Serves 20" window: opens whenever someone in preview mode taps something that's locked. */
export function UnlockSheet({ ent, signedIn, email, signIn, close }: { ent: EntitlementApi; signedIn: boolean; email: string; signIn: () => void; close: () => void }) {
  const canBuy = ent.native || signedIn;
  return (
    <div className="sheet" onClick={close}><div role="dialog" aria-label="Unlock Serves 20" onClick={(e) => e.stopPropagation()}>
      <div className="row"><span /><button className="round" aria-label="Close" onClick={close}>✕</button></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center", alignItems: "center" }}>
        <Logo size={64} />
        <h2 style={{ fontSize: 30 }}><Wordmark /></h2>
        <p className="sub" style={{ fontSize: 16, margin: 0 }}>You’re previewing Serves 20. Unlock the whole thing:</p>
        <ul className="sub" style={{ textAlign: "left", margin: 0, paddingLeft: 20, fontSize: 15 }}>
          <li>Every recipe, with amounts scaled to your guests</li>
          <li>Your full shopping list and cooking plan</li>
          <li>Share a menu so guests can sign up to bring a dish</li>
          <li>Add your own recipes, and notes for next year</li>
          <li>One price, yours for good. No subscription.</li>
        </ul>
        {ent.checking ? <p className="sub" role="status">{ent.justPaid ? "Thanks! Finishing up…" : "Checking your purchase…"}</p> : (<>
          {canBuy
            ? <button className="btn" style={{ width: "100%" }} disabled={ent.busy} onClick={ent.buy}>{ent.busy ? "Please wait…" : `Unlock Serves 20 · ${ent.price}`}</button>
            : <button className="btn" style={{ width: "100%" }} onClick={signIn}>Sign in to unlock · {ent.price}</button>}
          {ent.notice && <p className="sub" role="status">{ent.notice}</p>}
          {ent.error && <p className="err" role="alert">{ent.error}</p>}
          {ent.native && <button className="linkbtn" disabled={ent.busy} onClick={ent.restore}>Restore purchase</button>}
          {signedIn
            ? <p className="sub" style={{ margin: 0 }}>Signed in as {email}. Already purchased with another email? <button className="linkbtn" style={{ minHeight: 0 }} onClick={signIn}>Switch account</button></p>
            : <button className="linkbtn" onClick={signIn}>Already purchased? Sign in</button>}
        </>)}
        <p className="sub" style={{ margin: 0 }}><a href="#/terms">Terms</a> · <a href="#/privacy">Privacy</a> · <a href="#/support">Help</a></p>
      </div>
    </div></div>
  );
}

/** A greyed-out spot where locked content would be. Tapping it opens the unlock window. */
export function LockCard({ title, text, price, lock }: { title: string; text: string; price: string; lock: () => void }) {
  return (
    <section className="card lockcard" aria-label="Locked">
      <h2 style={{ fontSize: 18 }}>🔒 {title}</h2>
      <p className="sub">{text}</p>
      <button className="btn" onClick={lock}>Unlock Serves 20 · {price}</button>
    </section>
  );
}
