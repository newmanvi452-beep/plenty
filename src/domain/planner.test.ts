import { describe, expect, it } from "vitest";
import { DEFAULT_PARTY, DEFAULT_TG, LIB } from "./data";
import { derive, parseLine, PlannerState, recTG, roastMin, turkeyLbs } from "./planner";
import { buildCustomDish, cleanOcr, numberSteps, parseRecipeText, stepList } from "./recipe";
import { packaged } from "./packaging";
import { clock, daysUntil, frac, fmtDate, isoDate, nextThanksgiving, parseISO, thanksgivingOf } from "./format";
import { eventKey, isEventOver, latestFor, reviewFor, upsertReview } from "./review";

const ids = (a: string[]) => Object.fromEntries(a.map((i) => [i, true as const]));
const base = (over: Partial<PlannerState> = {}): PlannerState => ({
  mode: "tg", adults: 12, kids: 0, leftovers: false, partyStyle: "meal", dinnerTG: 16 * 60, partyTime: 19 * 60,
  tgDate: "2026-11-26", partyDate: "", hidden: {},
  selTG: ids(DEFAULT_TG), selP: ids(DEFAULT_PARTY), custom: [], bringers: {}, extras: [], ...over,
});

describe("data", () => {
  it("every default dish exists", () => {
    const known = new Set(LIB.map((d) => d.id));
    [...DEFAULT_TG, ...DEFAULT_PARTY].forEach((id) => expect(known.has(id), id).toBe(true));
  });
});

describe("sizing", () => {
  it("turkey: 12 guests, no ham = 15 lb; never below 10", () => {
    expect(turkeyLbs(12, false, false)).toBe(15);
    expect(turkeyLbs(2, false, false)).toBe(10);
  });
  it("roast time steps up with weight and halves for two birds", () => {
    expect(roastMin(12)).toBe(180);
    expect(roastMin(15)).toBe(255);
    expect(roastMin(30)).toBe(255);
  });
  it("recommended sides grow with guests", () => {
    expect(recTG("sides", 4)).toBe(3);
    expect(recTG("sides", 30)).toBe(7);
  });
});

