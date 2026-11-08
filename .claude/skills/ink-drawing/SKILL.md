---
name: ink-drawing
description: "How LangHarness draws explanatory pictures as pen sketches: the ink kit (wobbling strokes, hand-drawn people, houses and arrows, a highlighter patch, strokes that draw themselves), how to build a scene, the checks that a picture means one thing, and how to look at it before it ships. Use before and after drawing or changing any case sketch, lesson picture, table that explains a rule, or the visual tool's figure prompt, and when a picture 'looks off'."
---

# Ink drawing

- **Comments**: Code explains itself; name things until it does. A comment is allowed only for something outside this repo (browser, framework, library, platform, third-party API, spec, or where an external number comes from). Full rule in [AGENTS.md](../../../AGENTS.md) under **Code style → Comments**.

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

## Does it mean one thing

Ask each of these of every picture. A picture that fails one is redrawn, not captioned.

1. **One idea.** What does this picture say in five words? If it needs two sentences it is two pictures.
2. **The arrow is the verb or the preposition.** Into: it ends inside the door. Out of: it starts inside the door and leaves. If an arrow could be read as pointing at a person, the person is the object and the verb is the Note.
3. **No two meanings share a picture.** "Toward" (k), "have" (mám) and "see" (vidím) are three drawings, not one. Stay (u: at someone's place) has no arrow at all.
4. **The object is recognizable without the caption.** An office has windows, a school a flag, a clinic a cross, milk a drop. A plain house reads as home.
5. **Gender is shown, not assumed.** A case with three genders has a step for a masculine, a feminine and a neuter word. A rule with several parallel cases is a table, one row per kind of word.
6. **The Slovak is checked.** Every sentence, form and rule is checked against the case page on slovak.wiki (`/grammar/cases/<case>`). What the wiki does not say is marked as such in the changelog, not presented as sourced.
7. **Plain English.** No term a learner was not given ("hard noun"). Say feminine, not "-a words", when gender is the reason.

## Look at it

Never judge a picture from its code.

- **All sketches at once:** `npx tsx scripts/ink-contact-sheet.tsx <dir>`, then a Chrome screenshot of `sheet-light.html` and `sheet-dark.html` (the command is at the top of the script). Read both themes.
- **In the app:** `npm run dev:sandbox -- --seed`, open `/lesson?unit=gen` (or `loc`, `ins`, `dat`, `acc-people`, `acc-fem`), click through every step and the table. A dev server already running from the same checkout blocks the sandbox: use the worktree recipe it prints.
- **Animations in a screenshot:** a headless or hidden tab catches strokes at frame zero. Use `--force-prefers-reduced-motion` in Chrome, or inject `.ink-draw{animation:none!important;stroke-dashoffset:0!important}.ink-fade{animation:none!important;opacity:1!important}` before the snapshot.
- Run it at the lesson card's width and at 390 px.

## Mistakes already made

- `vector-effect: non-scaling-stroke` on a stretched line makes the `pathLength` dash lengths screen pixels: the line stays dotted after it draws. Plain scaled strokes only.
- Round caps leave a dot before the pen moves unless the start offset is a little past 1 (`ink-draw`).
- A filter id must be unique per sheet (`useId`), and a sheet is keyed by its stage so the strokes draw again on each step.
- `preLesson !== null` was always true: an intro frame opened empty on units with no sketch. Test the thing, not its negation.
- A picture of a house for "from work" read as "from home".

## Figures the model draws

The `visual` tool's maker (`src/agent/subagents/visual-maker.ts`) is told the same look in words: thin near-black strokes, round caps, curved arrows with two-stroke heads, one teal accent and one patch, on the white background the figure card and its invert switch rely on. When this skill changes the look, change that prompt in the same PR.
