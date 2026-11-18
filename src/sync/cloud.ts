// Reads and writes the signed-in user's single saved copy of their Serves Twenty data.
// Row level security in the database means this can only ever touch the caller's own row.
import { SUPABASE_KEY as KEY, SUPABASE_URL as URL_ } from "../share/client";
import type { Saved } from "../store";
import type { Session } from "./auth";

export class CloudError extends Error { constructor(m: string, readonly status = 0) { super(m); } }

async function rest(s: Session, path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY!, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  } catch { throw new CloudError("Can’t reach your account. Check your connection."); }
  if (!res.ok) throw new CloudError(res.status === 401 ? "Please sign in again." : "Couldn’t save to your account.", res.status);
  return res;
}

export interface CloudCopy { data: unknown; updated_at: string }
export async function pullCloud(s: Session): Promise<CloudCopy | null> {
  const rows = (await (await rest(s, "user_data?select=data,updated_at")).json()) as CloudCopy[];
  return rows[0] ?? null;
}
export async function pushCloud(s: Session, data: Saved): Promise<void> {
  await rest(s, "user_data?on_conflict=user_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: s.user.id, data, updated_at: new Date().toISOString() }),
  });
}
export async function deleteCloud(s: Session): Promise<void> {
  await rest(s, `user_data?user_id=eq.${encodeURIComponent(s.user.id)}`, { method: "DELETE" });
}
/** Erase the login itself (and, through the database, everything saved under it). */
export async function deleteAccountRemote(s: Session): Promise<void> {
  await rest(s, "rpc/delete_my_account", { method: "POST", body: "{}" });
}
