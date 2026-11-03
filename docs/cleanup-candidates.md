# Cleanup candidates (for the owner to approve)

Written 2026-11-02 on `refactor/remove-unused-fork-code`. Nothing here was deleted. Each item is either a whole user-facing feature, touches `data/` formats, or sits in auth, pairing, remote access, the Electron release pipeline or the Slovak/Russian code, so it needs a yes first.

Already removed (Tier 1, see the commits on the branch): 11 unused packages, `components/ui/textarea.tsx`, `GET /api/lexicon`, and the upstream `skills/learnharness` data skill with its Python tests. Also removed on 2026-11-03, after the owner's approval: `lib/sidebar-cookie.ts`, `components/week-card.tsx`, `components/strand-balance.tsx`, `components/phone-nav.tsx` and `tests/render-phone-nav.test.tsx`.

How to read the size column: files and lines are from `git ls-files` at the time of writing, including that feature's tests where they are named after it.

## Features and routes

| Candidate | What it is | Who uses it | Size | Risk |
|---|---|---|---|---|
| `/map` page | The knowledge-graph home LearnHarness opened on. LangHarness opens on Today; `app/map/page.tsx` renders `Home`. | Nobody, as far as the code shows: no link opens `/map`. It only counts as part of the Progress group in the nav highlight (`components/language-switcher.tsx`, `components/phone-nav.tsx`). Typing the address still works. | page: 1 file, 13 lines. The weight is the graph stack below. | Low alone. Removing the page without the graph stack changes nothing. |
| Graph stack (graph canvas, chain table, extraction, coverage, positions, clusters) | The upstream "everything you taught becomes a graph" system: `components/graph-view.tsx`, `graph-canvas.ts`, `chain-table.tsx`, `extraction-coverage.tsx`, `minimal-home.tsx`, the extractor/auditor/merger in `src/agent/subagents/extraction.ts` and `src/core/graph.ts`, and `app/api/graph/*` (8 routes). | `/map`, the notes import button, the teacher's `list_sessions` / `list_propositions` tools, the spend panel (`/api/graph/costs`). | About 49 files and 20,000 lines with tests (UI alone is 9 files, 8,000 lines). | High. Writes `data/graph/*.jsonl`; extraction runs after chats; practice sets read the graph. Ask first whether any of the owner's own data lives there. |
| Practice in chat (`components/practice-cards.tsx`, `practice-dock.tsx`, `src/agent/tools/practice.ts`, `src/agent/prompts/practice/*`) | The upstream problem-set agent: partitioner, generators and grader, shown as cards in a chat. The upstream `/practice` pages and API are already gone. | The chat view only; it reads the graph. | 3 files, 740 lines, plus 3 prompt files and `tests/practice-*.test.ts`. | Medium. Depends on the graph stack; stores `data/practice/*.json`. |
| Watch (`/watch`, `app/api/watch`, `src/core/watch.ts`, `src/server/watch.ts`, `components/watch/*`, `docs/research/watch.md`) | YouTube captions as study material, with glosses and questions. | The Watch strand and `/watch`. | 7 files, 2,780 lines. | Medium. Needs `yt-dlp`; writes `data/` video index; a documented feature. |
| Chat modes and the teacher/prober loop (`app/chat/*`, `src/agent/teacher-agent.ts`, prober, tools, sub-agents: researcher, demo builder, visual maker, PDF reading) | The upstream classroom: free chat with a teacher agent that plans, quizzes and spawns background jobs. | `/chat/new`, `/chat/[id]`, the sidebar, jobs and activity dock. | About 32 files, 8,700 lines, plus plan/mermaid pieces (14 files, 3,100 lines). | High. Chat records in `data/chats/`; the Learn slot and the Why? answers may route through it. |
| Pi engine bridge (`src/server/pi/*`, `src/agent/subagents/pi-run.ts`, `docs/pi-engine-swap.md`, `@earendil-works/pi-*` packages) | The SDK layer that runs every model turn. | Everything that calls a model. | 3 files, 750 lines, plus two packages. | Very high. This is the model runtime, not dead code. Listed because the brief named it. |
| Tutor tools nobody turns on (`agent.graphTools`, `graph.enabled` settings) | Settings flags that gate the graph tools. | Only the graph stack. | A handful of settings keys. | Low, but they ship with the graph stack, so remove together. |

## Data formats and migrations

