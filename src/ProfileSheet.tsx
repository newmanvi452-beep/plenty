import { useEffect, useState } from "react";
import { AccountApi } from "./sync/useAccount";
import { AppState } from "./store";

type Patch = (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
const timeOf = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

/** Your profile: your name, and signing in so your plans are saved to your account on every device. */
export default function ProfileSheet({ account, s, patch, close }: { account: AccountApi; s: AppState; patch: Patch; close: () => void }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [cool, setCool] = useState(0);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } };
  const send = () => run(async () => { await account.requestCode(email); setStep("code"); setCode(""); setCool(30); });
  const verify = () => run(async () => { await account.confirmCode(email, code); setStep("email"); setCode(""); });
  const signedIn = !!account.session;

  return (
    <div className="sheet" onClick={close}><div role="dialog" aria-label="Your profile" onClick={(e) => e.stopPropagation()}>
      <div className="row"><h2>Your profile</h2><button className="round" aria-label="Close" onClick={close}>✕</button></div>

      <div className="field"><label htmlFor="profile-name">Your name</label>
        <input id="profile-name" value={s.profile.name} maxLength={40} placeholder="Vi" autoComplete="off"
          onChange={(e) => patch({ profile: { name: e.target.value } })} />
        <p className="sub" style={{ margin: 0, fontWeight: 600 }}>Shown as the host on shared menus, and on your own dishes under “Who’s bringing what”.</p></div>

      {account.enabled && !signedIn && (<>
        <section className="card" aria-label="Sign in" style={{ gap: 10 }}>
          <div><h2 style={{ fontSize: 18 }}>Save your plans</h2>
            <p className="sub">Sign in and your menus, recipes, checklists and notes are saved to your account and follow you to every device. No password: we email you a code.</p></div>
          {step === "email" ? (<>
            <div className="field"><label htmlFor="acct-email">Email</label>
              <input id="acct-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) send(); }} /></div>
            <button className="btn" disabled={busy || !/.+@.+\..+/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email me a code"}</button></>
          ) : (<>
            <p className="sub" style={{ margin: 0 }} role="status">We emailed a code to <b>{email.trim()}</b>. It can take a minute.</p>
            <div className="field"><label htmlFor="acct-code">Code</label>
              <input id="acct-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456" value={code}
                onChange={(e) => { setCode(e.target.value.replace(/[^\d\s]/g, "")); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter" && code.trim().length >= 6) verify(); }} /></div>
            <button className="btn" disabled={busy || code.replace(/\s/g, "").length < 6} onClick={verify}>{busy ? "Checking…" : "Sign in"}</button>
            <div className="row" style={{ gap: 8 }}>
              <button className="chip" disabled={busy || cool > 0} onClick={send}>{cool > 0 ? `Resend in ${cool}s` : "Resend code"}</button>
              <button className="chip" onClick={() => { setStep("email"); setErr(""); }}>Use a different email</button></div></>)}
          {err && <p className="err" role="alert">{err}</p>}
        </section></>)}

      {account.enabled && signedIn && (<section className="card" aria-label="Account" style={{ gap: 10 }}>
        <div><h2 style={{ fontSize: 18 }}>Signed in</h2><p className="sub" style={{ wordBreak: "break-all" }}>{account.email}</p></div>
        <p className="sub" style={{ margin: 0 }} role="status">
          {account.status === "syncing" ? "Saving…" : account.status === "error" ? "" : account.lastSynced ? `✓ Saved to your account · ${timeOf(account.lastSynced)}` : "✓ Signed in"}</p>
        {account.error && <p className="err" role="alert">{account.error}</p>}
        {account.status === "error" && <button className="btn ghost" onClick={account.syncNow}>Try again</button>}
        <button className="btn ghost" disabled={busy} onClick={() => { if (window.confirm("Sign out? Your plans stay saved in your account. This device will be cleared, so sign in again to get them back.")) run(async () => { await account.signOut(); close(); }); }}>Sign out</button>
        <button className="btn danger" disabled={busy} onClick={() => { if (window.confirm("Delete everything saved in your account? Your menus, recipes and notes will be erased for good, and this device will be cleared.")) run(async () => { await account.deleteData(); close(); }); }}>Delete my saved data</button>
        {err && <p className="err" role="alert">{err}</p>}
      </section>)}

      {!account.enabled && <p className="sub">Sign-in isn’t available in this version.</p>}
    </div></div>);
}
