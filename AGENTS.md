<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rules in short

- **Comments**: Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from). Full rule under **Code style → Comments** below.
- **Pull requests**: every PR description MUST show the changed thing with images/screenshots before asking for a review (Day and Night screenshots attached via `gh pr create/edit --attach`). Include: what changes for the learner, Day and Night screenshots, how to try it, commit-pinned links to the code, what was and was not checked. Template `.github/pull_request_template.md`, rule W5, steps in the `pr-description` skill. Never open or hand back a PR without embedded screenshots of the change.

# Code style

## Comments

Code explains itself: names, types, small functions and tests carry the meaning. When a line seems to need a comment, rename it, extract a named function or constant, or pin the behavior in a test.

A comment is allowed only for something outside this repo that the code cannot show:

- a browser, framework, library or platform behavior ("Safari fires blur before click", "ESM evaluates static imports first");
- a third-party API's behavior or limit;
- a spec the code follows (WCAG, BCP 47, HTTP, FSRS);
- where an external number comes from (a standard, a study, a measurement), with its source.

Not allowed:

- restating what the code does, or naming the element ("// the rating row");
- docblocks on this repo's own functions, types, fields, routes or test files;
- the product reason for a choice, the owner's words, dates or history ("was X before", "since PR #12"): those go in the pull request's description and the commit message;
- commented-out code and TODOs: delete the code; say what was deferred in the pull request's description.

Code you add or change follows this rule. An older comment goes when the code around it is next changed.

# Execution & efficiency

- **Act decisively (W1 in `CLAUDE.md`)**: Make reasonable assumptions and carry out the task end to end instead of stalling for confirmation on clear choices. Ask a concise question only when a missing user decision would materially change the result or an ambiguity is genuinely unsafe to guess. Lock the stop condition, product rules, review cap, and merge policy before starting a multi-PR autonomous run, and never pause with checkable items still open.
- **Fast inner-loop checks**: Run `bun run typecheck:fast` (`tsgo --noEmit`, ~2s vs ~22s for `tsc`) and `bun run test:changed` (or `bun scripts/test.ts <file>`, ~1–2s) during edit loops. Run full `bun run typecheck`, `bun run lint`, `bun run fmt:check`, and `npm test` once before commit/PR.
- **Deterministic gates over LLM swarms**: Use the model to invent and deterministic code (`bun run audit:content`, `bun run story:brief`, `bun run story:gaps`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `bun scripts/test.ts`) to enforce. Run `bun run audit:content` on every PR touching stories, courses, lessons, or word pictures (pass `--data-dir <path>` to include Russian and Estonian lexicons). Write stories via the 2-step flow (`bun run story:brief` -> draft JSON -> `bun run story:gaps` -> fill missing glosses in one edit) instead of 100-turn exploratory loops.
- **Reusable sandbox and UI checks**: Run UI verification and screenshots through `bun run sandbox:run -- --seed -- node scripts/verify-ui.mjs {URL} <dir> ... --check-icons` (add `--copy-languages` and `--languages slovak,russian,estonian` when changing lessons or stories, `--expand-chapters` on `/curriculum`, `--reset-between-shots` for stateful walks, or `--prod` against an existing build). Never leave orphaned sandboxes, write unbounded sleep loops, or invent throwaway inline Python scripts for recurring chores. For quick standalone DOM/CLS checks, `node C:/Users/Stream/.claude/scripts/pw-check.mjs <url> [--mobile] [--dark] [--shot out.jpg]` also works without install.
- **Council and review caps**: Keep council reviews lean (two frontier models such as Gemini and Opus, max 2 rounds). Skip round 2 when round 1 scores >= 8.5 with only trivial fixes. Cache provider quota exhaustion for the thread instead of retrying exhausted models. Check `CLAUDE.md` product principles P1–P9 before coding UX changes.
- **Model routing**: Never use Claude Sonnet. Keep frontier models on architecture, code review, and prose quality; route mechanical edits, test boilerplate, PR assembly, and first-pass image naming to Haiku (High / Extra High effort) or Gemini Flash. Keep workers narrowly scoped with disjoint file lists, and encapsulate multi-round draw/blind-review loops inside one worker instead of waking the coordinator each round.
- **Horizontal fan-out and wave PR batching**: For large multi-unit batches (such as multiple picture sets or chapter stories across languages), fan out 4 to 6 independent worktree workers in parallel (`bun run worktree -- create <branch>`) instead of serializing 1.5 PRs at a time through one coordinator, and batch cohesive slices into 5 to 6 wave PRs rather than 18 tiny PRs so fixed test/sandbox/council tax is paid once per wave. Split multi-hour workstreams into separate threads after 3 to 4 PRs so context stays sharp.
- **Verified edits and PR hygiene**: Assert non-zero matches and check `git diff --stat` before claiming a scripted edit landed. Generate PR counts from script output (`bun run audit:content --json`) instead of typing them by hand, and use `bun run pr:attach -- create|edit ...` so every local screenshot resolves with zero broken `./` links.
- **App versions**: never bump `package.json`'s version except in a release commit that goes to `main`. The next version is above the latest published GitHub Release (`gh release view --json tagName`), not above what `main` says. Rules and checks: `docs/desktop-release.md` → **Version numbers**. To put a build on this PC, use `bun run desktop:install`. To release, use `bun run release:publish`.
- **Verify callers before deleting**: Search the whole repo (including `scripts/`, `electron/`, `.github/`, `tests/`) before removing exports, routes, or dependencies.

# Design: no AI slop

Before you design or restyle any screen, component, page or artifact, read `.claude/skills/anti-slop-design/SKILL.md` (Claude Code loads it as the `anti-slop-design` skill). It lists the tells that make a UI look machine-made and what Lanna does instead. In short:

- No gradients, glows, colored shadows, glassmorphism, or thick colored top/left card borders.
- No Inter-everywhere, no italic-serif accent word, no all-caps labels. Bricolage Grotesque for the chrome, Source Sans 3 for prose.
- No lavender/purple accent. One action color (`--lanna-sun`); the trail colors belong to the strands only.
- No centered hero with a badge, no rows of identical icon cards, no stat banners or "1, 2, 3" steps for decoration, no emoji navigation.
- No stock shadcn/ui look: restyle radius, color and shadow to the app's tokens.
- One layout primitive per screen, one bold choice per screen, body text that passes WCAG AA in both themes.

Run the skill's diff checks before you call a UI change done, and write any new visual rule that later screens must follow into `CLAUDE.md` in the same PR.

Before you write or change any grammar rule, example form, table row or grammar claim (in the app, on slovak.wiki or in chat), read `.claude/skills/grammar-explanations/SKILL.md` (the `grammar-explanations` skill): every form is sourced, the whole paradigm is covered, a rule is stated with its exceptions, every example names its case, and no word is used that the learner was not given.

Before you draw or change a picture that explains something (a case sketch, a lesson figure, a story cover in Read), read `.claude/skills/ink-drawing/SKILL.md` (the `ink-drawing` skill): the pen look, the kit, the checks that a picture means one thing, and how to look at it.

> **AGENTS.md size budget:** Keep this file under 16 KB. Move any new multi-paragraph reference guide into `docs/agents/<topic>.md` with a one-line trigger link here.
