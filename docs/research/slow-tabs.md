# Slow tabs: why clicking around felt slow

**Question:** the owner reported that clicking between tabs and using the app is "very very slow, some things more than others". What is the cause, and what fixes it?

**Date:** 2026-11-03. **Branch:** `feat/motion-pass`. **Decision:** E36.

## Method

`node scripts/perf-check.mjs --cpu 4` against a production build (headless Chromium, 4x slower CPU, a seeded profile), before and after; JS coverage of `/milestones` with Playwright; a static import trace from `components/sidebar.tsx` to find what the shell pulls in.

## Causes, in order of cost

1. **The app was run in dev mode.** `npm run desktop:dev` is `next dev`: each route compiles the first time it is opened (so a tab never visited is slow, a visited one is not: "some things more than others"), and React and the bundles are unminified. A production build does not do this. `npm run desktop:prod` now builds once and serves the build.
2. **KaTeX and the Markdown parsers were in every route.** `src/core/index.ts` re-exported `math-delims.ts`, which imports `content-reader.ts`, which imports KaTeX, mdast and micromark. Every client component imports that barrel (the sidebar does), so about 900 KB of JS (2.4 MB to 1.2 MB measured by coverage on `/milestones`) was parsed on every page. At 4x CPU the page-load long tasks fell from 620–880 ms to 66–183 ms, and 18 broken budgets became one.
3. **A tab click showed nothing until the server answered.** All 18 pages are `force-dynamic` (they read the learner's files) and there was no `loading.tsx`, so the URL and the sidebar stayed put until the page's data was rendered. `app/loading.tsx` now shows at once in a production build (checked with the server's reply held back 1.5 s: the URL changed and the skeleton showed within 500 ms). Dev mode does not prefetch, so it still waits there.

## Second pass (Next.js 16.4.4, `next analyze`)

The app was moved to Next.js 16.4.4, whose bundle analyzer ([post](https://nextjs.org/blog/ship-less-javascript-with-ai)) lists what each route loads. In the shared client bundle:

| Package | gzipped | What fixed it |
|---|---|---|
| `next` (framework) | 338 KB | nothing to do |
| `typebox` | 118 KB | the tool-input schemas moved to `question-schemas.ts` and `contracts/probe-schema.ts`; the parsers (`typebox/value`) behind `@/src/core/tutor` |
| KaTeX on `/map` | 75 KB | `LatexGlyph` loads KaTeX on first use and shows the plain character until then |

Per-route JS fell from about 561 KB to about 480 KB gzipped. The chat route keeps KaTeX, Markdown and the parsers statically: its messages are on screen at once, so deferring them there would only delay the first paint, and it would break server rendering of the cards.

The main nav also lights the pressed row at once. `app/loading.tsx` was measured both ways: it adds about 300 ms of long tasks to a full page load at 4x CPU (about 75 ms on a normal CPU, once, at app start) and nothing to a client navigation, where it shows the page's shape while the server renders. Kept.

## Partial Prefetching: tried, not adopted (2026-11-03)

Next.js 16.4's [Partial Prefetching](https://nextjs.org/docs/app/guides/instant-navigation) needs `cacheComponents: true`. Turning both on and building fails at once: 72 files export `dynamic = "force-dynamic"` (19 pages and 53 route handlers), and that segment config is not allowed with Cache Components, plus two `runtime = "nodejs"`. The migration is not a flag:

- **Pages (19):** each reads the learner's files with synchronous `fs` calls, which Next cannot see. Without `force-dynamic` they would be prerendered at build time with the developer's data in them, so each needs an explicit `await connection()` inside a `<Suspense>` boundary, and so does the root layout (it reads cookies and the settings file).
- **Route handlers (53):** a `GET` that does not read its request would also be baked at build time. Every one has to be audited by hand.
- **Payoff:** the App Shell of these pages would be their skeleton, because all their content is per-request. `app/loading.tsx` already gives that shell on a client navigation. What Partial Prefetching adds is prefetching URL-specific content, which these pages do not have.

So the cost is high and the risk is stale data in a learning app, for a result `loading.tsx` mostly gives already. Not adopted. What was done in its place on 2026-11-09 is in [instant-navigation.md](instant-navigation.md): the whole page is rendered while the pointer rests on its link. Revisit if pages move to cached reads (a cache keyed on file mtime would make `"use cache"` honest), which would also speed the server render itself.

## What did not need fixing

Interactions in the lesson and Review (answer, Check, Continue) paint in 70–150 ms at 4x CPU, and settings open in 150 ms. The API calls a page makes on load are 12–45 ms each.

## Left open

Today's click-to-URL is the slowest tab (374 ms at 4x CPU, about 90 ms on a normal CPU): its server render reads the progress summary. A cache keyed on the files' size and mtime, as E-notes in `docs/development.md` describe for the review log, is the next step if it is felt.
