// Sign in with an emailed code (no passwords). Talks to Supabase Auth directly; the session lives in this
// browser's storage and is refreshed automatically.
import { SUPABASE_KEY as KEY, SUPABASE_URL as URL_, sharingEnabled as accountsEnabled } from "../share/client";

export { accountsEnabled };
/**
 * How the sign-in email works. "link": the email has a sign-in link (Supabase's built-in emails). "code": the email has a
 * 6-digit code (needs your own email provider and an edited template). Set VITE_AUTH_METHOD=code once that's done.
 */
export const AUTH_METHOD: "link" | "code" = import.meta.env.VITE_AUTH_METHOD === "code" ? "code" : "link";
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

/** Email a sign-in link or code (depending on the email template). Creates the account the first time. */
export const sendCode = (email: string) => call(`/auth/v1/otp?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { email: email.trim(), create_user: true });
export const verifyCode = async (email: string, code: string) => toSession(await call<TokenResponse>("/auth/v1/verify", { type: "email", email: email.trim(), token: code.replace(/\s+/g, "") }));
export const signOutRemote = (s: Session) => call("/auth/v1/logout", {}, s.access_token).catch(() => undefined);

const NOTICE = "plenty:auth:notice";
/** A message left for the next screen (e.g. an expired sign-in link). */
export const takeNotice = (): string => { try { const m = sessionStorage.getItem(NOTICE) || ""; sessionStorage.removeItem(NOTICE); return m; } catch { return ""; } };

const jwtClaims = (jwt: string): { sub?: string; email?: string; exp?: number } | null => {
  try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
};
/**
 * When someone opens the sign-in link from their email they land on the site with the session in the address
 * (#access_token=...). Pick it up, save it, and tidy the address bar. Must run before the app starts.
 */
export function consumeAuthFromUrl(): void {
  if (!accountsEnabled) return;
  const h = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!h || h.startsWith("/")) return; // empty, or a guest link (#/s/...)
  const p = new URLSearchParams(h);
  const at = p.get("access_token"), rt = p.get("refresh_token");
  if (at && rt) {
    const c = jwtClaims(at);
    if (c?.sub) saveSession({ access_token: at, refresh_token: rt, expires_at: Number(p.get("expires_at")) || c.exp || Math.floor(Date.now() / 1000) + 3600, user: { id: c.sub, email: c.email ?? "" } });
  } else if (p.get("error")) {
    try { sessionStorage.setItem(NOTICE, /expired|invalid/i.test(p.get("error_description") || "") ? "That sign-in link has expired or was already used. Ask for a new one." : "Sign-in didn’t work. Please try again."); } catch { /* ignore */ }
  } else return;
  history.replaceState(null, "", location.pathname + location.search);
}

/** A session whose token is good for at least another minute (refreshing if needed). */
export async function freshSession(s: Session): Promise<Session> {
  if (s.expires_at - Math.floor(Date.now() / 1000) > 60) return s;
  const n = toSession(await call<TokenResponse>("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token }));
  saveSession(n);
  return n;
}
