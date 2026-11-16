import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, parseISO } from "../domain/format";
import { cookText, Derived } from "../domain/planner";
import { applyClaims, buildSnapshot, ClaimState } from "../domain/sharing";
import { AppState } from "../store";
import { createShare, deleteShare, EventFields, getShare, sharingEnabled, ShareError, shareUrl, unclaim, updateShare } from "./client";

type Patch = (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
const msg = (e: unknown) => (e instanceof ShareError ? e.message : "Something went wrong. Please try again.");

/** Owner-side sharing: create/stop a link, keep the shared menu up to date, pull in guests' claims. */
export function useShare(s: AppState, d: Derived, patch: Patch) {
  const mode = s.mode, share = s.shares[mode];
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState<"idle" | "saving" | "synced">("idle");
  const [claimCount, setClaimCount] = useState(0);
  const isTG = mode === "tg", date = isTG ? s.tgDate : s.partyDate;
  const fields: EventFields = useMemo(() => ({
    title: isTG ? "Thanksgiving dinner" : "Party",
    date: parseISO(date) ? date : null, serveMin: isTG ? s.dinnerTG : s.partyTime, adults: s.adults, kids: s.kids,
    snapshot: buildSnapshot(d, cookText, s.profile.name.trim() || undefined),
  }), [d, isTG, date, s.dinnerTG, s.partyTime, s.adults, s.kids, s.profile.name]);
  const sig = JSON.stringify(fields);
  const pushed = useRef("");

  // Keep the shared menu in step with the owner's plan (after a short pause so typing isn't chatty).
  useEffect(() => {
    if (!sharingEnabled || !share || pushed.current === mode + share.slug + sig) return;
    setStatus("saving");
    const t = setTimeout(() => {
      updateShare(share.slug, share.token, fields)
        .then(() => { pushed.current = mode + share.slug + sig; setStatus("synced"); setError(""); })
        .catch((e) => { setStatus("idle"); setError(msg(e)); });
    }, 1200);
    return () => clearTimeout(t);
  }, [share?.slug, share?.token, sig, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull in who's bringing what.
  useEffect(() => {
    if (!sharingEnabled || !share) return;
    let live = true;
    const pull = () => getShare(share.slug).then((ev) => {
      if (!live) return;
      if (!ev) { setError("This share link is no longer active."); return; }
      setClaimCount(ev.claims.length);
      patch((st) => applyClaims(st as ClaimState, mode, ev.snapshot.dishes.map((x) => x.id), ev.claims));
    }).catch(() => { /* offline: try again next time */ });
    pull();
    const iv = setInterval(pull, 20000);
    const vis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [share?.slug, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setBusy(true); setError("");
    try {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const slug = await createShare(mode, token, fields);
      pushed.current = mode + slug + sig; setStatus("synced");
      patch((st) => ({ shares: { ...st.shares, [mode]: { slug, token } } }));
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  /** Host removes a guest's sign-up (a dish or an extra). The next sync clears it from the plan. */
  const removeClaim = async (t: { claimId?: string; dishId?: string }) => {
    if (!share) return;
    setError("");
    try {
      let id = t.claimId;
      if (!id) id = (await getShare(share.slug))?.claims.find((c) => c.dish_id === t.dishId)?.id;
      if (id) await unclaim(share.slug, id, { editToken: share.token });
      const ev = await getShare(share.slug);
      if (ev) { setClaimCount(ev.claims.length); patch((st) => applyClaims(st as ClaimState, mode, ev.snapshot.dishes.map((x) => x.id), ev.claims)); }
    } catch (e) { setError(msg(e)); }
  };
  const stop = async () => {
    if (!share || !window.confirm("Stop sharing? The link will stop working and guests’ sign-ups are deleted. Dishes they claimed stay assigned in your plan.")) return;
    setBusy(true); setError("");
    try {
      await deleteShare(share.slug, share.token);
      patch((st) => {
        const shares = { ...st.shares }; delete shares[mode];
        return { shares, claimSync: Object.fromEntries(Object.entries(st.claimSync).filter(([k]) => !k.startsWith(mode + ":"))) };
      });
      setClaimCount(0); setStatus("idle");
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  return { enabled: sharingEnabled, share, url: share ? shareUrl(share.slug) : "", busy, error, status, claimCount, create, stop, removeClaim, when: parseISO(date) ? fmtDate(parseISO(date)!) : "" };
}
export type ShareApi = ReturnType<typeof useShare>;
