import { describe, expect, it } from "vitest";
import { DEFAULT_PARTY, DEFAULT_TG, LIB } from "./data";
import { derive, parseLine, PlannerState, recTG, roastMin, turkeyLbs } from "./planner";
import { clock, frac } from "./format";

const ids = (a: string[]) => Object.fromEntries(a.map((i) => [i, true as const]));
const base = (over: Partial<PlannerState> = {}): PlannerState => ({
  mode: "tg", guests: 12, leftovers: false, partyStyle: "meal", dinnerTG: 16 * 60, partyTime: 19 * 60,
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
