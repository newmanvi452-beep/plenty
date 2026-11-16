import { useEffect, useState } from "react";
import { Dish } from "./domain/data";
import { hourLabel } from "./domain/format";
import { bringKey, cookText, derive, parseLine, selKeyOf, Derived } from "./domain/planner";
import { AppState, Tab, useAppState } from "./store";

type Patch = (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const toneOf = (rec: number, picked: number) =>
  rec === 0 ? { t: "Optional", c: picked ? "ok" : "" }
  : picked === rec ? { t: "On track", c: "ok" }
  : picked < rec ? { t: `Add ${rec - picked} more`, c: "need" }
  : { t: `+${picked - rec} extra`, c: "" };

export default function App() {
  const [s, patch] = useAppState();
  const d = derive(s);
  const [detail, setDetail] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { document.documentElement.dataset.mode = s.mode; }, [s.mode]);

  const gTotal = d.grocery.reduce((n, g) => n + g.items.length, 0);
  const gGot = d.grocery.reduce((n, g) => n + g.items.filter((i) => s.got[i.key]).length, 0);
  const planKeys = [...d.planDays.flatMap((p) => p.tasks), ...d.dayOf].map((t) => s.mode + ":" + t.id);
  const pDone = planKeys.filter((k) => s.done[k]).length;
  const titles: Record<Tab, [string, string]> = {
    home: ["Plenty", "Plan the feast, shop once, cook calmly."],
    menu: ["Menu", `${d.chosen.length} dishes picked`],
    shop: ["Groceries", `${gTotal - gGot} of ${gTotal} left to grab`],
    plan: ["Cooking plan", `${pDone} of ${planKeys.length} tasks done`],
  };
  const go = (tab: Tab) => { setDetail(null); setShowForm(false); patch({ tab }); };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg width="40" height="40" viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="28" fill="var(--soft)" /><path d="M17 41c0-13 9-22 25-24-1 15-10 24-25 24z" fill="var(--mid)" /><path d="M17 41l16-16" stroke="var(--deep)" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
          <div><h1>{titles[s.tab][0]}</h1><p>{titles[s.tab][1]}</p></div>
        </div>
        <span className="pill">{s.guests} guests</span>
      </header>
      <main>
        {s.tab === "home" && <Home s={s} d={d} patch={patch} />}
        {s.tab === "menu" && <Menu s={s} d={d} patch={patch} open={setDetail} openForm={() => setShowForm(true)} />}
        {s.tab === "shop" && <Shop s={s} d={d} patch={patch} />}
        {s.tab === "plan" && <Plan s={s} d={d} patch={patch} />}
      </main>
      <nav className="tabs" aria-label="Sections">
        {([["home", "Home", "⌂"], ["menu", "Menu", "☰"], ["shop", "Groceries", "🛒"], ["plan", "Plan", "✓"]] as const).map(([k, l, i]) => (
          <button key={k} aria-pressed={s.tab === k} onClick={() => go(k)}><span aria-hidden="true" style={{ fontSize: 20 }}>{i}</span>{l}</button>
        ))}
      </nav>
      {detail && <DetailSheet id={detail} s={s} d={d} patch={patch} close={() => setDetail(null)} />}
      {showForm && <FormSheet s={s} d={d} patch={patch} close={() => setShowForm(false)} />}
    </div>
  );
}

