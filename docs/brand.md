# Brand

LangHarness is a language tutor for any language: you add a language from the app, and every task asks you to produce the answer before it helps (P3). The brand says that and nothing more.

Rule: [DECISIONS.md](DECISIONS.md) E59. Sheet: [assets/brand/logo-sheet.png](assets/brand/logo-sheet.png); in the app: [assets/brand/sidebar-mark.png](assets/brand/sidebar-mark.png).

## The mark: your turn

A text cursor waiting at an empty answer line.

- **What it says.** The app shows a blank and waits for you to type, say or recall the answer. Recognition comes first only to meet a form; production proves it (P3, P4). The cursor is the learner and the line is the answer they have not given yet.
- **Any language.** It has no letter, script, flag or diacritic, so it fits Estonian, Slovak, Russian or Japanese the same. An earlier draft (an `š` cut from Geist Bold) was dropped for that reason: it made a language tutor look like a Slovak one.
- **An L.** The two shapes read as an L, the first letter of the name, without spelling it.
- **The app's own blank.** The answer line is the same straight writing line the exercises draw (`.q-blank`, E33), not a new shape.
- **Not a download icon.** A chevron over a line (a háček over a blank was tried) reads as "download". The cursor is a plain bar, so it does not.

### Geometry

1024 box, two rounded rectangles (radius 22), no strokes:

| Part | x | y | w | h | Color |
|---|---|---|---|---|---|
| Cursor | 262 | 212 | 116 | 600 | ink |
| Answer line | 418 | 696 | 344 | 116 | teal |

The drawing spans 500 × 600 and is centered at 512, 512. The bars are the same width, and the gap between them is a third of a bar, so the two parts stay apart at 16 px. The first drawing (bars of 72, spanning 460 × 520) was too thin and too small to read in a taskbar (owner, 2026-11-07: "Make the icon a bit better"); the bars are now 60% thicker and the drawing fills more of the tile.

### Color

In the app, the mark uses the app's two tokens and nothing else (E33):

| | Day | Night |
|---|---|---|
| Cursor | `--q-ink` #16181B | `--q-ink` #ECEDEE |
| Answer line | `--q-teal` #0D6764 | `--q-teal` #4CBDB7 |

The app icon is a teal tile (#0D6764, Day `--q-teal`) with a white cursor and a pale teal line (#9FE3DE). The first version used an ink tile, which disappeared on a dark taskbar. Teal stands out on a dark or a light one, and it is the app's one accent. The wordmark follows the in-app split: "Lang" in ink, "Harness" in teal.

### Where it lives

One geometry, kept in step by hand:

- `build/mark.svg`: the mark alone, in the app icon's colors. Source for the home-screen icons (`node scripts/make-pwa-icons.mjs` writes `public/icons/*` and `app/apple-icon.png`).
- `build/icon-flat.svg`: the squircle app icon. Source for `build/icon.ico`, `build/icon.png` and `build/icon.icns` (`node scripts/make-icons.mjs`).
- `app/icon.svg`: the browser tab icon.
- `components/lh-mark.tsx`: the sidebar mark. The cursor is `currentColor` and the line is `var(--q-teal)`, so it follows the theme. Its viewBox is cropped to the drawing.
- `build/icon.icon`: the Icon Composer document for macOS 26 (layers `cursor.svg` and `line.svg` on an ink fill).

### Don't

- Don't add a flag, a letter or a speech bubble to the mark. The meaning is the blank.
- Don't animate the cursor blinking in the app chrome. A blinking cursor in the sidebar reads as a text field.
- Don't put the in-app mark (ink and teal) on a teal surface: the line would vanish. On teal, use the app icon's colors (white cursor, pale teal line).

## Name ideas

LangHarness is the name today: the repo, the app id (`com.langharness.LangHarness`), the window title and the PWA all use it, so a rename is its own piece of work. The name works with the new mark (the L). It also has weak points: "harness" reads as developer tooling (test harness, Harness.io), and "Lang" is a prefix that many language products use.

If the app gets a name of its own, these fit what it does. The first three fit the mark best.

| Name | Why it fits | Watch out for |
|---|---|---|
| **Unprompted** | The goal is to say a thing with no cue, and every rep starts without a hint (P3). The mark is a cursor with no prompt. It also plays on the model prompts, which the app keeps cheap. | Long (3 syllables), and "unprompted" can read as "unasked". |
| **Foothold** | A first, secure grip on a language, earned on a hard climb. The mark can be read as a climber (the cursor) on a ledge (the line). | Common English word; may be used in other fields. |
| **Offhand** | To say something offhand is fluency: no notes, no searching. Short and friendly. | Can mean "careless". |
| **Typed** | The Review card says "Type it, don't pick it." It says what the app asks for. | Leaves out speaking and listening. |
| **Belay** | In climbing, the belayer holds the rope while you climb. The tutor helps, but you do the climbing, and help has a price. | Climbing jargon; other companies use it. |
| **Crux** | The hardest move of a climb: desirable difficulty in one word. | Used by many products. |
| **Firsthand** | Words you produce yourself, not ones you pick from a list. | Long; a little plain. |
| **Tabula** | A blank slate (tabula rasa) that you fill. Latin, so it is neutral across languages. | Abstract; easy to confuse with "Tableau". |

**Decision (owner, 2026-11-06):** keep LangHarness for now. If the app gets a public name later, **Unprompted** fits the mark and the method best, with **Foothold** second.

**Checked so far (2026-11-06):** web searches for Unprompted, Foothold and Offhand found no language app with that name. Nothing else has been checked: no trademark search, no domain search and no app store search.
