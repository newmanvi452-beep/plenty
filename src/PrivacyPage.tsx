import { Logo } from "./Logo";

export const CONTACT_EMAIL = "hello@serves20.com";

/** The privacy policy: plain language, reachable without signing in (address ends in #/privacy). */
export default function PrivacyPage() {
  return (
    <div className="app">
      <header className="top"><div className="brand"><Logo size={40} /><div><h1>Privacy</h1><p>Serves 20 · updated November 2026</p></div></div></header>
      <main>
        <section className="card" style={{ gap: 12 }}>
          <p className="sub">Serves 20 is a Thanksgiving and party planner. This page says what it keeps about you, who handles it, and how to erase it.</p>
          <h2 style={{ fontSize: 18 }}>What we keep</h2>
          <ul className="sub" style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>On your device.</b> Your events, menus, recipes, checklists and notes are saved in your browser or home-screen app. You never have to sign in to use them.</li>
            <li><b>If you sign in.</b> Your email address, and a copy of the same plans so they follow you between devices. There is no password: we email you a code.</li>
            <li><b>If you share a menu.</b> The menu, its amounts and the date, plus the names guests type when they sign up to bring a dish. Anyone with the link can see these.</li>
            <li><b>Guests.</b> A guest does not need an account. The name they enter and what they claim are stored with that shared menu, and a random key stays in their browser so they can undo their own sign-up.</li>
          </ul>
          <h2 style={{ fontSize: 18 }}>What we don’t do</h2>
          <p className="sub">No ads, no tracking, no analytics, and we never sell or rent your information. We don’t read your plans or look at your guests’ names.</p>
          <h2 style={{ fontSize: 18 }}>Who handles it</h2>
          <ul className="sub" style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>Supabase</b> stores accounts, saved plans and shared menus.</li>
            <li><b>Resend</b> delivers the sign-in code email.</li>
            <li><b>GitHub Pages and Cloudflare</b> serve the website and its address. They see ordinary web requests (such as your IP address), as any website host does.</li>
          </ul>
          <h2 style={{ fontSize: 18 }}>Deleting your information</h2>
          <ul className="sub" style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>Delete my account</b> (Profile, while signed in) erases your login, your saved plans and every menu you shared, right away.</li>
            <li><b>Stop sharing</b> on an event removes that shared menu and the names on it.</li>
            <li>Clearing your browser data removes what’s saved on that device.</li>
          </ul>
          <p className="sub">Sign-in codes expire after an hour. Deleted data is gone from our systems; backups made by our provider can take a short while to roll off.</p>
          <h2 style={{ fontSize: 18 }}>Children</h2>
          <p className="sub">Serves 20 is meant for adults planning meals. It does not knowingly collect information from children.</p>
          <h2 style={{ fontSize: 18 }}>Questions</h2>
          <p className="sub">Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If we change this policy, the date at the top changes.</p>
          <a className="linkbtn" href="./">← Back to Serves 20</a>
        </section>
      </main>
    </div>);
}
export const SUPPORT_EMAIL = "support@serves20.com";
