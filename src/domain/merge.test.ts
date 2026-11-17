import { describe, expect, it } from "vitest";
import { fromCloud, mergeStates, toCloud } from "./merge";
import { addEventTo, applyPatch, initialSaved, normalize, removeEventFrom, view } from "../store";
import { upsertReview } from "./review";
import { friendly } from "../sync/auth";

const st = (over: Record<string, unknown> = {}) => ({ ...initialSaved(), ...over }) as ReturnType<typeof initialSaved>;
const withTG = (sv: ReturnType<typeof initialSaved>, over: Record<string, unknown>) => ({ ...sv, events: sv.events.map((e) => (e.id === "tg" ? { ...e, ...over } : e)) });
const dish = (id: string) => ({ id, name: id, short: id, cat: "sides", mode: "tg" as const, modes: ["tg" as const], custom: true, serves: 4, meta: "", blurb: "", ing: [], ahead: [], day: [] });

describe("syncing devices", () => {
  it("normal sync: the newer copy wins, so deletions are real", () => {
    const old = st({ modified: "2026-11-01T10:00:00Z", custom: [dish("a"), dish("b")] });
    const newer = st({ modified: "2026-11-02T10:00:00Z", custom: [dish("a")] }); // 'b' deleted on the other device
    expect(mergeStates(old, newer, false).custom.map((d) => d.id)).toEqual(["a"]);
    expect(mergeStates(newer, old, false).custom.map((d) => d.id)).toEqual(["a"]);
  });
  it("keeps this device's own tab and open event, never the account's", () => {
    const sv = addEventTo(st({ modified: "1" }), "party", "Birthday", "e1");
    const local = { ...sv, tab: "plan" as const, planView: "dayof" as const }, cloud = { ...st({ modified: "2" }), events: sv.events, activeId: "tg", tab: "home" as const };
    expect(mergeStates(local, cloud, false)).toMatchObject({ tab: "plan", planView: "dayof", activeId: "e1" });
  });
  it("first sign-in keeps everything from both sides", () => {
    const rev = (id: string, note: string, t: string) => upsertReview([], { eventKey: "tg:2026-11-26", dishId: id, dishName: id, verdict: "hit", note }, new Date(t))[0];
    const local = withTG(st({ modified: "2026-11-05T00:00:00Z", custom: [dish("mine")], people: ["Ann"], reviews: [rev("pie", "local note", "2026-11-05")], profile: { name: "" } }), { adults: 20 });
    const cloud = withTG(st({ modified: "2026-11-09T00:00:00Z", custom: [dish("cloud")], people: ["Bo", "Ann"], reviews: [rev("pie", "cloud note", "2026-11-09"), rev("mash", "m", "2026-11-09")], profile: { name: "Vi" } }), { adults: 8 });
    const m = mergeStates(local, cloud, true);
    expect(m.custom.map((d) => d.id).sort()).toEqual(["cloud", "mine"]);
    expect(m.people).toEqual(["Bo", "Ann"]);
    expect(m.reviews.map((r) => r.note).sort()).toEqual(["cloud note", "m"]); // newest review of the same dish wins
    expect(m.profile.name).toBe("Vi");
    expect(m.events[0].adults).toBe(8); // plain settings follow the newer copy
    expect(m.modified).toBe("2026-11-09T00:00:00Z");
  });
  it("first sign-in with the device newer keeps the device's settings and still adds the account's recipes and events", () => {
    const local = withTG(st({ modified: "2026-11-10T00:00:00Z" }), { adults: 20 });
    const cloud = { ...addEventTo(withTG(st({ custom: [dish("cloud")] }), { adults: 8 }), "party", "Cloud party", "e9"), modified: "2026-11-01T00:00:00Z" };
    const m = mergeStates(local, cloud, true);
    expect(m.events.find((e) => e.id === "tg")!.adults).toBe(20);
    expect(m.events.map((e) => e.id).sort()).toEqual(["e9", "tg"]); // the account's other event isn't lost
    expect(m.custom.map((d) => d.id)).toEqual(["cloud"]);
  });
  it("uploads without device-only bits, and upgrades older copies", () => {
    expect(Object.keys(toCloud(st()))).not.toContain("tab");
    expect(Object.keys(toCloud(st()))).not.toContain("activeId");
    const restored = fromCloud({ adults: 5 });
    expect(restored.events[0].adults).toBe(5);
    expect(restored.reviews).toEqual([]); // field an older copy never had
  });
});

