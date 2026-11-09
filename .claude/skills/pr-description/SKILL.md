---
name: pr-description
description: How a LangHarness pull request description is written and what it carries (what changes for the learner, screenshots in Day and Night at two widths, how to try it in the sandbox, commit-pinned links to the changed code, what was and was not checked). Use before opening a PR, after the last push to one, and when asked to improve or fix a PR description.
---

# Pull request description

The rule is `docs/DECISIONS.md` → **W5**; the shape is `.github/pull_request_template.md`. This repo's PRs are reviewed by the owner on a local app, with no preview URL and no CI (W3), so the description has to carry what a preview would: pictures of the change, how to see it, and where it lives.

## Steps

1. **Write the diff first, the description second.** `git diff origin/main --stat`, then name only what is in it. A PR that was redrawn or reworked after its first description gets the description rewritten after the last push: a body that lists a picture, a rule or a control the diff no longer has is wrong.
2. **What changes for the learner**: what they see or do now, and why, in plain words, with full grammar words (E23) and American spelling.
3. **Screenshots** for any learner-facing change:
   - Start a sandbox: `npm run dev:sandbox -- --seed` (never the real profile, E6). It prints the URL.
   - `MSYS_NO_PATHCONV=1 node scripts/pr-shots.mjs <url> <dir> "name=/route" "name=/route@.css-selector"` writes `<name>-<theme>-<width>.png` for Day and Night at 1280 and 390 px (`--themes`, `--widths` change that). Use the selector to crop a long page to the part the PR changed. Get to the state the PR is about (after an answer, after a miss, an empty list) through the route or a seeded profile; if a state needs clicks, take it in the browser tool and name the file the same way.
   - **Open every image** before it goes in. A screenshot nobody looked at is not a check.
   - Push them to the `pr-assets` branch, which holds only screenshots (see below), and embed them in a Day | Night table.
4. **Try it**: one checkbox per thing to check: the route in the sandbox, what to do, what to see.
5. **Where**: one link per part of the diff, `https://github.com/Xurify/langharness/blob/<head SHA>/<path>#L<from>-L<to>`, the part the learner sees first, then the logic, the tests, the docs and skills. Re-pin the SHA and the lines after the last push (`git rev-parse HEAD`).
6. **Removed**: anything a learner has now that the PR takes away. The owner signs that off.
7. **Checked**: the real counts (`npm test`, `npm run typecheck`, `npm run lint`), then what was looked at (page, theme, width) and **Not looked at:**. Never "should work".
8. A PR that adds or changes a drawn explanation says how it was reviewed: the blind review in the `ink-drawing` skill, and the limits that remain.

## The `pr-assets` branch

An orphan branch of screenshots, one folder per PR: `pr-<number>/<name>-<theme>-<width>.png`. The repo is private, so the link has the form `https://github.com/Xurify/langharness/blob/pr-assets/pr-<number>/<file>.png?raw=true`; it renders for anyone who can open the repo. Create it once, from an empty folder:

```
git init -b pr-assets
git remote add origin https://github.com/Xurify/langharness.git
mkdir pr-<number> && cp <dir>/*.png pr-<number>/
git add -A && git commit -m "Screenshots for PR <number>" && git push origin pr-assets
```

Later: clone with `git clone --branch pr-assets --single-branch <url> <folder>`, add `pr-<number>/`, commit and push. The PR number is known after `gh pr create`, so open the PR with a short body, push the shots, then `gh pr edit <number> --body-file`. Pictures that document a decision stay in `docs/assets/` (S5), not here.

## Writing the body

Write it to a file with the Write tool and pass `--body-file`. On Windows, PowerShell `Set-Content` and here-strings turn Slovak letters into mojibake (seen on slovak.wiki #125); a Node script or the Write tool does not. Check with `gh pr view <n> --json body --jq .body` that č, š and ž survived.

## Mistakes already made

- A first description that had no screenshots and no links to the code, so the reviewer had to ask for both.
- A body that kept describing the first drawings after they were redrawn.
- Screenshots taken at one width and one theme; the owner reviews Night and the phone width closely (E4).
- "Looked at in a browser" with no page, theme or width named.
- Git Bash turns `/` and `/route` arguments into `C:\Program Files\Git\...`. Set `MSYS_NO_PATHCONV=1` (the script stops and says so).
