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
- **Test failures already on main:** 13 tests fail on main without this change: automatic-updates (6), desktop-payload (2), desktop-platform (1), fluency (1), rejected-examples (1), server-title-guard (1) and subscription-auth (1). The next section clears all but one of them.

## 1 November: typecheck, the Standalone build and the lexicon restore

- **Typecheck:** 89 errors on main since PR #64 came from the optional `lemma` and `text` fields (`sk` is their legacy alias). Reads now go through `entryLemma()` and `exampleText()` in `src/core/review.ts`, and helper parameters take `Pick<…>` so both shapes type-check. No casts or ignores. `npm run typecheck` passes.
- **Lexicon restore:** PR #60's re-export put the 986 sentences marked `rejected` back into lessons and reviews, and it moved example positions, which card and lesson ids depend on (`word#position`). `curriculum/slovak/lexicon.json` now matches the pre-#60 file, plus one appended example, built with `scripts/merge-lexicon.mjs`: every example keeps its position and its `rejected` flag, and word fields are as #60 left them. For the learner, rejected sentences are excluded again. Cards and lesson reps made while #60 was on main may now point at another sentence; the owner should decide whether to reset those.
- **Tests:** the failing groups were fixture gaps, not product bugs. The fake Electron app lacked `userAgentFallback` and `commandLine`; the desktop payload fixture lacked the language prompts and the curriculum; the say-it-faster test built its own known set instead of the server's level-bounded one. Node 26, the version CI runs: 2807 of 2807 pass. Node 22: 2805 of 2807. The pi-ai package-exports test is environment-bound (E6). The ChatGPT bridge test failed once under full-suite load and passes alone, on main and on this branch.
- **Standalone:** `npm run build` passes, and so do the provider smoke, `build-server`, the Electron boot smoke and the native renderer tests (18 of 18). The boot smoke had a stale check: a fresh profile is sent once to `/start` (`app/page.tsx`), so `GET /` answers 307, not 200. It now accepts that first-run redirect and probes `/start` with 200.
- **Build warnings, not failures:** Next reports six "dynamic filesystem access" traces (`src/store/graph.ts`, `src/server/watch.ts`, `src/agent/subagents/headless.ts`, `src/agent/tools/pdf-read.ts`). Each can make Next trace more of the project into the server output. Left for a follow-up.
- **Unverified:** GitHub Actions (it does not run on this repo), the packaged Electron window, and the PC, which this thread could not reach.

## 1 November: this computer's browser no longer asks for a code

- **Cause:** PR #65 sent every loopback request without a device session to pairing when remote access was on, so the PC's own browser at localhost:3010 got the pairing page (the owner's screenshot).
- **Fix:** a request that names only this computer and carries no proxy evidence always passes, switch on or off. A request that came through Tailscale Serve still needs a paired device. Proxy evidence: the Tailscale identity headers, `Forwarded`, `X-Real-IP`, or a tailnet name in `Host` or `X-Forwarded-Host`.
- **Checked:** unit tests for the rule (this computer on both names, a phone, every proxy header, a tailnet name through `X-Forwarded-Host`, the desktop API check, and this computer getting the same answer with the switch on or off): 97 tests passing in the four focused files that cover this area (the rules, the store, the desktop API check, and the ChatGPT connection UI). A browser run in the sandbox, 19 checks passing: this computer's browser at `localhost` opens the app with the switch on and off; a phone with an identity header goes to pairing, pairs with a code, and is refused again with the switch off.
- **Unverified:** the PC itself (the owner needs to pull main and restart); the packaged Electron window (not launched in the cloud, though its requests take the same path); the Host header Tailscale Serve sends. If Serve rewrites Host to loopback and sends no identity header (tagged devices, Funnel), that traffic now looks like this computer. Keep Funnel off, and check the Host header on the PC.
- **CI:** this change adds no TypeScript errors. The 89 that had kept main's typecheck and Standalone builds red were cleared by PR #66 (see the typecheck section above).
