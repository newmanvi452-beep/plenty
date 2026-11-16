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
