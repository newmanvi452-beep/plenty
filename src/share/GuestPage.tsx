import { useCallback, useEffect, useState } from "react";
import { clock, fmtDate, parseISO } from "../domain/format";
import { Claim, SharedDish, SharedEvent } from "../domain/sharing";
import { claimDish, randomKey, ShareError, getShare, unclaim } from "./client";

const GUEST_KEY = "plenty:guest:v1";
interface Guest { name: string; keys: Record<string, string> } // keys: claim id -> secret that lets this browser remove it
const loadGuest = (): Guest => { try { return { name: "", keys: {}, ...JSON.parse(localStorage.getItem(GUEST_KEY) || "{}") }; } catch { return { name: "", keys: {} }; } };

/** What a guest sees when they open a share link. */
export default function GuestPage({ slug }: { slug: string }) {
  const [ev, setEv] = useState<SharedEvent | null | undefined>(undefined);
  const [guest, setGuest] = useState<Guest>(loadGuest);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [extra, setExtra] = useState("");
  useEffect(() => { try { localStorage.setItem(GUEST_KEY, JSON.stringify(guest)); } catch { /* ignore */ } }, [guest]);

  const refresh = useCallback(() => getShare(slug).then((e) => setEv(e)).catch((e) => { if (ev === undefined) setEv(null); setErr(e instanceof ShareError ? e.message : ""); }), [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15000);
    const vis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [refresh]);
  useEffect(() => { if (ev) document.documentElement.dataset.mode = ev.mode; }, [ev?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = guest.name.trim();
  const mine = (c: Claim) => !!guest.keys[c.id];
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await fn(); await refresh(); } catch (e) { setErr(e instanceof ShareError ? e.message : "Something went wrong."); await refresh(); } finally { setBusy(false); }
  };
  const claim = (dishId: string | null, what: string | null) => {
    if (!name) { setErr("Add your name first so people know who’s bringing it."); document.getElementById("guest-name")?.focus(); return; }
    const key = randomKey();
    return run(async () => { const id = await claimDish(slug, dishId, what, name, key); setGuest((g) => ({ ...g, keys: { ...g.keys, [id]: key } })); setExtra(""); });
  };
  const remove = (c: Claim) => run(() => unclaim(slug, c.id, { ownerKey: guest.keys[c.id] }));

  if (ev === undefined) return <div className="app"><main><p className="empty">Loading the menu…</p></main></div>;
  if (ev === null) return <div className="app"><main><section className="card"><h2>This link isn’t active</h2><p className="sub">The host may have stopped sharing, or the link was copied incorrectly. Ask them for a fresh one.</p></section></main></div>;

  const date = ev.event_date ? parseISO(ev.event_date) : null;
  const dishes = ev.snapshot.dishes;
  const groups: { label: string; items: SharedDish[] }[] = [];
  dishes.forEach((x) => { let g = groups.find((y) => y.label === x.catLabel); if (!g) groups.push((g = { label: x.catLabel, items: [] })); g.items.push(x); });
  const extras = ev.claims.filter((c) => !c.dish_id && c.what);

  return (
    <div className="app">
      <header className="top"><div className="brand">
        <svg width="40" height="40" viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="28" fill="var(--soft)" /><path d="M17 41c0-13 9-22 25-24-1 15-10 24-25 24z" fill="var(--mid)" /><path d="M17 41l16-16" stroke="var(--deep)" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
        <div><h1>{ev.title}</h1><p>{date ? fmtDate(date) : "Date to be announced"}{ev.serve_min !== null ? ` · ${clock(ev.serve_min)}` : ""}</p></div></div></header>
      <main>
        <section className="hero"><div><p className="kicker">{ev.snapshot.host ? `${ev.snapshot.host} invited you` : "You’re invited"}</p><h2>What can you bring?</h2></div>
          <div className="field"><label htmlFor="guest-name">Your name</label>
            <input id="guest-name" value={guest.name} maxLength={40} placeholder="Aunt May" onChange={(e) => { setGuest({ ...guest, name: e.target.value }); setErr(""); }} /></div>
          <p className="sub" style={{ margin: 0 }}>Tap “I’ll bring this” on a dish. The host sees it right away.</p></section>
        {err && <p className="err" role="alert">{err}</p>}
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}><div className="catHead"><h2 style={{ fontSize: 20 }}>{g.label}</h2></div>
            <div className="stack" style={{ gap: 10 }}>{g.items.map((x) => { const c = ev.claims.find((y) => y.dish_id === x.id); return (
              <div key={x.id} className={"card" + (c ? "" : "")} style={{ gap: 8, padding: 14 }}>
                <div><b style={{ fontSize: 16 }}>{x.name}</b><p className="sub" style={{ margin: 0 }}>{x.meta}</p></div>
                <span className="badge">{x.badge}</span>
                {c ? <div className="row"><span className="tag ok">{mine(c) ? "You’re bringing this" : `${c.name} is bringing this`}</span>
                  {mine(c) && <button className="chip" style={{ minHeight: 36 }} disabled={busy} onClick={() => remove(c)}>Remove me</button>}</div>
                  : <button className="btn" style={{ minHeight: 44 }} disabled={busy} onClick={() => claim(x.id, null)}>I’ll bring this</button>}
                <details><summary style={{ cursor: "pointer", fontWeight: 800 }}>Amounts & recipe</summary>
                  {x.ing.map((i, n) => <div className="ing" key={n}><b>{i.q}</b><span>{i.name}</span></div>)}
                  {!!x.directions?.length && <ol className="steps">{x.directions.map((t, n) => <li key={n}>{t}</li>)}</ol>}</details>
              </div>); })}</div></section>))}
        <section className="card"><h2>Bringing something else?</h2>
          {extras.map((c) => <div className="row" key={c.id}><span>{c.what} <span className="sub">· {c.name}{mine(c) ? " (you)" : ""}</span></span>
            {mine(c) && <button className="chip" style={{ minHeight: 36 }} disabled={busy} onClick={() => remove(c)}>Remove</button>}</div>)}
          <div className="field"><label htmlFor="guest-extra">Ice, drinks, napkins…</label><input id="guest-extra" value={extra} maxLength={80} onChange={(e) => setExtra(e.target.value)} /></div>
          <button className="btn ghost" disabled={busy || !extra.trim()} onClick={() => claim(null, extra.trim())}>Add</button></section>
        <p className="sub" style={{ textAlign: "center" }}>Made with Plenty</p>
      </main>
    </div>);
}
