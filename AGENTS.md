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

- **Act decisively (W1 in `CLAUDE.md`)**: Make reasonable assumptions and carry out the task end to end instead of stalling for confirmation on clear choices. Ask a concise question only when a missing user decision would materially change the result or an ambiguity is genuinely unsafe to guess.
- **Fast inner-loop checks**: Run `bun run typecheck:fast` (`tsgo --noEmit`, ~2s vs ~22s for `tsc`) during edit loops, and run full `bun run typecheck` once before commit/PR. For DOM/CLS/console verification, run `node C:/Users/Stream/.claude/scripts/pw-check.mjs <url> [--mobile] [--dark] [--shot out.jpg]` (zero-install).
- **Deterministic gates over LLM swarms**: Use the model to invent and deterministic code (`npm run typecheck`, `npm run lint`, `npm run fmt:check`, `tsx --test`) to enforce. Never run expensive multi-turn critic loops to verify things a compiler, linter, formatter, or unit test checks in milliseconds.
- **Model routing**: Never use Claude Sonnet. For subagents and delegated implementation or hill-climbing against deterministic assertions, use Haiku (High / Extra High effort) or Gemini Flash; keep tasks narrowly scoped with disjoint file lists when running workers in parallel.
- **App versions**: never bump `package.json`'s version except in a release commit that goes to `main`. The next version is above the latest published GitHub Release (`gh release view --json tagName`), not above what `main` says. Rules and checks: `docs/desktop-release.md` → **Version numbers**. To put a build on this PC, use `npm run desktop:install`.
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
