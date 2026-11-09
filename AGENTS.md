<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rules in short

- **Comments**: Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from). Full rule under **Code style → Comments** below.
- **Pull requests**: the description shows the change before it asks for a review: what changes for the learner, Day and Night screenshots, how to try it, commit-pinned links to the code, what was and was not checked. Template `.github/pull_request_template.md`, rule W5 in `docs/DECISIONS.md`, steps in the `pr-description` skill.

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
- the product reason for a choice, the owner's words, dates or history ("was X before", "since PR #12"): those go in `docs/DECISIONS.md`, the changelog and the commit message;
- commented-out code and TODOs: delete the code; write a deferred item in `docs/DECISIONS.md` under "Dropped or deferred".

Code you add or change follows this rule. An older comment goes when the code around it is next changed.

# No guessing

All design authority belongs to the human. **Never guess a design or implementation decision.** If anything is ambiguous — naming, behavior, data shapes, UX, defaults, scope boundaries, prompt wording — STOP and ask with the ask-user-question tool before proceeding. If you are "a little unsure," you are unsure: ask. A wrong guess is far more expensive than a question. Ask early, ask specific, one question per call.

Concretely: first investigate and plan rigorously (asking the user design questions along the way), get the plan approved by the user, and only then implement. Implementation should be mechanical execution of an approved plan — not interpretation.

# Design: no AI slop

Before you design or restyle any screen, component, page or artifact, read `.claude/skills/anti-slop-design/SKILL.md` (Claude Code loads it as the `anti-slop-design` skill). It lists the tells that make a UI look machine-made and what LangHarness does instead. In short:

- No gradients, glows, colored shadows, glassmorphism, or thick colored top/left card borders.
- No Inter-everywhere, no italic-serif accent word, no all-caps labels. Bricolage Grotesque for the chrome, Source Sans 3 for prose.
- No lavender/purple accent. One action color (`--lh-sun`); the trail colors belong to the strands only.
- No centered hero with a badge, no rows of identical icon cards, no stat banners or "1, 2, 3" steps for decoration, no emoji navigation.
- No stock shadcn/ui look: restyle radius, color and shadow to the app's tokens.
- One layout primitive per screen, one bold choice per screen, body text that passes WCAG AA in both themes.

Run the skill's diff checks before you call a UI change done, and write any new visual rule into `docs/DECISIONS.md` in the same PR.

Before you write or change any grammar rule, example form, table row or grammar claim (in the app, on slovak.wiki or in chat), read `.claude/skills/grammar-explanations/SKILL.md` (the `grammar-explanations` skill): every form is sourced, the whole paradigm is covered, a rule is stated with its exceptions, every example names its case, and no word is used that the learner was not given.

Before you draw or change a picture that explains something (a case sketch, a lesson figure), read `.claude/skills/ink-drawing/SKILL.md` (the `ink-drawing` skill): the pen look, the kit, the checks that a picture means one thing, and how to look at it.
