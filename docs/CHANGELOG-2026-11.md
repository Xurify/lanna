# LangHarness, November 2026: what was built, when, and what is still unverified

Times are UTC. "Unverified" means the owner has not yet used it in the live app; the sandbox checks and the tests were run in the cloud.

## 1 November: phone and iPad, first slice

- **Route:** an installable responsive web app served from the PC, not a store app (E20). The reasoning, the iOS limits and the next steps are in [research/mobile-ipad.md](research/mobile-ipad.md).
- **Layouts:** Today, lessons, review, Read and Speak fit 390 px and 820 px with no sideways scroll. On a phone, or a touch screen narrower than 1024 px, the sidebar is a drawer over the page.
- **Touch:** 44 px targets for the sidebar, the reader's header and bottom bar, and the leave buttons. Keycap hints show only with a fine pointer. On touch, press and hold the Speak mic to talk.
- **Reader:** the tap-to-gloss card stays inside the screen edges (at 390 px it ran 15 px off the right edge).
- **Install:** manifest, icons rendered from the brand mark, Apple web-app meta tags, safe-area padding.
- **Unverified:** a phone or iPad cannot reach the app yet (the server binds to 127.0.0.1); Safari on iOS and iPadOS has not been run; the reader was checked with a synthetic episode, not a generated story; the press-and-hold was checked with simulated touch, not a real microphone on a device.
- **Earlier November work** (the Plan page, the Read shelf and the other PRs merged since 28 October) is in those PRs and is not narrated here yet.