function Home({ s, d, patch }: { s: AppState; d: Derived; patch: Patch }) {
  const isTG = s.mode === "tg";
  const times = isTG ? [12, 13, 14, 15, 16, 17, 18] : [12, 14, 17, 18, 19, 20];
  const serve = isTG ? s.dinnerTG : s.partyTime;
  const pies = d.chosen.filter((r) => r.noun?.[0] === "pie").reduce((a, r) => a + d.scale(r).mult, 0);
  const note = isTG ? `For ${s.guests} guests${pies ? ` · ${pies} ${pies === 1 ? "pie" : "pies"} total` : ""}`
    : s.partyStyle === "apps" ? "Plan on 10–12 bites per guest" : "A hearty main plus easy sides";
  return (<>
    <div className="seg" role="group" aria-label="Planner mode">
      <button aria-pressed={isTG} onClick={() => patch({ mode: "tg" })}>Thanksgiving</button>
      <button aria-pressed={!isTG} onClick={() => patch({ mode: "party" })}>Party</button>
    </div>
    <section className="hero" aria-label="Your event">
      <div><p className="kicker">{isTG ? "Thanksgiving · Thu, Nov 26" : "Party planner"}</p>
        <h2>{isTG ? `Dinner for ${s.guests}` : `${s.partyStyle === "apps" ? "Snacks & apps for " : "A party for "}${s.guests}`}</h2></div>
      <div className="row"><label className="label" htmlFor="guests">Guests</label>
        <div className="row" style={{ gap: 8 }}>
          <button className="round" aria-label="Fewer guests" onClick={() => patch({ guests: Math.max(1, s.guests - 1) })}>−</button>
          <input id="guests" className="num" type="number" min={1} max={80} value={s.guests}
            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) patch({ guests: Math.max(1, Math.min(80, v)) }); }} />
          <button className="round" aria-label="More guests" onClick={() => patch({ guests: Math.min(80, s.guests + 1) })}>+</button>
        </div></div>
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
  </>);
}

function Menu({ s, d, patch, open, openForm }: { s: AppState; d: Derived; patch: Patch; open: (id: string) => void; openForm: () => void }) {
  const key = selKeyOf(s.mode);
  const toggle = (id: string) => patch((st) => { const cur = { ...st[key] }; if (cur[id]) delete cur[id]; else cur[id] = true; return { [key]: cur } as Partial<AppState>; });
  return (<>
    {d.cats.map((c) => { const r = d.rec(c.key), t = toneOf(r, d.counts[c.key] || 0); return (
      <section key={c.key} aria-label={c.label}>
        <div className="catHead"><div><h2 style={{ fontSize: 20 }}>{c.label}</h2><p className="sub">{r ? `Pick ${r}${c.hint ? " · " + c.hint : ""}` : c.hint || "Optional for this kind of party"}</p></div><span className={"tag " + t.c}>{t.t}</span></div>
        <div className="stack" style={{ gap: 10 }}>{d.all.filter((x) => x.cat === c.key).map((x) => { const on = !!s[key][x.id], who = d.bringerOf(x); return (
          <div key={x.id} className={"dish" + (on ? " on" : "")}>
            <button className="pick" aria-pressed={on} onClick={() => toggle(x.id)}>
              <span className="check">{on && <Check />}</span>
              <span className="stack" style={{ gap: 4 }}><b style={{ fontSize: 16 }}>{x.name}</b><span className="sub" style={{ margin: 0 }}>{x.meta}</span>
                {on && <span className="badge">{d.scale(x).badge}</span>}{on && who && <span className="tag ok">{who} is bringing it</span>}</span>
            </button>
            <button className="info" aria-label={`Details for ${x.name}`} onClick={() => open(x.id)}>›</button>
          </div>); })}</div>
      </section>); })}
    <button className="btn dashed" onClick={openForm}>+ Add your own recipe</button>
  </>);
}

function Shop({ s, d, patch }: { s: AppState; d: Derived; patch: Patch }) {
  if (!d.grocery.length) return <p className="empty">Pick some dishes and your list shows up here.</p>;
  return (<>
    {d.grocery.map((g) => (
      <section className="card" key={g.section} aria-label={g.label}>
        <h2>{g.label} <span className="sub">· {g.items.length}</span></h2>
        <div>{g.items.map((i) => { const on = !!s.got[i.key]; return (
          <button key={i.key} className="item" aria-pressed={on} onClick={() => patch((st) => { const n = { ...st.got }; if (n[i.key]) delete n[i.key]; else n[i.key] = true; return { got: n }; })}>
            <span className="box">{on && <Check />}</span>
            <span className="txt"><b>{i.qty}</b> {i.name}<small>For {i.used.join(", ")}</small></span></button>); })}</div>
      </section>))}
    <button className="btn ghost" onClick={() => patch({ got: {} })}>Uncheck everything</button>
  </>);
}

