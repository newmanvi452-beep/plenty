// Pure planning logic (no UI): sizing, scaling, grocery list, and cooking timeline.
// Ported from the Plenty prototype's renderVals().
import { Dish, Ingredient, LIB, Mode, SECTIONS, Section, TG_CATS, PARTY_CATS, Category } from "./data";
import { ceilTo, clock, frac, hm, parseISO, qtyStr, round5, shiftDays, fmtDate } from "./format";
import { bestVolume, packaged, VOL } from "./packaging";

/** A child eats about half as much as an adult. */
export const KID_FACTOR = 0.5;

export type PartyStyle = "apps" | "meal";

export interface PlannerState {
  mode: Mode;
  adults: number;
  kids: number;
  leftovers: boolean;
  partyStyle: PartyStyle;
  dinnerTG: number; // minutes after midnight
  partyTime: number;
  /** event dates as YYYY-MM-DD; partyDate is empty until the user picks one */
  tgDate: string;
  partyDate: string;
  /** dishes the user removed from their list */
  hidden: Record<string, true>;
  selTG: Record<string, true>;
  selP: Record<string, true>;
  custom: Dish[];
  /** "<mode>:<dishId>" -> person bringing it */
  bringers: Record<string, string>;
  extras: { id: string; who: string; what: string; mode: Mode }[];
}

// ---- Sizing -------------------------------------------------------------

export function recTG(cat: string, g: number): number {
  if (cat === "apps") return g <= 6 ? 2 : g <= 12 ? 3 : g <= 20 ? 4 : 5;
  if (cat === "mains") return g <= 12 ? 1 : 2;
  if (cat === "sides") return g <= 4 ? 3 : g <= 8 ? 4 : g <= 14 ? 5 : g <= 20 ? 6 : 7;
  if (cat === "sauces") return 2;
  if (cat === "bread") return 1;
  if (cat === "desserts") return g <= 6 ? 2 : g <= 12 ? 3 : 4;
  if (cat === "drinks") return g <= 10 ? 2 : 3;
  return 1;
}
export function recParty(cat: string, g: number, style: PartyStyle): number {
  if (style === "apps") {
    if (cat === "apps") return g <= 10 ? 4 : g <= 20 ? 5 : 6;
    if (cat === "mains") return 0;
    if (cat === "sides") return 1;
    if (cat === "desserts") return g <= 12 ? 1 : 2;
    return 2;
  }
  if (cat === "apps") return g <= 10 ? 2 : 3;
  if (cat === "mains") return g <= 12 ? 1 : 2;
  if (cat === "sides") return g <= 8 ? 2 : g <= 16 ? 3 : 4;
  if (cat === "desserts") return g <= 12 ? 1 : 2;
  return 2;
}
/** Fraction of each guest's appetite a single dish in a category must cover. */
export function portion(cat: string, n: number): number {
  if (cat === "mains") return n >= 2 ? 0.6 : 1;
  if (cat === "drinks") return n >= 2 ? 0.75 : 1;
  if (cat === "sauces" || cat === "bread") return 1;
  return n <= 2 ? 1 : n <= 4 ? 0.75 : 0.6;
}
export function turkeyLbs(g: number, left: boolean, hasHam: boolean): number {
  const per = (hasHam ? 0.75 : 1.25) + (left ? 0.25 : 0);
  return Math.max(10, Math.ceil(g * per));
}
export function hamLbs(g: number, left: boolean, hasTurkey: boolean): number {
  const per = (hasTurkey ? 0.5 : 0.75) * (left ? 1.25 : 1);
  return Math.max(6, Math.ceil(g * per));
}
export function roastMin(lbs: number): number {
  const b = lbs > 24 ? lbs / 2 : lbs;
  if (b <= 12) return 180; if (b <= 14) return 225; if (b <= 18) return 255; if (b <= 20) return 270; return 300;
}

// ---- Custom recipe parsing ---------------------------------------------

