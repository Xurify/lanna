# Instant navigation: the next page on screen before the server answers

**Question:** the owner asked for tab and section switches that feel instant, "any and every interaction", and pointed at how Vercel made v0's navigations instant. What in that approach fits this app, and what is left that is slow?

**Date:** 2026-11-09. **Branch:** `feat/instant-navigation`. **Decision:** E86. It follows [slow-tabs.md](slow-tabs.md) (E36).

## What v0 did

Source: [Making v0 navigations instant](https://nextjs.org/blog/making-v0-navigations-instant) (Next.js blog), and the guide it rests on, `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` (Next.js 16.4).

- **A definition.** A navigation is instant when the browser can start drawing the new page the moment of the click, from what it already holds, while the server sends the rest.
- **A test for it.** `instant()` from `@next/playwright` pauses the server side of a navigation and asserts what is on screen. A slow navigation is a failing test.
- **A loop.** For each slow navigation: write the failing test, fix the route, run it until it passes, keep the test.
- **The fix.** Move per-request data below a `<Suspense>` boundary and mark the rest cacheable (`"use cache"`), so Next.js can prerender a shell per route and keep it in the browser (Cache Components and Partial Prefetching).
- **Why not prefetch whole pages.** The post says full prefetching "can be expensive and strain your servers". That is a cost of a hosted app with many users.

The post gives no timings in its text; the result it states is which routes went from blocking to instant, and 16 tests.

## What fits this app, and what does not

| v0 | Here |
|---|---|
| Define instant, test it with the server held | Taken: `scripts/instant-check.mjs` |
| Failing test first, then the fix | Taken: the check was written and run against the old build first (table below) |
| A prerendered shell per route, cached in the browser | Not taken. Every page here is the learner's own files, so the shell would be the skeleton `app/loading.tsx` already gives, and turning Cache Components on means auditing 72 `force-dynamic` exports ([slow-tabs.md](slow-tabs.md), still true) |
| Do not prefetch whole pages, it strains the server | Reversed. The server is the learner's own computer and a page renders in 10 to 50 ms, so the whole page can be rendered before the click |

So the idea kept is the definition and the test. The mechanism is the older one Next.js still has without Cache Components: a full prefetch, asked for when the learner shows where they are going.

## What was slow

Measured on a production build with `scripts/perf-check.mjs` (1x CPU, this PC, seeded profile with a year of reviews), before any change:

- A sidebar click changed the URL in about 15 ms and the page was complete in 19 to 45 ms. Interactions (Review check and continue, lesson answer and continue, Settings) painted in 7 to 14 ms and finished in 42 ms or less.
- So the build was not slow in milliseconds. What a learner could still see or feel: nothing happens until the mouse button comes back up (about 90 ms of a normal click), then the skeleton, then the page.
- **`next dev` is the slow case, and this work does not change it.** With the server held, a click in dev mode changes nothing on screen at all, with or without a pointer resting on the row (`node scripts/instant-check.mjs --dev`, also with `--rest 2500`): Next.js does not use prefetched pages in development. `npm run desktop:dev` is `next dev`. E36 already says to use `npm run desktop:prod` to feel the app's real speed; that is still the largest single difference available on the PC.

## The check

`node scripts/instant-check.mjs` (after `npm run build`): for each sidebar row, rest the pointer on it for 300 ms, hold every request the page makes, click (button down, 90 ms, button up) and read what is on screen 1.2 s later, with the time from the button going down.

- **page**: the page itself is up.
- **shell**: the URL changed and `loading.tsx` shows.
- **blocked**: nothing changed.

Before (old build), with the server held:

| Row | On screen | ms |
|---|---|---|
| all 16 rows | shell | 100 to 123 |

After:

| Row | On screen | ms |
|---|---|---|
| Today, Ask, Curriculum, Speak, Speed, Words, Grammar, Progress, Milestones, Mistakes, Log | page | 16 to 56 |
| Review | page | 132 (56 to 61 in three earlier runs) |
| Read, Listen, Watch, Study | shell | 9 to 12 |

At 4x CPU after the change: page in 94 to 362 ms, shell in 64 to 78 ms (no run of the old build at 4x CPU was kept). With the pointer resting only 40 ms before the click, eleven of the twelve pages were still up; Progress, the slowest to render, showed the shell first.

## What was built

1. **Render ahead on intent** (`components/instant-navigation.tsx`, `lib/render-ahead.ts`). One listener for the whole app: when the pointer comes over a link, a link takes focus, or a finger or mouse button goes down on one, and the link is to a page that can be rendered ahead, the router is asked for the whole page (`router.prefetch` with `kind: "full"`). The jump palette does the same for the row it has selected.
2. **Which pages** (`rendersAhead` in `lib/nav.ts`). Twelve sidebar pages only read the learner's files. Four start work when they render, so they are left out and still show the skeleton: Read tops up the shelf with a model, Listen asks a model for close options, Watch refreshes the picks from YouTube, Study draws its schedule on the first view. A test reads each page file and fails if a page marked `rendersAhead` calls one of those.
3. **Freshness.** Next.js keeps a full prefetch for `experimental.staleTimes.static` seconds and will not ask again sooner; the lowest value it takes is 30, and that is what `next.config.ts` sets (the default is 300). A page rendered less than 2 s before the click is shown as it is. One rendered 2 to 30 s before is shown at once and then refreshed (`router.refresh()`), so what stays on screen is current. Milestones, Mistakes and Speak kept their server data in state and would have ignored that refresh; they now follow it (`components/use-server-value.ts`).
4. **Sidebar rows go on mouse-down**, as tabs do in a desktop app. Touch and the keyboard still go on the click.

## What it costs

- One server render per page per 30 s at most, when a pointer passes over its link. Nothing is rendered for a page whose render is not free.
- A refresh after arriving on a page that was rendered 2 to 30 s earlier: one more render of that page, and the sidebar's links ask for their skeletons again (13 small requests that do not render a page; measured at 7.6 kB against 40 kB for the Progress page itself).
- A sidebar row can no longer be cancelled by dragging off it before letting go.

## Left open

- **Dev mode**, above.
- **Today's Start, a lesson, a chat.** A lesson's render may pay for close options and a chat page reads a whole record, so they are not rendered ahead. They still open through `loading.tsx`.
- **Pages that fetch after they mount** (Log, Words, Review's first deck): the page frame is instant, its list arrives one request later (12 to 45 ms in [slow-tabs.md](slow-tabs.md)).
- **The PC and the packaged window** were not measured here.