function Plan({ s, d, patch }: { s: AppState; d: Derived; patch: Patch }) {
  const task = (id: string, text: string, lead?: React.ReactNode, tag?: string) => { const k = s.mode + ":" + id, on = !!s.done[k]; return (
    <button key={id} className="item" aria-pressed={on} onClick={() => patch((st) => { const n = { ...st.done }; if (n[k]) delete n[k]; else n[k] = true; return { done: n }; })}>
      {lead}<span className="box">{on && <Check />}</span><span className="txt">{text}{tag && <small>{tag}</small>}</span></button>); };
  return (<>
    <div className="seg" role="group" aria-label="Plan view">
      <button aria-pressed={s.planView === "before"} onClick={() => patch({ planView: "before" })}>Before</button>
      <button aria-pressed={s.planView === "dayof"} onClick={() => patch({ planView: "dayof" })}>{s.mode === "tg" ? "Turkey Day" : "Party day"}</button>
    </div>
    {s.planView === "before" && d.planDays.map((p) => (
      <section className="card" key={p.daysBefore}><div><h2>{p.label}</h2>{p.sub && <p className="sub">{p.sub}</p>}</div>{p.tasks.map((t) => task(t.id, t.text))}</section>))}
    {s.planView === "dayof" && <>
      {d.ovenNote && <p className="sub" style={{ margin: 0 }}>{d.ovenNote}</p>}
      <section className="card">{d.dayOf.map((t) => task(t.id, t.text, <span className="time">{t.time}</span>, t.tag))}</section></>}
    <Potluck s={s} d={d} patch={patch} />
  </>);
}