const UNIT_WORDS: Record<string, string> = { cup: "cup", cups: "cup", tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbs: "tbsp", teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", lb: "lb", lbs: "lb", pound: "lb", pounds: "lb", oz: "oz", ounce: "oz", ounces: "oz", can: "can", cans: "can", clove: "clove", cloves: "clove", bunch: "bunch", bunches: "bunch", stick: "stick", sticks: "stick", package: "pack", packages: "pack", pkg: "pack", pack: "pack", packs: "pack", bag: "bag", bags: "bag", jar: "jar", jars: "jar", box: "box", boxes: "box", pint: "pint", pints: "pint", bottle: "bottle", bottles: "bottle", slice: "slices", slices: "slices", head: "head", heads: "head", sheet: "sheet", sheets: "sheet", quart: "quart", quarts: "quart", gallon: "gallon", gallons: "gallon" };

export function guessSec(name: string): Section {
  const n = name.toLowerCase();
  const has = (arr: string[]) => arr.some((w) => n.includes(w));
  if (has(["broth", "stock", "sauce", "can ", "canned", "pasta", "noodle", "rice", "beans"])) return "C";
  if (has(["salt", "black pepper", "olive oil", "vegetable oil", "flour", "sugar", "vanilla", "baking soda", "baking powder"])) return "X";
  if (has(["frozen", "ice cream"])) return "F";
  if (has(["chicken", "beef", "pork", "turkey", "bacon", "sausage", "ham", "shrimp", "salmon", "steak", "lamb"])) return "M";
  if (has(["milk", "butter", "cheese", "cream", "egg", "yogurt", "parmesan", "mozzarella", "cheddar", "ricotta"])) return "D";
  if (has(["bread", "roll", "bun", "tortilla", "crust", "baguette"])) return "B";
  if (has(["cinnamon", "cumin", "paprika", "nutmeg", "oregano", "chili powder", "clove", "seasoning", "spice"])) return "S";
  if (has(["wine", "juice", "soda", "beer", "cider", "seltzer"])) return "K";
  if (has(["onion", "garlic", "potato", "apple", "lemon", "lime", "orange", "berr", "lettuce", "tomato", "carrot", "celery", "parsley", "cilantro", "basil", "thyme", "sage", "rosemary", "spinach", "mushroom", "corn", "squash", "pepper", "greens", "herb", "shallot", "pear", "kale"])) return "P";
  return "C";
}
export function parseQty(input: string): number | null {
  const s = input.replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").replace(/⅓/g, " 1/3").replace(/⅔/g, " 2/3").trim();
  let total = 0, ok = false;
  s.split(/\s+/).forEach((p) => {
    if (/^\d+\/\d+$/.test(p)) { const [a, b] = p.split("/"); total += Number(a) / Number(b); ok = true; }
    else if (/^\d*\.?\d+$/.test(p)) { total += parseFloat(p); ok = true; }
  });
  return ok ? total : null;
}
export function parseLine(line: string): Ingredient {
  const m = line.trim().match(/^([\d\s/.½¼¾⅓⅔]+)?\s*(.*)$/);
  let q = m && m[1] ? parseQty(m[1]) : null;
  let rest = (m && m[2]) || "";
  let unit = "";
  const w = rest.split(/\s+/);
  const u = UNIT_WORDS[(w[0] || "").toLowerCase().replace(/\.$/, "")];
  if (u && q !== null) { unit = u; rest = w.slice(1).join(" "); }
  rest = rest.replace(/^of\s+/i, "");
  if (q === null) q = 1;
  const name = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : line.trim();
  return [name, q, unit, guessSec(name)];
}

// ---- Shopping text ------------------------------------------------------

export function shopText(it: { name: string; u: string; q: number }): string {
  const { name, u, q } = it; let n: number;
  if (u === "stick" && /butter/i.test(name)) { n = Math.ceil(q - 1e-9); return n + " " + (n > 1 ? "sticks" : "stick") + (n >= 4 ? " (" + frac(n / 4) + " lb)" : ""); }
  if (/eggs/i.test(name) && !u) { n = Math.ceil(q - 1e-9); return n + (n > 6 ? " (" + Math.ceil(n / 12) + " dozen)" : ""); }
  if (/chicken broth/i.test(name) && u === "cup") { n = Math.ceil(q / 4 - 1e-9); return n + " × 32-oz carton" + (n > 1 ? "s" : ""); }
  if (u === "lb" || u === "cup" || u === "tbsp" || u === "tsp") n = ceilTo(q, 0.25);
  else n = Math.ceil(q - 1e-9);
  return qtyStr(n, u);
}
export function cookText(q: number, u: string, name: string): string {
  if (!u) {
    if (/eggs/i.test(name)) return "" + Math.ceil(q - 1e-9);
    return frac(Math.round(q * 2) / 2);
  }
  return qtyStr(q, u);
}

// ---- Derived plan -------------------------------------------------------

export interface Scale { mult: number; badge: string }
/** `buy` is what to pick up; `need` is the recipe amount when it differs (e.g. buy "1 × 8-oz box", need "¾ cup"). */
export interface GroceryItem { key: string; buy: string; need: string; name: string; used: string[]; section: Section }
export interface PlanTask { id: string; text: string; tag?: string }
export interface PlanDay { daysBefore: number; label: string; sub: string; tasks: PlanTask[] }
export interface DayOfTask extends PlanTask { min: number; time: string }
export interface Derived {
  cats: Category[];
  all: Dish[];
  chosen: Dish[];
  mine: Dish[];
  counts: Record<string, number>;
  rec: (cat: string) => number;
  scale: (r: Dish) => Scale;
  bringerOf: (r: Dish) => string;
  grocery: { section: Section; label: string; items: GroceryItem[] }[];
  planDays: PlanDay[];
  dayOf: DayOfTask[];
  ovenNote: string;
  turkey: { headline: string; thaw: string; roast: string; twoBirds: boolean } | null;
  base: Date | null;
  dayLabel: (n: number) => string;
  bringing: Record<string, { text: string; short: string; dishId?: string; extraId?: string }[]>;
}

export const bringKey = (mode: Mode, id: string) => mode + ":" + id;
export const selKeyOf = (mode: Mode) => (mode === "tg" ? "selTG" : "selP") as "selTG" | "selP";

export function derive(s: PlannerState): Derived {
  const mode = s.mode, isTG = mode === "tg";
  const g = s.adults + s.kids * KID_FACTOR, left = s.leftovers;
  const sel = s[selKeyOf(mode)];
  const cats = isTG ? TG_CATS : PARTY_CATS;
  const all = LIB.filter((r) => r.modes.includes(mode)).concat(s.custom.filter((c) => c.mode === mode)).filter((r) => !s.hidden[r.id]);
  const base = parseISO(isTG ? s.tgDate : s.partyDate);
  const dayLabel = (n: number) => (base ? fmtDate(shiftDays(base, n)) : n === 1 ? "The day before" : n + " days before");
  const chosen = all.filter((r) => sel[r.id]);
  const counts: Record<string, number> = {};
  cats.forEach((c) => (counts[c.key] = 0));
  chosen.forEach((r) => (counts[r.cat] = (counts[r.cat] || 0) + 1));
  const hasTurkey = chosen.some((r) => r.kind === "turkey");
  const hasHam = chosen.some((r) => r.kind === "ham");
  const tl = turkeyLbs(g, left, hasHam), hl = hamLbs(g, left, hasTurkey);
  const serveTime = isTG ? s.dinnerTG : s.partyTime;

  const bringerOf = (r: Dish) => s.bringers[bringKey(mode, r.id)] || "";
  const mine = chosen.filter((r) => !bringerOf(r));
  const hasTurkeyMine = mine.some((r) => r.kind === "turkey");
  const rec = (cat: string) => (isTG ? recTG(cat, g) : recParty(cat, g, s.partyStyle));

  const scale = (r: Dish): Scale => {
    if (r.kind === "turkey") return { mult: tl / 14, badge: (tl > 24 ? "2 birds, " + Math.ceil(tl / 2) + " lb each" : tl + " lb bird") + " · ~" + hm(roastMin(tl)) };
    if (r.kind === "ham") return { mult: hl / 8, badge: hl + " lb ham" };
    const f = portion(r.cat, Math.max(1, counts[r.cat] || 0) + (sel[r.id] ? 0 : 1));
    const people = g * f * (left ? 1.25 : 1);
    const b = r.whole ? Math.max(1, Math.ceil(people / r.serves - 1e-9)) : Math.max(0.5, ceilTo(people / r.serves, 0.5));
    const badge = r.noun ? b + " " + (b > 1 ? r.noun[1] : r.noun[0]) : "×" + frac(b).replace(" ", "") + " recipe · " + Math.round(b * r.serves) + " servings";
    return { mult: b, badge };
  };

  // Grocery list (only dishes the user is making themselves). Volumes merge in teaspoons.
  const map: Record<string, { name: string; u: string; sec: Section; q: number; used: string[] }> = {};
  const keys: string[] = [];
  mine.forEach((r) => {
    const sc = scale(r);
    r.ing.forEach((x) => {
      const vol = VOL[x[2]] !== undefined;
      const k = x[0] + "|" + (vol ? "vol" : x[2]);
      if (!map[k]) { map[k] = { name: x[0], u: vol ? "vol" : x[2], sec: x[3], q: 0, used: [] }; keys.push(k); }
      map[k].q += x[1] * sc.mult * (vol ? VOL[x[2]] : 1);
      const sn = r.short || r.name;
      if (!map[k].used.includes(sn)) map[k].used.push(sn);
    });
  });
  const toItem = (k: string): GroceryItem => {
    const it = map[k]; const key = "g:" + mode + ":" + k;
    const base = { key, name: it.name, used: it.used, section: it.sec };
    if (it.u === "vol") {
      const v = bestVolume(it.q), need = qtyStr(ceilTo(v.q, 0.25), v.u);
      const p = packaged(it.name, "vol", it.q, it.sec);
      return p ? { ...base, buy: p.text, need } : { ...base, buy: shopText({ name: it.name, u: v.u, q: v.q }), need: "" };
    }
    if (it.u === "oz") {
      const p = packaged(it.name, "oz", it.q);
      if (p) return { ...base, buy: p.text, need: qtyStr(Math.ceil(it.q - 1e-9), "oz") };
    }
    return { ...base, buy: shopText({ name: it.name, u: it.u, q: it.q }), need: "" };
  };
  const grocery = SECTIONS.map(([sec, label]) => ({
    section: sec, label,
    items: keys.filter((k) => map[k].sec === sec).sort().map(toItem),
  })).filter((x) => x.items.length);

  // Cooking plan
  const aheadMap: Record<number, PlanTask[]> = {};
  const dayOfRaw: { min: number; id: string; text: string; tag?: string }[] = [];
  const addA = (d: number, id: string, text: string) => { (aheadMap[d] = aheadMap[d] || []).push({ id, text }); };
  const addD = (min: number, id: string, text: string, tag?: string) => { dayOfRaw.push({ min, id, text, tag }); };
  let ovenNote = "";
  let turkey: Derived["turkey"] = null;
  if (isTG) {
    addA(5, "gen-shop1", "Big grocery run: pantry, canned & frozen items");
    addA(2, "gen-shop2", "Fresh grocery run: produce, dairy & herbs");
    addA(1, "gen-fridge", "Clear fridge space; pull out serving dishes & sticky-note each with its dish");
    addA(1, "gen-table", "Set the table tonight so tomorrow is calmer");
    addD(120, "gen-chill", "Pull make-ahead casseroles out of the fridge to lose their chill");
    addD(0, "gen-dinner", "Dinner is served. You did it!");
  } else {
    addA(2, "pgen-shop", "Grocery run");
    addA(1, "pgen-fridge", "Clear fridge space; pull out platters, serving spoons & a drink tub");
    addD(180, "pgen-ice", "Pick up ice; chill the drinks");
    addD(60, "pgen-set", "Set out plates, napkins, cups & ice");
    addD(20, "pgen-vibe", "Music on, candles lit, quick tidy. You’re ready");
    addD(0, "pgen-go", "Guests arrive!");
  }
  mine.forEach((r) => {
    const tag = r.short || r.name;
    if (r.kind === "turkey") {
      const thawDays = Math.ceil(tl / 4), start = thawDays + 1, rm = roastMin(tl), inAt = 45 + rm;
      addA(start + 1, "tk-buy", "Buy your " + (tl > 24 ? "two ~" + Math.ceil(tl / 2) + "-lb frozen turkeys" : tl + "-lb frozen turkey") + " (or order a fresh one for Tuesday pickup and skip the thaw)");
      addA(start, "tk-thaw", "Move the turkey (still wrapped, on a sheet pan) into the fridge to thaw. Allow about 1 day per 4 lb");
      addA(1, "tk-dry", "Turkey should be thawed: remove neck & giblets, pat dry, salt all over. Leave uncovered in the fridge overnight");
      addD(inAt + 60, "tk-1", "Turkey out of the fridge to take the chill off; move a rack to the lowest position", tag);
      addD(inAt + 30, "tk-2", "Preheat the oven to 325°F", tag);
      addD(inAt, "tk-3", "Turkey in! Herb butter under the skin, aromatics inside, broth in the pan. Roast ~" + hm(rm) + " at 325°F", tag);
      addD(45 + round5(rm / 2), "tk-4", "Baste & rotate the pan; tent the breast with foil if it’s browning fast", tag);
      addD(105, "tk-5", "Start checking the temp: done at 165°F in the thickest part of the thigh", tag);
      addD(45, "tk-6", "Turkey out! Tent with foil and rest 40 min. Raise the oven to 375°F for sides", tag);
      addD(10, "tk-7", "Carve the turkey", tag);
      turkey = {
        headline: tl > 24 ? tl + " lb total (2 birds)" : tl + " lb bird",
        thaw: "Start thawing in the fridge " + dayLabel(start),
        roast: "Into the oven at " + clock(round5(serveTime - inAt)) + " · roasts ~" + hm(rm),
        twoBirds: tl > 24,
      };
      ovenNote = "Oven: turkey at 325°F from " + clock(round5(serveTime - inAt)) + " to " + clock(serveTime - 45) + ". Apps can share it. Casseroles go in at 375°F while it rests.";
    } else if (r.kind === "ham") {
      if (hasTurkeyMine) {
        addD(270, "ham-1", "Ham into the slow cooker on LOW with half the glaze (keeps the oven free)", tag);
        addD(30, "ham-2", "Brush ham with the rest of the glaze; keep warm", tag);
      } else {
        addD(round5(hl * 12 + 30), "ham-1", "Ham into a 325°F oven, cut-side down, covered (~12 min per lb)", tag);
        addD(35, "ham-2", "Glaze the ham; bake uncovered 15 min more", tag);
        addD(15, "ham-3", "Ham out to rest; slice & serve", tag);
      }
      r.ahead.forEach((a, i) => addA(a[0], r.id + "-a" + i, a[1]));
    } else {
      r.ahead.forEach((a, i) => addA(a[0], r.id + "-a" + i, a[1]));
      r.day.forEach((d, i) => addD(d[0], r.id + "-d" + i, d[1], tag));
    }
  });

  // Potluck: who is bringing what
  const bringing: Derived["bringing"] = {};
  const addBring = (who: string, item: Derived["bringing"][string][number]) => { (bringing[who] = bringing[who] || []).push(item); };
  chosen.forEach((r) => {
    const b = bringerOf(r);
    if (b) addBring(b, { text: r.name + " · " + scale(r).badge, short: r.short || r.name, dishId: r.id });
  });
  s.extras.filter((e) => e.mode === mode).forEach((e) => addBring(e.who, { text: e.what, short: e.what, extraId: e.id }));
  Object.keys(bringing).forEach((w) => addA(isTG ? 3 : 2, "bring-" + w, "Check in with " + w + ": " + bringing[w].map((x) => x.short).join(", ")));

  const planDays = Object.keys(aheadMap).map(Number).sort((a, b) => b - a).map((d) => ({
    daysBefore: d,
    label: dayLabel(d),
    sub: base ? (d === 1 ? "day before" : d + " days before") : "",
    tasks: aheadMap[d],
  }));
  const dayOf = dayOfRaw.sort((a, b) => b.min - a.min).map((t) => ({ ...t, time: clock(round5(serveTime - t.min)) }));

  return { cats, all, chosen, mine, counts, rec, scale, bringerOf, grocery, planDays, dayOf, ovenNote, turkey, bringing, base, dayLabel };
}
