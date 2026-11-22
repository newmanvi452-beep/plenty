import { useState } from "react";

const KEY = "serves20:tour";
/** True only for someone opening the planner for the first time (no saved plan, tour not seen yet). Worked out once, before anything is saved. */
export const firstRun = (() => {
  try { return !localStorage.getItem(KEY) && !localStorage.getItem("plenty:v1") && !import.meta.env.VITE_SHOT; } catch { return false; }
})();
const markSeen = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };

const SLIDES = [
  { icon: "🦃", title: "Plan the whole feast", text: "Tell us the date and how many are coming. Serves 20 sizes everything for your crowd: adults and kids." },
  { icon: "🍽️", title: "Pick your dishes", text: "Choose from classics or add your own recipe. Paste a recipe or snap a photo and we’ll read it for you." },
  { icon: "🛒", title: "Shop once", text: "Your grocery list adds it all up for you. It tells you how many packages to buy, sorted by aisle." },
  { icon: "👩‍🍳", title: "Cook calmly", text: "A day-by-day cooking plan counts down to dinner. Share the menu so guests can claim what they’ll bring." },
];

/** A short first-run tour: four swipeable cards. */
export default function Walkthrough({ close }: { close: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1, sl = SLIDES[i];
  const done = () => { markSeen(); close(); };
  return (
    <div className="sheet tour" onClick={(e) => e.stopPropagation()}>
      <div role="dialog" aria-label="Welcome to Serves 20" style={{ textAlign: "center", alignItems: "center", gap: 12 }}
        onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX); }}
        onTouchEnd={(e) => { const x0 = Number((e.currentTarget as HTMLElement).dataset.x), dx = e.changedTouches[0].clientX - x0; if (dx < -50 && !last) setI(i + 1); if (dx > 50 && i > 0) setI(i - 1); }}>
        <button className="btn ghost" style={{ alignSelf: "flex-end", minHeight: 36, padding: "0 14px", fontSize: 14 }} onClick={done}>Skip</button>
        <div style={{ fontSize: 64 }} aria-hidden="true">{sl.icon}</div>
        <h2 style={{ fontSize: 26 }}>{sl.title}</h2>
        <p className="sub" style={{ fontSize: 16, margin: 0, minHeight: 72 }}>{sl.text}</p>
        <div className="dots" aria-hidden="true">{SLIDES.map((_, n) => <span key={n} className={n === i ? "on" : ""} />)}</div>
        <button className="btn" style={{ width: "100%" }} onClick={() => (last ? done() : setI(i + 1))}>{last ? "Let’s plan" : "Next"}</button>
        {i > 0 && <button className="btn ghost" style={{ width: "100%" }} onClick={() => setI(i - 1)}>Back</button>}
      </div>
    </div>
  );
}
