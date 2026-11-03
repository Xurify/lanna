<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
