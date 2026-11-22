// Turns the ingredient lines of a recipe into clean grocery lines, so the same thing is listed once:
// "Butter cubed", "Butter" and "Tbl Butter" become one butter line counted in sticks; "Salt & pepper" becomes
// "Salt" and "Black pepper" once; names lose preparation words ("chopped"), and the aisle is guessed again.
import type { Ingredient, Section } from "./data";
import { VOL } from "./packaging";

export interface GroceryLine { name: string; q: number; u: string; sec: Section; staple?: boolean }

const PREP = /\b(cubed|chopped|minced|diced|sliced|grated|shredded|melted|softened|crushed|uncooked|cooked|divided|optional|packed|room temperature|canned or fresh|to taste)\b/gi;
const sentence = (s: string) => {
  const words = s.split(" ");
  const shouty = s.length > 3 && s === s.toUpperCase();
  const titled = words.length > 1 && words.every((w) => /^[A-Z]/.test(w));
  const t = shouty || titled ? s.toLowerCase() : s;
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const STAPLE_SALT = /^(kosher |sea |table |coarse |fine )?salt$/i;
const STAPLE_PEPPER = /^((freshly |fresh )?(ground |cracked )?black |ground )?pepper$/i;
const SALT_AND_PEPPER = /^salt\s*(?:&|and|\+|\/)\s*(?:fresh(?:ly)? )?(?:ground |cracked )?(?:black )?pepper$/i;

const salt = (): GroceryLine => ({ name: "Salt", q: 1, u: "", sec: "X", staple: true });
const pepper = (): GroceryLine => ({ name: "Black pepper", q: 1, u: "", sec: "X", staple: true });

/** Cooking-amount names are left alone for the built-in recipes, except salt and pepper (amounts there don't matter at the store). */
function library(x: Ingredient): GroceryLine[] {
  const [name, q, u, sec] = x;
  if (STAPLE_SALT.test(name)) return [salt()];
  if (STAPLE_PEPPER.test(name)) return [pepper()];
  return [{ name, q, u, sec }];
}

/** `parse` and `guess` are passed in so this file does not depend on planner.ts. */
export function groceryLines(x: Ingredient, custom: boolean, parse: (line: string) => Ingredient, guess: (name: string) => Section): GroceryLine[] {
  if (!custom) return library(x);
  // Read the stored amount, unit and name again with today's rules (older saved recipes were parsed with weaker ones).
  const [raw, q0, u0] = parse(`${x[1]} ${x[2]} ${x[0]}`.replace(/\s+/g, " ").trim());
  let q = q0, u = u0;
  let block = false;
  let n = raw.replace(/\([^)]*\)/g, " ").split(",")[0].replace(PREP, " ").replace(/\b\d+\s*pieces?\b/gi, " ").replace(/^[^a-z0-9]+/i, "").replace(/\s+/g, " ").trim();
  n = n.replace(/^(blocks?|packages?|packs?|boxes?|sticks?)( of)?\s+/i, () => { block = true; return ""; });
  if (!n) return [];
  const ln = n.toLowerCase();

  if (SALT_AND_PEPPER.test(ln)) return [salt(), pepper()];
  if (STAPLE_SALT.test(ln)) return [salt()];
  if (STAPLE_PEPPER.test(ln)) return [pepper()];

  const out = (name: string, qq = q, uu = u): GroceryLine[] => [{ name, q: qq, u: uu, sec: guess(name) }];
  const vol = VOL[u] !== undefined;

  if (/^(unsalted |salted )?butter$/.test(ln)) { // everything in sticks, like the built-in recipes
    const sticks = vol ? (q * VOL[u]) / 24 : u === "lb" ? q * 4 : q;
    return [{ name: "Unsalted butter", q: sticks, u: "stick", sec: "D" }];
  }
  if (/^cream cheese$/.test(ln)) {
    if (u === "" || block || u === "pack" || u === "box") return out("Cream cheese", q * 8, "oz");
    return out("Cream cheese");
  }
  if (/ricotta/.test(ln)) return out("Ricotta");
  if (/^evaporated milk$/.test(ln) || /^sweetened condensed milk$/.test(ln)) {
    const name = sentence(ln);
    return u === "can" ? out(name, q * (/evaporated/.test(ln) ? 12 : 14), "oz") : out(name);
  }
  if (vol && /^(sharp |mild |medium |extra sharp )?cheddar( cheese)?$/.test(ln)) return out("Cheddar, shredded");
  if (vol && /^parmesan( cheese)?$/.test(ln)) return out("Parmesan, grated");
  if (vol && /^mozzarella( cheese)?$/.test(ln)) return out("Mozzarella, shredded");
  if (/^heavy (whipping )?cream$/.test(ln)) return out("Heavy cream");
  return out(sentence(n));
}
