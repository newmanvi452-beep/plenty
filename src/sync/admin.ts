// Calls the admin and support functions in supabase/admin.sql. The database refuses everyone who is not on the admin list.
import { SUPABASE_KEY as KEY, SUPABASE_URL as URL_ } from "../share/client";
import { freshSession, type Session } from "./auth";

export class AdminError extends Error { constructor(m: string, readonly notAdmin = false) { super(m); } }

async function rpc<T>(fn: string, args: Record<string, unknown>, s?: Session): Promise<T> {
  if (!URL_ || !KEY) throw new AdminError("Not set up yet.");
  const headers: Record<string, string> = { apikey: KEY, "Content-Type": "application/json" };
  if (s) headers.Authorization = `Bearer ${(await freshSession(s)).access_token}`;
  else if (KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${KEY}`;
  let res: Response;
  try { res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) }); }
  catch { throw new AdminError("Can’t reach the server. Check your connection."); }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = String(body?.message || "");
    if (/not allowed/i.test(msg)) throw new AdminError("This account isn’t an admin.", true);
    if (res.status === 401 || /jwt/i.test(msg)) throw new AdminError("Please sign in again.", true);
    throw new AdminError(msg || "Something went wrong.");
  }
  return body as T;
}

export interface Overview {
  users: number; new_24h: number; new_7d: number; unlocked: number; unlocked_by_source: Record<string, number>;
  shared_menus: number; claims: number; support_open: number; signups_by_day: { day: string; n: number }[];
  downloads_total: number; downloads_7d: number; purchases_total: number; downloads_synced_to: string | null; downloads_by_day: { day: string; n: number }[];
}
export interface Person { email: string; created_at: string; last_sign_in_at: string | null; unlocked: string | null }
export interface SupportItem { id: string; created_at: string; email: string; name: string | null; message: string; status: "open" | "done" }

export const adminOverview = (s: Session) => rpc<Overview>("admin_overview", {}, s);
export const adminPeople = (s: Session) => rpc<Person[]>("admin_people", {}, s);
export const adminSupport = (s: Session) => rpc<SupportItem[]>("admin_support", {}, s);
export const adminSupportSet = (s: Session, id: string, status: "open" | "done") => rpc<null>("admin_support_set", { p_id: id, p_status: status }, s);

/** Anyone can send a support request from the Support page. */
export async function submitSupport(email: string, name: string, message: string): Promise<void> {
  try { await rpc<null>("submit_support", { p_email: email, p_name: name, p_message: message }); }
  catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/bad email/i.test(m)) throw new AdminError("Enter a valid email address so we can reply.");
    if (/too short/i.test(m)) throw new AdminError("Please tell us a little more.");
    if (/too many|busy/i.test(m)) throw new AdminError("We’ve received a lot of messages from you. Please email us instead.");
    throw new AdminError("Couldn’t send that. Please email us instead.");
  }
}