describe("events", () => {
  it("an old single-plan copy becomes a Thanksgiving event, with the party only if it was used", () => {
    const old = { adults: 14, kids: 2, tgDate: "2026-11-26", partyDate: "", got: { "g:tg:flour": true }, done: { "tg:t1": true }, extras: [{ id: "x1", who: "", what: "napkins", mode: "tg" }], shares: { tg: { slug: "s", token: "t" } }, mode: "tg" };
    const n = normalize(old, new Date("2026-11-17"));
    expect(n.events.map((e) => e.id)).toEqual(["tg"]);
    expect(n.events[0]).toMatchObject({ adults: 14, kids: 2, name: "Thanksgiving", shares: { tg: { slug: "s", token: "t" } } });
    expect(n.events[0].got).toEqual({ "g:tg:flour": true });
    expect(n.events[0].extras).toHaveLength(1);
    const used = normalize({ ...old, partyDate: "2026-12-12", got: { "g:tg:flour": true, "g:party:cups": true }, extras: [...old.extras, { id: "x2", who: "Ann", what: "ice", mode: "party" }], mode: "party" }, new Date("2026-11-17"));
    expect(used.events.map((e) => e.id)).toEqual(["tg", "party"]);
    expect(used.activeId).toBe("party");
    expect(used.events[1]).toMatchObject({ partyDate: "2026-12-12", adults: 14 });
    expect(used.events[1].got).toEqual({ "g:party:cups": true }); // each event only keeps its own checklist
    expect(used.events[1].extras.map((x) => x.what)).toEqual(["ice"]);
  });
  it("planning two parties at once keeps their guests, dates and checklists apart", () => {
    let sv = addEventTo(initialSaved(), "party", "Birthday", "e1");
    sv = applyPatch(sv, { adults: 8, partyDate: "2026-12-01" });
    sv = addEventTo(sv, "party", "Housewarming", "e2");
    sv = applyPatch(sv, { adults: 30, partyDate: "2026-12-20", got: { "g:party:ice": true } });
    expect(view(sv)).toMatchObject({ eid: "e2", eventName: "Housewarming", adults: 30, partyDate: "2026-12-20" });
    sv = { ...sv, activeId: "e1" };
    expect(view(sv)).toMatchObject({ adults: 8, partyDate: "2026-12-01", got: {} });
    expect(view(sv).events.map((e) => e.name)).toEqual(["Thanksgiving", "Birthday", "Housewarming"]);
  });
  it("shared things (recipes, people, hidden dishes) are common to every event", () => {
    let sv = addEventTo(initialSaved(), "party", "Birthday", "e1");
    sv = applyPatch(sv, { people: ["Ann"], hidden: { pie: true } });
    sv = { ...sv, activeId: "tg" };
    expect(view(sv)).toMatchObject({ people: ["Ann"], hidden: { pie: true } });
  });
  it("review keys use the event, so two events never share notes", () => {
    const sv = addEventTo(initialSaved(), "party", "Birthday", "e1");
    expect(view(sv).eid).toBe("e1");
  });
  it("renames an event, and never deletes the last one", () => {
    let sv = addEventTo(initialSaved(), "party", "Birthday", "e1");
    sv = applyPatch(sv, { eventName: "Sam's 40th" });
    expect(view(sv).eventName).toBe("Sam's 40th");
    sv = removeEventFrom(sv, "e1");
    expect(sv.events.map((e) => e.id)).toEqual(["tg"]);
    expect(sv.activeId).toBe("tg");
    expect(removeEventFrom(sv, "tg").events).toHaveLength(1);
  });
  it("switching events is not a change that needs syncing", () => {
    const sv = addEventTo(initialSaved(), "party", "Birthday", "e1");
    expect(applyPatch(sv, { tab: "menu" }).modified).toBe(sv.modified);
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
