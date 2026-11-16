# What can the tutor chat learn from riddled.ai?

**Question (2026-11-08):** the owner finds the tutor chat "way too clunky" and slow: picking a model, sending, the thinking, long replies, and figures that arrive late. riddled.ai teaches the same Slovak point (demonstratives) in a chat that is short, easy to follow, and draws as it explains. How does it work, and what should LangHarness take from it?

**Answer:** the difference is not a secret prompt. It is the shape of a turn. A riddled.ai reply is two short paragraphs, every form glossed where it stands, at most one drawing written in the same reply, and one question at the end. There is no test before the answer, no plan, no quiz card, no model picker, and the learner answers in the same box they asked in. LangHarness now has the same kind of chat (rule E76). It keeps what LangHarness does better: help is graded (the first miss gets a cue, not the answer), and the tutor checks a correction before it gives one.

## How this was looked at

Public pages only: the shared conversation the owner sent, the landing, pricing, privacy, about and teams pages, the public JavaScript and CSS, and the YouTube demo with its captions. No account was made, no message was sent, and no attempt was made to get the model to reveal its prompt. The raw captures were kept outside the repo. The owner also pasted one reply as the app's API returns it.

## What riddled.ai does

### Observed

| What                              | Evidence                                                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One model, no picker              | Pricing: "Every plan runs on OpenAI's GPT-6.1 Sol. Never a smaller model". Privacy: model provider OpenAI.                                                                                                                                                              |
| A reply is plain text             | The shared page stores each tutor turn as one text field (`InkText {text}`). The API reply the owner pasted: `{"said": true, "thought": {"kind": "reply", "quote": "What else can we learn?", "message": {"text": "…"}, "riddlerId": null, "riddlerVersionId": null}}`. |
| Drawings are written in the reply | A fenced ` ```svg ` block inside the reply text, parsed by `/```([\w+#.-]*)\n([\s\S]*?)\n?```/g`.                                                                                                                                                                       |
| Drawings follow the page's theme  | Colors and fonts are CSS variables: `--ink`, `--graphite`, `--faint`, `--rule`, `--riddle-wash`, `--font-voice` (forms, 16 to 18 px), `--font-sans` (labels, 11 to 12 px). Width 320.                                                                                   |
| Drawings are checked, not trusted | Their own allowlist, not a general sanitizer: about 15 SVG elements, those CSS variables only, no `url(` except a marker reference, no `javascript`, `data:` or `@import`, at most 24,000 characters. A failed drawing reads "Riddled couldn't draw this one."          |
| Drawings can build up in steps    | Groups carry `data-step` (1 to 10) and `data-caption`; the player has Step back, Step forward, Play again and a counter.                                                                                                                                                |
| Personas and memory               | "Riddlers" are custom personas with versions (likely `riddlerId` / `riddlerVersionId`). Up to 15 short lines "About you" that the learner can see, reword and delete. A per-note instruction ("Quiz me before Friday", "never give the answer unless I ask").           |

### The turn, read from the demonstratives thread (39 turns)

| Turn type                   | What it does                                                                                                             | Example                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| First answer                | The rule in one sentence, glossed examples inline, then a drawing (a speaker, a near book, a far book)                   | "ten muž (that man), tá žena (that woman), to dieťa (that child)"                                        |
| "Help me clear this better" | A new frame, not the same words again: two separate choices, shown as a grid (across: distance; down: gender)            | "Think of two separate choices: distance and agreement."                                                 |
| "Help me learn this better" | Switches to production, one item per turn                                                                                | "Fill the gaps using tento, táto, or toto"                                                               |
| A right answer              | The verdict first, the form restated with its meaning, the next question                                                 | "Correct: toto dieťa = “this child.”"                                                                    |
| A spelling slip             | Counted right, the accent shown                                                                                          | "Right form—just add the accent: tamtá kniha"                                                            |
| A wrong answer              | What was right first, then the fix and the contrast                                                                      | "You matched the feminine gender correctly: tá kniha means “that book.” For “this book,” use táto kniha" |
| The order of items          | One thing changes at a time: gender, then distance, a new noun (auto), a full sentence, then a mixed set "without hints" | "Now try without hints: …"                                                                               |
| A return to a miss          | Several items later, in a new frame                                                                                      | "Let's check the distinction that tripped you up earlier"                                                |

### Inferred, not verified

`said` is probably whether the tutor chose to speak (its "reads along" mode stays quiet most of the time). `quote` is probably the passage of the learner's note the reply is anchored to. The other values of `kind` are not public.

## Why the turn shape works

The order of items is variation theory (Marton 2015): a learner notices a feature when it varies against a background that stays the same. Contrast (the same noun, only near or far changes), then generalization (the same "this" across the three genders), then fusion (both at once, a new noun, a sentence). The grid drawing is the same idea on paper: across a row only distance changes, down a column only gender. Asking the learner to produce the form, and coming back to a miss later in a new sentence, are already LangHarness rules (retrieval practice and spacing, [tutor-prompts.md](tutor-prompts.md)).

## What LangHarness took (E76)

| From riddled.ai                                                 | In LangHarness                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A plain chat, no test before the answer                         | A new kind of chat (`kind: "chat"`), the default for New chat and for Why?: no probe, no plan map, no question cards, no practice problems.                                                                                                                                                                                                    |
| One model, no picker, a fast reply                              | The chat takes the strong slot's model at a low thinking level, and the model picker and the token figures are not shown in it. The probe's five questions and the high thinking level were most of the wait in the owner's screenshot.                                                                                                        |
| Two short paragraphs, glossed forms, one question               | The chat's prompt (`src/agent/prompts/chat/10-chat.md`): about 90 words, plain prose with no headings or lists, every form followed by its meaning, at most one question.                                                                                                                                                                      |
| Change one thing at a time, fade the hints, come back to a miss | The same prompt, "Breaking a concept down".                                                                                                                                                                                                                                                                                                    |
| "Clear this better" → a new frame                               | "When the learner is lost": a grid, a drawing, a minimal pair, a bridge, or a smaller first piece, shorter than before.                                                                                                                                                                                                                        |
| Drawings written in the reply, on the theme's colors            | ` ```svg ` fences render in the page (`components/sketch-figure.tsx`) after an allowlist rebuild (`src/core/sketch.ts`): the same idea as theirs, in the LangHarness ink look (a pen wobble filter, strokes that draw themselves on a new drawing, teal for the one thing that matters). The prompt is `src/agent/prompts/chat/20-drawing.md`. |
| Drawings in steps                                               | `<g data-step data-caption>`, with Back, Next and a counter under the drawing.                                                                                                                                                                                                                                                                 |
| Asking for help in words                                        | One-tap replies under the tutor's last message: Hint, I don't know, Explain it another way when a question is open; Quiz me, Explain it another way, Draw it otherwise.                                                                                                                                                                        |

## What LangHarness did not take, and why

- **The answer on the first miss.** riddled.ai gives the right form at once ("For “this book,” use táto kniha"). LangHarness keeps P3: the first miss gets the smallest cue and a second try, and the form comes after a second miss.
- **Unchecked corrections.** The chat keeps `check_slovak`, `lookup_word` and `slovak_reference`, and must check before it marks the learner wrong (E29). Every form in a drawing must also be in the prose, so it is in the text the tools can check and the learner can play.
- **A second font for the tutor's voice.** riddled.ai sets the tutor in a serif (Newsreader). LangHarness keeps one font family (E33).
- **Personas, per-note instructions, margin notes, the "About you" lines.** Not built. The "This learner" block already gives the tutor what the app measured; a short learner-editable memory is a possible next step.

## Checked against real models (2026-11-08)

`scripts/eval-chat.ts` plays three scripted conversations (demonstratives, v + locative against do + genitive, a learner's own sentence with _s sestra_) against the chat agent. Four runs: Haiku 5.5 at low (three times, between prompt fixes), Haiku 5.5 at medium, Sonnet 5.5 at low.

|                                | Haiku 5.5, low   | Haiku 5.5, medium | Sonnet 5.5, low                 |
| ------------------------------ | ---------------- | ----------------- | ------------------------------- |
| First text, follow-up turns    | about 1.4 to 5 s | about 1.4 to 5 s  | about 0.6 to 7 s                |
| First text, first reply        | 7 to 10.5 s      | 12.5 s            | 13 s                            |
| Prose words per reply          | 17 to 138        | 29 to 148         | 11 to 110                       |
| Drawings passing the allowlist | all              | all               | all                             |
| Slovak claims read wrong       | none             | none              | one ("do … answers from what?") |

What the runs found and the prompt now forbids is listed under E76. The Slovak was read by the author of this change against the slovak-language skill, not by a native speaker.

## The /write page, looked at live (2026-11-08, E77)

The owner opened riddled.ai's note editor (`/write`) in a browser signed in to their account, and asked for it to be studied, network included. Three messages were sent from its Chat panel (3 of the account's 12 left): "Why is it v škole but do školy?", a wrong answer ("Toto dieťa je v školy."), and "Can you draw where vs where to?". The client code was read in the page; nothing was sent outside the page's own calls. A separate pass read the public pages and bundles (no account).

### Observed

| What                 | Evidence                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A note is the center | `/write` is a ProseMirror note. The tutor's remarks are "thoughts" anchored to a quoted passage (`quote`), shown under it or in a margin. A side Chat panel answers about the whole note ("I've read the whole note and its threads. Ask me anything about it.") with three starters: what am I still misunderstanding, what have we figured out, what should I work on next. |
| Storage              | Supabase tables `notes` (`doc`, `revision`, `brief_goal`, `brief_voice`, `read_along`, `riddler_id`), `thoughts` (`kind`, `status`, `quote`, `sketch`), `thought_messages`, `note_messages`, `riddler_versions` (`approach`, `default_voice`, `eagerness`).                                                                                                                   |
| One endpoint         | `POST /api/riddled` with `{ task, message, messageId, thoughtId, noteId, noteText, voice: "plain", images, imageKeys, timeZone, near }`; `task` is `chat`, `read`, `answer`, `ask`, `visualize`, `reply` or `draw`. The whole note text goes with every call.                                                                                                                 |
| No streaming         | The client awaits `res.json()`: the reply arrives whole. The page then reveals it word by word in at most about 1.8 s, with a pulsing one-line "writing back" mark before it.                                                                                                                                                                                                 |
| Two-phase drawings   | A reply that wants a picture comes back with `drawing: true` and text that describes the picture in words. The client then calls `task: "draw"` for the same message, which returns the text plus an `svg` code fence. Measured: text at 3.3 s, the drawing 7.4 s later.                                                                                                      |
| Times                | Text answer 3.7 s; a graded answer 2.6 s (whole JSON, about 60 to 120 words).                                                                                                                                                                                                                                                                                                 |
| Reading along        | A tracker marks which passages the tutor has read; a new read waits at least 10 s after the last and 8 s after the last remark, covers at most 3,000 characters, and the server may answer `said: false` (shown as a faint "nothing to add" mark). At most 5 open remarks; older ones are resolved.                                                                           |
| Two model tiers      | Limit errors name `limit_mini` and `limit_frontier`, and the page polls `/api/ai-status` every 60 s to show an outage before a send fails.                                                                                                                                                                                                                                    |
| Personas             | Riddler presets carry an `approach` text and an `eagerness` (Rarely 0.5, When it matters 1, Often 1.5).                                                                                                                                                                                                                                                                       |
| Teaching             | The first miss got the right form at once ("For “at school,” use v škole"), as in the shared thread. Examples sit on their own lines (`Som v škole. = I'm at school.`), pairs as `Where? → v škole`, and the task gives the first words ("Start with Toto dieťa…").                                                                                                           |

### What LangHarness took, in its own way (E77)

- **The drawing comes after the text.** The tutor writes its reply and calls `draw` with a brief; a separate call (the same model, its own prompt) draws while the learner reads, and the learner can already answer. LangHarness streams the text, so it starts sooner than a whole-JSON reply.
- **The tutor knows the app.** Their chat reads the note; ours reads a map of the app's pages, units, scenes, cheatsheets and stories with the learner's state, and links them.
- **Not taken:** the answer on the first miss (P3 stays), a reveal timer over a streamed reply, the note editor and margin threads, personas.

## Open

- The chat has not been measured against the old Learn chat with real learners, and the owner has not used it yet.
- The probed lesson (prober then teacher) and practice sessions stay for tutor units, the placement follow-up and `/chat/new?mode=teach` or `?mode=practice`. Whether they should become this chat too is the owner's call after using it.
- A typed Slovak answer in the chat reaches the model without the `[Checker …]` note that practice answers carry, because the note would show in the learner's own bubble. The tutor has `check_slovak` instead.

## Sources

- riddled.ai, shared conversation "Slovak Demonstratives", https://www.riddled.ai/s/84eb42d5e6174b76898a4a93a3ffca34fea3bf1a01e149b09f44b646627137eb (read 2026-11-08).
- riddled.ai landing, pricing, privacy, about and teams pages, https://www.riddled.ai (read 2026-11-08).
- Noah Kim, "AI is Making us Dumber, So I Built This", YouTube, 2026-11-01, https://youtu.be/UyPbjmLUtEo (captions read 2026-11-08).
- Marton, F. (2015). _Necessary Conditions of Learning_. Routledge. ISBN 9780415739139. The contrast, generalization and fusion patterns were checked against the publisher's description and the University of Hong Kong's summary of variation theory (https://kb.edu.hku.hk/approaches_variation_theory/), not against the book itself.
