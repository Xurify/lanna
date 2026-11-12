# E36. Keep the browser bundle small, give every tab an instant response, measure a build (2026-11-03, branch `feat/motion-pass`)

**Why:** the owner found clicking tabs "very very slow". The causes ([research/slow-tabs.md](../research/slow-tabs.md)) were dev mode, 900 KB of KaTeX and Markdown parsing in every route, and a tab click with no response until the server finished.

**How to apply:**
- A client component imports `@/src/core` only for light things. Anything heavy lives behind `@/src/core/tutor` (KaTeX and the Markdown parsers in `math-delims` and `answer-presentation`, TypeBox's validator in `tool-parts`), which only a tutor component imports. The TypeBox schemas are in `question-schemas.ts` and `contracts/probe-schema.ts` (agent and tests only). Do not re-export any of them from `src/core/index.ts`; ESLint allows the two entry points and no other path.
- A tab you press lights at once (`components/language-switcher.tsx`), before the route changes.
- `app/loading.tsx` costs about 300 ms of extra long tasks on a full page load at 4x CPU (the fallback and the page hydrate separately) and nothing on a client navigation; it was kept because the click is what the owner feels. Next.js 16.4's Partial Prefetching with Cache Components was tried and not adopted: it fails on 72 `force-dynamic` exports and would bake per-request file reads into the build unless each is audited (see slow-tabs.md).
- Every page is server-rendered per request, so `app/loading.tsx` must exist: a tab click changes the URL and shows the page's shape at once (production build; dev mode does not prefetch).
- Judge speed on `npm run desktop:prod` or `node scripts/perf-check.mjs --cpu 4`, never on `desktop:dev`. A change that adds a large dependency to the shell shows up as long tasks in that table.
