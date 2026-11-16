import { createRoot } from "react-dom/client";
import App from "./App";
import GuestPage from "./share/GuestPage";
import { slugFromHash } from "./share/client";
import "./styles.css";
// A link like  .../#/s/<slug>  opens the guest page; everything else is the planner.
const slug = slugFromHash(location.hash);
createRoot(document.getElementById("root")!).render(slug ? <GuestPage slug={slug} /> : <App />);
window.addEventListener("hashchange", () => location.reload());

// Offline support: only in production builds so dev hot-reload isn't cached.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