| Candidate | Notes | Risk |
|---|---|---|
| `src/store/graph-format.ts`, golden fixtures in `tests/fixtures/golden-data/`, `tests/golden-fixtures.test.ts`, `tests/schema-stamps.test.ts` | Pin the on-disk shapes of chats and the graph. Needed as long as those stores exist. | High to change. Delete only with the graph stack. |
| Data generators: `scripts/generate-all-stories.ts` with `stories-data-a1/a2/b1/b2.ts`, `generate-distractors.ts`, `generate-why-index.ts` | One-off seeders that wrote stories, near-miss distractors and the Why? index into `data/profiles/slovak/`. No script, doc or test references them. | Medium. 7 files, about 8,400 lines. The authored story text lives only here, so check the stories are already in the owner's data or in git before deleting. |
| `scripts/sentence-sources.ts` | Report on where sentences come from (written 2026-10-30). Not referenced by `package.json` or docs. | Low. 1 file, 323 lines. Keep if the owner still wants the report. |
| `scripts/backfill-graph.ts`, `replay-layout.ts`, `import-notes.ts` | Upstream graph maintenance; listed in `docs/development.md`. | Low, but removing needs the graph stack decision. 3 files, 250 lines. |
| `scripts/smoke-web-subscriptions.mjs`, `smoke-demo-runtime.mjs` | Smoke checks listed in `docs/development.md`. | Low. |

## Auth, pairing, remote access

| Candidate | Notes | Risk |
|---|---|---|
| `proxy.ts`, `src/server/remote-access*.ts`, `desktop-access.ts`, `/pair`, `app/api/access/*` | Phone pairing over Tailscale (E21) and the origin guard. Live feature in `docs/remote-access.md`. | Very high. Security-sensitive. |
| Subscription sign-in (ChatGPT, Copilot, xAI): `electron/subscription-*.cjs`, `src/agent/chatgpt-*.ts`, `src/server/web-subscription*.ts`, `components/settings/*connection*`, `/api/subscriptions` | Upstream-added provider logins. About 43 files, 5,400 lines. Several of the known Windows test failures sit here. | High. Ask whether the owner uses any provider besides OpenRouter keys. |
| Upstream branding strings: `x-learnharness-*` headers, the `learnharness` tool namespace, `LearnHarness` in user-agent, `desktopName` and `homepage` in `package.json` | A rename touches Electron IPC headers, tests and the packaged app id. | High for little gain. Test files assert these values. |

## Electron release pipeline

| Candidate | Notes | Risk |
|---|---|---|
| `.github/workflows/notify-website.yml` | Guarded by `github.repository == 'amosblomqvist/learnharness'`, so it never runs on this fork. | Low. 1 file. Needs the owner's yes because it is release plumbing. |
| `.github/workflows/release.yml`, `electron-builder.yml`, `scripts/verify-release.ts`, `scripts/build-server.mjs`, `scripts/after-pack.cjs`, `electron/*` | Signed and notarized macOS builds, auto-update. Several tests fail on Windows by design. | Very high. |
| `.github/ISSUE_TEMPLATE/*` | Upstream bug-report forms. | Low. 4 files. |
| `desktop:dist` script's `APPLE_TEAM_ID=JS6XN22HY6` | Upstream team id baked into the script. | Medium: the owner should confirm it is theirs. |

## Slovak and Russian language code

Nothing proposed. `src/agent/prompts/language/10-russian.md`, `src/core/language.ts`, `curriculum/` and the lexicon are product code (see `docs/adding-a-language.md`). Left alone.

## Documentation

| Candidate | Notes |
|---|---|
| `README.md` | Still the upstream LearnHarness README (banners, screenshots of the teaching session and knowledge graph). `LANGHARNESS.md` is the real description. Needs a rewrite, not a deletion. |
| `docs/archive/architecture-2026-09-08.md`, `docs/plan.md`, `docs/release-0.3.md`, `docs/probe-teach-split.md`, `docs/compaction-accounting.md`, `docs/tool-content-recovery.md`, `docs/pi-engine-swap.md` | Upstream history. About 850 lines. Each says it is historical or a decision record; `docs/architecture.md` links the archive. |
| `docs/architecture.md` (577 lines) | Describes the upstream graph and classroom system as if it were the whole app. It is accurate for what still runs, but it does not mention Today, the strands, or the corpus. |
| `docs/assets/lh_banner_*.svg` | Source art for the README banners; the PNGs the README uses are separate. |

## Code-level leftovers, low value

- About 170 exports that are only used inside their own file (knip "unused exports"). Dropping the `export` keyword changes nothing at runtime, but it touches many files the three design branches are editing, so it is left for after they merge. List: run `npx knip --include exports,types`.
- Three packages are imported but not listed in `package.json`: `js-yaml` and `app-builder-lib` (used by release tests and `scripts/verify-release.ts`; both arrive through `electron-builder`) and `@napi-rs/canvas` (arrives through `pdfjs-dist`). They work today. Listing them would make the install honest; leaving them is fine.
- `bun.lock` and `package-lock.json` are both committed. The owner runs bun (`bun run desktop:dev`); CI and docs use npm. One of them could go, but that is the owner's choice of package manager.
