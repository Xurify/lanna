# Instant navigation: the next page on screen before the server answers

**Question:** the owner asked for tab and section switches that feel instant, "any and every interaction", and pointed at how Vercel made v0's navigations instant. What in that approach fits this app, and what is left that is slow?

**Date:** 2026-11-09. **Branch:** `feat/instant-navigation`. **Decision:** E86. It follows E36.

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
| --- | --- |
| Define instant, test it with the server held | Taken: `scripts/instant-check.mjs` |
| Failing test first, then the fix | Taken: the check was written and run against the old build first (table below) |
| A prerendered shell per route, cached in the browser | Not taken. Every page here is the learner's own files, so the shell would be the skeleton `app/loading.tsx` already gives, and turning Cache Components on means auditing 72 `force-dynamic` exports |
| Do not prefetch whole pages, it strains the server | Reversed. The server is the learner's own computer and a page renders in 10 to 50 ms, so the whole page can be rendered before the click, once its render starts no paid work |

So the idea kept is the definition and the test. The mechanism is the older one Next.js still has without Cache Components: a full prefetch, asked for when the learner shows where they are going.

## What was slow

Measured on a production build with `scripts/perf-check.mjs` (1x CPU, this PC, seeded profile with a year of reviews), before any change:

- A sidebar click changed the URL in about 15 ms and the page was complete in 19 to 45 ms. Interactions (Review check and continue, lesson answer and continue, Settings) painted in 7 to 14 ms and finished in 42 ms or less.
- So the build was not slow in milliseconds. What a learner could still see or feel: nothing happens until the mouse button comes back up (about 90 ms of a normal click), then the skeleton, then the page.
- **Two waits on a model, found by reading the code** (the seeded profile has no keys, so no measurement shows them). A unit's lesson and Listen asked the cheap model for close wrong meanings inside the page render and waited up to 6 s for the answer (`DEFAULT_WAIT_MS` in `src/server/distractors.ts`). Listen has been typing-only since E38 and never shows those meanings.
- **`next dev` is the slow case, and this work does not change it.** With the server held, a click in dev mode changes nothing on screen at all, with or without a pointer resting on the row (`node scripts/instant-check.mjs --dev`, also with `--rest 2500`): Next.js does not use prefetched pages in development. `npm run desktop:dev` is `next dev`. E36 already says to use `npm run desktop:prod` to feel the app's real speed; that is still the largest single difference available on the PC.

## The check

`node scripts/instant-check.mjs` (after `npm run build`): for each sidebar row, rest the pointer on it for 300 ms, hold every request the page makes, click (button down, 90 ms, button up) and read what is on screen 1.2 s later, with the time from the button going down.

- **page**: the page itself is up.
- **shell**: the URL changed and `loading.tsx` shows.
- **blocked**: nothing changed.

| Build | Rows | On screen with the server held | ms |
| --- | --- | --- | --- |
| Before | all 16 | shell | 100 to 123 |
| After | 15 | page | 18 to 47 |
| After | Review | page | 145 in the last full run; 53 to 145 across ten runs |

At 4x CPU after the change: the page in 140 to 402 ms (no run of the old build at 4x CPU was kept). With the pointer resting only 40 ms before the click (measured when twelve pages were rendered ahead), eleven were still up and Progress, the slowest to render, showed the shell first.

## What was built

1. **Render ahead on intent** (`components/instant-navigation.tsx`, `lib/render-ahead.ts`). One listener for the whole app: when the pointer comes over a link, a link takes focus, or a finger or mouse button goes down on one, and the link is to a sidebar page, the router is asked for the whole page (`router.prefetch` with `kind: "full"`). The jump palette does the same for the row it has selected, and an end screen for the page it closes to.
2. **Every sidebar page may be rendered ahead**, because none starts paid or network work when it renders. Three did and were changed: Read's shelf top-up and Watch's refresh of the picks now run when the screen is really open (the reader and the Watch shelf ask for them on mount), and Listen's close-meanings call is gone. A test reads each sidebar page file and fails if it calls one of those starters. Three renders still write a local file the first time: Today's data READMEs (once per server start), Mistakes' first snapshot, and Study's schedule, which is drawn from a fixed seed and start date. A pointer passing the link can now cause that first write.
3. **Freshness.** Next.js keeps a full prefetch for `experimental.staleTimes.static` seconds and will not ask again sooner; the lowest value it takes is 30, and that is what `next.config.ts` sets (the default is 300). A page rendered less than 2 s before the click is shown as it is. One rendered 2 to 35 s before is shown at once and then refreshed (`router.refresh()`), so what stays on screen is current; the 5 s past 30 cover the gap between when a page was asked for and when it arrived. Milestones, Mistakes, Speak and Watch kept their server data in state and would have ignored that refresh; they follow it now, until the learner changes something on the page (`components/use-server-value.ts`).
4. **Sidebar rows go on mouse-down**, as tabs do in a desktop app. Touch and the keyboard still go on the click.
5. **A lesson does not wait on a model when it is opened from Today.** A unit's lesson is the same twelve reps until the unit is practiced or the day turns (`lessonSeed`), and Today asks the server to start writing the close meanings for the first lesson still to do (`GET /api/lesson?unit=…&warm`). Opening the lesson then finds them kept, or still being written, and in neither case waits.
6. **Log and Words arrive with their first list**, read with the page as the other pages do; both still read again in the browser.

## What it costs

- One server render per page per 30 s at most, when a pointer passes over its link.
- A refresh after arriving on a page that was rendered 2 to 35 s earlier: one more render of that page, and the sidebar's links ask for their skeletons again (small requests that do not render a page; measured at 7.6 kB against 40 kB for the Progress page itself).
- The close meanings for the next lesson are asked for when Today is shown, not when the lesson is opened: at most one cheap batch per unit, per finished lesson, per day, also on a day the lesson is not opened. They are kept by sentence, as before (E1).
- A lesson left half way comes back with the same twelve reps that day.
- A sidebar row can no longer be cancelled by dragging off it before letting go.

## Left open

- **Dev mode**, above.
- **A lesson opened from the Curriculum or a link** still goes through `loading.tsx`, and still waits up to 6 s the first time its sentences need close meanings.
- **A chat page** reads a whole record and holds live state (a running turn), so it is not rendered ahead.
- **Review's first deck** is fetched after the page mounts, because asking for it mints the day's new card.
- **Saving waits for the server** before the screen changes: adding or removing a milestone, logging outside listening, deleting a chat, changing the goal, switching language. On this PC the calls a page makes take 12 to 45 ms; none was changed to show its result first.
- **The guard test reads page files only.** A page that reaches a model through a helper with another name passes it.
- **The PC and the packaged window** were not measured here.
