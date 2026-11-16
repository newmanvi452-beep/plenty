import { describe, expect, it } from "vitest";
import { fromCloud, mergeStates, toCloud } from "./merge";
import { initialState } from "../store";
import { upsertReview } from "./review";
import { friendly } from "../sync/auth";

const st = (over: Record<string, unknown> = {}) => ({ ...initialState(), ...over }) as ReturnType<typeof initialState>;
const dish = (id: string) => ({ id, name: id, short: id, cat: "sides", mode: "tg" as const, modes: ["tg" as const], custom: true, serves: 4, meta: "", blurb: "", ing: [], ahead: [], day: [] });

describe("syncing devices", () => {
  it("normal sync: the newer copy wins, so deletions are real", () => {
    const old = st({ modified: "2026-11-01T10:00:00Z", custom: [dish("a"), dish("b")] });
    const newer = st({ modified: "2026-11-02T10:00:00Z", custom: [dish("a")] }); // 'b' deleted on the other device
    expect(mergeStates(old, newer, false).custom.map((d) => d.id)).toEqual(["a"]);
    expect(mergeStates(newer, old, false).custom.map((d) => d.id)).toEqual(["a"]);
  });
  it("keeps this device's own tab, never the account's", () => {
    const local = st({ tab: "plan", planView: "dayof", modified: "1" }), cloud = st({ tab: "home", modified: "2" });
    expect(mergeStates(local, cloud, false)).toMatchObject({ tab: "plan", planView: "dayof" });
  });
  it("first sign-in keeps everything from both sides", () => {
    const rev = (id: string, note: string, t: string) => upsertReview([], { eventKey: "tg:2026-11-26", dishId: id, dishName: id, verdict: "hit", note }, new Date(t))[0];
    const local = st({ modified: "2026-11-05T00:00:00Z", custom: [dish("mine")], people: ["Ann"], reviews: [rev("pie", "local note", "2026-11-05")], profile: { name: "" }, adults: 20 });
    const cloud = st({ modified: "2026-11-09T00:00:00Z", custom: [dish("cloud")], people: ["Bo", "Ann"], reviews: [rev("pie", "cloud note", "2026-11-09"), rev("mash", "m", "2026-11-09")], profile: { name: "Vi" }, adults: 8 });
    const m = mergeStates(local, cloud, true);
    expect(m.custom.map((d) => d.id).sort()).toEqual(["cloud", "mine"]);
    expect(m.people).toEqual(["Bo", "Ann"]);
    expect(m.reviews.map((r) => r.note).sort()).toEqual(["cloud note", "m"]); // newest review of the same dish wins
    expect(m.profile.name).toBe("Vi");
    expect(m.adults).toBe(8); // plain settings follow the newer copy
    expect(m.modified).toBe("2026-11-09T00:00:00Z");
  });
  it("first sign-in with the device newer keeps the device's settings and still adds the account's recipes", () => {
    const local = st({ modified: "2026-11-10T00:00:00Z", adults: 20 }), cloud = st({ modified: "2026-11-01T00:00:00Z", custom: [dish("cloud")], adults: 8 });
    const m = mergeStates(local, cloud, true);
    expect(m.adults).toBe(20);
    expect(m.custom.map((d) => d.id)).toEqual(["cloud"]);
  });
  it("uploads without device-only bits, and restores missing fields from older copies", () => {
    expect(Object.keys(toCloud(st()))).not.toContain("tab");
    const restored = fromCloud({ adults: 5 } as never, st());
    expect(restored.adults).toBe(5);
    expect(restored.reviews).toEqual([]); // field an older copy never had
  });
});

describe("sign-in messages", () => {
  it("an expired or used link is not reported as a bad email address", () => {
    expect(friendly("Email link is invalid or has expired", false, true)).toMatch(/already been used or has expired/);
    expect(friendly("Token has expired or is invalid", false)).toMatch(/code didn’t work/);
    expect(friendly("Unable to validate email address: invalid format", false)).toBe("Enter a valid email address.");
    expect(friendly("email rate limit exceeded", false)).toMatch(/Too many emails/);
  });
});
