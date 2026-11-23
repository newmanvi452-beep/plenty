// Turn recipe amounts into what you actually buy ("1 × 8-oz box" instead of "¾ cup").
// Volumes are tracked in teaspoons so cups/tbsp/tsp of the same ingredient merge.
export const VOL: Record<string, number> = { tsp: 1, tbsp: 3, cup: 48 };

interface Rule { re: RegExp; base: "vol" | "oz"; per: number; label: string; plural?: string }
const C = 48; // tsp per cup
const RULES: Rule[] = [
  // dry goods
  { re: /^panko/i, base: "vol", per: 2 * C, label: "8-oz box", plural: "8-oz boxes" },
  { re: /^all-purpose flour/i, base: "vol", per: 18 * C, label: "5-lb bag" },
  { re: /^sugar$/i, base: "vol", per: 9 * C, label: "4-lb bag" },
  { re: /^brown sugar/i, base: "vol", per: 4.5 * C, label: "2-lb bag" },
  { re: /cornmeal/i, base: "vol", per: 5 * C, label: "24-oz bag" },
  { re: /old-fashioned oats/i, base: "vol", per: 6 * C, label: "18-oz canister" },
  { re: /^pecans/i, base: "vol", per: 2 * C, label: "8-oz bag" },
  { re: /marcona|mixed nuts/i, base: "vol", per: 1.25 * C, label: "6-oz bag" },
  { re: /dried cranberries/i, base: "vol", per: C, label: "5-oz bag" },
  { re: /cocoa powder/i, base: "vol", per: 3 * C, label: "8-oz canister" },
  { re: /^baking powder/i, base: "vol", per: 40, label: "can" },
  { re: /^baking soda/i, base: "vol", per: 240, label: "box" },
  { re: /kosher salt/i, base: "vol", per: 8 * C, label: "3-lb box" },
  { re: /vanilla extract/i, base: "vol", per: 12, label: "2-oz bottle" },
  // dairy
  { re: /whole milk/i, base: "vol", per: 8 * C, label: "half-gallon carton" },
  { re: /heavy cream/i, base: "vol", per: 2 * C, label: "pint carton" },
  { re: /^sour cream/i, base: "vol", per: 2 * C, label: "16-oz tub" },
  { re: /parmesan, grated/i, base: "vol", per: 2.5 * C, label: "8-oz container" },
  { re: /(cheddar|mozzarella), shredded/i, base: "vol", per: 2 * C, label: "8-oz bag" },
  { re: /^cream cheese/i, base: "oz", per: 8, label: "8-oz block" },
  { re: /^american cheese/i, base: "vol", per: 2 * C, label: "8-oz block" },
  { re: /^evaporated milk/i, base: "oz", per: 12, label: "12-oz can" },
  { re: /^sweetened condensed milk/i, base: "oz", per: 14, label: "14-oz can" },
  { re: /^fresh (thyme|rosemary|sage|oregano|dill|mint|basil|tarragon)/i, base: "vol", per: 12, label: "package" },
  { re: /(parsley|cilantro)/i, base: "vol", per: C, label: "bunch", plural: "bunches" },
  { re: /(green onions?|scallions?)/i, base: "vol", per: 0.75 * C, label: "bunch", plural: "bunches" },
  { re: /^ricotta/i, base: "oz", per: 15, label: "15-oz tub" },
  { re: /^goat cheese/i, base: "oz", per: 4, label: "4-oz log" },
  { re: /^semi-sweet chocolate/i, base: "oz", per: 4, label: "4-oz bar" },
  { re: /frozen chopped spinach/i, base: "oz", per: 10, label: "10-oz box" },
  { re: /baby spinach/i, base: "oz", per: 5, label: "5-oz container" },
  { re: /mixed greens/i, base: "oz", per: 10, label: "10-oz bag" },
  // bottles & jars
  { re: /^mayonnaise/i, base: "vol", per: 1.75 * C, label: "15-oz jar" },
  { re: /olive oil/i, base: "vol", per: 3 * C, label: "25-oz bottle" },
  { re: /corn syrup/i, base: "vol", per: 2 * C, label: "16-oz bottle" },
  { re: /^dijon/i, base: "vol", per: 66, label: "12-oz jar" },
  { re: /^honey$/i, base: "vol", per: C, label: "12-oz bottle" },
  { re: /maple syrup/i, base: "vol", per: C, label: "8-oz bottle" },
  { re: /apple cider vinegar/i, base: "vol", per: 2 * C, label: "16-oz bottle" },
  { re: /^balsamic vinegar/i, base: "vol", per: 2 * C, label: "16-oz bottle" },
  { re: /soy sauce/i, base: "vol", per: 60, label: "10-oz bottle" },
  { re: /bbq sauce/i, base: "vol", per: 2 * C, label: "18-oz bottle" },
  { re: /buffalo hot sauce/i, base: "vol", per: 1.5 * C, label: "12-oz bottle" },
  { re: /blue cheese dressing/i, base: "vol", per: 1.5 * C, label: "12-oz bottle" },
];

export interface Packaged { count: number; text: string }

/** `q` is in tsp for base "vol", in oz for base "oz". Returns null when there is no rule. */
export function packaged(name: string, base: "vol" | "oz", q: number, section?: string): Packaged | null {
  const rule = RULES.find((r) => r.base === base && r.re.test(name));
  if (rule) {
    const count = Math.max(1, Math.ceil(q / rule.per - 1e-9));
    return { count, text: `${count} × ${count > 1 ? rule.plural || rule.label + "s" : rule.label}` };
  }
  // Any other spice measured by the spoonful comes in a jar.
  if (base === "vol" && section === "S") {
    const count = Math.max(1, Math.ceil(q / 30 - 1e-9));
    return { count, text: `${count} × ${count > 1 ? "jars" : "jar"}` };
  }
  return null;
}

/** Pick a friendly unit for an amount in teaspoons. */
export function bestVolume(tsp: number): { q: number; u: "cup" | "tbsp" | "tsp" } {
  if (tsp >= 12) return { q: tsp / 48, u: "cup" };
  if (tsp >= 3) return { q: tsp / 3, u: "tbsp" };
  return { q: tsp, u: "tsp" };
}
