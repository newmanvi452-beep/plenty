import { useEffect, useState } from "react";
import { Logo, Wordmark } from "./Logo";
import { AccountApi } from "./sync/useAccount";

/** The website asks for an email (and a code we send to it) before anyone can use the planner. */
export default function SignupGate({ account }: { account: AccountApi }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [cool, setCool] = useState(0);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } };
  const send = () => run(async () => { await account.requestCode(email); setStep("code"); setCode(""); setCool(30); });
  const verify = () => run(async () => { await account.confirmCode(email, code); });
  return (
    <div className="app solo">
      <main style={{ justifyContent: "center", paddingTop: 40 }}>
        <section className="card" style={{ gap: 14, textAlign: "center", alignItems: "center" }}>
          <Logo size={72} />
          <h1 style={{ fontSize: 34 }}><Wordmark /></h1>
          <p className="sub" style={{ fontSize: 16, margin: 0 }}>Create your account to take a look inside. No password: we email you a code.</p>
          {step === "email" ? (<>
            <div className="field" style={{ width: "100%", textAlign: "left" }}><label htmlFor="gate-email">Your email</label>
              <input id="gate-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter" && /.+@.+\..+/.test(email.trim())) send(); }} /></div>
            <button className="btn" style={{ width: "100%" }} disabled={busy || !/.+@.+\..+/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email me a code"}</button>
          </>) : (<>
            <p className="sub" style={{ margin: 0 }} role="status">We emailed a code to <b>{email.trim()}</b>. It can take a minute, and may land in spam.</p>
            <div className="field" style={{ width: "100%", textAlign: "left" }}><label htmlFor="gate-code">Code</label>
              <input id="gate-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) verify(); }} /></div>
            <button className="btn" style={{ width: "100%" }} disabled={busy || code.replace(/\s/g, "").length < 6} onClick={verify}>{busy ? "Checking…" : "Continue"}</button>
            <div className="row" style={{ gap: 8, width: "100%" }}>
              <button className="btn ghost" style={{ flex: 1 }} disabled={busy || cool > 0} onClick={send}>{cool > 0 ? `Resend in ${cool}s` : "Resend code"}</button>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setStep("email"); setCode(""); setErr(""); }}>Different email</button></div>
          </>)}
          {err && <p className="err" role="alert">{err}</p>}
          <p className="sub" style={{ margin: 0 }}>We use your email only to run your account. <a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a> · <a href="#/support">Help</a></p>
        </section>
      </main>
    </div>
  );
}
