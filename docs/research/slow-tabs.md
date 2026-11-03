# Slow tabs: why clicking around felt slow

**Question:** the owner reported that clicking between tabs and using the app is "very very slow, some things more than others". What is the cause, and what fixes it?

**Date:** 2026-11-03. **Branch:** `feat/motion-pass`. **Decision:** E36.

## Method

`node scripts/perf-check.mjs --cpu 4` against a production build (headless Chromium, 4x slower CPU, a seeded profile), before and after; JS coverage of `/milestones` with Playwright; a static import trace from `components/sidebar.tsx` to find what the shell pulls in.

## Causes, in order of cost

1. **The app was run in dev mode.** `npm run desktop:dev` is `next dev`: each route compiles the first time it is opened (so a tab never visited is slow, a visited one is not: "some things more than others"), and React and the bundles are unminified. A production build does not do this. `npm run desktop:prod` now builds once and serves the build.
2. **KaTeX and the Markdown parsers were in every route.** `src/core/index.ts` re-exported `math-delims.ts`, which imports `content-reader.ts`, which imports KaTeX, mdast and micromark. Every client component imports that barrel (the sidebar does), so about 900 KB of JS (2.4 MB to 1.2 MB measured by coverage on `/milestones`) was parsed on every page. At 4x CPU the page-load long tasks fell from 620–880 ms to 66–183 ms, and 18 broken budgets became one.
3. **A tab click showed nothing until the server answered.** All 18 pages are `force-dynamic` (they read the learner's files) and there was no `loading.tsx`, so the URL and the sidebar stayed put until the page's data was rendered. `app/loading.tsx` now shows at once in a production build (checked with the server's reply held back 1.5 s: the URL changed and the skeleton showed within 500 ms). Dev mode does not prefetch, so it still waits there.

## What did not need fixing

Interactions in the lesson and Review (answer, Check, Continue) paint in 70–150 ms at 4x CPU, and settings open in 150 ms. The API calls a page makes on load are 12–45 ms each.

## Left open

Today's click-to-URL is the slowest tab (374 ms at 4x CPU, about 90 ms on a normal CPU): its server render reads the progress summary. A cache keyed on the files' size and mtime, as E-notes in `docs/development.md` describe for the review log, is the next step if it is felt.
