# Plenty

Thanksgiving & party meal planner: pick a menu, get a scaled grocery list and a cooking timeline.

```
npm install
npm run dev     # http://localhost:5173
npm test        # planner logic tests
npm run build
```

- `src/domain/` is pure TypeScript (no UI): `data.ts` (dish library), `planner.ts` (sizing, scaling, grocery, timeline), `format.ts`.
- `src/App.tsx` is the mobile-first UI (Home / Menu / Groceries / Plan). State persists to localStorage.
- Ported from the prototypes in Downloads. Not yet built: the wide web layout from `plenty-web-prototype.html`.

## Installing as a PWA
The service worker only registers in production builds, and installing needs HTTPS (localhost counts for testing).
```
npm run build && npm run preview   # then open in Chrome and use Install, or on iPhone: Share > Add to Home Screen
```
To use it on a phone, deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages). Bump `VERSION` in `public/sw.js` when you want clients to drop old caches.

## Sharing menus with guests (Supabase)
Guests open a link, see the menu with amounts and recipes, and tap **I'll bring this**. Their sign-ups flow into your plan (the dish leaves your grocery list). Only you can edit the menu. Your notes stay private. Without the two settings below the app works exactly as before and the Share card is hidden.

1. Create a free project at supabase.com.
2. In the dashboard open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and run it.
3. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key.
4. `cp .env.example .env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. `npm run build`, then publish `dist/` as before.

How it is protected: the tables are locked, and the app only calls the functions in `schema.sql`. Anyone with a link can read that event and add or remove their own sign-ups. Only the owner's device holds the secret edit token (the database stores just its hash). The anon key is designed to be public.

Limits and to-dos: guest names are stored in your Supabase project (mention this in a privacy policy before charging users); there is no automatic cleanup of old events yet; one share link per mode.

Develop without Supabase: `node supabase/mock-server.mjs` runs the same SQL in memory on http://localhost:54321, then start the app with `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local npm run dev`. `npm test` also runs the SQL against a real Postgres (PGlite).
