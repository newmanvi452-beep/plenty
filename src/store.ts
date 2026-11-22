import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_PARTY, DEFAULT_TG, Mode } from "./domain/data";
import { PlannerState } from "./domain/planner";
import { isoDate, nextThanksgiving, parseISO } from "./domain/format";
import { isDeviceOnly } from "./domain/merge";
import { Review } from "./domain/review";

export type Tab = "home" | "menu" | "shop" | "plan" | "notes";

/** One event you're planning: its own guests, date, menu, checklists, helpers and share link. */
export interface EventRec {
  /** "tg" and "party" for events from before you could have several; new ones get a fresh id */
  id: string;
  name: string;
  mode: Mode;
  adults: number; kids: number; leftovers: boolean;
  partyStyle: PlannerState["partyStyle"]; dinnerTG: number; partyTime: number;
  tgDate: string; partyDate: string;
  selTG: Record<string, true>; selP: Record<string, true>;
  bringers: Record<string, string>;
  extras: PlannerState["extras"];
  got: Record<string, true>; done: Record<string, true>;
  /** items the host typed onto the grocery list by hand */
  shopAdds?: ShopAdd[];
  /** one share link per event; `token` is the owner's secret and never leaves the owner's account */
  shares: Partial<Record<Mode, { slug: string; token: string }>>;
  claimSync: Record<string, string>;
}

export interface ShopAdd { id: string; text: string }

/** Everything that is saved on the device and synced to the account. */
export interface Saved {
  events: EventRec[];
  /** which event is on screen: per device, never synced */
  activeId: string;
  custom: PlannerState["custom"];
  hidden: Record<string, true>;
  people: string[];
  /** post-event notes, newest data wins per dish+event (keyed by event id + date) */
  reviews: Review[];
  eventNotes: Record<string, string>;
  /** who you are: shown as the host on shared menus and on your own dishes in the overview */
  profile: { name: string };
  tab: Tab;
  planView: "before" | "dayof";
  /** when anything that syncs last changed (ISO); the newest copy wins when devices differ */
  modified: string;
}

/** What the screens work with: the shared stuff plus the event on screen, flattened. */
export interface AppState extends PlannerState {
  tab: Tab;
  planView: "before" | "dayof";
  got: Record<string, true>;
  done: Record<string, true>;
  shopAdds: ShopAdd[];
  people: string[];
  reviews: Review[];
  eventNotes: Record<string, string>;
  shares: EventRec["shares"];
  profile: { name: string };
  claimSync: Record<string, string>;
  modified: string;
  /** the event on screen */
  eid: string;
  eventName: string;
  events: { id: string; name: string; mode: Mode }[];
}

const KEY = "plenty:v1";
const ids = (a: string[]) => Object.fromEntries(a.map((i) => [i, true as const]));
/** fields that belong to the event on screen (everything else is shared by all events) */
const EVENT_FIELDS = ["adults", "kids", "leftovers", "partyStyle", "dinnerTG", "partyTime", "tgDate", "partyDate", "selTG", "selP", "bringers", "extras", "got", "done", "shopAdds", "shares", "claimSync"] as const;
const DEFAULT_NAMES: Record<Mode, string> = { tg: "Thanksgiving", party: "Party" };

export const newEvent = (mode: Mode, id: string, name?: string, now: Date = new Date()): EventRec => ({
  id, name: (name || "").trim() || DEFAULT_NAMES[mode], mode,
  adults: 12, kids: 0, leftovers: false, partyStyle: "meal", dinnerTG: 16 * 60, partyTime: 19 * 60,
  tgDate: mode === "tg" ? isoDate(nextThanksgiving(now)) : "", partyDate: "",
  selTG: ids(DEFAULT_TG), selP: ids(DEFAULT_PARTY), bringers: {}, extras: [], got: {}, done: {}, shopAdds: [], shares: {}, claimSync: {},
});

export const initialSaved = (): Saved => ({
  events: [newEvent("tg", "tg")], activeId: "tg", custom: [], hidden: {}, people: [], reviews: [], eventNotes: {},
  profile: { name: "" }, tab: "home", planView: "before", modified: "",
});

/** Keep only the entries that belong to one planner mode (checklist keys start with the mode). */
const only = <T,>(o: Record<string, T> | undefined, mode: string) =>
  Object.fromEntries(Object.entries(o || {}).filter(([k]) => k.startsWith(mode + ":") || k.startsWith("g:" + mode + ":"))) as Record<string, T>;

/**
 * Turn any saved copy into the current shape. Copies from before events existed held a single
 * Thanksgiving plan and a single party plan side by side: they become events "tg" and "party".
 */
