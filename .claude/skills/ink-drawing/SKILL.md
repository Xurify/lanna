---
name: ink-drawing
description: "How LangHarness draws explanatory pictures as pen sketches: the ink kit (wobbling strokes, hand-drawn people, houses and arrows, a highlighter patch, strokes that draw themselves), how to build a scene, the checks that a picture means one thing, and how to look at it before it ships. Use before and after drawing or changing any case sketch, lesson picture, table that explains a rule, or the visual tool's figure prompt, and when a picture 'looks off'."
---

# Ink drawing

The owner's rule (2026-11-07, rule E73 in `docs/DECISIONS.md`): explanations with a lot of text get a picture, and the picture looks like a pen drawing, not a diagram. The reference is a hand-drawn figure (round head, straight body, one pointing arm, straight legs; thin graphite and ink lines; a pale wash behind the objects) and riddled.ai.

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

## Figures the model draws

**In the chat (E76)** the tutor writes the drawing itself, as a ` ```svg ` fence in its reply. Its prompt is `src/agent/prompts/chat/20-drawing.md`: the same look in words (thin round strokes with a small bow, a person as round head, straight body, straight legs and one pointing arm, one teal accent, one patch), colors only through `var(--ink)`, `var(--graphite)`, `var(--faint)`, `var(--rule)`, `var(--mark)` and `var(--wash)`. `src/core/sketch.ts` rebuilds it from an allowlist and maps those names to the tokens (`--sk-*` on the figure, set in `components/sketch-figure.tsx`), which also adds the wobble filter and, for a drawing that arrives live, the `ink-draw` and `ink-fade` order. A drawing can step through `<g data-step data-caption>` groups. When this skill changes the look, change that prompt and the token map in the same PR.

The `visual` tool's maker (`src/agent/subagents/visual-maker.ts`) is told the same look in words: thin near-black strokes, round caps, curved arrows with two-stroke heads, one teal accent and one patch, on the white background the figure card and its invert switch rely on. When this skill changes the look, change that prompt in the same PR.
