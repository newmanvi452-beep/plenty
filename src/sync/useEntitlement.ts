import { useCallback, useEffect, useState } from "react";
import { isNative, Store } from "../native";
import { AuthError, freshSession } from "./auth";
import { CloudError, fetchPurchased, startCheckout } from "./cloud";
import type { AccountApi } from "./useAccount";

/** Website: sign up with an email before using the planner (on now). */
export const WEB_EMAIL_GATE = true;
/** Website: flip to true when payments are live, and the website becomes a limited preview until the unlock is bought. */
const WEB_PAYWALL = false;
export const PAYWALL_ON = (isNative && !import.meta.env.VITE_SHOT) || WEB_PAYWALL;
export const PRICE_LABEL = "$9.99";

const CACHE = "plenty:paid:v1"; // which account was last seen as paid, so it still opens offline
const cached = (uid?: string) => { try { return !!uid && localStorage.getItem(CACHE) === uid; } catch { return false; } };
const remember = (uid: string, paid: boolean) => { try { if (paid) localStorage.setItem(CACHE, uid); else if (localStorage.getItem(CACHE) === uid) localStorage.removeItem(CACHE); } catch { /* ignore */ } };

/** Whether the person has bought the app (on this iPhone through Apple, or on their account), plus a way to buy. */
export function useEntitlement(account: AccountApi) {
  const session = account.session, uid = session?.user.id;
  const [accountPaid, setAccountPaid] = useState(() => cached(uid));
  const [storePaid, setStorePaid] = useState(false);
  const [price, setPrice] = useState(PRICE_LABEL);
  const [checking, setChecking] = useState(!!uid || isNative), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const justPaid = typeof location !== "undefined" && new URLSearchParams(location.search).has("paid");

  const checkAccount = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    try { const p = await fetchPurchased(await freshSession(session)); remember(session.user.id, p); setAccountPaid(p); return p; }
    catch { return cached(session.user.id); } // offline: keep what we last knew
  }, [session]);
  const checkStore = useCallback(async () => {
    if (!isNative) return;
    try { setStorePaid((await Store.isPurchased()).purchased); } catch { /* the store is not reachable: keep what we knew */ }
  }, []);

  useEffect(() => {
    if (isNative) Store.product().then((p) => setPrice(p.displayPrice)).catch(() => undefined);
    let live = true;
    (async () => {
      setChecking(true);
      await checkStore();
      let p = await checkAccount();
      // Just came back from the website checkout: the confirmation can take a few seconds to arrive.
      for (let i = 0; justPaid && !p && i < 10 && live; i++) { await new Promise((r) => setTimeout(r, 2000)); p = await checkAccount(); }
      if (live) setChecking(false);
    })();
    const vis = () => { if (document.visibilityState === "visible") { checkAccount(); checkStore(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; document.removeEventListener("visibilitychange", vis); };
  }, [uid, checkAccount, checkStore, justPaid]);

  const buy = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (isNative) {
        const r = await Store.purchase();
        if (r.status === "purchased") setStorePaid(true);
        else if (r.status === "pending") setNotice("Your purchase is waiting for approval. It will unlock as soon as it’s approved.");
        setBusy(false); return;
      }
      if (!session) { setBusy(false); return; }
      const url = await startCheckout(await freshSession(session));
      if (url === "already") { await checkAccount(); setBusy(false); return; }
      location.href = url;
    } catch (e) { setError(e instanceof AuthError || e instanceof CloudError ? e.message : "The purchase didn’t go through. Please try again."); setBusy(false); }
  };
  /** Apple requires a way to get back a purchase made earlier (new phone, reinstall). */
  const restore = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await Store.restore();
      setStorePaid(r.purchased);
      if (!r.purchased) setNotice("We couldn’t find an earlier purchase on this Apple ID.");
    } catch { setError("Couldn’t reach the App Store. Check your connection and try again."); }
    setBusy(false);
  };
  return { paid: accountPaid || storePaid, checking, busy, error, notice, price, buy, restore, justPaid, native: isNative };
}
export type EntitlementApi = ReturnType<typeof useEntitlement>;