function Potluck({ s, d, patch }: { s: AppState; d: Derived; patch: Patch }) {
  const [who, setWho] = useState(""), [what, setWhat] = useState(""), [err, setErr] = useState("");
  const names = Object.keys(d.bringing);
  const canon = (n: string) => { n = n.trim().replace(/\s+/g, " "); return s.people.find((p) => p.toLowerCase() === n.toLowerCase()) || n; };
  const add = () => {
    const w = canon(who), t = what.trim();
    if (!w || !t) { setErr("Add who’s bringing it and what it is."); return; }
    patch((st) => ({ extras: [...st.extras, { id: "x" + Date.now(), who: w, what: t, mode: st.mode }], people: st.people.includes(w) ? st.people : [...st.people, w] }));
    setWhat(""); setErr("");
  };
  return (
    <section className="card" aria-label="Who's bringing what">
      <div><h2>Who’s bringing what</h2><p className="sub">{names.length ? `You’re making ${d.mine.length} dishes · ${names.length} pitching in. Their dishes are off your grocery list.` : "Open any dish on the Menu (tap the arrow) to hand it off to someone."}</p></div>
      {names.map((w) => (<div key={w} className="row" style={{ alignItems: "flex-start", justifyContent: "flex-start" }}>
        <span className="avatar">{w[0].toUpperCase()}</span>
        <div className="stack" style={{ flex: 1 }}><b>{w}</b>{d.bringing[w].map((x, j) => (
          <div key={j} className="row"><span style={{ fontSize: 14 }}>{x.text}</span>
            <button className="chip" style={{ minHeight: 32, padding: "0 10px" }} aria-label={`Remove ${x.short}`} onClick={() => patch((st) => x.dishId
              ? { bringers: Object.fromEntries(Object.entries(st.bringers).filter(([k]) => k !== bringKey(st.mode, x.dishId!))) }
              : { extras: st.extras.filter((e) => e.id !== x.extraId) })}>✕</button></div>))}</div>
      </div>))}
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
  const toggle = () => patch((st) => { const c = { ...st[key] }; if (c[r.id]) delete c[r.id]; else c[r.id] = true; return { [key]: c } as Partial<AppState>; });
  const addNew = () => { const n = name.trim().replace(/\s+/g, " "); if (!n) return; assign(s.people.find((p) => p.toLowerCase() === n.toLowerCase()) || n); setName(""); };
  return (
    <div className="sheet" onClick={close}><div role="dialog" aria-label={r.name} onClick={(e) => e.stopPropagation()}>
      <div className="row"><h2>{r.name}</h2><button className="round" aria-label="Close" onClick={close}>✕</button></div>
      <p className="sub" style={{ margin: 0 }}>{r.blurb}</p>
      <span className="badge">{sc.badge}</span>
      <p className="sub" style={{ margin: 0 }}>{r.serves ? `Recipe serves ${r.serves} · ${r.meta}` : r.meta}</p>
      <div>{r.ing.map((x, i) => <div className="ing" key={i}><b>{cookText(x[1] * sc.mult, x[2], x[0])}</b><span>{x[0]}</span></div>)}</div>
      <div className="stack" style={{ gap: 8 }}><span className="label">Who’s making it?</span>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {[{ l: "Me", v: "" }, ...s.people.map((p) => ({ l: p, v: p }))].map((o) => <button key={o.l} className="chip" aria-pressed={cur === o.v} onClick={() => assign(o.v)}>{o.l}</button>)}</div>
        <div className="row"><input className="num" style={{ flex: 1, textAlign: "left", padding: "0 12px", fontSize: 16 }} aria-label="Add a person" placeholder="Add a person…" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn ghost" onClick={addNew}>Assign</button></div>
        {cur && <p className="sub" style={{ margin: 0 }}>{cur} is on it. This dish is off your grocery list and cooking plan, so send {cur} the amounts above.</p>}</div>
      <button className={on ? "btn ghost" : "btn"} onClick={toggle}>{on ? "Remove from menu" : "Add to menu"}</button>
    </div></div>);
}

function FormSheet({ s, d, patch, close }: { s: AppState; d: Derived; patch: Patch; close: () => void }) {
  const [f, setF] = useState({ name: "", cat: d.cats.some((c) => c.key === "sides") ? "sides" : d.cats[0].key, serves: "8", mins: "30", lines: "" });
  const [err, setErr] = useState("");
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setErr(""); };
  const save = () => {
    const name = f.name.trim(), lines = f.lines.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!name) return setErr("Give your recipe a name.");
    if (!lines.length) return setErr("Add at least one ingredient line.");
    const serves = Math.max(1, parseInt(f.serves, 10) || 4), mins = Math.max(0, parseInt(f.mins, 10) || 0);
    const id = "c" + Date.now(), key = selKeyOf(s.mode);
    const rec: Dish = { id, name, short: name, cat: f.cat, mode: s.mode, modes: [s.mode], serves, custom: true,
      meta: mins ? `Start ${mins} min before serving` : "Your recipe", blurb: "Your recipe, scaled automatically.",
      ing: lines.map(parseLine), ahead: [], day: mins ? [[mins, "Start " + name]] : [] };
    patch((st) => ({ custom: [...st.custom, rec], [key]: { ...st[key], [id]: true } }) as Partial<AppState>);
    close();
  };
  return (
    <div className="sheet" onClick={close}><div role="dialog" aria-label="Add your own recipe" onClick={(e) => e.stopPropagation()}>
      <div className="row"><h2>Add your own recipe</h2><button className="round" aria-label="Close" onClick={close}>✕</button></div>
      <div className="field"><label htmlFor="rn">Name</label><input id="rn" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="chips" style={{ flexWrap: "wrap" }}>{d.cats.map((c) => <button key={c.key} className="chip" aria-pressed={f.cat === c.key} onClick={() => set({ cat: c.key })}>{c.label}</button>)}</div>
      <div className="row"><div className="field" style={{ flex: 1 }}><label htmlFor="rs">Serves</label><input id="rs" inputMode="numeric" value={f.serves} onChange={(e) => set({ serves: e.target.value })} /></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="rm">Start (min before)</label><input id="rm" inputMode="numeric" value={f.mins} onChange={(e) => set({ mins: e.target.value })} /></div></div>
      <div className="field"><label htmlFor="rl">Ingredients, one per line</label><textarea id="rl" rows={6} placeholder={"2 lb potatoes\n1/2 cup butter\n1 tsp salt"} value={f.lines} onChange={(e) => set({ lines: e.target.value })} /></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" onClick={save}>Save & add to menu</button>
    </div></div>);
}