describe("derive", () => {
  it("scales pies as whole pies", () => {
    const d = derive(base());
    const pie = d.chosen.find((r) => r.id === "pumpkin")!;
    expect(d.scale(pie).badge).toMatch(/^\d+ pies?$/);
  });
  it("dishes handed to someone else leave the grocery list and plan", () => {
    const withTurkey = derive(base());
    const handed = derive(base({ bringers: { "tg:turkey": "Aunt May" } }));
    const hasTurkey = (d: ReturnType<typeof derive>) => d.grocery.some((s) => s.items.some((i) => i.name === "Whole turkey"));
    expect(hasTurkey(withTurkey)).toBe(true);
    expect(hasTurkey(handed)).toBe(false);
    expect(handed.turkey).toBeNull();
    expect(handed.bringing["Aunt May"]).toHaveLength(1);
    expect(handed.planDays.some((p) => p.tasks.some((t) => t.id === "bring-Aunt May"))).toBe(true);
  });
  it("turkey goes in before dinner and day-of tasks sort earliest first", () => {
    const d = derive(base());
    expect(d.turkey?.roast).toMatch(/^Into the oven at/);
    const mins = d.dayOf.map((t) => t.min);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    // dessert tasks (e.g. whip the cream) can fall after dinner, so dinner is not always last
    expect(d.dayOf.find((t) => t.id === "gen-dinner")!.time).toBe("4:00 PM");
  });
  it("party mode ignores turkey and uses party time", () => {
    const d = derive(base({ mode: "party" }));
    expect(d.turkey).toBeNull();
    expect(d.dayOf.find((t) => t.id === "pgen-go")!.time).toBe("7:00 PM");
  });
  it("merges shared ingredients across dishes", () => {
    const d = derive(base());
    const keys = d.grocery.flatMap((s) => s.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    const butter = d.grocery.flatMap((s) => s.items).find((i) => i.name === "Unsalted butter")!;
    expect(butter.used.length).toBeGreaterThan(1);
  });
});

describe("custom recipes", () => {
  it("parses quantities, units and names", () => {
    expect(parseLine("1 1/2 cups flour")).toEqual(["Flour", 1.5, "cup", "X"]);
    expect(parseLine("2 lbs chicken thighs")).toEqual(["Chicken thighs", 2, "lb", "M"]);
    expect(parseLine("salt")[1]).toBe(1);
  });
});

describe("format", () => {
  it("fractions and clock", () => {
    expect(frac(1.5)).toBe("1 ½");
    expect(frac(0.25)).toBe("¼");
    expect(clock(16 * 60)).toBe("4:00 PM");
    expect(clock(-30)).toBe("11:30 PM");
  });
});

describe("adults and kids", () => {
  it("kids count as half a portion", () => {
    const adultsOnly = derive(base({ adults: 10, kids: 0 }));
    const mixed = derive(base({ adults: 8, kids: 4 })); // 8 + 2 = 10 portions
    const g = (d: ReturnType<typeof derive>) => d.grocery.flatMap((x) => x.items).map((i) => i.key + i.buy).join();
    expect(g(mixed)).toBe(g(adultsOnly));
    expect(g(derive(base({ adults: 10, kids: 10 })))).not.toBe(g(adultsOnly));
  });
});

describe("store packages", () => {
  it("panko: ¾ cup is one 8-oz box, 5 cups is three", () => {
    expect(packaged("Panko breadcrumbs", "vol", 36)?.text).toBe("1 × 8-oz box");
    expect(packaged("Panko breadcrumbs", "vol", 5 * 48)?.text).toBe("3 × 8-oz boxes");
  });
  it("shows the package and the recipe amount on the list", () => {
    const d = derive(base());
    const panko = d.grocery.flatMap((x) => x.items).find((i) => /panko/i.test(i.name))!;
    expect(panko.buy).toBe("1 × 8-oz box");
    expect(panko.need).toMatch(/cup/);
  });
  it("merges cups, tbsp and tsp of the same ingredient", () => {
    // brie (2 tbsp honey) + cornbread (2 tbsp) + a custom dish using ½ cup: one line, 1 jar-sized bottle
    const d = derive(base({ selTG: ids(["brie", "cornbread"]) }));
    const honey = d.grocery.flatMap((x) => x.items).filter((i) => i.name === "Honey");
    expect(honey).toHaveLength(1);
    expect(honey[0].buy).toBe("1 × 12-oz bottle");
    expect(honey[0].need).toBe("½ cup");
  });
  it("any spice by the spoonful is a jar", () => {
    expect(packaged("Paprika", "vol", 3, "S")?.text).toBe("1 × jar");
  });
});

describe("custom recipes with times", () => {
  const base2 = { name: "Garlic Bread", cat: "bread", mode: "tg" as const, serves: 8, ingredients: ["1 loaf bread"], directions: ["Slice", "Bake"] };
  it("puts prep and cook on the day-of timeline", () => {
    const d = buildCustomDish({ ...base2, prep: 10, cook: 20, makeAhead: false });
    expect(d.day).toEqual([[30, "Garlic Bread: start prepping (about 10 min)"], [20, "Garlic Bread: cook (about 20 min)"]]);
    expect(d.directions).toEqual(["Slice", "Bake"]);
  });
  it("make-ahead moves prep to the day before", () => {
    const d = buildCustomDish({ ...base2, prep: 10, cook: 20, makeAhead: true });
    expect(d.ahead).toHaveLength(1);
    expect(d.day).toEqual([[20, "Garlic Bread: cook (about 20 min)"]]);
  });
});

describe("paste a recipe", () => {
  const keys = ["apps", "mains", "sides", "sauces", "bread", "desserts", "drinks"];
  it("sorts a recipe with headers", () => {
    const r = parseRecipeText(`Grandma's Apple Pie Recipe
Prep Time: 30 mins  Cook Time: 1 hr 15 mins
Serves: 8

Ingredients
- 6 cups sliced apples
• 3/4 cup sugar
1 tsp cinnamon

Directions
1. Heat oven to 425°F.
2. Toss apples with sugar and bake 50 minutes.`, keys);
    expect(r).toMatchObject({ name: "Grandma's Apple Pie", serves: 8, prep: 30, cook: 75, cat: "desserts" });
    expect(r.ingredients).toEqual(["6 cups sliced apples", "3/4 cup sugar", "1 tsp cinnamon"]);
    expect(r.directions).toEqual(["Heat oven to 425°F.", "Toss apples with sugar and bake 50 minutes."]);
  });
  it("guesses without headers", () => {
    const r = parseRecipeText(`Cheesy Potatoes
2 lb potatoes
1 cup shredded cheddar
Slice the potatoes thin, layer with cheese, and bake until golden and bubbling.`, keys);
    expect(r.name).toBe("Cheesy Potatoes");
    expect(r.ingredients).toHaveLength(2);
    expect(r.directions).toHaveLength(1);
  });
  it("stuffing made with cornbread is a side, not bread", () => {
    expect(parseRecipeText("Mom's Cornbread Stuffing\n1 loaf cornbread", keys).cat).toBe("sides");
    expect(parseRecipeText("Honey Cornbread\n1 cup cornmeal", keys).cat).toBe("bread");
  });
  it("a title that starts with a digit is still the title", () => {
    expect(parseRecipeText("7-Layer Dip\n1 can beans", keys).name).toBe("7-Layer Dip");
  });
});

describe("OCR cleanup", () => {
  it("fixes common misreads", () => {
    expect(cleanOcr("l cup sugar")).toBe("1 cup sugar");
    expect(cleanOcr("• I tsp salt")).toBe("• 1 tsp salt");
    expect(cleanOcr("l/2 cup butter")).toBe("1/2 cup butter");
    expect(cleanOcr("Bake 4O minutes")).toBe("Bake 40 minutes");
    expect(cleanOcr("Mom\u2019s Pie")).toBe("Mom's Pie");
  });
  it("leaves real text alone", () => {
    expect(cleanOcr("2 cups flour\nBake 8 oz in 10 minutes")).toBe("2 cups flour\nBake 8 oz in 10 minutes");
  });
});

describe("directions", () => {
  const keys = ["apps", "sides"];
  it("joins wrapped lines into one step", () => {
    const r = parseRecipeText(`Cranberry Dip
Ingredients
1 cup ricotta
Directions
Prep the cranberries and rosemary.
To assemble: pour the whipped ricotta in a
shallow bowl. Top with generous amount of
balsamic glaze, chopped cranberries.
Serve with crackers`, keys);
    expect(r.directions).toEqual([
      "Prep the cranberries and rosemary.",
      "To assemble: pour the whipped ricotta in a shallow bowl. Top with generous amount of balsamic glaze, chopped cranberries.",
      "Serve with crackers",
    ]);
  });
  it("keeps numbered steps separate even if they wrap", () => {
    const r = parseRecipeText("Pie\nIngredients\n1 crust\nDirections\n1. Heat the oven\nto 425.\n2. Bake it", keys);
    expect(r.directions).toEqual(["Heat the oven to 425.", "Bake it"]);
  });
  it("numbers and renumbers steps", () => {
    expect(numberSteps("Slice\nBake")).toBe("1. Slice\n2. Bake");
    expect(numberSteps("1. Slice\n\n3) Bake\nStep 4: Eat")).toBe("1. Slice\n2. Bake\n3. Eat");
    expect(stepList("1. Slice\n2. Bake")).toEqual(["Slice", "Bake"]);
  });
});

describe("event dates", () => {
  it("Thanksgiving is the 4th Thursday of November", () => {
    expect(isoDate(thanksgivingOf(2026))).toBe("2026-11-26");
    expect(isoDate(thanksgivingOf(2027))).toBe("2027-11-25");
    expect(isoDate(thanksgivingOf(2025))).toBe("2025-11-27");
  });
  it("rolls to next year a month after Thanksgiving", () => {
    expect(isoDate(nextThanksgiving(new Date(2026, 10, 16)))).toBe("2026-11-26");
    expect(isoDate(nextThanksgiving(new Date(2026, 11, 20)))).toBe("2026-11-26"); // still within 30 days
    expect(isoDate(nextThanksgiving(new Date(2027, 0, 5)))).toBe("2027-11-25");
  });
  it("counts days and formats dates", () => {
    expect(daysUntil(new Date(2026, 10, 26), new Date(2026, 10, 16, 23, 59))).toBe(10);
    expect(fmtDate(parseISO("2026-12-05")!)).toBe("Sat, Dec 5");
    expect(parseISO("nope")).toBeNull();
  });
  it("party plan shows real dates once a date is set, relative days before", () => {
    const none = derive(base({ mode: "party" }));
    expect(none.planDays.map((p) => p.label)).toContain("The day before");
    const dated = derive(base({ mode: "party", partyDate: "2026-12-05" }));
    expect(dated.planDays.map((p) => p.label)).toEqual(["Thu, Dec 3", "Fri, Dec 4"]);
    expect(dated.planDays[1].sub).toBe("day before");
  });
  it("thanksgiving plan follows its date", () => {
    expect(derive(base({ tgDate: "2027-11-25" })).planDays.some((p) => p.label === "Sat, Nov 20")).toBe(true); // 5 days before
  });
});

describe("hiding dishes", () => {
  it("a hidden dish disappears from the menu, grocery list and plan", () => {
    const d = derive(base({ hidden: { turkey: true } }));
    expect(d.all.some((r) => r.id === "turkey")).toBe(false);
    expect(d.chosen.some((r) => r.id === "turkey")).toBe(false);
    expect(d.turkey).toBeNull();
    expect(d.grocery.some((g) => g.items.some((i) => i.name === "Whole turkey"))).toBe(false);
  });
});

describe("post-event notes", () => {
  const key = eventKey("tg", "2026-11-26");
  it("event is over two hours after it starts", () => {
    expect(isEventOver("2026-11-26", 16 * 60, new Date(2026, 10, 26, 17, 0))).toBe(false);
    expect(isEventOver("2026-11-26", 16 * 60, new Date(2026, 10, 26, 18, 1))).toBe(true);
    expect(isEventOver("", 16 * 60, new Date(2030, 0, 1))).toBe(false);
  });
  it("adds, updates and clears one review per dish", () => {
    const t = new Date(2026, 10, 27);
    let l = upsertReview([], { eventKey: key, dishId: "mash", dishName: "Mashed", verdict: "hit", note: "" }, t);
    l = upsertReview(l, { eventKey: key, dishId: "mash", dishName: "Mashed", verdict: "hit", note: "more butter" }, t);
    expect(l).toHaveLength(1);
    expect(reviewFor(l, key, "mash")?.note).toBe("more butter");
    expect(upsertReview(l, { eventKey: key, dishId: "mash", dishName: "Mashed", note: "  " }, t)).toHaveLength(0);
  });
  it("finds the latest note from a different event", () => {
    const old = eventKey("tg", "2025-11-27");
    let l = upsertReview([], { eventKey: old, dishId: "pecan", dishName: "Pecan pie", verdict: "miss", note: "too sweet" }, new Date(2025, 10, 28));
    l = upsertReview(l, { eventKey: key, dishId: "pecan", dishName: "Pecan pie", verdict: "hit", note: "" }, new Date(2026, 10, 27));
    expect(latestFor(l, "pecan", key)?.verdict).toBe("miss");
    expect(latestFor(l, "pecan")?.verdict).toBe("hit");
  });
});
