# Web security review: what changes when the app has a public address

Date: 2026-11-09. Decision: [E88 in DECISIONS.md](../DECISIONS.md). Context: [plans/always-on-server.md](../plans/always-on-server.md), route W (the app at its own address behind a sign-in).

## Question

If LangHarness is served on the internet behind a sign-in, what can a stranger, a hostile web page, or a prompt-injected model reach, and what does it cost to close each path?

## Method

I read every server-side network call, every route that takes a body or an id, every place a key or an upstream error could reach the page, the response headers, the subscription controls and the dependency audit. Each fix has a test; the CSP was checked in a production build in Chromium. The sign-in and the gate (`proxy.ts`, `src/server/remote-access*.ts`) are on another branch and are not reviewed here.

## Findings

Severity assumes the app is reachable from the internet behind a sign-in.

| # | Finding | Severity | Status | Evidence |
|---|---|---|---|---|
| 1 | `web_fetch` and `web_fetch_pdf` fetched any URL the model chose. A page the model had read could make it fetch `http://127.0.0.1:3010/api/...` (this computer passes the gate without a sign-in, E21), or a cloud metadata address, and the result went back to the model. | High | Fixed: `safeFetch` | `tests/safe-fetch.test.ts`: 88 cases for addresses, redirects, pinning, caps; the two tools refuse loopback and metadata |
| 2 | Both tools read the whole body before checking its size (the check used `Content-Length` only), so a large or compressed response could exhaust memory. | Medium | Fixed: streamed, decoded-size cap | gzip bomb of 5 MB in under 10 KB is stopped |
| 3 | A caption track address from YouTube's player response was fetched from whatever host it named. | Low | Fixed: only `youtube.com/api/timedtext` | `isYouTubeCaptionUrl` test |
| 4 | The browser fallback that draws a model-written SVG ran its script with network access on the server's machine. It runs only when the native renderer fails. | Medium | Fixed: script off, requests only to `file:`, `data:`, `about:` | Type-checked and reviewed. Not run: it needs Chrome and a failing SVG, and no test reaches it |
| 5 | Model-written markdown can load a remote image, which carries data out in its address. | Medium | Mitigated by the CSP | In Chromium, an image, fetch, socket, frame and script to another host are all blocked |
| 6 | No cap on request bodies: a 10 MB message to the tutor would have gone on to a paid model, and oversized JSON failed with a parse error. | Medium | Fixed: 413 per route by `Content-Length` | `tests/body-limits.test.ts`, plus a test that fails when a route skips the check |
| 7 | Seven places passed a provider's raw error body (200 characters) to the page. A provider that echoed the authorization header would have shown the key. | Low | Fixed: `redactSecrets` | Test with a provider that echoes the key; fails without the fix |
| 8 | The ChatGPT, Copilot and Grok controls check the browser's origin, which is not a login, and the status call returns the account's email. Their credential files sit beside `auth.json`. | High on a public address | Fixed: all controls answer 403 while `LH_PUBLIC_HOST` is set | `tests/subscriptions-public-host.test.ts`. Existing connections keep working for the model slots; delete the files on a public server |
| 9 | Response headers: none of the usual ones, and no CSP. | Medium | Fixed in `next.config.ts` | Headers read from a production server; 16 pages load with no violations |
| 10 | `script-src` allows inline script. | Medium | Open | Next's hydration scripts are inline and a static header cannot hold a nonce. Needs `proxy.ts` |
| 11 | A request from this computer's own address passes the gate with no sign-in (E21). On a VPS, any other process or container that can reach `127.0.0.1:3010` can use the whole API. | High on a shared server | Open, outside this branch | Design of the gate. Bind the app where nothing else reaches it, or add a secret header from the reverse proxy |
| 12 | Path traversal through an id, name or segment. | None found | Pinned by a test | 12 hostile ids against 51 route and method combinations, plus the voice and language of a clip; every store checks its ids with a strict pattern |
| 13 | Model-written Mermaid and markdown injected into the page. | None found | Reviewed | 7 Mermaid payloads and 11 markdown payloads: the renderers escape `<`, `>` and quotes, and drop `javascript:` and `data:` links. Model SVG is shown as an image, which runs no script |
| 14 | Keys: `GET /api/keys` shows the last four characters and the length of each key, and a plain setting (the Azure region) in full. | Info | Accepted | `tests/secrets-leak.test.ts` calls every GET route with fake keys seeded |
| 15 | `GET /api/storage` returns absolute paths on the server. | Low | Accepted | Behind the sign-in; reveals the folder layout only |
| 16 | The Azure speech region is part of a host name. | None | Already checked | `^[a-z0-9]{4,40}$` in `azureKeys` |
| 17 | Dependency advisories, see below. | Mixed | Accepted, with reasons | `npm audit --omit=dev` |

