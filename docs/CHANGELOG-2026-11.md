# LangHarness, November 2026: what was built, when, and what is still unverified

Times are UTC. "Unverified" means the owner has not yet used it in the live app; the sandbox checks and the tests were run in the cloud.

## 1 November: phone and iPad, first slice

- **Route:** an installable responsive web app served from the PC, not a store app (E20). The reasoning, the iOS limits and the next steps are in [research/mobile-ipad.md](research/mobile-ipad.md).
- **Layouts:** Today, lessons, review, Read and Speak fit 390 px and 820 px with no sideways scroll. On a phone, or a touch screen narrower than 1024 px, the sidebar is a drawer over the page.
- **Touch:** 44 px targets for the sidebar, the reader's header and bottom bar, and the leave buttons. Keycap hints show only with a fine pointer. On touch, press and hold the Speak mic to talk.
- **Reader:** the tap-to-gloss card stays inside the screen edges (at 390 px it ran 15 px off the right edge).
- **Install:** manifest, icons rendered from the brand mark, Apple web-app meta tags, safe-area padding.
- **Unverified:** Safari on iOS and iPadOS has not been run (the reachability slice below lists its own gaps); the reader was checked with a synthetic episode, not a generated story; the press-and-hold was checked with simulated touch, not a real microphone on a device.
- **Earlier November work** (the Plan page, the Read shelf and the other PRs merged since 28 October) is in those PRs and is not narrated here yet.

## 1 November: phone and iPad, reachability (second slice)

- **Route:** Tailscale Serve over the same loopback bind. The server does not listen on the network, even with remote access on, because Serve connects from this computer. Funnel is refused by design (E21). Options and sources: [research/remote-access.md](research/remote-access.md).
- **Switch:** Settings → Devices, off by default. Turning it off signs out every device, and the confirmation says so first.
- **Pairing:** a six-digit code, five minutes, five wrong tries, one code at a time. A paired device stays signed in for 180 days, is listed with its last use, and can be signed out on its own.
- **Gate:** while off, requests a proxy marked, and requests for another host, are refused. While on, the desktop window and paired devices pass; `/pair`, its one POST and the static assets stay public.
- **Recovery:** `npm run remote:off` turns the switch off and signs out every device.
- **Checked in the cloud, on a throwaway data folder:** 35 rule cases, 13 store cases (codes, tries, expiry, sessions, sign-out, turning off, an unreadable file), and a 16-step browser check against a sandbox server: the desktop switch and code, a phone pairing, the paired home screen, and turning it off again.
- **Unverified:** Tailscale and Serve on the owner's PC, and the headers Serve sends (`Host` and the `X-Forwarded-*` headers through Serve are not documented); the iPhone and iPad, Safari's cookie handling, and whether a Home Screen app shares Safari's cookies; the packaged desktop app with remote access on, whose port changes at each start, so it is not yet a fixed Serve target; dev hot reload through a tailnet name, which needs `allowedDevOrigins`; the PC itself, which needs a restart onto main. A Serve setup that sends no identity headers and keeps the Host as loopback would look like this computer; the guide tells the owner to turn the switch on first.
- **Test failures already on main:** 13 tests fail on main without this change: automatic-updates (6), desktop-payload (2), desktop-platform (1), fluency (1), rejected-examples (1), server-title-guard (1) and subscription-auth (1).
