import { useCallback, useEffect, useState } from "react";
import { AuthError, freshSession } from "./auth";
import { CloudError, fetchPurchased, startCheckout } from "./cloud";
import type { AccountApi } from "./useAccount";

/** Flip to true when payments are live. While false, everyone gets the full app, exactly as before. */
export const PAYWALL_ON = false;
export const PRICE_LABEL = "$9.99";

const CACHE = "plenty:paid:v1"; // which account was last seen as paid, so it still opens offline
const cached = (uid?: string) => { try { return !!uid && localStorage.getItem(CACHE) === uid; } catch { return false; } };
const remember = (uid: string, paid: boolean) => { try { if (paid) localStorage.setItem(CACHE, uid); else if (localStorage.getItem(CACHE) === uid) localStorage.removeItem(CACHE); } catch { /* ignore */ } };

/** Whether the signed-in account has bought the app, plus a way to start the purchase. */
export function useEntitlement(account: AccountApi) {
  const session = account.session, uid = session?.user.id;
  const [paid, setPaid] = useState(() => cached(uid));
  const [checking, setChecking] = useState(!!uid), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const justPaid = typeof location !== "undefined" && new URLSearchParams(location.search).has("paid");

  const check = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    try { const p = await fetchPurchased(await freshSession(session)); remember(session.user.id, p); setPaid(p); return p; }
    catch { return cached(session.user.id); } // offline: keep what we last knew
  }, [session]);

  useEffect(() => {
    if (!uid) { setPaid(false); setChecking(false); return; }
    let live = true;
    (async () => {
      setChecking(true);
      let p = await check();
      // Just came back from checkout: the confirmation can take a few seconds to arrive.
      for (let i = 0; justPaid && !p && i < 10 && live; i++) { await new Promise((r) => setTimeout(r, 2000)); p = await check(); }
      if (live) setChecking(false);
    })();
    const vis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; document.removeEventListener("visibilitychange", vis); };
  }, [uid, check, justPaid]);

  const buy = async () => {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const url = await startCheckout(await freshSession(session));
      if (url === "already") { await check(); setBusy(false); return; }
      location.href = url;
    } catch (e) { setError(e instanceof AuthError || e instanceof CloudError ? e.message : "Something went wrong. Please try again."); setBusy(false); }
  };
  return { paid, checking, busy, error, buy, justPaid };
}
export type EntitlementApi = ReturnType<typeof useEntitlement>;