## Request body caps

| Kind | Limit | Routes |
|---|---|---|
| JSON | 256 KB | every route that reads JSON and is not listed below |
| Prompt | 512 KB | `PUT /api/settings/prompts/*` |
| Cheatsheet | 1 MB | cheatsheet create, replace and add (the text also stops at 200,000 characters) |
| Import | 4 MB | `POST /api/watch/discover` (a YouTube history or subscription list) |
| Recording | 8.25 MB | `/api/stt`, `/api/speak`, `/api/pronounce` (the recording itself stops at 8 MB) |
| Subscription controls | 16 KB | their own check |
| Pairing | not changed | the pairing routes belong to the sign-in branch |

The limit is read from `Content-Length`. A body sent without a length is cut off by Next's request buffer (`proxyClientMaxBodySize`, now set to 10 MB) and should be refused by the reverse proxy first.

## The content security policy

Enforced in a production build only, so `next dev` keeps working:

- `default-src 'self'`; `connect-src 'self'` and Deepgram's dictation socket; `frame-src` YouTube's player hosts; `img-src` this origin, `data:`, `blob:`, YouTube thumbnails and Google's avatar hosts; `object-src 'none'`; `base-uri`, `form-action` this origin; `frame-ancestors 'none'`.
- `script-src` and `style-src` allow inline code (finding 10).

Checked in a production build in Chromium 153, with the sandbox's data folder:

- Sixteen pages (Today, Curriculum, Review, a lesson, Blitz, Listen, Read, Watch, Speak, Speed, Words, Grammar, Progress, Milestones, Mistakes, Sources) load with no violation. Typing and clicking in two lessons add none.
- Negative controls are blocked: an image, a `fetch`, a WebSocket, an iframe and a script, each to another host. Another page cannot frame the app.
- The microphone opens, the dictation worklet loads, and a blob URL plays.

Not exercised: YouTube's player (the sandbox cannot reach YouTube, so the `iframe_api` script and the embed never loaded; if Watch shows a blank player after this ships, add the host the browser console names to `script-src` or `frame-src`), Deepgram's socket, and Google avatar images.

One thing seen on the way, not caused by this change as far as I can tell: React reports a hydration mismatch (#418) now and then on Today, Review and Watch in a production build. With the policy removed it still happened on Today and Review. On Watch it appeared in 9 of 54 loads with the policy and 0 of 37 without; the two ways of loading differ in how the response is delivered, so this does not show the policy is the cause. If it appears on Watch after this ships, remove the CSP header first and look again.

## What a public deployment must switch off or protect

- The subscription sign-ins: off while `LH_PUBLIC_HOST` is set. Delete `chatgpt-credentials.json`, `github-copilot-credentials.json` and `xai-credentials.json` from the server.
- The Electron bridges (the YouTube sign-in window, cache clearing, fonts, the desktop secret): they exist only inside the desktop window and are not reachable from a browser. A server has no Electron, so nothing to switch off.
- `POST /api/reset` moves the learner's progress into backups; `GET /api/storage` lists server paths. Both are behind the sign-in.
- The reverse proxy: `client_max_body_size 10m`, HTTPS, and the app bound to `127.0.0.1` on a port no other service on the machine uses.
- Keys in the environment of the service: use `auth.json` on a volume, and keep `.env.local` out of the image.

## Dependencies

`npm audit --omit=dev` lists nine advisories: 1 critical, 5 high, 3 low. None was fixed here (`npm audit fix` was not run).

| Package | Severity | Reached how | Verdict |
|---|---|---|---|
| `dompurify` ≤ 3.4.16 | critical | through `mermaid`, through `streamdown` | The app draws Mermaid with `pele` and intercepts Mermaid fences, so Streamdown's own Mermaid path is not used. Not confirmed at runtime. Update `streamdown` when a release moves its `mermaid` |
| `puppeteer-core`, `chromium-bidi`, `zod` < 4.6.6 | high | the headless browser | Validates messages from the local browser, not from a user |
| `undici` 7.x | high | provider clients (`openai`) | A denial of service by a malicious server; the providers are fixed hosts |
| `source-map-js` | high | the stylesheet build | Build time only |
| `katex`, `mermaid`, `streamdown` | low | as above | Not reached |

## Not verified

- YouTube's player, Deepgram's socket and Google avatars under the policy.
- The SVG fallback in a real browser.
- Anything about the sign-in and the gate, which are not on this branch.
- `Content-Length` is checked, but a chunked body was not tested against the real server.
- The time `safeFetch` takes against a real DNS and a real site: the tests use a stub for names and a local socket for the pinned connection.
- The proxy environment: `safeFetch` connects directly and does not use `HTTPS_PROXY`.
