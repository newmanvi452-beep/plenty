import { describe, expect, it } from "vitest";
import { buildCustomDish } from "./recipe";

const base = { name: "Cheese board", cat: "apps", mode: "tg" as const, serves: 8, makeAhead: false, ingredients: ["1 lb cheese"], directions: [] };

describe("custom recipe times are optional", () => {
  it("prep only (assemble, no cooking) goes on the timeline", () => {
    const d = buildCustomDish({ ...base, prep: 15, cook: 0 });
    expect(d.day).toEqual([[15, "Cheese board: prep & assemble (about 15 min)"]]);
    expect(d.meta).toBe("15 min prep");
  });
  it("no times at all still saves, with nothing on the timeline", () => {
    const d = buildCustomDish({ ...base, prep: 0, cook: 0 });
    expect(d.day).toEqual([]);
    expect(d.ahead).toEqual([]);
    expect(d.meta).toBe("Your recipe");
  });
  it("prep and cook together still make two steps", () => {
    const d = buildCustomDish({ ...base, prep: 10, cook: 30 });
    expect(d.day.length).toBe(2);
    expect(d.meta).toBe("10 min prep · 30 min cook");
  });
});

import { packaged } from "./packaging";
describe("fresh herbs come by the bunch", () => {
  it("parsley and green onions read as bunches", () => {
    expect(packaged("Fresh Parsley", "vol", 6)?.text).toBe("1 × bunch");
    expect(packaged("Green Onions", "vol", 60)?.text).toBe("2 × bunches");
  });
});
