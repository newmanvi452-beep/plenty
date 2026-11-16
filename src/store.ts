import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PARTY, DEFAULT_TG } from "./domain/data";
import { PlannerState } from "./domain/planner";

export type Tab = "home" | "menu" | "shop" | "plan";
export interface AppState extends PlannerState {
  tab: Tab;
  planView: "before" | "dayof";
  got: Record<string, true>;
  done: Record<string, true>;
  people: string[];
}

const KEY = "plenty:v1";
const ids = (a: string[]) => Object.fromEntries(a.map((i) => [i, true as const]));

export const initialState = (): AppState => ({
  mode: "tg", guests: 12, leftovers: false, partyStyle: "meal", dinnerTG: 16 * 60, partyTime: 19 * 60,
  selTG: ids(DEFAULT_TG), selP: ids(DEFAULT_PARTY), custom: [], bringers: {}, extras: [],
  tab: "home", planView: "before", got: {}, done: {}, people: [],
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return initialState();
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);
  const patch = useCallback((p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
    setState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) })), []);
  return [state, patch] as const;
}
