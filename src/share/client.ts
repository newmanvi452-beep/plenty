// Talks to the Supabase database through the functions in supabase/schema.sql.
// Only the public (anon) key is used here. The database decides what each caller may do.
import { Snapshot, SharedEvent } from "../domain/sharing";
import { siteBase } from "../native";

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** False until you add the two settings; the app hides sharing and works as before. */
export const sharingEnabled = !!(URL_ && KEY);
/** Same project settings, reused by the sign-in and sync code. */
export const SUPABASE_URL = URL_;
export const SUPABASE_KEY = KEY;

export class ShareError extends Error {}

/** New-style keys (sb_publishable_...) go in `apikey` only; old-style keys are JWTs and also go in Authorization. */
const authHeaders = (): Record<string, string> => ({
  apikey: KEY!, "Content-Type": "application/json", ...(KEY!.startsWith("eyJ") ? { Authorization: `Bearer ${KEY}` } : {}),
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!sharingEnabled) throw new ShareError("Sharing isn’t set up yet.");
  let res: Response;
  try {
    res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify(args),
    });
  } catch { throw new ShareError("Can’t reach the sharing service. Check your connection."); }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ShareError(friendly(body?.message || res.statusText));
  return body as T;
}

const friendly = (m: string) =>
  /already claimed/i.test(m) ? "Someone just claimed that dish." :
  /not on menu/i.test(m) ? "That dish was removed from the menu." :
  /too many claims/i.test(m) ? "This menu has reached its limit of sign-ups." :
  /not found/i.test(m) ? "This link isn’t active anymore." :
  /not allowed/i.test(m) ? "You can’t change that." : "Something went wrong. Please try again.";

export const randomKey = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

export interface EventFields { title: string; date: string | null; serveMin: number; adults: number; kids: number; snapshot: Snapshot }

export const createShare = (mode: string, token: string, f: EventFields) =>
  rpc<string>("create_shared_event", { p_edit_token: token, p_mode: mode, p_title: f.title, p_event_date: f.date, p_serve_min: f.serveMin, p_adults: f.adults, p_kids: f.kids, p_snapshot: f.snapshot });
export const updateShare = (slug: string, token: string, f: EventFields) =>
  rpc<null>("update_shared_event", { p_slug: slug, p_edit_token: token, p_title: f.title, p_event_date: f.date, p_serve_min: f.serveMin, p_adults: f.adults, p_kids: f.kids, p_snapshot: f.snapshot });
export const deleteShare = (slug: string, token: string) => rpc<null>("delete_shared_event", { p_slug: slug, p_edit_token: token });
export const getShare = (slug: string) => rpc<SharedEvent | null>("get_shared_event", { p_slug: slug });
export const claimDish = (slug: string, dishId: string | null, what: string | null, name: string, ownerKey: string) =>
  rpc<string>("claim_dish", { p_slug: slug, p_dish_id: dishId, p_what: what, p_name: name, p_owner_key: ownerKey });
export const unclaim = (slug: string, claimId: string, auth: { ownerKey?: string; editToken?: string }) =>
  rpc<null>("unclaim", { p_slug: slug, p_claim_id: claimId, p_owner_key: auth.ownerKey ?? null, p_edit_token: auth.editToken ?? null });

export const shareUrl = (slug: string) => `${siteBase()}#/s/${slug}`;
export const slugFromHash = (hash: string) => /^#\/s\/([0-9a-f]{16})$/i.exec(hash)?.[1] ?? null;
