# Phone and iPad: which route, and what the first slice does

Date: 2026-11-01. Decision: [E20 in DECISIONS.md](../DECISIONS.md). Owner's question: "I'm thinking of turning our app into a mobile app and tablet (iPad) app."

## Answer

Ship LangHarness as a responsive, installable web app served from the owner's PC. Do not start a store app yet. The first slice makes the existing screens work at phone and iPad widths with touch targets, a drawer sidebar, safe-area padding, a manifest and icons, and a press-and-hold microphone. A phone or iPad still cannot reach the PC until a pairing step and HTTPS exist, so the next slice is reachability, not more layout.

## Routes considered

| Route | What it is | For | Against |
|---|---|---|---|
| **Responsive installable web app (chosen)** | The current Next app, laid out for phones and tablets, added to the home screen | One UI for desktop and tablet; the data (E7) and the keys (E5) stay on the PC; no Apple account needed to try it; each change ships in hours | Not in the App Store; the iOS limits below; the PC must be reachable from the device, securely |
| Capacitor or Ionic shell | The same web UI inside a native app, sent to the App Store | Store listing; native plugins if needed later | App Store guideline 4.2 (Minimum Functionality) rejects thin wrappers; this app would be a thin client to a server on the owner's PC, the weakest case; needs an Apple developer account, which only the owner can create |
| React Native or Expo rewrite | Native screens rebuilt in React Native | Best native feel | A second UI for every screen; the UX changes almost daily, so every pass would be done twice |
| Swift or SwiftUI | A separate iOS app | Best platform fit | A third codebase next to the desktop app and the web UI; the same account and store questions |

Revisit a native shell when a feature needs something the browser cannot give (background audio that survives the screen locking, for example), or when the owner wants a store listing and has the account.

## What iOS and iPadOS allow (facts and their sources)

These are the points the route depends on. Where a point was taken from a search result rather than the page itself, the source says so.

