import { createRoot } from "react-dom/client";
import App from "./App";
import PrivacyPage from "./PrivacyPage";
import TermsPage from "./TermsPage";
import Landing from "./Landing";
import GuestPage from "./share/GuestPage";
import { slugFromHash } from "./share/client";
import { consumeAuthFromUrl, loadSession } from "./sync/auth";
import { isNative } from "./native";
import "./styles.css";
// A link like  .../#/s/<slug>  opens the guest page; everything else is the planner.
consumeAuthFromUrl(); // a sign-in link from the email lands here with the session in the address
const slug = slugFromHash(location.hash);
// First-time visitors in a browser see the front page; installed apps, returning users and "#/app" go straight to the planner.
const installed = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const returning = (() => { try { return !!localStorage.getItem("plenty:v1") || !!loadSession(); } catch { return false; } })();
const front = !isNative && (location.hash === "" || location.hash === "#" || location.hash === "#/") && !installed && !returning && !location.search.includes("paid");
createRoot(document.getElementById("root")!).render(
  location.hash === "#/privacy" ? <PrivacyPage /> : location.hash === "#/terms" ? <TermsPage /> : slug ? <GuestPage slug={slug} /> : front ? <Landing /> : <App />);
window.addEventListener("hashchange", () => location.reload());

// Offline support: only in production builds so dev hot-reload isn't cached.
if ("serviceWorker" in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
