// Combining this device's data with what's saved in the account.
//
// Normal syncs: whoever saved last wins, so a deletion on one device really deletes everywhere.
// First sync on a device that already has its own data (you used Serves Twenty before signing in): keep
// everything from both sides so nothing you made is lost.
import { normalize, type EventRec, type Saved } from "../store";
import type { Review } from "./review";

/** Screen position isn't worth syncing: each device keeps its own tab. */
export const DEVICE_ONLY = ["tab", "planView", "activeId"] as const;
export const isDeviceOnly = (k: string) => (DEVICE_ONLY as readonly string[]).includes(k);

const byId = <T extends { id: string }>(a: T[], b: T[]) => { const seen = new Set(a.map((x) => x.id)); return [...a, ...b.filter((x) => !seen.has(x.id))]; };
const mergeReviews = (a: Review[], b: Review[]) => {
  const out = new Map<string, Review>();
  [...a, ...b].forEach((r) => { const cur = out.get(r.id); if (!cur || r.updated > cur.updated) out.set(r.id, r); });
  return [...out.values()];
};

/** Same event on both sides (first sign-in): keep the newer settings but don't lose helpers or links from either. */
const mergeEvent = (base: EventRec, other: EventRec): EventRec => ({
  ...base,
  extras: byId(base.extras, other.extras),
  shares: { ...other.shares, ...base.shares },
  got: { ...other.got, ...base.got },
  done: { ...other.done, ...base.done },
  bringers: { ...other.bringers, ...base.bringers },
});

export function mergeStates(local: Saved, cloud: Saved, firstSync: boolean): Saved {
  const cloudNewer = (cloud.modified || "") > (local.modified || "");
  const base = cloudNewer ? cloud : local, other = cloudNewer ? local : cloud;
  const device = { tab: local.tab, planView: local.planView, activeId: local.activeId };
  const keepActive = (m: Saved): Saved => ({ ...m, activeId: m.events.some((e) => e.id === local.activeId) ? local.activeId : m.events[0].id });
  if (!firstSync) return keepActive({ ...base, ...device });
  // First sync on a device that already has data: every event from both sides is kept.
  const events = [...base.events.map((e) => { const o = other.events.find((x) => x.id === e.id); return o ? mergeEvent(e, o) : e; }), ...other.events.filter((e) => !base.events.some((x) => x.id === e.id))];
  return keepActive({
    ...base, ...device, events,
    custom: byId(base.custom, other.custom),
    reviews: mergeReviews(base.reviews, other.reviews),
    people: Array.from(new Set([...base.people, ...other.people])),
    eventNotes: { ...other.eventNotes, ...base.eventNotes },
    hidden: { ...other.hidden, ...base.hidden },
    profile: { name: base.profile.name || other.profile.name },
    modified: (local.modified || "") > (cloud.modified || "") ? local.modified : cloud.modified,
  });
}

/** What gets uploaded: everything except device-only bits. */
export function toCloud(s: Saved): Saved {
  const out: Record<string, unknown> = { ...s };
  DEVICE_ONLY.forEach((k) => delete out[k]);
  return out as unknown as Saved;
}
/** Fill in anything an older/newer saved copy doesn't have (older copies are upgraded to events). */
export function fromCloud(saved: unknown): Saved {
  return normalize(saved);
}
