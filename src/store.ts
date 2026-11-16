import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PARTY, DEFAULT_TG } from "./domain/data";
import { PlannerState } from "./domain/planner";
import { isoDate, nextThanksgiving, parseISO } from "./domain/format";
import { isDeviceOnly } from "./domain/merge";
import { Review } from "./domain/review";
import { Mode } from "./domain/data";

export type Tab = "home" | "menu" | "shop" | "plan" | "notes";
export interface AppState extends PlannerState {
  tab: Tab;
  planView: "before" | "dayof";
  got: Record<string, true>;
  done: Record<string, true>;
  people: string[];
  /** post-event notes, newest data wins per dish+event */
  reviews: Review[];
  eventNotes: Record<string, string>;
  /** one share link per planner mode; `token` is the owner's secret and never leaves this device */
  shares: Partial<Record<Mode, { slug: string; token: string }>>;
  /** who you are: shown as the host on shared menus and on your own dishes in the overview */
  profile: { name: string };
  claimSync: Record<string, string>;
  /** when anything that syncs last changed (ISO); the newest copy wins when devices differ */
  modified: string;
}

const KEY = "plenty:v1";
const ids = (a: string[]) => Object.fromEntries(a.map((i) => [i, true as const]));

export const initialState = (): AppState => ({
  mode: "tg", adults: 12, kids: 0, leftovers: false, partyStyle: "meal", dinnerTG: 16 * 60, partyTime: 19 * 60,
  tgDate: isoDate(nextThanksgiving(new Date())), partyDate: "", hidden: {},
  selTG: ids(DEFAULT_TG), selP: ids(DEFAULT_PARTY), custom: [], bringers: {}, extras: [],
  tab: "home", planView: "before", got: {}, done: {}, people: [], reviews: [], eventNotes: {}, shares: {}, claimSync: {}, profile: { name: "" }, modified: "",
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // v1 stored a single "guests" count: treat those as adults.
      if (saved.adults === undefined && typeof saved.guests === "number") saved.adults = saved.guests;
      delete saved.guests;
      const st: AppState = { ...initialState(), ...saved };
      // A new Thanksgiving season: move to the next date and clear last year's checklists (menu and notes stay).
      const old = parseISO(st.tgDate);
      if (old && new Date(old.getFullYear(), old.getMonth(), old.getDate() + 30) < new Date()) {
        st.tgDate = isoDate(nextThanksgiving(new Date()));
        st.got = Object.fromEntries(Object.entries(st.got).filter(([k]) => !k.startsWith("g:tg:")));
        st.done = Object.fromEntries(Object.entries(st.done).filter(([k]) => !k.startsWith("tg:")));
      }
      return st;
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return initialState();
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);
  const patch = useCallback((p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
    setState((s) => {
      const part = typeof p === "function" ? p(s) : p;
      const syncs = Object.keys(part).some((k) => !isDeviceOnly(k) && k !== "modified");
      return { ...s, ...part, ...(syncs ? { modified: new Date().toISOString() } : {}) };
    }), []);
  /** Swap in a whole state (from the account) without counting it as a local edit. */
  const replace = useCallback((next: AppState) => setState(next), []);
  return [state, patch, replace] as const;
}
