import { Logo, Wordmark } from "./Logo";
import { useEffect, useRef, useState } from "react";
import { Dish, LIB } from "./domain/data";
import { daysUntil, fmtDate, hourLabel, parseISO } from "./domain/format";
import { dateOfKey, eventKey, isEventOver, latestFor, reviewFor, upsertReview, VERDICTS, Verdict } from "./domain/review";
import { bringKey, cookText, derive, KID_FACTOR, selKeyOf, Derived } from "./domain/planner";
import { buildCustomDish, cleanOcr, numberSteps, parseRecipeText, stepList } from "./domain/recipe";
import { extractRecipeText } from "./domain/ocr";
import { AppState, Tab, useAppState } from "./store";
import { ShareApi, useShare } from "./share/useShare";
import ProfileSheet from "./ProfileSheet";
import { AccountApi, useAccount } from "./sync/useAccount";

type Patch = (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const toneOf = (rec: number, picked: number) =>
  rec === 0 ? { t: "Optional", c: picked ? "ok" : "" }
  : picked === rec ? { t: "On track", c: "ok" }
  : picked < rec ? { t: `Add ${rec - picked} more`, c: "need" }
  : { t: `+${picked - rec} extra`, c: "" };
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? " " + (m % 60) + " min" : ""}` : `${m} min`);
const meLabel = (name: string) => (name.trim() ? `${name.trim()} (you)` : "You");
const meInitial = (name: string) => (name.trim() ? name.trim()[0].toUpperCase() : "Y");
const isMe = (who: string, name: string) => !!name.trim() && who.trim().toLowerCase() === name.trim().toLowerCase();
/** Take a dish out of every selection and hand-off (used when deleting or hiding it). */
const forgetDish = (st: AppState, id: string): Partial<AppState> => {
  const bringers = Object.fromEntries(Object.entries(st.bringers).filter(([k]) => k !== bringKey("tg", id) && k !== bringKey("party", id)));
  const selTG = { ...st.selTG }, selP = { ...st.selP }; delete selTG[id]; delete selP[id];
  return { bringers, selTG, selP };
};
const toggleIn = (rec: Record<string, true>, k: string) => { const n = { ...rec }; if (n[k]) delete n[k]; else n[k] = true; return n; };

function Completed({ count, children }: { count: number; children: React.ReactNode }) {
  if (!count) return null;
  return <section className="card done"><details open><summary>Completed · {count}</summary>{children}</details></section>;
}

export default function App() {
  const [s, patch, replace] = useAppState();
  const account = useAccount(s, replace);
  const [showProfile, setShowProfile] = useState(false);
  const d = derive(s);
  const share = useShare(s, d, patch);
  const [detail, setDetail] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { document.documentElement.dataset.mode = s.mode; }, [s.mode]);

  const gTotal = d.grocery.reduce((n, g) => n + g.items.length, 0);
  const gGot = d.grocery.reduce((n, g) => n + g.items.filter((i) => s.got[i.key]).length, 0);
  const planKeys = [...d.planDays.flatMap((p) => p.tasks), ...d.dayOf].map((t) => s.mode + ":" + t.id);
  const pDone = planKeys.filter((k) => s.done[k]).length;
  const titles: Record<Tab, [string, string]> = {
    home: ["Serves Twenty", "Plan the feast, shop once, cook calmly."],
    menu: ["Menu", `${d.chosen.length} dishes picked`],
    shop: ["Groceries", `${gTotal - gGot} of ${gTotal} left to grab`],
    plan: ["Cooking plan", `${pDone} of ${planKeys.length} tasks done`],
    notes: ["Notes", "What worked, what to change"],
  };
  const go = (tab: Tab) => { setDetail(null); setShowForm(false); patch({ tab }); };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Logo size={40} />
          <div><h1>{s.tab === "home" ? <Wordmark /> : titles[s.tab][0]}</h1><p>{titles[s.tab][1]}</p></div>
        </div>
        <div className="row" style={{ gap: 8, flex: "none" }}>
          <button className="avatar-btn" aria-label="Your profile" onClick={() => setShowProfile(true)}>{(s.profile.name.trim() || account.email || "").charAt(0).toUpperCase() || "👤"}</button>
          <span className="pill">{s.adults + s.kids} guests</span></div>
      </header>
      <main>
        {s.tab === "home" && <Home s={s} d={d} patch={patch} share={share} account={account} openProfile={() => setShowProfile(true)} />}
        {s.tab === "menu" && <Menu s={s} d={d} patch={patch} share={share} open={setDetail} openForm={() => setShowForm(true)} />}
        {s.tab === "shop" && <Shop s={s} d={d} patch={patch} />}
        {s.tab === "plan" && <Plan s={s} d={d} patch={patch} share={share} />}
        {s.tab === "notes" && <Notes s={s} d={d} patch={patch} goHome={() => go("home")} />}
      </main>
      <nav className="tabs" aria-label="Sections">
        {([["home", "Home"], ["menu", "Menu"], ["shop", "Groceries"], ["plan", "Plan"], ["notes", "Notes"]] as const).map(([k, l]) => (
          <button key={k} aria-pressed={s.tab === k} onClick={() => go(k)}><TabIcon name={k} />{l}</button>
        ))}
      </nav>
      {detail && <DetailSheet id={detail} s={s} d={d} patch={patch} close={() => setDetail(null)} />}
      {showProfile && <ProfileSheet account={account} s={s} patch={patch} close={() => setShowProfile(false)} />}
      {showForm && <FormSheet s={s} d={d} patch={patch} close={() => setShowForm(false)} />}
    </div>
  );
}

function Stepper({ id, label, value, min, onChange }: { id: string; label: string; value: number; min: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(min, Math.min(80, n));
  return (
    <div className="row"><label className="label" htmlFor={id}>{label}</label>
      <div className="row" style={{ gap: 8 }}>
        <button className="round" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - 1))}>−</button>
        <input id={id} className="num" type="number" min={min} max={80} value={value}
          onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onChange(clamp(v)); }} />
        <button className="round" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + 1))}>+</button>
      </div></div>);
}

function ShareCard({ share }: { share: ShareApi }) {
  const [copied, setCopied] = useState(false);
  if (!share.enabled) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(share.url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy this link", share.url); } };
  const send = () => (navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> }).share?.({ title: "Serves Twenty menu", url: share.url }).catch(() => {});
  return (
    <section className="card" aria-label="Share with guests">
      <div><h2>Share with guests</h2>
        <p className="sub">{share.share ? "Anyone with this link can see the menu and amounts and sign up to bring a dish. Only you can change the menu." : "Send guests a link so they can see the menu and tell you what they’ll bring. Your notes stay private."}</p></div>
      {share.share ? <>
        <input className="num" style={{ width: "100%", textAlign: "left", padding: "0 12px", fontSize: 16 }} readOnly aria-label="Share link" value={share.url} onFocus={(e) => e.target.select()} />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
          {"share" in navigator && <button className="btn ghost" style={{ flex: 1 }} onClick={send}>Send…</button>}</div>
        <p className="sub" style={{ margin: 0 }} role="status">{share.status === "saving" ? "Updating the shared menu…" : "Shared menu is up to date"}{share.claimCount ? ` · ${share.claimCount} sign-up${share.claimCount === 1 ? "" : "s"}` : ""}</p>
        <button className="btn danger" disabled={share.busy} onClick={share.stop}>Stop sharing</button></>
        : <button className="btn" disabled={share.busy} onClick={share.create}>{share.busy ? "Creating link…" : "Create a share link"}</button>}
      {share.error && <p className="err" role="alert">{share.error}</p>}
    </section>);
}

function Home({ s, d, patch, share, account, openProfile }: { s: AppState; d: Derived; patch: Patch; share: ShareApi; account: AccountApi; openProfile: () => void }) {
  const isTG = s.mode === "tg";
  const times = isTG ? [12, 13, 14, 15, 16, 17, 18] : [12, 14, 17, 18, 19, 20];
  const serve = isTG ? s.dinnerTG : s.partyTime;
  const total = s.adults + s.kids;
  const pies = d.chosen.filter((r) => r.noun?.[0] === "pie").reduce((a, r) => a + d.scale(r).mult, 0);
  const dateStr = isTG ? s.tgDate : s.partyDate, date = parseISO(dateStr);
  const over = isEventOver(dateStr, serve);
  const until = date ? daysUntil(date) : null;
  const countdown = until === null ? "" : over ? "This one’s done. Add your notes!" : until > 1 ? `${until} days to go` : until === 1 ? "Tomorrow!" : until === 0 ? "Today!" : "";
  const setPartyDate = (v: string) => patch((st) => {
    // Picking a new date after the last party is over starts fresh checklists.
    const stale = isEventOver(st.partyDate, st.partyTime) && v !== st.partyDate;
    return stale ? { partyDate: v, got: Object.fromEntries(Object.entries(st.got).filter(([k]) => !k.startsWith("g:party:"))), done: Object.fromEntries(Object.entries(st.done).filter(([k]) => !k.startsWith("party:"))) } : { partyDate: v };
  });
  const note = isTG ? `For ${total} guests${pies ? ` · ${pies} ${pies === 1 ? "pie" : "pies"} total` : ""}`
    : s.partyStyle === "apps" ? "Plan on 10–12 bites per guest" : "A hearty main plus easy sides";
  return (<>
    <AccountRow s={s} account={account} open={openProfile} />
    <div className="seg" role="group" aria-label="Planner mode">
      <button aria-pressed={isTG} onClick={() => patch({ mode: "tg" })}>Thanksgiving</button>
      <button aria-pressed={!isTG} onClick={() => patch({ mode: "party" })}>Party</button>
    </div>
    {over && <section className="card" aria-label="Notes prompt"><h2>How did it go?</h2><p className="sub">Mark each dish a hit or a miss and jot notes for next time.</p><button className="btn" onClick={() => patch({ tab: "notes" })}>Add notes</button></section>}
    <section className="hero" aria-label="Your event">
      <div><p className="kicker">{isTG ? `Thanksgiving · ${date ? fmtDate(date) : ""}` : date ? `Party · ${fmtDate(date)}` : "Party planner"}</p>
        <h2>{isTG ? `Dinner for ${total}` : `${s.partyStyle === "apps" ? "Snacks & apps for " : "A party for "}${total}`}</h2>
        {s.kids > 0 && <p className="sub" style={{ margin: "4px 0 0" }}>{s.adults} adult{s.adults === 1 ? "" : "s"} + {s.kids} kid{s.kids === 1 ? "" : "s"} (kids count as {KID_FACTOR === 0.5 ? "half a portion" : "a smaller portion"})</p>}
        {countdown && <p className="sub" style={{ margin: "4px 0 0", fontWeight: 800 }}>{countdown}</p>}</div>
      {!isTG && <div className="field"><label htmlFor="pdate">When’s the party?</label>
        <input id="pdate" type="date" value={s.partyDate} onChange={(e) => setPartyDate(e.target.value)} />
        {!s.partyDate && <p className="sub" style={{ margin: 0 }}>Add the date to get dated reminders on your plan and a place for notes afterward.</p>}</div>}
      <Stepper id="adults" label="Adults" value={s.adults} min={1} onChange={(adults) => patch({ adults })} />
      <Stepper id="kids" label="Kids" value={s.kids} min={0} onChange={(kids) => patch({ kids })} />
      <div className="stack" style={{ gap: 8 }}><span className="label">{isTG ? "Dinner at" : "Party starts at"}</span>
        <div className="chips" role="group">{times.map((h) => (
          <button key={h} className="chip" aria-pressed={serve === h * 60} onClick={() => patch(isTG ? { dinnerTG: h * 60 } : { partyTime: h * 60 })}>{hourLabel(h * 60)}</button>))}</div></div>
      {!isTG && <div className="stack" style={{ gap: 8 }}><span className="label">What kind of party?</span>
        <div className="chips">{([["apps", "Snacks & apps"], ["meal", "Full meal"]] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={s.partyStyle === k} onClick={() => patch({ partyStyle: k })}>{l}</button>))}</div></div>}
      <button className="switch" aria-pressed={s.leftovers} onClick={() => patch({ leftovers: !s.leftovers })}>
        Hungry crowd / want leftovers<span className="track" aria-hidden="true"><span className="knob" /></span></button>
    </section>
    <section className="card" aria-label="Suggested dishes">
      <div><h2>We suggest</h2><p className="sub">{note}</p></div>
      <div className="recs">{d.cats.map((c) => { const r = d.rec(c.key), t = toneOf(r, d.counts[c.key] || 0); return (
        <div className="rec" key={c.key}><b className="n">{r}</b><div className="stack" style={{ gap: 2 }}><span style={{ fontWeight: 800, fontSize: 14 }}>{c.label}</span><span className={"tag " + t.c}>{t.t}</span></div></div>); })}</div>
    </section>
    {d.turkey && <section className="card" aria-label="Turkey"><h2>Turkey: {d.turkey.headline}</h2>
      <p className="sub">{d.turkey.thaw}</p><p className="sub">{d.turkey.roast}</p>
      {d.turkey.twoBirds && <p className="sub">Two birds: roast side by side, or one at a time if your oven is small.</p>}</section>}
    <button className="btn" onClick={() => patch({ tab: "menu" })}>Pick your menu</button>
    <ShareCard share={share} />
  </>);
}

function Menu({ s, d, patch, share, open, openForm }: { s: AppState; d: Derived; patch: Patch; share: ShareApi; open: (id: string) => void; openForm: () => void }) {
  const key = selKeyOf(s.mode);
  const evKey = eventKey(s.mode, s.mode === "tg" ? s.tgDate : s.partyDate);
  const [undo, setUndo] = useState<{ text: string; run: () => void } | null>(null);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 7000); return () => clearTimeout(t); }, [undo]);
  /** Delete a dish from the list. Your own recipes are deleted for good (after a confirm); built-ins are hidden and can be restored. */
  const removeFromList = (x: Dish): boolean | void => {
    if (x.custom) {
      if (!window.confirm(`Delete “${x.name}”? This removes the recipe and its notes for good.`)) return false;
      patch((st) => ({ ...forgetDish(st, x.id), custom: st.custom.filter((c) => c.id !== x.id), reviews: st.reviews.filter((r) => r.dishId !== x.id) }));
      return;
    }
    const was = { tg: !!s.selTG[x.id], p: !!s.selP[x.id], bTG: s.bringers[bringKey("tg", x.id)], bP: s.bringers[bringKey("party", x.id)] };
    patch((st) => ({ ...forgetDish(st, x.id), hidden: { ...st.hidden, [x.id]: true } }));
    setUndo({ text: `Removed “${x.name}”`, run: () => patch((st) => {
      const hidden = { ...st.hidden }; delete hidden[x.id];
      const bringers = { ...st.bringers };
      if (was.bTG) bringers[bringKey("tg", x.id)] = was.bTG;
      if (was.bP) bringers[bringKey("party", x.id)] = was.bP;
      return { hidden, bringers, selTG: was.tg ? { ...st.selTG, [x.id]: true } : st.selTG, selP: was.p ? { ...st.selP, [x.id]: true } : st.selP };
    }) });
  };
  const hiddenDishes = LIB.filter((r) => r.modes.includes(s.mode)).concat(s.custom.filter((c) => c.mode === s.mode)).filter((r) => s.hidden[r.id]);
  const toggle = (id: string) => patch((st) => ({ [key]: toggleIn(st[key], id) }) as Partial<AppState>);
  return (<>
    <button className="btn dashed" onClick={openForm}>+ Add your own recipe</button>
    <Overview s={s} d={d} />
    <p className="sub" style={{ margin: "-6px 4px 0" }}>Tip: swipe a dish left to remove it.</p>
    {d.cats.map((c) => { const r = d.rec(c.key), t = toneOf(r, d.counts[c.key] || 0); return (
      <section key={c.key} aria-label={c.label}>
        <div className="catHead"><div><h2 style={{ fontSize: 20 }}>{c.label}</h2><p className="sub">{r ? `Pick ${r}${c.hint ? " · " + c.hint : ""}` : c.hint || "Optional for this kind of party"}</p></div><span className={"tag " + t.c}>{t.t}</span></div>
        <div className="stack" style={{ gap: 10 }}>{d.all.filter((x) => x.cat === c.key).map((x) => { const on = !!s[key][x.id], who = d.bringerOf(x); return (
          <SwipeRow key={x.id} label={x.custom ? "Delete" : "Remove"} onRemove={() => removeFromList(x)}>
          <div className={"dish" + (on ? " on" : "")}>
            <button className="pick" aria-pressed={on} onClick={() => toggle(x.id)}>
              <span className="check">{on && <Check />}</span>
              <span className="stack" style={{ gap: 4 }}><b style={{ fontSize: 16 }}>{x.name}</b><span className="sub" style={{ margin: 0 }}>{x.meta}</span>
                {on && <span className="badge">{d.scale(x).badge}</span>}{on && who && <span className="tag ok">{who} is bringing it</span>}
                {(() => { const lv = latestFor(s.reviews, x.id, evKey); const v = VERDICTS.find((q) => q.key === lv?.verdict); return v ? <span className="tag">{v.emoji} {v.label} last time</span> : null; })()}</span>
            </button>
            <button className="info" aria-label={`Details for ${x.name}`} onClick={() => open(x.id)}>›</button>
          </div></SwipeRow>); })}</div>
      </section>); })}
    {undo && <div className="toast" role="status"><span>{undo.text}</span><button onClick={() => { undo.run(); setUndo(null); }}>Undo</button></div>}
    <Extras s={s} d={d} patch={patch} share={share} />
    {!!hiddenDishes.length && <section className="card done"><details><summary>Hidden dishes · {hiddenDishes.length}</summary>
      {hiddenDishes.map((x) => <div className="row" key={x.id} style={{ padding: "6px 0" }}><span>{x.name}</span>
        <button className="chip" onClick={() => patch((st) => { const h = { ...st.hidden }; delete h[x.id]; return { hidden: h }; })}>Restore</button></div>)}
    </details></section>}
  </>);
}

function Shop({ s, d, patch }: { s: AppState; d: Derived; patch: Patch }) {
  if (!d.grocery.length) return <p className="empty">Pick some dishes and your list shows up here.</p>;
  const flip = (k: string) => patch((st) => ({ got: toggleIn(st.got, k) }));
  const todo = d.grocery.map((g) => ({ ...g, items: g.items.filter((i) => !s.got[i.key]) })).filter((g) => g.items.length);
  const got = d.grocery.flatMap((g) => g.items.filter((i) => s.got[i.key]));
  return (<>
    {todo.map((g) => (
      <section className="card" key={g.section} aria-label={g.label}>
        <h2>{g.label} <span className="sub">· {g.items.length}</span></h2>
        <div>{g.items.map((i) => (
          <button key={i.key} className="item" aria-pressed={false} onClick={() => flip(i.key)}>
            <span className="box" />
            <span className="txt"><b>{i.buy}</b> {i.name}<small>{i.need ? `Recipes need ${i.need} · ` : ""}For {i.used.join(", ")}</small></span></button>))}</div>
      </section>))}
    {!todo.length && <p className="empty">Everything's in the cart. 🎉</p>}
    <Completed count={got.length}>
      {got.map((i) => (
        <button key={i.key} className="item" aria-pressed={true} onClick={() => flip(i.key)}>
          <span className="box"><Check /></span><span className="txt"><b>{i.buy}</b> {i.name}</span></button>))}
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => patch({ got: {} })}>Uncheck everything</button>
    </Completed>
  </>);
}

function Plan({ s, d, patch, share }: { s: AppState; d: Derived; patch: Patch; share: ShareApi }) {
  const isDone = (id: string) => !!s.done[s.mode + ":" + id];
  const flip = (id: string) => patch((st) => ({ done: toggleIn(st.done, st.mode + ":" + id) }));
  const row = (id: string, text: string, on: boolean, lead?: React.ReactNode, tag?: string) => (
    <button key={id} className="item" aria-pressed={on} onClick={() => flip(id)}>
      {lead}<span className="box">{on && <Check />}</span><span className="txt">{text}{tag && <small>{tag}</small>}</span></button>);
  const before = s.planView === "before";
  const daysTodo = d.planDays.map((p) => ({ ...p, tasks: p.tasks.filter((t) => !isDone(t.id)) })).filter((p) => p.tasks.length);
  const dayTodo = d.dayOf.filter((t) => !isDone(t.id));
  const doneBefore = d.planDays.flatMap((p) => p.tasks.filter((t) => isDone(t.id)).map((t) => ({ ...t, day: p.label })));
  const doneDay = d.dayOf.filter((t) => isDone(t.id));
  const nothingLeft = before ? !daysTodo.length : !dayTodo.length;
  return (<>
    <div className="seg" role="group" aria-label="Plan view">
      <button aria-pressed={before} onClick={() => patch({ planView: "before" })}>Before</button>
      <button aria-pressed={!before} onClick={() => patch({ planView: "dayof" })}>{s.mode === "tg" ? "Turkey Day" : "Party day"}</button>
    </div>
    {before && daysTodo.map((p) => (
      <section className="card" key={p.daysBefore}><div><h2>{p.label}</h2>{p.sub && <p className="sub">{p.sub}</p>}</div>{p.tasks.map((t) => row(t.id, t.text, false))}</section>))}
    {!before && <>
      {d.ovenNote && <p className="sub" style={{ margin: 0 }}>{d.ovenNote}</p>}
      {!!dayTodo.length && <section className="card">{dayTodo.map((t) => row(t.id, t.text, false, <span className="time">{t.time}</span>, t.tag))}</section>}</>}
    {nothingLeft && <p className="empty">All caught up. 🎉</p>}
    <Completed count={before ? doneBefore.length : doneDay.length}>
      {before ? doneBefore.map((t) => row(t.id, t.text, true, undefined, t.day)) : doneDay.map((t) => row(t.id, t.text, true, <span className="time">{t.time}</span>, t.tag))}
    </Completed>
    <Potluck s={s} d={d} patch={patch} share={share} />
  </>);
}

function Notes({ s, d, patch, goHome }: { s: AppState; d: Derived; patch: Patch; goHome: () => void }) {
  const isTG = s.mode === "tg";
  const dateStr = isTG ? s.tgDate : s.partyDate, date = parseISO(dateStr);
  const key = eventKey(s.mode, dateStr);
  const over = isEventOver(dateStr, isTG ? s.dinnerTG : s.partyTime);
  const title = isTG ? "Thanksgiving" : "Your party";
  const setReview = (dish: Dish, change: { verdict?: Verdict; note?: string }) => patch((st) => {
    const cur = reviewFor(st.reviews, key, dish.id);
    const verdict = change.verdict !== undefined ? (change.verdict === cur?.verdict ? undefined : change.verdict) : cur?.verdict;
    const note = change.note !== undefined ? change.note : cur?.note ?? "";
    return { reviews: upsertReview(st.reviews, { eventKey: key, dishId: dish.id, dishName: dish.name, verdict, note }) };
  });
  const pastKeys = Array.from(new Set(s.reviews.map((r) => r.eventKey).concat(Object.keys(s.eventNotes).filter((k) => s.eventNotes[k])))).filter((k) => k !== key).sort().reverse();
  const label = (k: string) => { const dt = parseISO(dateOfKey(k)); return (k.startsWith("tg:") ? "Thanksgiving" : "Party") + (dt ? ` · ${fmtDate(dt)} ${dt.getFullYear()}` : ""); };
  return (<>
    <section className="hero" aria-label="This event">
      <div><p className="kicker">{title}{date ? ` · ${fmtDate(date)} ${date.getFullYear()}` : ""}</p>
        <h2>{over ? "How did it go?" : "Notes for next time"}</h2></div>
      <p className="sub" style={{ margin: 0 }}>{over ? "Mark each dish a hit, maybe or a miss, and add anything you’d change. You’ll see this next time you plan."
        : !isTG && !date ? "Add your party date on Home so these notes can be filed under the right event." : "Come back after the event, or jot notes any time."}</p>
      {!isTG && !date && <button className="btn" onClick={goHome}>Add the party date</button>}
    </section>
    {d.chosen.length === 0 && <p className="empty">Pick some dishes on the Menu first.</p>}
    {d.chosen.map((dish) => { const rv = reviewFor(s.reviews, key, dish.id); const who = d.bringerOf(dish); return (
      <section className="card" key={dish.id} aria-label={dish.name}>
        <div><h2 style={{ fontSize: 18 }}>{dish.name}</h2>{who && <p className="sub">{who} brought this</p>}</div>
        <div className="chips" role="group" aria-label={`Rate ${dish.name}`}>{VERDICTS.map((v) => (
          <button key={v.key} className="chip" aria-pressed={rv?.verdict === v.key} onClick={() => setReview(dish, { verdict: v.key })}>{v.emoji} {v.label}</button>))}</div>
        <textarea className="note" rows={2} aria-label={`Notes on ${dish.name}`} placeholder="Too sweet? Needed more time? Everyone asked for the recipe?" value={rv?.note ?? ""} onChange={(e) => setReview(dish, { note: e.target.value })} />
      </section>); })}
    <section className="card" aria-label="Overall notes"><h2 style={{ fontSize: 18 }}>Overall</h2>
      <textarea className="note" rows={3} aria-label="Overall notes" placeholder="How was the timing? Too much food? Who to invite next time?" value={s.eventNotes[key] ?? ""} onChange={(e) => patch((st) => ({ eventNotes: { ...st.eventNotes, [key]: e.target.value } }))} /></section>
    {!!pastKeys.length && <section className="card done"><h2 style={{ fontSize: 18 }}>Past events</h2>
      {pastKeys.map((k) => <details key={k}><summary>{label(k)}</summary>
        {s.eventNotes[k] && <p className="sub" style={{ margin: "6px 0" }}>{s.eventNotes[k]}</p>}
        {s.reviews.filter((r) => r.eventKey === k).map((r) => { const v = VERDICTS.find((q) => q.key === r.verdict); return <div key={r.id} className="pastnote"><b>{v ? v.emoji + " " : ""}{r.dishName}</b>{r.note && <span>{r.note}</span>}</div>; })}
      </details>)}</section>}
  </>);
}

/** Slim row at the top of Home: who you are and whether your plans are saved to your account. */
function AccountRow({ s, account, open }: { s: AppState; account: AccountApi; open: () => void }) {
  const name = s.profile.name.trim();
  const text = account.session
    ? `Hi, ${name || account.email}${account.status === "syncing" ? " · saving…" : account.status === "error" ? " · couldn’t save" : " · ✓ saved"}`
    : account.error ? account.error : name ? `Hi, ${name}` : account.enabled ? "Sign in to save your plans on every device" : "Add your name";
  return (
    <div className="row" style={{ padding: "0 4px", flex: "none" }}>
      <span className="sub" style={{ margin: 0, fontWeight: 800 }}>{text}</span>
      <button className="chip" style={{ minHeight: 36 }} onClick={open}>{account.session ? "Profile" : account.enabled ? "Sign in" : "Profile"}</button></div>);
}

/** Slide a row left to reveal Remove; slide far (or tap Remove) to delete it. A plain tap still works as a tap. */
function SwipeRow({ onRemove, label, children }: { onRemove: () => boolean | void; label: string; children: React.ReactNode }) {
  const [dx, setDx] = useState(0), [anim, setAnim] = useState(false);
  const start = useRef<{ x: number; y: number; base: number } | null>(null), dragging = useRef(false), moved = useRef(false);
  const REVEAL = 104, FAR = 150;
  const fire = () => { setAnim(true); setDx(-520); setTimeout(() => { if (onRemove() === false) { setAnim(true); setDx(0); } }, 170); };
  const down = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY, base: dx }; dragging.current = false; moved.current = false; setAnim(false); };
  const move = (e: React.PointerEvent) => {
    const st = start.current; if (!st) return;
    const ddx = e.clientX - st.x, ddy = e.clientY - st.y;
    if (!dragging.current) {
      if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy) * 1.5) { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
      else { if (Math.abs(ddy) > 10) start.current = null; return; }
    }
    moved.current = true;
    setDx(Math.min(0, Math.max(-280, st.base + ddx)));
  };
  const up = () => {
    start.current = null;
    if (!dragging.current) return;
    dragging.current = false; setAnim(true);
    if (dx < -FAR) fire(); else if (dx < -48) setDx(-REVEAL); else setDx(0);
  };
  // A drag shouldn't count as a tap; and tapping a revealed row just closes it.
  const tap = (e: React.MouseEvent) => {
    if (moved.current) { moved.current = false; e.preventDefault(); e.stopPropagation(); }
    else if (dx !== 0) { setAnim(true); setDx(0); e.preventDefault(); e.stopPropagation(); }
  };
  return (
    <div className="swipe">
      <button className="swipe-act" style={{ visibility: dx < 0 ? "visible" : "hidden" }} tabIndex={dx < 0 ? 0 : -1} aria-label={label} onClick={fire}>{label}</button>
      <div className="swipe-body" style={{ transform: `translateX(${dx}px)`, transition: anim ? "transform .18s ease" : "none" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={tap}>{children}</div>
    </div>);
}

/** Simple line icons for the bottom bar. */
function TabIcon({ name }: { name: Tab }) {
  const p = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "home": return <svg {...p}><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></svg>;
    case "menu": return <svg {...p}><path d="M7 3v6a2.5 2.5 0 0 0 5 0V3" /><path d="M9.5 3v18" /><path d="M17 21V3c-2.6 1.4-3.5 4.2-3.5 8v3H17" /></svg>;
    case "shop": return <svg {...p}><path d="M5 8h14l-1.2 12.2H6.2L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>;
    case "plan": return <svg {...p}><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 4.5V3.5h6v1" /><path d="m9 13.5 2 2 4-4.2" /></svg>;
    case "notes": return <svg {...p}><path d="M4 20l1-4.2L16.3 4.5a2.1 2.1 0 0 1 3 3L8 18.8 4 20Z" /><path d="m14.5 6.5 3 3" /></svg>;
  }
}

/** Everything at a glance: what you're making, and what each person is bringing. */
function Overview({ s, d }: { s: AppState; d: Derived }) {
  const people = Object.keys(d.bringing);
  const others = d.chosen.length - d.mine.length;
  const me = meLabel(s.profile.name);
  const row = (name: string, initial: string, items: string[], key: string) => (
    <div className="row" key={key} style={{ alignItems: "flex-start", justifyContent: "flex-start" }}>
      <span className="avatar">{initial}</span>
      <div className="stack" style={{ flex: 1, gap: 6 }}><b>{name}</b>
        <div className="pills">{items.map((t, i) => <span className="pill2" key={i}>{t}</span>)}</div></div>
    </div>);
  return (
    <section className="card" aria-label="Overview">
      <div><h2>Who’s bringing what</h2>
        <p className="sub">{`You’re making ${d.mine.length} of ${d.chosen.length} dishes`}{others ? ` · ${others} covered by others` : ""}{s.shares[s.mode] ? " · guests can still claim any of yours" : ""}</p></div>
      {row(me, meInitial(s.profile.name), [...d.mine.map((r) => r.short || r.name), ...d.mineExtras.map((x) => x.what)], "you")}
      {people.map((w) => row(w, w[0].toUpperCase(), d.bringing[w].map((x) => x.short), w))}
      {!people.length && <p className="sub" style={{ margin: 0 }}>Hand a dish to someone with the arrow on any dish, add an extra below, or share a link from Home so guests can sign up.</p>}
    </section>);
}

/** Things that aren't dishes: napkins, ice, drinks. Guests' extras appear here too. */
function Extras({ s, d, patch, share }: { s: AppState; d: Derived; patch: Patch; share: ShareApi }) {
  const [what, setWhat] = useState(""), [who, setWho] = useState("");
  const list = s.extras.filter((e) => e.mode === s.mode);
  const me = meLabel(s.profile.name);
  const add = () => {
    const t = what.trim(); if (!t) return;
    const n = who.trim().replace(/\s+/g, " ");
    patch((st) => {
      const name = n && !isMe(n, st.profile.name) ? st.people.find((p) => p.toLowerCase() === n.toLowerCase()) || n : "";
      return { extras: [...st.extras, { id: "x" + Date.now(), who: name, what: t, mode: st.mode }], people: name && !st.people.includes(name) ? [...st.people, name] : st.people };
    });
    setWhat(""); setWho("");
  };
  const remove = (e: AppState["extras"][number]) => {
    if (e.id.startsWith("sc-") && share.share) share.removeClaim({ claimId: e.id.slice(3) });
    else patch((st) => ({ extras: st.extras.filter((x) => x.id !== e.id) }));
  };
  void d;
  return (
    <section aria-label="Extras">
      <div className="catHead"><div><h2 style={{ fontSize: 20 }}>Extras</h2><p className="sub">Napkins, ice, drinks, anything that isn’t a dish</p></div></div>
      <div className="stack" style={{ gap: 8 }}>
        {list.map((e) => <div key={e.id} className="dish on" style={{ alignItems: "center", padding: "10px 14px", gap: 10 }}>
          <span className="stack" style={{ flex: 1, gap: 2 }}><b>{e.what}</b><span className="sub" style={{ margin: 0 }}>{e.who ? `${e.who} is bringing it` : `${me} ${s.profile.name.trim() ? "is" : "are"} bringing it`}</span></span>
          <button className="chip" style={{ minHeight: 36, padding: "0 12px" }} aria-label={`Remove ${e.what}`} onClick={() => remove(e)}>✕</button></div>)}
        {!list.length && <p className="sub" style={{ margin: 0 }}>Nothing yet.</p>}
        <div className="card" style={{ gap: 8, padding: 14 }}>
          <div className="field"><label htmlFor="ex-what">What</label><input id="ex-what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Napkins" /></div>
          <div className="field"><label htmlFor="ex-who">Who’s bringing it (blank = you)</label><input id="ex-who" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Aunt May" /></div>
          <button className="btn ghost" onClick={add} disabled={!what.trim()}>Add extra</button></div>
      </div>
    </section>);
}

function Potluck({ s, d, patch, share }: { s: AppState; d: Derived; patch: Patch; share: ShareApi }) {
  const [who, setWho] = useState(""), [what, setWhat] = useState(""), [err, setErr] = useState("");
  const names = Object.keys(d.bringing);
  const canon = (n: string) => { n = n.trim().replace(/\s+/g, " "); return s.people.find((p) => p.toLowerCase() === n.toLowerCase()) || n; };
  const add = () => {
    const w = canon(who), t = what.trim();
    if (!w || !t) { setErr("Add who’s bringing it and what it is."); return; }
    const mine = isMe(w, s.profile.name);
    patch((st) => ({ extras: [...st.extras, { id: "x" + Date.now(), who: mine ? "" : w, what: t, mode: st.mode }], people: mine || st.people.includes(w) ? st.people : [...st.people, w] }));
    setWhat(""); setErr("");
  };
  /** Remove one item. If a guest signed up for it, the sign-up is removed at the source so it doesn't come back. */
  const removeItem = (x: { dishId?: string; extraId?: string }, who: string) => {
    const guestDish = x.dishId && share.share && s.claimSync[bringKey(s.mode, x.dishId)] === who;
    const guestExtra = x.extraId && x.extraId.startsWith("sc-") && share.share;
    if (guestDish) share.removeClaim({ dishId: x.dishId });
    else if (guestExtra) share.removeClaim({ claimId: x.extraId!.slice(3) });
    else patch((st) => x.dishId
      ? { bringers: Object.fromEntries(Object.entries(st.bringers).filter(([k]) => k !== bringKey(st.mode, x.dishId!))) }
      : { extras: st.extras.filter((e) => e.id !== x.extraId) });
  };
  return (
    <section className="card" aria-label="Who's bringing what">
      <div><h2>Who’s bringing what</h2><p className="sub">{names.length ? `You’re making ${d.mine.length} dishes · ${names.length} pitching in. Their dishes are off your grocery list.` : "Open any dish on the Menu (tap the arrow) to hand it off to someone."}</p></div>
      {names.map((w) => (<div key={w} className="row" style={{ alignItems: "flex-start", justifyContent: "flex-start" }}>
        <span className="avatar">{w[0].toUpperCase()}</span>
        <div className="stack" style={{ flex: 1 }}><b>{w}</b>{d.bringing[w].map((x, j) => (
          <div key={j} className="row"><span style={{ fontSize: 14 }}>{x.text}</span>
            <button className="chip" style={{ minHeight: 32, padding: "0 10px" }} aria-label={`Remove ${x.short}`} onClick={() => removeItem(x, w)}>✕</button></div>))}</div>
      </div>))}
      {!!d.mineExtras.length && <div className="row" style={{ alignItems: "flex-start", justifyContent: "flex-start" }}>
        <span className="avatar">{meInitial(s.profile.name)}</span>
        <div className="stack" style={{ flex: 1 }}><b>{meLabel(s.profile.name)}</b>{d.mineExtras.map((x) => (
          <div key={x.id} className="row"><span style={{ fontSize: 14 }}>{x.what}</span>
            <button className="chip" style={{ minHeight: 32, padding: "0 10px" }} aria-label={`Remove ${x.what}`} onClick={() => patch((st) => ({ extras: st.extras.filter((e) => e.id !== x.id) }))}>✕</button></div>))}</div>
      </div>}
      <div className="field"><label htmlFor="exwho">Who</label><input id="exwho" value={who} onChange={(e) => { setWho(e.target.value); setErr(""); }} placeholder="Aunt May" /></div>
      <div className="field"><label htmlFor="exwhat">Bringing</label><input id="exwhat" value={what} onChange={(e) => { setWhat(e.target.value); setErr(""); }} placeholder="Wine, ice, paper plates…" /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn ghost" onClick={add}>Add</button>
    </section>);
}

function DetailSheet({ id, s, d, patch, close }: { id: string; s: AppState; d: Derived; patch: Patch; close: () => void }) {
  const r = d.all.find((x) => x.id === id);
  const [name, setName] = useState("");
  if (!r) return null;
  const key = selKeyOf(s.mode), on = !!s[key][r.id], sc = d.scale(r), cur = d.bringerOf(r);
  const assign = (who: string) => patch((st) => {
    const b = { ...st.bringers }, k = bringKey(st.mode, r.id);
    if (who) b[k] = who; else delete b[k];
    const p: Partial<AppState> = { bringers: b };
    if (who) { p.people = st.people.includes(who) ? st.people : [...st.people, who]; p[key] = { ...st[key], [r.id]: true }; }
    return p;
  });
  const toggle = () => patch((st) => ({ [key]: toggleIn(st[key], r.id) }) as Partial<AppState>);
  const addNew = () => { const n = name.trim().replace(/\s+/g, " "); if (!n) return; assign(s.people.find((p) => p.toLowerCase() === n.toLowerCase()) || n); setName(""); };
  const steps = [
    ...r.ahead.map((a) => `${d.dayLabel(a[0])}: ${a[1]}`),
    ...[...r.day].sort((a, b) => b[0] - a[0]).map((a) => `${a[0] >= 0 ? fmtMin(a[0]) + " before serving" : fmtMin(-a[0]) + " after sitting down"}: ${a[1]}`),
  ];
  const past = s.reviews.filter((x) => x.dishId === r.id).sort((a, b) => b.updated.localeCompare(a.updated));
  const forget = (st: AppState): Partial<AppState> => forgetDish(st, r.id);
  const remove = () => {
    if (r.custom) {
      if (!window.confirm(`Delete “${r.name}”? This removes the recipe and its notes for good.`)) return;
      patch((st) => ({ ...forget(st), custom: st.custom.filter((c) => c.id !== r.id), reviews: st.reviews.filter((x) => x.dishId !== r.id) }));
    } else patch((st) => ({ ...forget(st), hidden: { ...st.hidden, [r.id]: true } }));
    close();
  };
  return (
    <div className="sheet" onClick={close}><div role="dialog" aria-label={r.name} onClick={(e) => e.stopPropagation()}>
      <div className="row"><h2>{r.name}</h2><button className="round" aria-label="Close" onClick={close}>✕</button></div>
      <p className="sub" style={{ margin: 0 }}>{r.blurb}</p>
      <span className="badge">{sc.badge}</span>
      <p className="sub" style={{ margin: 0 }}>{r.serves ? `Recipe serves ${r.serves} · ${r.meta}` : r.meta}</p>
      <div>{r.ing.map((x, i) => <div className="ing" key={i}><b>{cookText(x[1] * sc.mult, x[2], x[0])}</b><span>{x[0]}</span></div>)}</div>
      {!!r.directions?.length && <div><span className="label">Directions</span><ol className="steps">{r.directions.map((t, i) => <li key={i}>{t}</li>)}</ol></div>}
      {!!steps.length && <div><span className="label">{r.directions?.length ? "On your timeline" : "Steps & timing"}</span><ol className="steps">{steps.map((t, i) => <li key={i}>{t}</li>)}</ol></div>}
      {!!past.length && <div><span className="label">Your notes from past events</span>
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>{past.map((x) => { const v = VERDICTS.find((q) => q.key === x.verdict), dt = parseISO(dateOfKey(x.eventKey));
          return <div key={x.id} className="pastnote"><b>{v ? `${v.emoji} ${v.label}` : "Note"}{dt ? ` · ${fmtDate(dt)} ${dt.getFullYear()}` : ""}</b>{x.note && <span>{x.note}</span>}</div>; })}</div></div>}
      <div className="stack" style={{ gap: 8 }}><span className="label">Who’s making it?</span>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {[{ l: s.profile.name.trim() ? `${s.profile.name.trim()} (me)` : "Me", v: "" }, ...s.people.map((p) => ({ l: p, v: p }))].map((o) => <button key={o.v || "me"} className="chip" aria-pressed={cur === o.v} onClick={() => assign(o.v)}>{o.l}</button>)}</div>
        <div className="row"><input className="num" style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "0 12px", fontSize: 16 }} aria-label="Add a person" placeholder="Add a person…" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn ghost" onClick={addNew}>Assign</button></div>
        {cur && <p className="sub" style={{ margin: 0 }}>{cur} is on it. This dish is off your grocery list and cooking plan, so send {cur} the amounts above.</p>}</div>
      <button className={on ? "btn ghost" : "btn"} onClick={toggle}>{on ? "Remove from menu" : "Add to menu"}</button>
      <button className="btn danger" onClick={remove}>{r.custom ? "Delete this recipe" : "Hide from my list"}</button>
    </div></div>);
}

function FormSheet({ s, d, patch, close }: { s: AppState; d: Derived; patch: Patch; close: () => void }) {
  const catKeys = d.cats.map((c) => c.key);
  const [f, setF] = useState({ name: "", cat: catKeys.includes("sides") ? "sides" : catKeys[0], serves: "8", prep: "", cook: "", makeAhead: false, lines: "", steps: "" });
  const [paste, setPaste] = useState(""), [err, setErr] = useState(""), [note, setNote] = useState("");
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setErr(""); };
  const [busy, setBusy] = useState("");
  const sortText = (text: string) => {
    const r = parseRecipeText(cleanOcr(text), catKeys);
    setF({ name: r.name, cat: r.cat, serves: String(r.serves ?? (f.serves || 8)), prep: r.prep ? String(r.prep) : "", cook: r.cook ? String(r.cook) : "", makeAhead: f.makeAhead, lines: r.ingredients.join("\n"), steps: numberSteps(r.directions.join("\n")) });
    const missing = [!r.ingredients.length && "ingredients", !r.directions.length && "directions", !(r.prep || r.cook) && "prep/cook times"].filter(Boolean);
    setNote(missing.length ? `Sorted. I couldn’t find ${missing.join(", ")}, so please check below.` : "Sorted. Give it a quick look, then save.");
    setErr("");
  };
  const sortOut = () => { if (!paste.trim()) { setNote("Paste a recipe first."); return; } sortText(paste); };
  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setNote(""); setErr(""); setBusy("Reading the photo…");
    try {
      const text = await extractRecipeText(file, (pct, status) => setBusy(`${status === "recognizing text" ? "Reading the photo" : "Getting ready"}… ${pct}%`));
      if (text.replace(/\s/g, "").length < 20) setNote("I couldn’t read much text in that photo. Try a sharper, straight-on picture, or paste the text.");
      else { setPaste(text); sortText(text); setNote((n) => n + " (Read from your photo, so double-check amounts.)"); }
    } catch {
      setNote("Couldn’t read that photo. Check your connection (the reader downloads once), or paste the text instead.");
    } finally { setBusy(""); }
  };
  const save = () => {
    const name = f.name.trim(), lines = f.lines.split("\n").map((x) => x.trim()).filter(Boolean);
    const prep = Math.max(0, parseInt(f.prep, 10) || 0), cook = Math.max(0, parseInt(f.cook, 10) || 0);
    if (!name) return setErr("Give your recipe a name.");
    if (!lines.length) return setErr("Add at least one ingredient line.");
    if (!prep && !cook) return setErr("Add a prep or cook time so it can go on the timeline.");
    const rec: Dish = buildCustomDish({ name, cat: f.cat, mode: s.mode, serves: parseInt(f.serves, 10) || 4, prep, cook, makeAhead: f.makeAhead, ingredients: lines, directions: stepList(f.steps) });
    const key = selKeyOf(s.mode);
    patch((st) => ({ custom: [...st.custom, rec], [key]: { ...st[key], [rec.id]: true } }) as Partial<AppState>);
    close();
  };
  return (
    <div className="sheet" onClick={close}><div role="dialog" aria-label="Add your own recipe" onClick={(e) => e.stopPropagation()}>
      <div className="row"><h2>Add your own recipe</h2><button className="round" aria-label="Close" onClick={close}>✕</button></div>
      <div className="field"><label htmlFor="rp">Paste a whole recipe</label>
        <textarea id="rp" rows={4} placeholder="Paste the title, ingredients and directions here and tap Sort it out" value={paste} onChange={(e) => { setPaste(e.target.value); setNote(""); }} />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={sortOut} disabled={!!busy}>Sort it out</button>
          <label className="btn ghost photo" aria-disabled={!!busy}>Use a photo
            <input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => { fromPhoto(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
        {busy && <p className="sub" style={{ margin: 0 }} role="status">{busy}</p>}
        {note && <p className="sub" style={{ margin: 0 }} role="status">{note}</p>}</div>
      <div className="field"><label htmlFor="rn">Name</label><input id="rn" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="chips" style={{ flexWrap: "wrap" }}>{d.cats.map((c) => <button key={c.key} className="chip" aria-pressed={f.cat === c.key} onClick={() => set({ cat: c.key })}>{c.label}</button>)}</div>
      <div className="row3">
        <div className="field"><label htmlFor="rs">Serves</label><input id="rs" inputMode="numeric" value={f.serves} onChange={(e) => set({ serves: e.target.value })} /></div>
        <div className="field"><label htmlFor="rpre">Prep (min)</label><input id="rpre" inputMode="numeric" value={f.prep} onChange={(e) => set({ prep: e.target.value })} /></div>
        <div className="field"><label htmlFor="rck">Cook (min)</label><input id="rck" inputMode="numeric" value={f.cook} onChange={(e) => set({ cook: e.target.value })} /></div>
      </div>
      <button className="switch" aria-pressed={f.makeAhead} onClick={() => set({ makeAhead: !f.makeAhead })}>
        Prep it the day before<span className="track" aria-hidden="true"><span className="knob" /></span></button>
      <div className="field"><label htmlFor="rl">Ingredients, one per line</label><textarea id="rl" rows={5} placeholder={"2 lb potatoes\n1/2 cup butter\n1 tsp salt"} value={f.lines} onChange={(e) => set({ lines: e.target.value })} /></div>
      <div className="field"><label htmlFor="rd">Directions, one step per line (numbered for you)</label><textarea id="rd" rows={5} placeholder={"1. Peel and cube the potatoes\n2. Boil 20 minutes, then drain and mash"} value={f.steps} onChange={(e) => set({ steps: e.target.value })} onBlur={() => setF((cur) => ({ ...cur, steps: numberSteps(cur.steps) }))} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" onClick={save}>Save & add to menu</button>
    </div></div>);
}
