// Post-event notes: was each dish a hit or a miss, and what to change next time.
export type Verdict = "hit" | "meh" | "miss";
export const VERDICTS: { key: Verdict; label: string; emoji: string }[] = [
  { key: "hit", label: "Hit", emoji: "👍" }, { key: "meh", label: "Maybe", emoji: "🤔" }, { key: "miss", label: "Miss", emoji: "👎" },
];
export interface Review { id: string; eventKey: string; dishId: string; dishName: string; verdict?: Verdict; note: string; updated: string }

export const eventKey = (mode: string, date: string) => mode + ":" + (date || "undated");

/** The event counts as over two hours after it starts. */
export function isEventOver(date: string, serveMin: number, now: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!m) return false;
  const start = new Date(+m[1], +m[2] - 1, +m[3], 0, serveMin);
  return now.getTime() >= start.getTime() + 2 * 3600 * 1000;
}

/** Add or update one dish's review for an event; an empty review is removed. */
export function upsertReview(list: Review[], r: { eventKey: string; dishId: string; dishName: string; verdict?: Verdict; note: string }, now: Date = new Date()): Review[] {
  const id = r.eventKey + "|" + r.dishId;
  const rest = list.filter((x) => x.id !== id);
  if (!r.verdict && !r.note.trim()) return rest;
  return [...rest, { id, ...r, updated: now.toISOString() }];
}
export const reviewFor = (list: Review[], key: string, dishId: string) => list.find((x) => x.id === key + "|" + dishId);

/** Newest review for a dish, optionally ignoring the current event. */
export function latestFor(list: Review[], dishId: string, exceptEvent?: string): Review | undefined {
  return list.filter((x) => x.dishId === dishId && x.eventKey !== exceptEvent).sort((a, b) => b.updated.localeCompare(a.updated))[0];
}
export const dateOfKey = (key: string) => key.split(":")[1] || "";
