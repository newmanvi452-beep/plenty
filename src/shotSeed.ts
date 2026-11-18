import { initialSaved } from "./store";

/** Screenshot builds only (VITE_SHOT=1): start with a lively party so the App Store pictures look real. */
export function seedForScreenshots() {
  try {
    if (localStorage.getItem("plenty:v1")) return;
    const s = initialSaved(), e = s.events[0];
    e.adults = 16; e.kids = 4;
    e.bringers = { "tg:board": "Alex", "tg:pecan": "Maya", "tg:wine": "Jordan" };
    e.extras = [{ id: "x1", who: "Jordan", what: "Ice and drinks", mode: "tg" }, { id: "x2", who: "Maya", what: "Paper plates", mode: "tg" }];
    s.people = ["Alex", "Maya", "Jordan"];
    s.profile = { name: "Sam" };
    s.modified = new Date().toISOString();
    localStorage.setItem("plenty:v1", JSON.stringify(s));
  } catch { /* ignore */ }
}
