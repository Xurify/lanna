---
name: ink-drawing
description: "How LangHarness draws explanatory pictures as pen sketches: the ink kit (wobbling strokes, hand-drawn people, houses and arrows, a highlighter patch, strokes that draw themselves), how to build a scene, the checks that a picture means one thing, and how to look at it before it ships. Use before and after drawing or changing any case sketch, lesson picture, story cover (the Read library), table that explains a rule, or the drawing prompt, and when a picture 'looks off'."
---

# Ink drawing

The owner's rule (2026-11-07, rule E73): explanations with a lot of text get a picture, and the picture looks like a pen drawing, not a diagram. The reference is a hand-drawn figure (round head, straight body, one pointing arm, straight legs; thin graphite and ink lines; a pale wash behind the objects) and riddled.ai.

Use it twice: once **before** you draw (decide the one idea, pick the pieces), once **after** (the checks at the bottom).

## The look

| Part | Rule |
|---|---|
| Line | Thin: 1.4 for things, 2.1 for the one arrow or path the idea is about. Round caps and joins. |
| Wobble | A seeded bow on every straight stroke and a displacement filter on the whole sheet. Never a ruler-straight line, never a random wobble that changes per render (hydration). |
| Ink | Three tones only: `ink` (the text color, for the main thing), `graphite` (people), `soft` (scenery), plus `mark` (teal, for the one thing that matters). Day and Night come from the tokens, never from a hex. |
| Patch | One highlighter patch (`Patch`) behind the single thing the case marks. Not two. |
| Words | At most one `Note` per picture: the preposition or verb the picture is about. The app's own font, no handwriting font, no third family. |
| Motion | Each stroke draws itself in the order scenery, people, patch, arrow, label (`delay`). Off under reduced motion (`app/globals.css`, `ink-draw`, `ink-fade`). |
| No | Gradients, shadows, boxes around everything, emoji, clip art, a legend. |

## The kit

`components/lesson/ink-paths.ts` is pure (path strings, seeded). `components/lesson/ink.tsx` draws them.

| Piece | Use |
|---|---|
| `Sheet` | The surface: an `svg` with the ink filter. Every sketch is one `Sheet`, viewBox `0 0 340 132`, ground line at y 104. |
| `Figure` | A person on the ground. `reach="right"` or `"left"` for the one who acts; no `reach` for the one who is acted on. |
| `House` | `kind` is `home`, `school` (a flag), `office` (windows) or `clinic` (a cross). Pick the kind that says what the word means: work is not a house. |
| `Box`, `Loop`, `Line`, `Curve`, `Stroke` | Things: a box, a ring, a line, a curve through points, a custom path. |
| `Arrow` | Always the accent ink: the movement of the preposition or verb. Shaft first, head after. |
| `Patch`, `Dot` | The highlight, and the solid dot of "where it sits". |
| `Note` | The one word. |
| `PenUnderline`, `PenRule` | The pen underline under a lit ending, and the rule between table rows. |

A scene is a `case` in `Scene` (`components/lesson/case-sketch.tsx`): `Ground`, scenery, people, `Patch`, `Arrow`, `Note`. Give every stroke its own `seed` (a number nobody else in the scene uses; a figure uses `seed` to `seed + 5`). A new scene kind goes in `SceneKind` and in a stage of `SKETCHES`.

## Blind review before it ships

Checking a picture against what you meant is not a check: you already know the answer. On slovak.wiki the first ink sketches passed every check in this file and the owner still asked "is that a book or a binder?", "what is happening there?". A blind review of the whole set found why: rectangles that read as two objects, one pointing arm for four meanings, a lone preposition that looks like a typo, an eye with no head, an arrow for time.

1. Render the sketches on numbered sheets with no names, with no sentence and no source.
2. Give two fresh reviewers only the PNGs: a Claude subagent and another model family (Antigravity `gemini-3.8-flash-high` through `delegate_task`). Ask each, per picture: what is drawn, which grammar idea and sentence it guesses, clarity 1 to 5, what is confusing and the smallest fix. Reviewer prompts must say "describe only what is drawn".
3. Score the answers against what you meant. Act on a confusion both name; a one-reviewer taste call is not a change. Read each reviewer's description of the picture first: Gemini 3.8 Flash sometimes describes things that are not drawn.
4. Redraw, render again, and use fresh reviewers (they remember). Stop when every picture is 4 or better and both guess the meaning.