export function normalize(raw: unknown, now: Date = new Date()): Saved {
  const base = initialSaved();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let events: EventRec[];
  if (Array.isArray(r.events) && r.events.length) {
    events = r.events.map((e: Partial<EventRec>) => ({ ...newEvent(e.mode === "party" ? "party" : "tg", e.id || "e" + Math.random().toString(36).slice(2, 8), e.name, now), ...e }));
  } else {
    // v1 stored a single "guests" count: treat those as adults.
    const adults = typeof r.adults === "number" ? r.adults : typeof r.guests === "number" ? r.guests : 12;
    const shared = { adults, kids: r.kids ?? 0, leftovers: !!r.leftovers, partyStyle: r.partyStyle ?? "meal", dinnerTG: r.dinnerTG ?? 16 * 60, partyTime: r.partyTime ?? 19 * 60 };
    const tg: EventRec = { ...newEvent("tg", "tg", undefined, now), ...shared, tgDate: r.tgDate || isoDate(nextThanksgiving(now)), selTG: r.selTG ?? ids(DEFAULT_TG), bringers: only(r.bringers, "tg"), extras: (r.extras || []).filter((x: { mode: string }) => x.mode === "tg"), got: only(r.got, "tg"), done: only(r.done, "tg"), shares: r.shares?.tg ? { tg: r.shares.tg } : {}, claimSync: only(r.claimSync, "tg") };
    const party: EventRec = { ...newEvent("party", "party", undefined, now), ...shared, partyDate: r.partyDate || "", selP: r.selP ?? ids(DEFAULT_PARTY), bringers: only(r.bringers, "party"), extras: (r.extras || []).filter((x: { mode: string }) => x.mode === "party"), got: only(r.got, "party"), done: only(r.done, "party"), shares: r.shares?.party ? { party: r.shares.party } : {}, claimSync: only(r.claimSync, "party") };
    const partyUsed = !!(party.partyDate || party.shares.party || party.extras.length || Object.keys(party.bringers).length || Object.keys(party.got).length || (r.selP && JSON.stringify(Object.keys(r.selP).sort()) !== JSON.stringify([...DEFAULT_PARTY].sort())));
    events = partyUsed ? [tg, party] : [tg];
  }
  // A new Thanksgiving season: move to the next date and clear last year's checklists (menu and notes stay).
  events = events.map((e) => {
    const old = e.mode === "tg" ? parseISO(e.tgDate) : null;
    if (old && new Date(old.getFullYear(), old.getMonth(), old.getDate() + 30) < now) {
      return { ...e, tgDate: isoDate(nextThanksgiving(now)), got: Object.fromEntries(Object.entries(e.got).filter(([k]) => !k.startsWith("g:tg:"))), done: Object.fromEntries(Object.entries(e.done).filter(([k]) => !k.startsWith("tg:"))) };
    }
    return e;
  });
  const activeId = events.some((e) => e.id === r.activeId) ? r.activeId : events.some((e) => e.id === r.mode) ? r.mode : events[0].id;
  return {
    ...base, events, activeId,
    custom: r.custom ?? [], hidden: r.hidden ?? {}, people: r.people ?? [], reviews: r.reviews ?? [], eventNotes: r.eventNotes ?? {},
    profile: r.profile ?? { name: "" }, tab: r.tab ?? "home", planView: r.planView ?? "before", modified: r.modified ?? "",
  };
}

/** The flat view the screens use. */
export function view(sv: Saved): AppState {
  const ev = sv.events.find((e) => e.id === sv.activeId) ?? sv.events[0];
  return {
    mode: ev.mode, adults: ev.adults, kids: ev.kids, leftovers: ev.leftovers, partyStyle: ev.partyStyle, dinnerTG: ev.dinnerTG, partyTime: ev.partyTime,
    tgDate: ev.tgDate, partyDate: ev.partyDate, hidden: sv.hidden, selTG: ev.selTG, selP: ev.selP, custom: sv.custom, bringers: ev.bringers, extras: ev.extras,
    tab: sv.tab, planView: sv.planView, got: ev.got, done: ev.done, shopAdds: ev.shopAdds ?? [], people: sv.people, reviews: sv.reviews, eventNotes: sv.eventNotes,
    shares: ev.shares, claimSync: ev.claimSync, profile: sv.profile, modified: sv.modified,
    eid: ev.id, eventName: ev.name, events: sv.events.map((e) => ({ id: e.id, name: e.name, mode: e.mode })),
  };
}

/** Apply a change made on the flat view back onto the saved data. */
export function applyPatch(sv: Saved, part: Partial<AppState> & { eventName?: string }): Saved {
  const evPart: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(part)) {
    if ((EVENT_FIELDS as readonly string[]).includes(k)) evPart[k] = v;
    else if (k === "eventName") evPart.name = v;
    else if (["eid", "events", "mode", "modified"].includes(k)) continue;
    else rest[k] = v;
  }
  const events = Object.keys(evPart).length ? sv.events.map((e) => (e.id === sv.activeId ? { ...e, ...evPart } : e)) : sv.events;
  const out = { ...sv, ...rest, events } as Saved;
  const syncs = Object.keys(part).some((k) => !isDeviceOnly(k) && k !== "modified");
  return syncs ? { ...out, modified: new Date().toISOString() } : out;
}

export const addEventTo = (sv: Saved, mode: Mode, name: string, id: string): Saved => ({ ...sv, events: [...sv.events, newEvent(mode, id, name)], activeId: id, modified: new Date().toISOString() });
export const removeEventFrom = (sv: Saved, id: string): Saved => {
  if (sv.events.length <= 1) return sv;
  const events = sv.events.filter((e) => e.id !== id);
  return { ...sv, events, activeId: sv.activeId === id ? events[0].id : sv.activeId, modified: new Date().toISOString() };
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return initialSaved();
}

export function useAppState() {
  const [saved, setSaved] = useState<Saved>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved]);
  const state = useMemo(() => view(saved), [saved]);
  const patch = useCallback((p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
    setSaved((sv) => applyPatch(sv, typeof p === "function" ? p(view(sv)) : p)), []);
  /** Swap in a whole saved copy (from the account) without counting it as a local edit. */
  const replace = useCallback((next: Saved) => setSaved((cur) => ({ ...next, activeId: next.events.some((e) => e.id === cur.activeId) ? cur.activeId : next.events[0].id })), []);
  const events = useMemo(() => ({
    add: (mode: Mode, name: string) => { const id = "e" + Date.now().toString(36); setSaved((sv) => addEventTo(sv, mode, name, id)); return id; },
    remove: (id: string) => setSaved((sv) => removeEventFrom(sv, id)),
    switchTo: (id: string) => setSaved((sv) => (sv.events.some((e) => e.id === id) ? { ...sv, activeId: id } : sv)),
  }), []);
  return [state, patch, replace, saved, events] as const;
}
