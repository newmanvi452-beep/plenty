// Sign in with an emailed code (no passwords). Talks to Supabase Auth directly; the session lives in this
// browser's storage and is refreshed automatically.
import { SUPABASE_KEY as KEY, SUPABASE_URL as URL_, sharingEnabled as accountsEnabled } from "../share/client";

export { accountsEnabled };
export interface Session { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } }
export class AuthError extends Error { constructor(m: string, readonly fatal = false) { super(m); } }

const STORE = "plenty:auth:v1";
export const loadSession = (): Session | null => {
  try { const s = JSON.parse(localStorage.getItem(STORE) || "null"); return s && s.access_token && s.refresh_token ? s : null; } catch { return null; }
};
export const saveSession = (s: Session | null) => {
  try { if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE); } catch { /* ignore */ }
};

const friendly = (m: string, fatal: boolean) =>
  /rate limit|too many/i.test(m) ? "Too many emails right now. Please try again in a little while." :
  /for security purposes|after \d+ seconds/i.test(m) ? "Please wait a few seconds before asking for another code." :
  /invalid.*email|unable to validate email|email.*invalid/i.test(m) ? "Enter a valid email address." :
  /expired|invalid|otp|token/i.test(m) ? (fatal ? "Your sign-in expired. Please sign in again." : "That code didn’t work. Check it, or ask for a new one.") :
  "Something went wrong. Please try again.";

async function call<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  if (!accountsEnabled) throw new AuthError("Accounts aren’t set up yet.");
  let res: Response;
  try {
    res = await fetch(`${URL_}${path}`, { method: "POST", headers: { apikey: KEY!, "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(body) });
  } catch { throw new AuthError("Can’t reach the sign-in service. Check your connection."); }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new AuthError(friendly(json?.msg || json?.error_description || json?.message || res.statusText, path.includes("token?grant_type=refresh")), res.status === 400 || res.status === 401);
  return json as T;
}

interface TokenResponse { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user: { id: string; email?: string } }
const toSession = (r: TokenResponse): Session => ({
  access_token: r.access_token, refresh_token: r.refresh_token,
  expires_at: r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600),
  user: { id: r.user.id, email: r.user.email ?? "" },
});

/** Email a one-time code. Creates the account the first time. */
export const sendCode = (email: string) => call("/auth/v1/otp", { email: email.trim(), create_user: true });
export const verifyCode = async (email: string, code: string) => toSession(await call<TokenResponse>("/auth/v1/verify", { type: "email", email: email.trim(), token: code.replace(/\s+/g, "") }));
export const signOutRemote = (s: Session) => call("/auth/v1/logout", {}, s.access_token).catch(() => undefined);

/** A session whose token is good for at least another minute (refreshing if needed). */
export async function freshSession(s: Session): Promise<Session> {
  if (s.expires_at - Math.floor(Date.now() / 1000) > 60) return s;
  const n = toSession(await call<TokenResponse>("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token }));
  saveSession(n);
  return n;
}
