# Development guide

The developer README (split out of the storefront README, 2026-10-10). Everything below is for people working ON Lanna, not using it.

Lanna runs as a Next.js app in the browser and as an Electron desktop app. Most of it is deterministic code: the curriculum, lessons, spaced review, reading, listening and the daily plan. The tutor chat (Ask) is the one place a model talks with the learner; it runs on [pi-ai](https://github.com/badlogic/pi-mono) with the Vercel AI SDK's `UIMessage` as the protocol to the browser.

What the app is for, and the rules for changing it, are in [CLAUDE.md](../CLAUDE.md), [learner.md](learner.md) and [research/](research/README.md).

## Commands

```bash
npm install          # once

npm run dev          # http://localhost:3010
npm run dev:sandbox  # a throwaway instance for demos and anything an agent drives (see "Sandbox" below)
npm run build        # production build (standalone output)
npm start            # serve the production build

npm test             # the full suite (node:test via tsx; deterministic, no LLM, no network)
npm run lint         # oxlint + eslint — includes the import law (architecture §2)
npm run fmt          # format code, JSON, and Markdown with oxfmt
npm run fmt:check    # check formatting with oxfmt
npm run typecheck    # tsc --noEmit

npm run desktop:dev    # next dev + Electron shell pointed at it
npm run desktop:dist   # local signed/notarized macOS arm64 build (LANNA_NOTARY keychain)
```

The Next server reloads on save. `electron/main.cjs` and the modules it loads do not: they load once, when Electron starts. After changing them, quit the desktop window and run `npm run desktop:dev` again. A window still running older code has no handler for newer IPC calls, so the Settings control that calls one fails (for example, Settings → Data → Clear cache).

To run the server in a container on an always-on machine (a VPS or a NAS), with updates, rollback and backups, see [`server.md`](server.md). `node scripts/boot-check.mjs` after `npm run build` and `node scripts/build-server.mjs` starts the standalone server on throwaway data and checks it; `tests/server-scripts.test.ts` covers the update and backup scripts (it needs bash, flock, git, tar and rsync, and skips without them).

For Windows/Linux packages and the three-OS CI/release flow, see [`desktop-release.md`](desktop-release.md). Native renderer binaries are traced per platform, so release builds run on the target OS, not as cross-builds from macOS.

## Environment (`.env.local`)

Secrets and machine-specific paths only. Model choice and thinking budgets are the user's, not the environment's — BYOK model slots live in **settings** (`models` section: strong/cheap/vision, provider + model id + optional thinking level; per-role and per-chat overrides ride on top). The extraction batch threshold is a settings knob too (`graph.extractionChunkTokens`, default 4096, floor 500).

| Variable                                  | Purpose                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`                      | required — all LLM calls go through OpenRouter                                                                         |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_CSE_ID` | researcher's `web_search` (Google Custom Search)                                                                       |
| `DEEPGRAM_API_KEY`                        | optional — dictation (STT token minting; audio streams browser→Deepgram, never through the server)                     |
| `CHROME_PATH`                             | optional system Chrome fallback for demo verification; the app's own browser helper is primary (nothing is downloaded) |

The packaged desktop app takes keys from `userData/auth.json` (BYOK, mode 0600, read/written directly by the server via `LANNA_AUTH_FILE`). PDFs render natively with pdfjs/Skia.

### Subscription connections in web/dev

Settings → API keys → Subscriptions signs in with a **ChatGPT, GitHub Copilot or Grok** plan instead of an API key, in the browser, the dev server and the desktop app alike. The server runs the sign-in through pi-ai's own flows (`src/agent/subscriptions.ts`) and keeps the result in `subscriptions.json` beside `auth.json` (the project directory by default, or the directory of `LANNA_AUTH_FILE`): one owner-only plaintext file, ignored by git and left out of the standalone build. A subscription model never falls back to an API key.

ChatGPT's sign-in page returns to a listener on `127.0.0.1:1455` of the machine running Lanna, so finish it in a browser on that machine; if the port is taken, the row asks for the code from the page instead. Copilot and Grok show a code to enter on their page. One account per company. The sign-ins are off while `LANNA_PUBLIC_HOST` is set, and run only one server process per credential directory.

## Architecture

Four layers, enforced by ESLint zones (`eslint.config.mjs`): the browser shell imports only the pure core barrel (`@/src/core`); `app/` imports only the barrels `@/src/core` and `@/src/server`; core never imports agent, server or store code; the agent layer gets storage through ports and never imports the server layer. `src/server/stores.ts` is the one place the file adapters are wired in.

```
app/                 pages and API route handlers
components/          the UI: Today, lessons, review, read, listen, speak, chat, settings
curriculum/          per-language word lists, lessons and stories
src/core/            pure logic: curriculum, lessons, FSRS review, plans, grading, contracts
src/server/          request handling, the chat turn (turn/), jobs, language data
src/agent/           the tutor chat agent: prompts, tools, models, subscriptions, PDF reader
src/store/           file adapters behind the core ports
electron/            the desktop shell; it starts the standalone Next server
scripts/             builds, data generation, checks, screenshots
data/                runtime state per language profile, git-ignored
```

## Key mechanisms

See [compaction and accounting](compaction-accounting.md) for the local Pi cutoff port, the context meter and pricing from Pi AI's catalog.

**Practice problems.** A practice session's tutor poses one problem at a time with `problem` and closes it with `conclude`; the problem stays open in the record until then, so a learner can leave and come back mid-problem. Dismissing a problem writes a marker, and the next input turns it into a concluded pair the model reads.

**Research and PDF reading.** `research` and `pdf` run their reader inside the turn (up to five minutes, stopped with the turn) and return the brief as the tool's result, so the tutor answers from it in the same reply. The reader's model calls are a usage entry of their own, priced under the reader's model. The PDF reader renders pages with pdfjs and Skia (`src/agent/subagents/pdf-pages.ts`), with no browser, and opens only files the learner sent (`data/sources`).

**Dictation.** Optional speech-to-text: the server mints short-lived Deepgram tokens; audio streams from the browser to Deepgram over a WebSocket, never through the server.

## Sandbox: demos and agent runs never touch your real data

Anything that starts the app to look at it, screenshot it or drive it (a demo, an agent, a manual check) must not use your own `data/`, your keys or your port. `npm run dev:sandbox` (`scripts/dev-sandbox.ts`) starts an instance with:

- **data** in a new folder under the OS temp dir (`LANNA_DATA_DIR`), never inside the repo; add `-- --seed` to fill it with the demo week (`scripts/demo-measured-minutes.ts`, which refuses any folder that already has profile data);
- **keys** hidden: `LANNA_AUTH_FILE` inside that folder and `LANNA_IGNORE_ENV_KEYS=1`, so `.env.local` and the environment's keys are not used and nothing paid can run;
- **a free port** chosen by the OS, never 3010.

It never edits a tracked file and never deletes anything; the folder is printed and is yours to delete. Next locks the checkout's `.next` folder, so while your own `npm run dev` is running here the sandbox cannot start (it says so and prints the worktree recipe: `git worktree add ..\<name>-sandbox`, install, run it there). A different build folder is not the answer: Next then rewrites the tracked `tsconfig.json` and `next-env.d.ts` (checked 2026-10-29). `dev:fresh` is the older new-user simulator; it ends in `npm run dev`, whose `-p 3010` beats the `PORT` it exports, so it does not move off the real port.

## Performance: measure the production build

`node scripts/perf-check.mjs` (after `npm run build`) serves the build with `next start` on a free port and a seeded scratch profile (the demo week plus a year of reviews, `scripts/perf-seed.ts`), drives headless Edge through puppeteer-core and prints four tables: sidebar click to the new page, a full page load with its JS size and long tasks, the API calls each page makes on load, and the main interactions (pointer-down to the next painted frame, and to the result on screen). `--cpu 4` emulates a CPU four times slower (a laptop on battery, a phone over the tailnet), `--light` skips the year of reviews, `--json file` keeps the numbers, `--check` exits 1 when a budget in `BUDGETS` is broken. Dev mode is not representative (no minification, routes compile on demand); use it only for the shape of a problem.

`node scripts/instant-check.mjs` (after `npm run build`) asks a different question: is the next page on screen before the server answers? For each sidebar row it rests the pointer on the row, holds every request the page makes, clicks, and prints `page` (the page itself is up), `shell` (the URL changed and `loading.tsx` shows) or `blocked` (nothing changed), with the time from the button going down. `--check` exits 1 when a row shows less than it should, `--rest 40` shortens the rest before the click, `--cpu 4` slows the CPU, `--only /review` runs one row (in Git Bash set `MSYS_NO_PATHCONV=1`, or the path is rewritten), `--dev` runs it against `next dev`, where every row is `blocked`: Next.js does not use prefetched pages in development. Rule E86; both scripts share `scripts/perf-harness.mjs`.

What the numbers taught (2026-11-02): the demo week hides the cost that matters. The server reads files synchronously on one thread, so a request that parses a growing file (the review log was re-parsed on every sidebar load and every Today load, about 100 ms at 21,000 lines) delays every other request queued behind it. Cache what only grows (keyed on the file's size and mtime, updated on append), and measure with the heavy profile.

## Testing

Run the suite with `NODE_ENV=test` set. It is the fence that sends the data folder to a temp dir (`config.ts`, E6); without it the tests write their fixtures into your real `data/`. `npm test` sets it with `NODE_ENV=test tsx --test ...`, which Windows `cmd.exe` rejects ("'NODE_ENV' is not recognized"), so on Windows set it yourself first (`$env:NODE_ENV="test"` in PowerShell) and never run `tsx --test` or `node --test` bare.

All deterministic, no LLM, no network (engines are injected — pi-ai's faux provider scripted per test; `globalThis.fetch` stubbed where transport matters):

1. **Pure core units** — lessons, review scheduling, grading, plans, phases, tool-parts, prices.
2. **Server flows** — `handleChatRequest` driven end-to-end with scripted engines: persistence, liveness, steer claiming, the wake pipeline (409 retry, quiz deferral, idempotency), crash recovery, the data-dir seam (including a fresh child process).
3. **Sub-agent loops** — the researcher and the PDF reader with scripted engines and a fake page renderer.
4. **Render tests** — transcript, cards, docks, composer, sidebar, coverage via React server-side rendering.
5. **Golden fixtures** (`tests/fixtures/golden-data/`) — a REAL data dir (real records produced by the app, never hand-edited), copied to a temp dir and read through the production paths via the `LANNA_DATA_DIR` seam. Pins that real data parses, flattens to a legal LLM wire, covers every custom-marker kind, and that reads never write. **The fixture law:** an intentional on-disk format change updates the fixtures in the same commit — see the fixture README.

## Data

Nothing under `data/` is ever tracked by git. Chats, lessons, reviews, stories, jobs and settings are plain files (JSON/JSONL), one folder per language profile — inspect them freely; they are the canonical records. The desktop app relocates the whole directory via `LANNA_DATA_DIR`.

**Schema stamps (2026-10-10):** chat records carry `version` (stamped at the store's write choke point; absence reads as v1 — lazy migration, no mass rewrite). A record stamped NEWER than the running build is refused on read — honest refusal for the downgrade scenario: a read-modify-write store never rewrites what it doesn't understand.
