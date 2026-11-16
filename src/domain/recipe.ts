// Custom recipes: building a Dish (with a timeline) and sorting pasted recipe text.
import { Dish, Mode } from "./data";
import { parseLine } from "./planner";

export interface RecipeInput {
  id?: string; name: string; cat: string; mode: Mode; serves: number;
  prep: number; cook: number; makeAhead: boolean; ingredients: string[]; directions: string[];
}

export function buildCustomDish(i: RecipeInput): Dish {
  const { name, prep, cook } = i;
  const ahead: Dish["ahead"] = [], day: Dish["day"] = [];
  if (i.makeAhead && prep > 0) {
    ahead.push([1, `${name}: prep ahead (about ${prep} min)`]);
    if (cook > 0) day.push([cook, `${name}: cook (about ${cook} min)`]);
  } else if (prep > 0 && cook > 0) {
    day.push([prep + cook, `${name}: start prepping (about ${prep} min)`], [cook, `${name}: cook (about ${cook} min)`]);
  } else if (prep > 0) day.push([prep, `${name}: prep (about ${prep} min)`]);
  else if (cook > 0) day.push([cook, `${name}: cook (about ${cook} min)`]);
  const parts = [prep ? `${prep} min prep` : "", cook ? `${cook} min cook` : ""].filter(Boolean);
  return {
    id: i.id || "c" + Date.now(), name, short: name, cat: i.cat, mode: i.mode, modes: [i.mode], custom: true,
    serves: Math.max(1, i.serves || 4), meta: parts.join(" · ") || "Your recipe", blurb: "Your recipe, scaled automatically.",
    ing: i.ingredients.map(parseLine), ahead, day, prep, cook, directions: i.directions,
  };
}

// ---- OCR cleanup --------------------------------------------------------

/** Fix the mistakes OCR makes most often in recipes. Safe to run on typed text too. */
export function cleanOcr(text: string): string {
  const UNITS = "cups?|tbsp|tsp|tablespoons?|teaspoons?|lbs?|pounds?|oz|ounces?|cans?|cloves?|sticks?|pinch|dash";
  return text.replace(/\r/g, "").split("\n").map((line) => {
    let l = line.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();
    l = l.replace(/^[«»]\s*/, "• ");
    l = l.replace(new RegExp("^([•\\-*]\\s*)?[lI|]\\s+(?=(?:" + UNITS + ")\\b)", "i"), "$11 "); // "l cup" -> "1 cup"
    l = l.replace(new RegExp("^([•\\-*]\\s*)?[lI|](?=\\/\\d)", "i"), "$11");                    // "l/2 cup" -> "1/2 cup"
    l = l.replace(/(\d)\s*[Oo](?=\s|$)(?!\s*(?:z|unce))/g, "$10").replace(/\b[Oo](\d)/g, "0$1");  // 4O -> 40, O5 -> 05
    return l;
  }).join("\n");
}

// ---- Paste & sort -------------------------------------------------------

export interface ParsedRecipe { name: string; serves?: number; prep?: number; cook?: number; ingredients: string[]; directions: string[]; cat: string }

const ING_H = /^(?:ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need)\s*:?$/i;
const DIR_H = /^(?:directions?|instructions?|method|steps?|preparation|how to make(?: it)?)\s*:?$/i;
const BULLET = /^\s*(?:[-•*▢☐□●◦▪]\s*|\d+[.)]\s+|step\s*\d+\s*[:.\-]?\s*)/i;
const QTY_START = /^\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[½¼¾⅓⅔])(?=\s|[½¼¾⅓⅔]|$)/;
const META = /^(?:prep(?:aration)?|cook(?:ing)?|total|active)?\s*time\b|^(?:serves|servings|yield|makes|prep|cook|total)\b\s*[:\-]/i;

export function parseDuration(s: string): number {
  let mins = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i); if (h) mins += parseFloat(h[1]) * 60;
  const m = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i); if (m) mins += parseInt(m[1], 10);
  return Math.round(mins);
}

export function guessCategory(name: string, keys: string[]): string {
  const n = name.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(stuffing|casserole|mashed|potatoes|salad|slaw|green beans|mac(?: &| and)? cheese|sprouts)\b/, "sides"],
    [/\b(pie|cake|cookie|brownie|crisp|cobbler|pudding|fudge|tart|cheesecake|bar|bars)\b/, "desserts"],
    [/\b(punch|cider|sangria|cocktail|lemonade|smoothie|latte|mocktail)\b/, "drinks"],
    [/\b(gravy|sauce|salsa|vinaigrette|dressing)\b/, "sauces"],
    [/\b(rolls?|bread|biscuits?|cornbread|focaccia|muffins?)\b/, "bread"],
    [/\b(dip|bites?|skewers?|wings|sliders|deviled|crostini|bruschetta|board|nachos)\b/, "apps"],
    [/\b(turkey|ham|roast|chicken|beef|pork|lasagna|ziti|brisket|tacos?|ribs|meatloaf|salmon|wellington)\b/, "mains"],
  ];
  for (const [re, cat] of rules) if (re.test(n) && keys.includes(cat)) return cat;
  return keys.includes("sides") ? "sides" : keys[0];
}

export function parseRecipeText(text: string, catKeys: string[]): ParsedRecipe {
  const raw = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const all = raw.join("\n");
  let prep: number | undefined, cook: number | undefined;
  const timeRe = /(prep(?:aration)?|cook(?:ing)?)\s*time\s*[:\-]?\s*((?:\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b[\s,and]*)+)/gi;
  for (const m of all.matchAll(timeRe)) { const d = parseDuration(m[2]); if (/^prep/i.test(m[1])) prep = d; else cook = d; }
  const sv = all.match(/(?:serves|servings?|yield|makes)\s*[:\-]?\s*(\d+)/i);
  const serves = sv ? parseInt(sv[1], 10) : undefined;

  const hasIngHeader = raw.some((l) => ING_H.test(l)), hasDirHeader = raw.some((l) => DIR_H.test(l));
  let name = "";
  const ingredients: string[] = [], directions: string[] = [];
  let mode: "pre" | "ing" | "dir" = "pre";
  for (const line of raw) {
    if (ING_H.test(line)) { mode = "ing"; continue; }
    if (DIR_H.test(line)) { mode = "dir"; continue; }
    if (META.test(line) || /^(?:prep|cook)(?:aration|ing)?\s*time/i.test(line)) continue;
    const clean = line.replace(BULLET, "").trim();
    if (!clean) continue;
    if (mode === "pre" && !name && !QTY_START.test(clean) && clean.length < 80) { name = clean.replace(/\s*recipe\s*$/i, ""); continue; }
    if (mode === "ing") { if (!/:$/.test(clean)) ingredients.push(clean); continue; }
    if (mode === "dir") { directions.push(clean); continue; }
    // No headers: guess by shape (short line that starts with an amount = ingredient; sentence = step)
    if (!hasIngHeader && QTY_START.test(line) && !/^\d+[.)]\s/.test(line) && clean.length < 90) ingredients.push(clean);
    else if (!hasDirHeader && clean.length > 40) directions.push(clean);
  }
  if (!name) name = "My recipe";
  return { name, serves, prep, cook, ingredients, directions, cat: guessCategory(name, catKeys) };
}