- **Home Screen launch.** Share, then Add to Home Screen, opens the app full screen when the page declares the Apple web-app meta tags. iOS has no install prompt (`beforeinstallprompt` is not supported in Safari), so the app explains the step itself.
- **Secure context for the microphone.** `getUserMedia` works only in a secure context: HTTPS, or `localhost` on the same machine. A phone on the home network reaching `http://192.168.x.x` gets no microphone. MDN, "Secure contexts" (not re-checked in this session).
- **Push.** Web push reached iOS and iPadOS in 16.4, only for Home Screen web apps, and the permission request has to come from a user gesture. WebKit, "Web Push for Web Apps on iOS and iPadOS" (https://webkit.org/?p=13878, found in a search, page not opened). Not needed for this slice; relevant later for a "your review is due" note.
- **Storage eviction.** WebKit bug 237350, "Web App Added to Home Screen Cookies Deleted After 7 Days" (https://bugs.webkit.org/show_bug.cgi?id=237350, found in a search, thread read). A report, not a device test: on current iOS the behaviour is unverified. A secondary report of the seven-day rule for browser storage: https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833. **Consequence:** progress stays in the PC's `data/` folder (E7), and the browser holds only per-viewer conveniences.
- **Input zoom.** Safari zooms into any text field whose font size is under 16 px. The sidebar search is 16 px on touch screens.
- **Touch targets.** Apple's Human Interface Guidelines ask for at least 44 × 44 pt for tappable controls; Android's Material guidance is 48 dp (https://developer.apple.com/design/human-interface-guidelines/ and https://m3.material.io, not re-checked in this session). This slice uses 44 px as the floor.
- **Safe areas and the status bar.** `viewport-fit=cover` lets the page run under the notch and the home indicator; `env(safe-area-inset-*)` pads the content; `theme-color` paints the status bar. Standard CSS and WebKit behaviour, verified in the sandbox only, not on a notched device.
- **Long press.** iOS shows a callout menu on a long press. `-webkit-touch-callout: none`, `user-select: none`, `touch-action: none` and a suppressed context menu stop it on the microphone button.
- **App Store.** Guideline 4.2, "Minimum Functionality" (https://developer.apple.com/app-store/review/guidelines/, not re-read here). Third-party write-ups on rejected web wrappers, for example https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper, describe the same risk. Judgement: a store app is a later option, not a first one.

## Reachability: the real limit

`npm run dev` and the desktop shell bind the server to `127.0.0.1`, so nothing on the network can reach it. This is deliberate. The server holds the owner's API keys (`.env`) and the learner's data, and it has no login. Binding it to the home network before a login exists would expose both.

Options for the next slice, with a recommendation:

1. **Pairing code, plus HTTPS through Tailscale Serve on the owner's tailnet (recommended).** The phone and the PC join the same private network; HTTPS certificates for the PC's tailnet name come from Tailscale (https://tailscale.com/docs/how-to/set-up-https-certificates, found in a search). No port forwarding, nothing public. A pairing code on the first visit issues a long-lived cookie. Owner steps: create or sign in to a Tailscale account, install it on the PC, the iPhone and the iPad, and enable HTTPS certificates in the admin console.
2. **Home network with a local certificate authority.** Works without an account, but the certificate root must be installed and trusted on each device, and a new device means repeating that. More fragile.
3. **A public tunnel.** Reachable from anywhere, but it puts the app on the internet, so it needs strong authentication before it is used. Not recommended for personal data without that.

## What this slice changes

- **Layouts.** Today, lesson, review, Read and Speak fit 390 px and 820 px with no horizontal scroll (measured). On a phone, or a touch screen narrower than 1024 px, the sidebar is a drawer over the page, closed on load.
- **Touch targets (measured in the sandbox, touch emulation).** The sidebar's rows and icon buttons are 44 px tall, and the icon buttons 44 px wide (were 36 and 32). The reader's header controls and its Otázky, Prehrať and Uložiť buttons are 44 px tall (were 24 to 32). The leave controls on the lesson and reader are 44 px. Keycap hints (`Enter`, `1`–`4`) show only where a fine pointer is the main input (`pointer-fine:`), so a touch screen never shows a key it does not have.
- **Word card (Read).** On a phone the tap-to-gloss card ran 15 px off the right edge at 390 px. It now measures its own layout width and its anchor word and nudges itself inside the screen, with a CSS translate, so the open animation is untouched (verified at 390 and 820).
- **Press and hold the Speak microphone (touch only).** Hold to talk, release to send. A release before the microphone is live still ends the take. The keyboard and mouse toggle is unchanged. Verified with simulated touch: listening state on hold, one send on release, no double toggle.
- **Install.** `app/manifest.ts` (standalone, starts at `/`, the app's colours), `app/apple-icon.png` and three manifest icons, rendered from `build/mark.svg` by `scripts/make-pwa-icons.mjs`. `app/layout.tsx` sets the viewport (`viewport-fit=cover`, `theme-color`) and the Apple web-app tags. Next 16 emits the standard `mobile-web-app-capable` tag, so `apple-mobile-web-app-capable` is set explicitly as well (both served, checked with curl).
- **Tests.** `tests/pwa.test.ts`: the manifest's start URL and display mode, the icon sizes on disk, the 180 px iOS icon.

## Verification

Method: the sandbox (`npm run dev:sandbox -- --seed`): a throwaway data folder outside the repo, fake keys, a free port. Playwright with a 390 × 844 and an 820 × 1180 viewport at 2× device pixels, touch emulation on. Screenshots are in the project audit folder, `audit/mobile/` (see its README).

| Check | Result |
|---|---|
| Horizontal overflow, Today, lesson, review, Read at 390 and 820 | none |
| Bottom navigation, phone | 57 px |
| Keycap hints visible on touch | 0 |
| Reader word card inside the screen, 390 px | yes (was 15 px over) |
| Sidebar controls under 44 px, drawer open | 0 |
| Reader controls under 44 px, excluding words in running text | 0 |
| ESLint on the changed files | clean |
| Typecheck | 89 errors, all in files this slice did not touch, the same count as main |
| Test suite | 2,772 tests: 2,759 pass, 13 fail in 6 files (automatic updates, desktop payload and platform, say-it-faster round, rejected examples, server title guard, subscription auth). The same 18 failing lines occur on a clean worktree of main, so they predate this change. |

**Not verified:** Safari on iOS and iPadOS (no device here); the Home Screen launch; the real microphone on a device; the Electron window; the PC itself; a generated story from the live model (the reader was checked with a synthetic A1 episode); pronunciation scoring.

**Known gaps:**

- Words inside a sentence are 39 px tall on a phone (44 px on an iPad). Inline padding does not change the line box, so the tap area stays within the line height; a taller box would push the lines apart on touch. Accepted for now.
- `/api/read` returns HTTP 500 in the sandbox because the cheap-model key is fake. The reader page itself renders from the story id. Not caused by this change (no server code touched); not investigated further.
- The landscape iPad sidebar is inline, not a drawer, and gets the same 44 px rows. Not checked by screenshot.

## Next slices

1. **Reachability.** Pairing code and HTTPS through Tailscale Serve; the server binds to the tailnet interface only after the login exists. Owner steps listed above.
2. **Check on the device.** Install from Safari on the owner's iPhone and iPad; the microphone over HTTPS; the press-and-hold on a real screen; the full-screen launch; what storage survives a week away.
3. **A native shell** only if a device check shows a feature the browser cannot do, or the owner wants a store listing and has the account.

Assumption, not measured: the iPad is the main lesson device and the phone is for short reviews. The layouts serve both; nothing in this slice depends on that split.
