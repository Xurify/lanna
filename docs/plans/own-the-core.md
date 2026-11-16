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
2. **Subscriptions on pi-ai.** pi-ai 1.4.0 already ships Sign in with ChatGPT (`openaiChatGPTOAuth`, the same per-install client flow), GitHub Copilot and xAI. Keep all three logins and API keys; replace the hand-written ChatGPT OAuth, the bridges and the request cycles with pi-ai's flows plus Lanna's own token store and Settings screen. Estimate after: about 22%.
3. **The tutor chat, designed for a language learner.** One chat screen and one session model written from P1–P9: retrieval first, priced help, answer first. It replaces `chat.tsx`, `session-core`, `question-dock`, `view`, `native-messages` and the smaller chat pieces, with new tests from behavior. Estimate after: about 13%.
4. **The agent runtime, smaller.** The tutor needs a turn loop, question tools, the language tools, the PDF reader and research. Decide each upstream piece: the probe→teach split and the mermaid plan tree (a STEM-tutor design), the file-system tools (`read`, `ls`, `find`, `grep`), compaction, and the background job queue and its dock. Keep what a learner uses, rewritten on pi-agent-core; drop the rest. Estimate after: about 8%.
5. **Settings, desktop shell, release.** Rewrite the model and key settings around Lanna's two slots (Cheap and Strong, P7), and the Electron shell around what it does today. Estimate after: about 6%.
6. **Fixtures and docs.** Replace the golden fixtures, which are recorded LearnHarness sessions (a "BKT belief update" demo, SVG visuals), with recorded Lanna sessions. Rewrite `docs/development.md`, `docs/desktop-release.md` and `docs/compaction-accounting.md`.

After step 4 the share should be under 10%. Measure after every step with the command above and write the number in the PR.

## Questions for the owner before step 4

- Should the tutor read files on the learner's computer (`read`, `ls`, `find`, `grep`)? Today it can; a language tutor may only need the PDFs and notes the learner hands it.
- Does Ask need a session plan tree, or is Lanna's daily plan enough?
- Are background jobs worth a dock of their own, or can a research or PDF result simply arrive in the chat?
