import { useCallback, useEffect, useState } from "react";
import { Logo } from "./Logo";
import { AdminError, Overview, Person, SupportItem, adminOverview, adminPeople, adminSupport, adminSupportSet } from "./sync/admin";
import { Session, loadSession, saveSession, sendCode, verifyCode } from "./sync/auth";

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";
const Stat = ({ label, value, note }: { label: string; value: number | string; note?: string }) => (
  <div className="card" style={{ flex: "1 1 140px", gap: 2 }}><p className="sub" style={{ margin: 0 }}>{label}</p><div style={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 800, color: "var(--deep)" }}>{value}</div>{note && <p className="sub" style={{ margin: 0 }}>{note}</p>}</div>
);

function SignIn({ done }: { done: (s: Session) => void }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email"), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } };
  return (
    <section className="card" style={{ gap: 12 }}>
      <h2 style={{ fontSize: 18 }}>Sign in</h2>
      <p className="sub">Admin only. Enter your admin email and we’ll email you a code.</p>
      {step === "email" ? (<>
        <div className="field"><label htmlFor="ad-email">Email</label><input id="ad-email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn" disabled={busy || !/.+@.+\..+/.test(email.trim())} onClick={() => run(async () => { await sendCode(email); setStep("code"); })}>{busy ? "Sending…" : "Email me a code"}</button>
      </>) : (<>
        <p className="sub" role="status">We emailed a code to <b>{email.trim()}</b>.</p>
        <div className="field"><label htmlFor="ad-code">Code</label><input id="ad-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <button className="btn" disabled={busy || code.replace(/\s/g, "").length < 6} onClick={() => run(async () => { const s = await verifyCode(email, code); saveSession(s); done(s); })}>{busy ? "Checking…" : "Continue"}</button>
        <button className="btn ghost" onClick={() => { setStep("email"); setCode(""); }}>Different email</button>
      </>)}
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}

function Dashboard({ session, signOut }: { session: Session; signOut: () => void }) {
  const [tab, setTab] = useState<"overview" | "support" | "people">("overview");
  const [ov, setOv] = useState<Overview | null>(null), [people, setPeople] = useState<Person[]>([]), [support, setSupport] = useState<SupportItem[]>([]);
  const [err, setErr] = useState(""), [notAdmin, setNotAdmin] = useState(false), [loading, setLoading] = useState(true), [showDone, setShowDone] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const [o, p, s] = await Promise.all([adminOverview(session), adminPeople(session), adminSupport(session)]); setOv(o); setPeople(p); setSupport(s); }
    catch (e) { if (e instanceof AdminError && e.notAdmin) setNotAdmin(true); setErr(e instanceof Error ? e.message : "Something went wrong."); }
    setLoading(false);
  }, [session]);
  useEffect(() => { load(); }, [load]);
  const mark = async (id: string, status: "open" | "done") => { try { await adminSupportSet(session, id, status); setSupport((l) => l.map((r) => r.id === id ? { ...r, status } : r)); setOv((o) => o && { ...o, support_open: o.support_open + (status === "done" ? -1 : 1) }); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t update."); } };

  if (notAdmin) return (<section className="card" style={{ gap: 10 }}><h2 style={{ fontSize: 18 }}>Not an admin</h2><p className="sub">{session.user.email} isn’t on the admin list.</p><button className="btn ghost" onClick={signOut}>Sign out</button></section>);
  const max = Math.max(1, ...(ov?.signups_by_day.map((d) => d.n) ?? [1]));
  const shown = support.filter((r) => showDone || r.status === "open");
  return (<>
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {(["overview", "support", "people"] as const).map((t) => <button key={t} className={"chip" + (tab === t ? " on" : "")} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === "overview" ? "Overview" : t === "support" ? `Support${ov?.support_open ? ` (${ov.support_open})` : ""}` : "People"}</button>)}
      <span style={{ flex: 1 }} /><button className="chip" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button><button className="chip" onClick={signOut}>Sign out</button>
    </div>
    {err && <p className="err" role="alert">{err}</p>}
    {tab === "overview" && ov && (<>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="Accounts" value={ov.users} note={`${ov.new_24h} today · ${ov.new_7d} this week`} />
        <Stat label="Unlocked" value={ov.unlocked} note={Object.entries(ov.unlocked_by_source).map(([k, v]) => `${v} ${k}`).join(" · ") || "none yet"} />
        <Stat label="Shared menus" value={ov.shared_menus} note={`${ov.claims} dishes claimed`} />
        <Stat label="Open support" value={ov.support_open} />
      </div>
      <section className="card" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>New accounts, last 30 days</h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }} role="img" aria-label="New accounts per day">
          {ov.signups_by_day.map((d) => <div key={d.day} title={`${d.day}: ${d.n}`} style={{ flex: 1, minHeight: 2, height: `${(d.n / max) * 100}%`, background: d.n ? "var(--deep)" : "var(--line)", borderRadius: 2 }} />)}
        </div>
        <p className="sub">App Store downloads and sales will appear here once the Apple report is connected. Check them in App Store Connect for now.</p>
      </section>
    </>)}
    {tab === "support" && (<section className="card" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ fontSize: 18 }}>Support requests</h2><label className="sub"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> show done</label></div>
      {shown.length === 0 && <p className="sub">{support.length ? "Nothing open. Nice." : "No requests yet. Messages sent from the Support page show up here. Emails to support@ still go to your inbox."}</p>}
      {shown.map((r) => (<div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{r.name || r.email}</b><span className="sub">{when(r.created_at)}</span></div>
        <p className="sub" style={{ margin: "2px 0" }}><a href={`mailto:${r.email}?subject=${encodeURIComponent("Re: your Serves 20 message")}`}>{r.email}</a></p>
        <p style={{ margin: "4px 0 8px", whiteSpace: "pre-wrap" }}>{r.message}</p>
        <button className="chip" onClick={() => mark(r.id, r.status === "open" ? "done" : "open")}>{r.status === "open" ? "Mark done" : "Reopen"}</button>
      </div>))}
    </section>)}
    {tab === "people" && (<section className="card" style={{ gap: 6 }}>
      <h2 style={{ fontSize: 18 }}>People ({people.length})</h2>
      {people.map((p) => (<div key={p.email} className="row" style={{ justifyContent: "space-between", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 6, flexWrap: "wrap" }}>
        <span>{p.email}</span><span className="sub">joined {when(p.created_at)} · last seen {when(p.last_sign_in_at)} · {p.unlocked ? `unlocked (${p.unlocked})` : "preview"}</span></div>))}
    </section>)}
  </>);
}

/** Private admin page (serves20.com/#/admin). The data only loads for emails on the admin list. */
export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  return (
    <div className="app">
      <header className="top"><div className="brand"><Logo size={40} /><div><h1>Admin</h1><p>Serves 20 · private</p></div></div></header>
      <main>{session ? <Dashboard session={session} signOut={() => { saveSession(null); setSession(null); }} /> : <SignIn done={setSession} />}</main>
    </div>
  );
}
