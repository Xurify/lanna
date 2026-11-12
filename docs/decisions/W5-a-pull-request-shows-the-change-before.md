# W5. A pull request shows the change before it asks for a review (2026-11-08, branch `docs/pr-descriptions`, updated 2026-11-10)

The owner, after the slovak.wiki PRs: a first description had no screenshots and no links to the changed code ("we used to have it"), a body went on describing drawings that had been redrawn, and a preview is not always up (a screenshot costs nothing). This app has no preview URL and no CI (W3), so the description carries what a preview would.

**How to apply** (the steps and commands are the `pr-description` skill, `.claude/skills/pr-description/SKILL.md`; the shape is `.github/pull_request_template.md`):
- A description has these parts, in this order: **What changes for the learner**, **Screenshots**, **Try it**, **Where**, **Removed** (only when something is), **Checked**. It names only what the diff contains, and is reread against the diff after the last push.
- **Screenshots** of every learner-facing change, Day and Night, 1280 and 390 px (E4), of the state the PR is about, taken with `scripts/pr-shots.mjs` from `npm run dev:sandbox -- --seed` (E6). Every image is opened before it goes in, and **Checked** says which were looked at.
- They are uploaded directly to GitHub user attachments via `gh pr create/edit --attach <path>` (2026-11-10, replacing the orphan `pr-assets` branch). Local markdown references (`![Day Desktop](./shots/...)`) are rewritten in-place by `gh` to `https://github.com/user-attachments/assets/...`. This keeps binary screenshots out of git storage entirely. Pictures that document a decision stay in `docs/assets/` (S5).
- **Try it** is the sandbox route and what to do and see, one checkbox per thing, for the owner's deploy to the PC (W3).
- **Where** is one link per part of the diff to the file and lines at the head commit (a SHA, not a branch), the part the learner sees first.
- **Checked** gives the real counts from the run, then what was looked at (page, theme, width) and **Not looked at:**. A PR that adds or changes a drawn explanation says how it was blind-reviewed (the `ink-drawing` skill).
- The body is written from a file (`--body-file`) in UTF-8; PowerShell here-strings mangle Slovak letters.
