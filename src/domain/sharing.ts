// What gets shared with guests, and how guests' claims flow back into the owner's plan.
import { Derived, bringKey } from "./planner";

export interface SharedDish {
  id: string; name: string; cat: string; catLabel: string; meta: string; badge: string;
  ing: { q: string; name: string }[]; directions?: string[];
}
export interface Snapshot { dishes: SharedDish[] }
export interface Claim { id: string; dish_id: string | null; name: string; what: string | null }
export interface SharedEvent {
  slug: string; mode: "tg" | "party"; title: string; event_date: string | null; serve_min: number | null;
  adults: number; kids: number; snapshot: Snapshot; claims: Claim[]; updated_at: string;
}

/** The menu as guests see it: dishes the owner picked, with amounts scaled for this guest list. */
export function buildSnapshot(d: Derived, cookText: (q: number, u: string, name: string) => string): Snapshot {
  return {
    dishes: d.chosen.map((r) => {
      const sc = d.scale(r);
      return {
        id: r.id, name: r.name, cat: r.cat, catLabel: d.cats.find((c) => c.key === r.cat)?.label || r.cat,
        meta: r.meta, badge: sc.badge,
        ing: r.ing.map((x) => ({ q: cookText(x[1] * sc.mult, x[2], x[0]), name: x[0] })),
        ...(r.directions?.length ? { directions: r.directions } : {}),
      };
    }),
  };
}

export interface ClaimState {
  bringers: Record<string, string>;
  extras: { id: string; who: string; what: string; mode: "tg" | "party" }[];
  people: string[];
  /** what we last copied from guests, so we never overwrite a choice the owner made by hand */
  claimSync: Record<string, string>;
}

/**
 * Copy guests' claims into the owner's plan: claimed dishes get a bringer (and leave the grocery list),
 * free-text extras show under "who's bringing what". Owner's manual assignments always win.
 */
export function applyClaims(s: ClaimState, mode: "tg" | "party", dishIds: string[], claims: Claim[]): Partial<ClaimState> {
  const bringers = { ...s.bringers }, claimSync = { ...s.claimSync };
  const people = [...s.people];
  const addPerson = (n: string) => { if (!people.some((p) => p.toLowerCase() === n.toLowerCase())) people.push(n); };
  for (const id of dishIds) {
    const key = bringKey(mode, id);
    const c = claims.find((x) => x.dish_id === id);
    if (c) {
      if (!bringers[key] || bringers[key] === claimSync[key]) { bringers[key] = c.name; claimSync[key] = c.name; addPerson(c.name); }
    } else {
      if (claimSync[key] && bringers[key] === claimSync[key]) delete bringers[key];
      delete claimSync[key];
    }
  }
  const guestExtras = claims.filter((c) => !c.dish_id && c.what).map((c) => ({ id: "sc-" + c.id, who: c.name, what: c.what as string, mode }));
  guestExtras.forEach((e) => addPerson(e.who));
  const extras = s.extras.filter((e) => !(e.id.startsWith("sc-") && e.mode === mode)).concat(guestExtras);
  return { bringers, claimSync, people, extras };
}
