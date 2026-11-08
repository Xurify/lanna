# What can the tutor chat learn from riddled.ai?

**Question (2026-11-08):** the owner finds the tutor chat "way too clunky" and slow: picking a model, sending, the thinking, long replies, and figures that arrive late. riddled.ai teaches the same Slovak point (demonstratives) in a chat that is short, easy to follow, and draws as it explains. How does it work, and what should LangHarness take from it?

**Answer:** the difference is not a secret prompt. It is the shape of a turn. A riddled.ai reply is two short paragraphs, every form glossed where it stands, at most one drawing written in the same reply, and one question at the end. There is no test before the answer, no plan, no quiz card, no model picker, and the learner answers in the same box they asked in. LangHarness now has the same kind of chat (rule E76). It keeps what LangHarness does better: help is graded (the first miss gets a cue, not the answer), and the tutor checks a correction before it gives one.

## How this was looked at

Public pages only: the shared conversation the owner sent, the landing, pricing, privacy, about and teams pages, the public JavaScript and CSS, and the YouTube demo with its captions. No account was made, no message was sent, and no attempt was made to get the model to reveal its prompt. The raw captures were kept outside the repo. The owner also pasted one reply as the app's API returns it.

## What riddled.ai does

### Observed

| What | Evidence |
|---|---|
| One model, no picker | Pricing: "Every plan runs on OpenAI's GPT-6.1 Sol. Never a smaller model". Privacy: model provider OpenAI. |
| A reply is plain text | The shared page stores each tutor turn as one text field (`InkText {text}`). The API reply the owner pasted: `{"said": true, "thought": {"kind": "reply", "quote": "What else can we learn?", "message": {"text": "…"}, "riddlerId": null, "riddlerVersionId": null}}`. |
| Drawings are written in the reply | A fenced ` ```svg ` block inside the reply text, parsed by `/```([\w+#.-]*)\n([\s\S]*?)\n?```/g`. |
| Drawings follow the page's theme | Colors and fonts are CSS variables: `--ink`, `--graphite`, `--faint`, `--rule`, `--riddle-wash`, `--font-voice` (forms, 16 to 18 px), `--font-sans` (labels, 11 to 12 px). Width 320. |
| Drawings are checked, not trusted | Their own allowlist, not a general sanitizer: about 15 SVG elements, those CSS variables only, no `url(` except a marker reference, no `javascript`, `data:` or `@import`, at most 24,000 characters. A failed drawing reads "Riddled couldn't draw this one." |
| Drawings can build up in steps | Groups carry `data-step` (1 to 10) and `data-caption`; the player has Step back, Step forward, Play again and a counter. |
| Personas and memory | "Riddlers" are custom personas with versions (likely `riddlerId` / `riddlerVersionId`). Up to 15 short lines "About you" that the learner can see, reword and delete. A per-note instruction ("Quiz me before Friday", "never give the answer unless I ask"). |

### The turn, read from the demonstratives thread (39 turns)

| Turn type | What it does | Example |
|---|---|---|
| First answer | The rule in one sentence, glossed examples inline, then a drawing (a speaker, a near book, a far book) | "ten muž (that man), tá žena (that woman), to dieťa (that child)" |
| "Help me clear this better" | A new frame, not the same words again: two separate choices, shown as a grid (across: distance; down: gender) | "Think of two separate choices: distance and agreement." |
| "Help me learn this better" | Switches to production, one item per turn | "Fill the gaps using tento, táto, or toto" |
| A right answer | The verdict first, the form restated with its meaning, the next question | "Correct: toto dieťa = “this child.”" |
| A spelling slip | Counted right, the accent shown | "Right form—just add the accent: tamtá kniha" |
| A wrong answer | What was right first, then the fix and the contrast | "You matched the feminine gender correctly: tá kniha means “that book.” For “this book,” use táto kniha" |
| The order of items | One thing changes at a time: gender, then distance, a new noun (auto), a full sentence, then a mixed set "without hints" | "Now try without hints: …" |
| A return to a miss | Several items later, in a new frame | "Let's check the distinction that tripped you up earlier" |

### Inferred, not verified

`said` is probably whether the tutor chose to speak (its "reads along" mode stays quiet most of the time). `quote` is probably the passage of the learner's note the reply is anchored to. The other values of `kind` are not public.

## Why the turn shape works

The order of items is variation theory (Marton 2015): a learner notices a feature when it varies against a background that stays the same. Contrast (the same noun, only near or far changes), then generalization (the same "this" across the three genders), then fusion (both at once, a new noun, a sentence). The grid drawing is the same idea on paper: across a row only distance changes, down a column only gender. Asking the learner to produce the form, and coming back to a miss later in a new sentence, are already LangHarness rules (retrieval practice and spacing, [tutor-prompts.md](tutor-prompts.md)).

## What LangHarness took (E76)

| From riddled.ai | In LangHarness |
|---|---|
| A plain chat, no test before the answer | A new kind of chat (`kind: "chat"`), the default for New chat and for Why?: no probe, no plan map, no question cards, no practice problems. |
| One model, no picker, a fast reply | The chat takes the strong slot's model at a low thinking level, and the model picker and the token figures are not shown in it. The probe's five questions and the high thinking level were most of the wait in the owner's screenshot. |
| Two short paragraphs, glossed forms, one question | The chat's prompt (`src/agent/prompts/chat/10-chat.md`): about 90 words, plain prose with no headings or lists, every form followed by its meaning, at most one question. |
| Change one thing at a time, fade the hints, come back to a miss | The same prompt, "Breaking a concept down". |
| "Clear this better" → a new frame | "When the learner is lost": a grid, a drawing, a minimal pair, a bridge, or a smaller first piece, shorter than before. |
| Drawings written in the reply, on the theme's colors | ` ```svg ` fences render in the page (`components/sketch-figure.tsx`) after an allowlist rebuild (`src/core/sketch.ts`): the same idea as theirs, in the LangHarness ink look (a pen wobble filter, strokes that draw themselves on a new drawing, teal for the one thing that matters). The prompt is `src/agent/prompts/chat/20-drawing.md`. |
| Drawings in steps | `<g data-step data-caption>`, with Back, Next and a counter under the drawing. |
| Asking for help in words | One-tap replies under the tutor's last message: Hint, I don't know, Explain it another way when a question is open; Quiz me, Explain it another way, Draw it otherwise. |

## What LangHarness did not take, and why

- **The answer on the first miss.** riddled.ai gives the right form at once ("For “this book,” use táto kniha"). LangHarness keeps P3: the first miss gets the smallest cue and a second try, and the form comes after a second miss.
- **Unchecked corrections.** The chat keeps `check_slovak`, `lookup_word` and `slovak_reference`, and must check before it marks the learner wrong (E29). Every form in a drawing must also be in the prose, so it is in the text the tools can check and the learner can play.
- **A second font for the tutor's voice.** riddled.ai sets the tutor in a serif (Newsreader). LangHarness keeps one font family (E33).
- **Personas, per-note instructions, margin notes, the "About you" lines.** Not built. The "This learner" block already gives the tutor what the app measured; a short learner-editable memory is a possible next step.

## Checked against real models (2026-11-08)

`scripts/eval-chat.ts` plays three scripted conversations (demonstratives, v + locative against do + genitive, a learner's own sentence with *s sestra*) against the chat agent. Four runs: Haiku 5.5 at low (three times, between prompt fixes), Haiku 5.5 at medium, Sonnet 5.5 at low.

| | Haiku 5.5, low | Haiku 5.5, medium | Sonnet 5.5, low |
|---|---|---|---|
| First text, follow-up turns | about 1.4 to 5 s | about 1.4 to 5 s | about 0.6 to 7 s |
| First text, first reply | 7 to 10.5 s | 12.5 s | 13 s |
| Prose words per reply | 17 to 138 | 29 to 148 | 11 to 110 |
| Drawings passing the allowlist | all | all | all |
| Slovak claims read wrong | none | none | one ("do … answers from what?") |

What the runs found and the prompt now forbids is listed under E76. The Slovak was read by the author of this change against the slovak-language skill, not by a native speaker.

## Open

- The chat has not been measured against the old Learn chat with real learners, and the owner has not used it yet.
- The probed lesson (prober then teacher) and practice sessions stay for tutor units, the placement follow-up and `/chat/new?mode=teach` or `?mode=practice`. Whether they should become this chat too is the owner's call after using it.
- A typed Slovak answer in the chat reaches the model without the `[Checker …]` note that practice answers carry, because the note would show in the learner's own bubble. The tutor has `check_slovak` instead.

## Sources

- riddled.ai, shared conversation "Slovak Demonstratives", https://www.riddled.ai/s/84eb42d5e6174b76898a4a93a3ffca34fea3bf1a01e149b09f44b646627137eb (read 2026-11-08).
- riddled.ai landing, pricing, privacy, about and teams pages, https://www.riddled.ai (read 2026-11-08).
- Noah Kim, "AI is Making us Dumber, So I Built This", YouTube, 2026-11-01, https://youtu.be/UyPbjmLUtEo (captions read 2026-11-08).
- Marton, F. (2015). *Necessary Conditions of Learning*. Routledge. ISBN 9780415739139. The contrast, generalization and fusion patterns were checked against the publisher's description and the University of Hong Kong's summary of variation theory (https://kb.edu.hku.hk/approaches_variation_theory/), not against the book itself.