The slovak.wiki skill (`.agents/skills/ink-drawing/` in that repo) has the brief, the script that makes the sheets, and twelve rules from four rounds. The ones that apply here too: the **silhouette test** (cover the labels; could it be two things?), **one gesture, one meaning**, **arrows are for movement or handing over and never for time**, **label the phrase, not the letter** (`z práce`, not `z`), **lines of sight are dashed and start at an eye in a head**, **say who is who** (a child holding a woman's hand is "with mama"), and **do not point at the answer to "who?"**.

## Does it mean one thing

Ask each of these of every picture. A picture that fails one is redrawn, not captioned.

1. **One idea.** What does this picture say in five words? If it needs two sentences it is two pictures.
2. **The arrow is the verb or the preposition.** Into: it ends inside the door. Out of: it starts inside the door and leaves. If an arrow could be read as pointing at a person, the person is the object and the verb is the Note.
3. **No two meanings share a picture.** "Toward" (k), "have" (mám) and "see" (vidím) are three drawings, not one. Stay (u: at someone's place) has no arrow at all.
4. **The object is recognizable without the caption.** An office has windows, a school a flag, a clinic a cross, milk a drop. A plain house reads as home.
5. **Gender is shown, not assumed.** A case with three genders has a step for a masculine, a feminine and a neuter word. A rule with several parallel cases is a table, one row per kind of word.
6. **The Slovak is checked.** Follow the `grammar-explanations` skill for every form and rule: sourced, whole paradigm, rule with exceptions, case named, plain words. `tests/case-forms.test.ts` holds the tables to a paradigm.

## Look at it

Never judge a picture from its code.

- **All sketches at once:** `npx tsx scripts/ink-contact-sheet.tsx <dir>`, then a Chrome screenshot of `sheet-light.html` and `sheet-dark.html` (the command is at the top of the script). Read both themes.
- **In the app:** `npm run dev:sandbox -- --seed`, open `/lesson?unit=gen` (the genitive; the other units are the `SKETCH_UNITS` in `components/lesson/case-sketch.tsx`: locative, instrumental, dative and two accusative units), click through every step and the table. A dev server already running from the same checkout blocks the sandbox: use the worktree recipe it prints.
- **Animations in a screenshot:** a headless or hidden tab catches strokes at frame zero. Use `--force-prefers-reduced-motion` in Chrome, or inject `.ink-draw{animation:none!important;stroke-dashoffset:0!important}.ink-fade{animation:none!important;opacity:1!important}` before the snapshot.
- Run it at the lesson card's width and at 390 px.

## Mistakes already made

- `vector-effect: non-scaling-stroke` on a stretched line makes the `pathLength` dash lengths screen pixels: the line stays dotted after it draws. Plain scaled strokes only.
- Round caps leave a dot before the pen moves unless the start offset is a little past 1 (`ink-draw`).
- A filter id must be unique per sheet (`useId`), and a sheet is keyed by its stage so the strokes draw again on each step.
- `preLesson !== null` was always true: an intro frame opened empty on units with no sketch. Test the thing, not its negation.
- A picture of a house for "from work" read as "from home".

## Story covers

Every story in the Read library has a cover: a small ink scene with watercolour washes, drawn in code by `components/reading/cover-scene.tsx` (owner, 2026-11-15). The rules below come from eight rounds of blind review (3.5 of 10 to 7), so follow them before you change a scene.

**How a story gets its cover.** The story writer (`src/server/reading.ts`, the `"cover"` rule in the writer and retell prompts) picks one scene name from `COVER_MOTIFS` (`src/core/cover.ts`) for every new story, in the same model call as its `topic`. Stories without one fall back to `coverMotif()`: the first scene whose Slovak or English words appear in the title or theme, else one of the general scenes by the story's seed. The seed (`coverSeed(id)`) also picks the paper tone, the hue of the main object's wash and whether the scene is mirrored, so two cafés never look the same. A scene with words in it (the "Ahoj!" bubble) is never mirrored.

**A new topic.** Start from the learner's own library: `LH_DATA_DIR=<profile folder> npx tsx scripts/cover-gaps.ts` lists every story with its cover and whether the writer named it, its words matched, or nothing matched ("general"); the general stories' topics are the scenes worth drawing next. Then add a scene: a function in `cover-scene.tsx`, its name in `COVER_MOTIFS`, its words in `MOTIF_WORDS` (Slovak stems and English words; guard short stems with `(?<!\p{L})` so `hrad` does not match `záhrada`), a test in `tests/reader-text.test.tsx`, and a blind review. The prompt lists `COVER_MOTIFS`, so the writer can pick it at once.

**What a cover scene is.**

| Part | Rule |
|---|---|
| Frame | viewBox `0 0 200 120`. The subject fills about 70 to 80% of the width with a 14 px margin; nothing runs off the edge. |
| Ground | Outdoors: one soft ground line at y 104. Indoors: a table edge instead. Never both. No sun, no moon, no empty circles. |
| Ink | Main shapes `MAIN` (1.7) in `ink`, details `DETAIL` (1.2) in `graphite`, scenery in `soft`. Long lines bow less than short ones (`L` does this). |
| People | Head with dot eyes, a smile and hair; a coat or dress with body; arms with an elbow (`Person` takes arm paths); shoes. One clear action each: waving, walking toward a door, sitting with knees bent. |
| Highlight | One teal patch (`Highlight`, `q-ink-patch`) on the one thing the story is about: the cross on a clinic, the briefcase, the coffee, the speech bubble. A bubble or a surface is filled to its outline, not blotted. Never on a random window or a tree crown. |
| Washes | Loose and off-register under the ink (`Wash`, `WashBox`, `WashPath`), in the four low-chroma hues `ochre`, `rose`, `sage`, `sky` (`--q-wash-*`, with their own lighter Night values). Two or three per scene, kept inside or just past their shape; a wash that spreads like a stain is too big. A vehicle's frame or a thin object stays uncoloured. |
| Each scene its own silhouette | Two scenes must not share a shape at card size: the park tree is round, the autumn tree is bare branches; the home is a gabled house, the mountain hut an A-frame. |

**Review before it ships.** Render every scene on numbered tiles with `npx tsx scripts/cover-contact-sheet.tsx <dir> <motif,motif,...>`, screenshot `sheet-light.html` and `sheet-dark.html`, and give only the PNGs to a fresh reviewer each round (the brief in "Blind review before it ships" above, asking per tile: what is drawn, the guessed setting, clarity and craft 1 to 10, the one fix; then which tiles are too alike). Fix what it names, render again, use a new reviewer. Mistakes the reviewers caught: a stall awning that read as a blimp, a tree that read as a lollipop, leaf ticks that read as birds, marks on a bush that read as a face, a croissant that read as a fish, a plate seen from above that read as a UFO, a stick person with an arm that meant nothing, typed lettering in a hand-drawn scene.

## Figures the model draws

**In the chat (E76)** the tutor writes the drawing itself, as a ` ```svg ` fence in its reply. Its prompt is `src/agent/prompts/chat/20-drawing.md`: the same look in words (thin round strokes with a small bow, a person as round head, straight body, straight legs and one pointing arm, one teal accent, one patch), colors only through `var(--ink)`, `var(--graphite)`, `var(--faint)`, `var(--rule)`, `var(--mark)` and `var(--wash)`. `src/core/sketch.ts` rebuilds it from an allowlist and maps those names to the tokens (`--sk-*` on the figure, set in `components/sketch-figure.tsx`), which also adds the wobble filter and, for a drawing that arrives live, the `ink-draw` and `ink-fade` order. A drawing can step through `<g data-step data-caption>` groups. When this skill changes the look, change that prompt and the token map in the same PR.

The chat's drawing prompt (`src/agent/prompts/drawing/10-drawing.md`) is told the same look in words. When this skill changes the look, change that prompt in the same PR. Figures from the removed `visual` tool still render in old chats through `components/artifacts/visual-card.tsx`.
