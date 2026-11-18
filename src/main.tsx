import { createRoot } from "react-dom/client";
import App from "./App";
import PrivacyPage from "./PrivacyPage";
import GuestPage from "./share/GuestPage";
import { slugFromHash } from "./share/client";
import { consumeAuthFromUrl } from "./sync/auth";
import "./styles.css";
// A link like  .../#/s/<slug>  opens the guest page; everything else is the planner.
consumeAuthFromUrl(); // a sign-in link from the email lands here with the session in the address
const slug = slugFromHash(location.hash);
createRoot(document.getElementById("root")!).render(location.hash === "#/privacy" ? <PrivacyPage /> : slug ? <GuestPage slug={slug} /> : <App />);
window.addEventListener("hashchange", () => location.reload());

// Offline support: only in production builds so dev hot-reload isn't cached.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
