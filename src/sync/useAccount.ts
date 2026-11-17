import { useCallback, useEffect, useRef, useState } from "react";
import { fromCloud, mergeStates, toCloud } from "../domain/merge";
import { initialSaved, Saved } from "../store";
import { accountsEnabled, AuthError, freshSession, loadSession, saveSession, sendCode, Session, signOutRemote, takeNotice, verifyCode, verifyLink } from "./auth";
import { CloudError, deleteCloud, pullCloud, pushCloud } from "./cloud";

const META = "plenty:sync:v1"; // which account this device's data last synced with
const loadMeta = (): { userId?: string } => { try { return JSON.parse(localStorage.getItem(META) || "{}"); } catch { return {}; } };
const saveMeta = (m: { userId?: string } | null) => { try { if (m) localStorage.setItem(META, JSON.stringify(m)); else localStorage.removeItem(META); } catch { /* ignore */ } };
const msg = (e: unknown) => (e instanceof AuthError || e instanceof CloudError ? e.message : "Something went wrong. Please try again.");

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

/** Account + cloud sync: sign in with an emailed code, then keep this device and the account in step. */
export function useAccount(state: Saved, replace: (s: Saved) => void) {
  const [session, setSession] = useState<Session | null>(() => (accountsEnabled ? loadSession() : null));
  const [status, setStatus] = useState<SyncStatus>("idle"), [error, setError] = useState(takeNotice), [lastSynced, setLastSynced] = useState("");
  const stateRef = useRef(state); stateRef.current = state;
  const sessionRef = useRef(session); sessionRef.current = session;
  const pushed = useRef<string | null>(null); // the `modified` value that matches the cloud copy
  const busy = useRef(false), again = useRef(false);

  const drop = useCallback(() => { saveSession(null); setSession(null); setStatus("idle"); }, []);

  /** Pull, merge, and push if this device has newer changes. */
  const syncNow = useCallback(async () => {
    const cur = sessionRef.current;
    if (!cur) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true; setStatus("syncing"); setError("");
    try {
      const sess = await freshSession(cur);
      if (sess !== cur) setSession(sess);
      const first = loadMeta().userId !== sess.user.id;
      const cloud = await pullCloud(sess);
      const local = stateRef.current;
      if (!cloud) {
        await pushCloud(sess, toCloud(local));
        pushed.current = local.modified;
      } else {
        const cloudState = fromCloud(cloud.data);
        const merged = mergeStates(local, cloudState, first);
        const cloudWins = !first && (cloudState.modified || "") > (local.modified || "");
        if (cloudWins || first) replace(merged);
        if (!cloudWins) await pushCloud(sess, toCloud(merged));
        pushed.current = merged.modified;
      }
      saveMeta({ userId: sess.user.id });
      setStatus("synced"); setLastSynced(new Date().toISOString());
    } catch (e) {
      if (e instanceof AuthError && e.fatal) { drop(); setError("Your sign-in expired. Please sign in again."); }
      else { setStatus("error"); setError(msg(e)); }
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; setTimeout(syncNow, 300); }
    }
  }, [drop, replace]);

  // First sync after signing in or opening the app.
  const uid = session?.user.id;
  useEffect(() => { if (uid) { pushed.current = null; syncNow(); } }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  // Save a moment after each change.
  useEffect(() => {
    if (!uid || pushed.current === null || state.modified === pushed.current) return;
    const t = setTimeout(syncNow, 1800);
    return () => clearTimeout(t);
  }, [state.modified, uid, syncNow]);
  // Pick up changes from your other devices when you come back to the app.
  useEffect(() => {
    if (!uid) return;
    const vis = () => { if (document.visibilityState === "visible") syncNow(); };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [uid, syncNow]);

  const requestCode = (email: string) => sendCode(email);
  const confirmCode = async (email: string, code: string) => { const s = await verifyCode(email, code); saveSession(s); setSession(s); };
  const confirmLink = async (pasted: string) => { const s = await verifyLink(pasted); saveSession(s); setSession(s); };
  const clearDevice = () => { saveMeta(null); replace(initialSaved()); };

  /** Make sure the latest changes are saved, then sign out and clear this device. */
  const signOut = async () => {
    const cur = sessionRef.current; if (!cur) return;
    if (stateRef.current.modified !== pushed.current) {
      try { await pushCloud(await freshSession(cur), toCloud(stateRef.current)); }
      catch { throw new AuthError("Couldn’t save your latest changes, so I didn’t sign you out. Check your connection and try again."); }
    }
    await signOutRemote(cur); drop(); clearDevice();
  };
  /** Delete the saved copy in the account, then sign out and clear this device. */
  const deleteData = async () => {
    const cur = sessionRef.current; if (!cur) return;
    try { await deleteCloud(await freshSession(cur)); } catch (e) { throw new AuthError(msg(e)); }
    await signOutRemote(cur); drop(); clearDevice();
  };

  return { enabled: accountsEnabled, session, email: session?.user.email ?? "", status, error, lastSynced, requestCode, confirmCode, confirmLink, signOut, deleteData, syncNow };
}
export type AccountApi = ReturnType<typeof useAccount>;
