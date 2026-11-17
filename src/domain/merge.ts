// Combining this device's data with what's saved in the account.
//
// Normal syncs: whoever saved last wins, so a deletion on one device really deletes everywhere.
// First sync on a device that already has its own data (you used Serves Twenty before signing in): keep
// everything from both sides so nothing you made is lost.
import type { AppState } from "../store";
import type { Review } from "./review";

/** Screen position isn't worth syncing: each device keeps its own tab. */
export const DEVICE_ONLY = ["tab", "planView"] as const;
export const isDeviceOnly = (k: string) => (DEVICE_ONLY as readonly string[]).includes(k);

const byId = <T extends { id: string }>(a: T[], b: T[]) => { const seen = new Set(a.map((x) => x.id)); return [...a, ...b.filter((x) => !seen.has(x.id))]; };
const mergeReviews = (a: Review[], b: Review[]) => {
  const out = new Map<string, Review>();
  [...a, ...b].forEach((r) => { const cur = out.get(r.id); if (!cur || r.updated > cur.updated) out.set(r.id, r); });
  return [...out.values()];
};

export function mergeStates(local: AppState, cloud: AppState, firstSync: boolean): AppState {
  const cloudNewer = (cloud.modified || "") > (local.modified || "");
  const base = cloudNewer ? cloud : local, other = cloudNewer ? local : cloud;
  const device = { tab: local.tab, planView: local.planView };
  if (!firstSync) return { ...base, ...device };
  return {
    ...base, ...device,
    custom: byId(base.custom, other.custom),
    reviews: mergeReviews(base.reviews, other.reviews),
    extras: byId(base.extras, other.extras),
    people: Array.from(new Set([...base.people, ...other.people])),
    eventNotes: { ...other.eventNotes, ...base.eventNotes },
    shares: { ...other.shares, ...base.shares },
    hidden: { ...other.hidden, ...base.hidden },
    profile: { name: base.profile.name || other.profile.name },
    modified: (local.modified || "") > (cloud.modified || "") ? local.modified : cloud.modified,
  };
}

/** What gets uploaded: everything except device-only bits. */
export function toCloud(s: AppState): AppState {
  const out: Record<string, unknown> = { ...s };
  DEVICE_ONLY.forEach((k) => delete out[k]);
  return out as unknown as AppState;
}
/** Fill in anything an older/newer saved copy doesn't have. */
export function fromCloud(saved: Partial<AppState>, defaults: AppState): AppState {
  return { ...defaults, ...saved, tab: defaults.tab, planView: defaults.planView } as AppState;
}
