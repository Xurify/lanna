---
name: pr-description
description: How a LangHarness pull request description is written and what it carries (what changes for the learner, screenshots in Day and Night at two widths, how to try it in the sandbox, commit-pinned links to the changed code, what was and was not checked). Use before opening a PR, after the last push to one, and when asked to improve or fix a PR description.
---

# Pull request description

The rule is **W5** (`docs/decisions/W5-a-pull-request-shows-the-change-before.md`); the shape is `.github/pull_request_template.md`. This repo's PRs are reviewed by the owner on a local app, with no preview URL and no CI (W3), so the description has to carry what a preview would: pictures of the change, how to see it, and where it lives.

## Steps

1. **Write the diff first, the description second.** `git diff origin/main --stat`, then name only what is in it. A PR that was redrawn or reworked after its first description gets the description rewritten after the last push: a body that lists a picture, a rule or a control the diff no longer has is wrong.
2. **What changes for the learner**: what they see or do now, and why, in plain words, with full grammar words (E23) and American spelling.
3. **Screenshots** for any learner-facing change:
   - Start a sandbox: `npm run dev:sandbox -- --seed` (never the real profile, E6). It prints the URL.
   - `MSYS_NO_PATHCONV=1 node scripts/pr-shots.mjs <url> <dir> "name=/route" "name=/route@.css-selector"` writes `<name>-<theme>-<width>.png` for Day and Night at 1280 and 390 px (`--themes`, `--widths` change that). Use the selector to crop a long page to the part the PR changed. Get to the state the PR is about (after an answer, after a miss, an empty list) through the route or a seeded profile; if a state needs clicks, take it in the browser tool and name the file the same way.
   - **Open every image** before it goes in. A screenshot nobody looked at is not a check.
   - Reference the local screenshot paths directly in the Day | Night table of the PR body:
     ```markdown
     | Day | Night |
     | --- | --- |
     | ![Day Desktop](./shots/page-day-1280.png) | ![Night Desktop](./shots/page-night-1280.png) |
     | ![Day Mobile](./shots/page-day-390.png) | ![Night Mobile](./shots/page-night-390.png) |
     ```
   - Pass each screenshot via `--attach` when running `gh pr create` (or `gh pr edit`):
     ```bash
     gh pr create --title "..." --body-file pr-body.md \
       --attach ./shots/page-day-1280.png \
       --attach ./shots/page-night-1280.png \
       --attach ./shots/page-day-390.png \
       --attach ./shots/page-night-390.png
     ```
     `gh` automatically uploads each file to GitHub user-attachments and rewrites the local Markdown image paths in the PR description to `https://github.com/user-attachments/assets/<uuid>`.
   - **Always include images and screenshots of the changed thing**: A PR is not ready for review until the screenshots are attached and rendered in the PR body. Never hand back a PR to the user without embedded screenshots.
4. **Try it**: one checkbox per thing to check: the route in the sandbox, what to do, what to see.
5. **Where**: one link per part of the diff, `https://github.com/Xurify/langharness/blob/<head SHA>/<path>#L<from>-L<to>`, the part the learner sees first, then the logic, the tests, the docs and skills. Re-pin the SHA and the lines after the last push (`git rev-parse HEAD`).
6. **Removed**: anything a learner has now that the PR takes away. The owner signs that off.
7. **Checked**: the real counts (`npm test`, `npm run typecheck`, `npm run lint`), then what was looked at (page, theme, width) and **Not looked at:**. Never "should work".
8. A PR that adds or changes a drawn explanation says how it was reviewed: the blind review in the `ink-drawing` skill, and the limits that remain.

## Uploading screenshots via `gh --attach`

GitHub CLI natively supports media attachments for pull requests via `--attach`:
- Any local image referenced in the Markdown body (e.g. `![Day Desktop](./shots/page-day-1280.png)`) will be uploaded to GitHub's user-attachments storage (`https://github.com/user-attachments/assets/...`) and rewritten in-place by `gh` to point to the uploaded asset URL.
- This avoids storing binary images in Git or maintaining an orphan `pr-assets` branch.
- You can attach up to 50 files in a single `gh pr create` or `gh pr edit` invocation.
- Pictures that document a permanent architectural decision stay in `docs/assets/` (S5), not in PR attachments.

## Writing the body

Write it to a file with the Write tool and pass `--body-file`. On Windows, PowerShell `Set-Content` and here-strings turn Slovak letters into mojibake (seen on slovak.wiki #125); a Node script or the Write tool does not. Check with `gh pr view <n> --json body --jq .body` that č, š and ž survived.

## Mistakes already made

- A first description that had no screenshots and no links to the code, so the reviewer had to ask for both.
- A body that kept describing the first drawings after they were redrawn.
- Screenshots taken at one width and one theme; the owner reviews Night and the phone width closely (E4).
- "Looked at in a browser" with no page, theme or width named.
- Git Bash turns `/` and `/route` arguments into `C:\Program Files\Git\...`. Set `MSYS_NO_PATHCONV=1` (the script stops and says so).
