import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Tab = "home" | "menu" | "shop" | "plan" | "notes";

const KEY = "serves20:tour2";
/** True for anyone who has not seen this tour yet (new installs and people updating from an older version). Worked out once, before anything is saved. */
export const firstRun = (() => {
  try { return !localStorage.getItem(KEY) && !import.meta.env.VITE_SHOT; } catch { return false; }
})();
const markSeen = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };

interface Step { tab?: Tab; target?: string; title: string; text: string }
const TAB_NTH: Record<Tab, number> = { home: 1, menu: 2, shop: 3, plan: 4, notes: 5 };

const STEPS: Step[] = [
  { title: "Welcome to Serves 20", text: "Let’s take a quick tour of the app, one tab at a time. It takes about a minute." },
  { tab: "home", target: "main section.hero", title: "Home: start here",
    text: "Pick the date and tell us how many are coming, adults and kids. Everything else is sized for your crowd, and you can keep more than one event." },
  { tab: "home", target: 'main section[aria-label="Suggested dishes"]', title: "Home: what to make",
    text: "We suggest how many appetizers, mains, sides and desserts to make for your crowd, and tell you if your menu is on track." },
  { tab: "home", target: 'main section[aria-label="Share with guests"]', title: "Home: share the menu",
    text: "Create a link and send it by text or email. Guests open it, see the menu, and sign up for a dish to bring." },
  { tab: "menu", target: "main section:not(.card):not(.hero)", title: "Menu: choose your dishes",
    text: "Pick from the classics or add your own. Paste a recipe or snap a photo and we’ll read it for you." },
  { tab: "menu", target: 'main section[aria-label="Overview"]', title: "Menu: who’s bringing what",
    text: "As guests sign up, their names show up next to each dish. You can see what’s covered and what still needs a cook." },
  { tab: "shop", target: 'main section.card:not([aria-label="Add an item"])', title: "Groceries: shop once",
    text: "We add up every ingredient and tell you how many packages to buy, sorted by aisle. Tick items off as they go in the cart." },
  { tab: "plan", target: "main section.card", title: "Plan: cook calmly",
    text: "A day-by-day countdown to dinner, from thawing the turkey to what to do on the day. Check things off as you go." },
  { tab: "notes", target: "main section.card", title: "Notes: remember for next year",
    text: "After the meal, mark each dish a hit or a miss and jot what to change. Next year starts with what you learned." },
  { target: ".avatar-btn", title: "Your profile",
    text: "Tap here to sign in, keep your plans in sync between phone and web, and replay this tour any time." },
  { title: "You’re ready", text: "That’s the whole app. Start with the date and your guest count on Home." },
];

interface Box { x: number; y: number; w: number; h: number }

/** A guided tour: it visits each tab for you and spotlights the part that matters, with a short note about what it does. */
export default function Walkthrough({ go, close }: { go: (t: Tab) => void; close: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [lift, setLift] = useState(14);
  const [atTop, setAtTop] = useState(false);
  const root = useRef<HTMLDivElement>(null), cardRef = useRef<HTMLDivElement>(null);
  const last = i === STEPS.length - 1, st = STEPS[i];
  const done = () => { markSeen(); go("home"); close(); };

  useLayoutEffect(() => { if (st.tab) go(st.tab); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find the thing to spotlight once the tab has drawn, and keep it lit if the window changes.
  useEffect(() => {
    const measure = () => {
      const r = root.current?.getBoundingClientRect(); if (!r) return;
      const app = root.current?.parentElement as HTMLElement;
      const nav = app.querySelector("nav.tabs")?.getBoundingClientRect();
      setLift(nav && nav.width > r.width * 0.5 ? r.bottom - nav.top + 12 : 14);
      const el = st.target ? (app.querySelector(st.target) as HTMLElement | null) : null;
      if (!el) { setBox(null); return; }
      el.scrollIntoView({ block: "start" });
      const b = el.getBoundingClientRect(), pad = 6;
      // Light the whole target; if it is taller than the space the note leaves, let it run under the note instead of cutting it off.
      const ch = cardRef.current?.getBoundingClientRect().height ?? 0, liftNow = nav && nav.width > r.width * 0.5 ? r.bottom - nav.top + 12 : 14;
      const rawY = b.top - r.top - pad, rawH = b.height + pad * 2;
      const low = rawY + Math.min(rawH, r.height * 0.36) / 2 > r.height * 0.5;
      setAtTop(low);
      let y = rawY, h = rawH;
      if (low) { const under = 60 + ch - 24; if (y < under) { h -= under - y; y = under; } }
      else { const under = r.height - liftNow - ch + 24; if (y + h > under) h = under - y; }
      h = Math.max(h, 40);
      setBox({ x: b.left - r.left - pad, y, w: b.width + pad * 2, h });
    };
    const t = setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Light up the matching tab button so people see where they are.
  useEffect(() => {
    const app = root.current?.parentElement; if (!app || !st.tab) return;
    const b = app.querySelector(`nav.tabs button:nth-child(${TAB_NTH[st.tab]})`);
    b?.classList.add("tour-on");
    return () => b?.classList.remove("tour-on");
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const centered = !st.target;
  return (
    <div ref={root} className="tourbox" role="dialog" aria-label="Welcome tour" onClick={(e) => e.stopPropagation()}>
      {box && !centered ? <div className="tour-spot" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      <div ref={cardRef} className={"tour-card" + (centered ? " mid" : "")} style={centered ? undefined : atTop ? { top: "calc(env(safe-area-inset-top) + 8px)", bottom: "auto" } : { bottom: lift }}>
        <div className="tour-top">
          <div className="dots" aria-hidden="true">{STEPS.map((_, n) => <span key={n} className={n === i ? "on" : ""} />)}</div>
          {!last && <button className="btn ghost" style={{ minHeight: 34, padding: "0 14px", fontSize: 14 }} onClick={done}>Skip</button>}
        </div>
        <h2 style={{ fontSize: 22, margin: 0 }}>{st.title}</h2>
        <p className="sub" style={{ fontSize: 15.5, margin: 0 }}>{st.text}</p>
        <div className="row" style={{ gap: 10 }}>
          {i > 0 && <button className="btn ghost" style={{ flex: 1 }} onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn" style={{ flex: 2 }} onClick={() => (last ? done() : setI(i + 1))}>{last ? "Let’s plan" : i === 0 ? "Start the tour" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
