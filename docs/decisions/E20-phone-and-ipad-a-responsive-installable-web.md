# E20. Phone and iPad: a responsive installable web app, served from the PC (2026-11-01)

**Why:** the owner wants LangHarness on a phone and an iPad. A store app would have to move the keys and the learner's data off the PC, needs an Apple developer account, and sits in the weakest position under App Store guideline 4.2 (a thin client to a server the owner runs). A responsive web app keeps one UI for the desktop and the tablet, and keeps the data (E7) and the keys (E5) on the PC. The route and its limits are in [research/mobile-ipad.md](../research/mobile-ipad.md).

**How to apply:**
- One UI. Phone and tablet layouts are CSS breakpoints and pointer variants on the same components, not separate screens.
- Choose by pointer, not by width, for touch behavior: `pointer-coarse:` for 44 px targets and the press-and-hold microphone, `pointer-fine:` for keycap hints (E4a), and `touch-narrow:` (a coarse pointer below `lg`) for the sidebar drawer.
- Every tappable control is at least 44 px tall on touch (the Apple HIG minimum). The sidebar gets this from one rule in `app/globals.css` (`[data-sidebar]`); reader and lesson controls carry `pointer-coarse:min-h-11`. A word inside a sentence keeps its line height, because inline padding does not grow the line box, so its tap area is 39 px tall on a phone. Do not make it taller: the lines would move on touch.
- Pad for the safe areas with `env(safe-area-inset-*)` on the shell and the drawer. The bottom navigation was removed on 2026-11-02 with the Quiet tool redesign. `viewport-fit=cover` and `theme-color` come from `app/layout.tsx`.
- Installable: `app/manifest.ts` (standalone, starts at `/`, the app's colors) and `app/apple-icon.png`, rendered from `build/mark.svg` by `scripts/make-pwa-icons.mjs`. `app/layout.tsx` sets `apple-mobile-web-app-capable` explicitly: Next 16 emits only the standard `mobile-web-app-capable`, and iOS reads the Apple name for a full-screen launch.
- The server stays on `127.0.0.1` in every mode. A phone reaches it only through Tailscale Serve, which connects from this computer, and only once remote access is on (E21). Do not bind it to the network: it holds the keys and the learner's data.
- Browser storage holds only per-viewer conveniences. WebKit bug 237350 reports that iOS removes a Home Screen web app's storage after seven days unused, so progress belongs on the PC (E7).
