# Own the core: Lanna's code below 10% LearnHarness

Lanna began as a fork of LearnHarness 0.3.8 (Amos Blomqvist, AGPL-3.0-only). While its code is in the repo, Lanna stays under AGPL-3.0, and a build that is published or shared must credit it. This plan replaces that code with Lanna's own, part by part, until less than 10% of the lines come from it.

## How the share is measured

```
git blame -w -M --ignore-revs-file <revs> 3dc88472..HEAD -- <file>
```

- `3dc88472` ("chore: prepare 0.3.8") is the last LearnHarness commit. Every line blamed on it or earlier is counted as upstream.
- `<revs>` lists the commits that only reformat or rename (`e90ca38a` oxfmt, `a2f6de25` and `7a3a614c` the Lanna rename), so a reformatted line keeps its real author.
- Counted: `.ts .tsx .cjs .mjs .js .css .py` under `src/ app/ components/ electron/ lib/ cli/ scripts/ tests/` and the root config files; test fixtures are not counted.
- Assumption: a line moved to a new file without `-C` counts as new. Moving code is not owning it, so each step below rewrites from what the learner needs, with tests written from behavior, and never ports a file line by line.

On 2026-11-16, before this plan: **26.4%** (61.2k of 231.4k lines).

## Where the upstream lines are

| Area                                                                                                     | Upstream lines | of which tests |
| -------------------------------------------------------------------------------------------------------- | -------------: | -------------: |
| Tutor chat UI and session state (`chat.tsx`, `session-core`, `question-dock`, `view`, `native-messages`) |          14.4k |           5.1k |
| Agent runtime (tools, jobs, compaction, sub-agents)                                                      |          12.9k |           5.9k |
| Smaller chat pieces (find, keyboard, composer, stats bar, plan tree, search)                             |          11.4k |           3.6k |
| Subscription logins (ChatGPT, Copilot, Grok)                                                             |           9.1k |           4.4k |
| Settings, models, keys                                                                                   |           5.2k |           0.4k |
| PDF reader, SVG, headless browser                                                                        |           3.4k |           1.0k |
| App frame (sidebar, CSS, setup)                                                                          |           2.2k |              — |
| Desktop shell and release                                                                                |           1.9k |           0.2k |
| Dictation                                                                                                |           0.8k |           0.1k |

## Steps

Each step is one or more PRs. The share after each is an estimate, assuming a rewrite is about half the size of what it replaces.

1. **Delete what nobody uses.** The browser-service helper, its smoke script and CI steps, Chrome lookup, and the docs that describe LearnHarness itself (vision, architecture, plan, teaching methodology). Done: measured **26.3%** after it. Most of what it removed was documentation, which the count leaves out.
2. **Subscriptions on pi-ai.** pi-ai 1.4.0 ships the three sign-ins: Sign in with ChatGPT is the OAuth of its `openai` provider (the same per-install client flow Lanna wrote by hand), plus `github-copilot` and `xai`, which Lanna already uses through pi. Replace the hand-written ChatGPT OAuth, its bridge, stream and request cycle with pi's flow, behind Lanna's own credential store and Settings rows. What pi does not have, and Lanna gives up or keeps small on top: several ChatGPT accounts at once (one per provider), remote revocation on disconnect, the email shown for the account, and a free callback port (pi listens on 1455 and offers a pasted code when it is taken). Done: measured **23.1%** after it.
3. **The tutor chat, designed for a language learner.** One chat screen and one session model written from P1–P9: retrieval first, priced help, answer first. It replaces `chat.tsx`, `session-core`, `question-dock`, `view`, `native-messages` and the smaller chat pieces, with new tests from behavior. Estimate after: about 13%.
   After step 3, before step 4: **Write**, a written-output task in the style of a quiet writing companion. The learner writes a short text in the target language; Lanna stays quiet while code checks it (dictionary, the language's rules, known words, the learner's mix-ups); at a slip it points to the place and asks, then offers priced steps (a question, the rule with the full name of the case, the form) instead of correcting. Slips land in Mistakes and Review. It fills the written half of meaning-focused output, which today only Speak covers. It starts from a research note on written corrective feedback in `docs/research/`.
4. **The agent runtime, smaller.** The tutor needs a turn loop, question tools, the language tools, the PDF reader and research. Decide each upstream piece: the probe→teach split and the mermaid plan tree (a STEM-tutor design), the file-system tools (`read`, `ls`, `find`, `grep`), compaction, and the background job queue and its dock. Keep what a learner uses, rewritten on pi-agent-core; drop the rest. Estimate after: about 8%. Two tool changes go with it: `grade` also records a slip in a free message, not only an answer to a posed question, so Mistakes sees what the learner writes in conversation; and `check_slovak` and `slovak_reference` work for the active language, as every other part of Lanna does.
5. **Settings, desktop shell, release.** Rewrite the model and key settings around Lanna's two slots (Cheap and Strong, P7), and the Electron shell around what it does today. Estimate after: about 6%.
6. **Fixtures and docs.** Replace the golden fixtures, which are recorded LearnHarness sessions (a "BKT belief update" demo, SVG visuals), with recorded Lanna sessions. Rewrite `docs/development.md`, `docs/desktop-release.md` and `docs/compaction-accounting.md`.

After step 4 the share should be under 10%. Measure after every step with the command above and write the number in the PR.

## Decided with the owner

- The tutor reads only the PDFs and images the learner sends with the composer's buttons (`data/sources`); `ls`, `find` and `grep` are gone.

- The "teach" session kind (prober, teacher, plan tree, question dock) is gone; the placement follow-up is an Ask chat. Done before the rest of step 4: measured **20.7%** after it.

- Background jobs: `research` and `pdf` become plain tools that run inside the turn and show their progress in the chat; the job queue, the wake pipeline and the jobs in the activity dock go. Long app work (preparing a video, adding a language, writing a story) stays a Task (`src/server/tasks.ts`, `/tasks`). Done: measured **18.6%** after it.
- No new `note_mistake` tool: `grade` already feeds Mistakes; it is widened instead (step 4).
