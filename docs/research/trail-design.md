# The trail design (2026-11-02)

**Question:** the first redesign made LangHarness feel like a language app, but in the best-known app's own forms (a winding road of round icons, a flame, a chunky green button, confetti). The owner wanted a direction of its own that still keeps what works: one next step, a visible path, streaks and XP, feedback in a fixed place, and a pathway that is clear and beautiful. What should that direction be, and why would it work for a learner of Slovak?

**Outcome:** the trail design, on branch `feat/trail-design` (one PR). Rule [E30](../decisions/E30-the-trail-design-four-marks-one-gold.md). It replaces the look built on `feat/language-app-redesign` (PR #79, left open and untouched for comparison).

## The idea

Learning Slovak to B2 is a long climb: about 650 guided hours ([milestones.md](milestones.md)). Slovakia's own way of showing a long walk is the hiking trail. Every marked trail in the country is blazed the same way: a colored stripe between two white ones, painted on trees and rocks, in one of four colors (red, blue, green, yellow; STN 01 8025, kept by the Klub slovenských turistov). The red-marked Cesta hrdinov SNP runs the length of the country along its ridges. Three hills stand on the coat of arms.

So the app takes three things from that world, and nothing else:

1. **The trail mark** (`components/trail.tsx`, `TrailMark`). The four kinds of practice the week balances, Nation's four strands ([comprehensible-input.md](comprehensible-input.md)), are the four trail colors: input red, speaking blue, words & rules green, speed yellow. A task on Today, a practice group, a bar in the week's balance all carry the same mark, so a learner reads the kind of practice by shape and color, not by color alone (WCAG 1.4.1).
2. **The climb** (`components/climb.tsx`). The path to the target level is a mountain read from the bottom up. Each CEFR level is a stretch of slope, each chapter a stop at the turn of a switchback trail, each level's end a flag. The stretch already walked is solid gold; the stretch ahead is a dotted line, the way a hiking map draws a trail; the stop you are at wears a ring. Today shows the stage you are on; `/curriculum` shows the whole mountain and opens at your stop.
3. **The ridge** (`RidgeProgress`). Under the greeting on Today, the whole way to the target level as one skyline, with a marker where you stand and the count of units beside it.

The sun (gold) is the one action color: Start, Check, Continue. It is also the streak (a flag, not a flame), XP, the due count on Review, and every finished stop. One color means "go, done, earned" everywhere.

## Why this should work for the learner

- **Visible progress toward a near goal raises effort.** The goal-gradient effect (Kivetz, Urminsky & Zheng 2006) and endowed progress (Nunes & Drèze 2006): people work harder when they can see how far they have come and how close the next stop is. The climb puts the walked stretch in gold under the learner's feet and the next stop one turn away. The ridge does the same for the whole way to B2.
- **Streaks and XP stay**, as the owner asked, because they work for them; the streak keeps its one forgiven rest day (a choice made in the app, documented in LANGHARNESS.md; P8, honest numbers, is why the count says what it counts). They are shown in the design's own words: days in a row with a flag, XP in gold.
- **Four strands made visible.** The research base of the app ([comprehensible-input.md](comprehensible-input.md)) says a balanced week gives a quarter to each strand. The trail marks make the strand of every task legible at a glance, so the learner sees the balance as they pick, not only in the week card.
- **A familiar sign for the learner's real life.** Anyone who walks in Slovakia meets these marks; the app's chrome becomes something they will recognise outside it. This is a reason to use the marks, and also a reason to keep them small and exact: a kitsch mountain would undo it.
- **Desirable difficulty is untouched** ([desirable-difficulties.md](desirable-difficulties.md)): nothing here changes what a rep asks for or what help costs. The lesson's progress bar became a trail of marks, one per question, colored by how it went (gold right, red missed, half gold for accents), so the bar is also the lesson's record.

## Palette

Flat tonal layers, no gradients, no shadows except on menus. The accents are desaturated and lifted for a dark ground, as dark-theme guidance recommends.

| Token | Value | Used for |
|---|---|---|
| ground `--background` | `#0f1519` night slate | the page |
| card `--card` | `#161e24` | cards |
| raised `--accent` | `#1f2a31` | tiles, hover, the slope behind the trail |
| edge `--border` | `#2b3842` | hairlines |
| text `--foreground` / `--muted-foreground` | `#eef2f3` snow / `#93a2aa` | text |
| sun `--lh-sun` | `#f2b84b` | the action button, streak, XP, done stops, the walked trail, the Review badge |
| trail red | `#ea5f4f` | input strand; a wrong answer |
| trail blue | `#4fa3e3` | speaking strand; the tutor |
| trail green | `#4cc47c` | words & rules strand; a right answer |
| trail yellow | = sun | speed strand |

Older token names (`go`, `miss`, `warn`, `gold`, `flame`, `xp`, `sky`) are aliases of these, so every screen keeps its meaning without edits. The window frame, the title bar and the web app manifest use the ground.

## Type

- **Bricolage Grotesque** (Mathieu Triay, Google Fonts, SIL OFL) for the app's chrome: labels, buttons, headings, numbers. It has an optical-size axis, so 12 px labels get its text cut and the big headings its display cut, and `latin-ext` covers every Slovak letter (ľ ĺ ŕ ť ď ň ô ä). Loaded with `next/font`, self-hosted, so no flash of another font. It replaces Nunito; headings dropped from the 900 weight to 800, which is the face's heaviest cut.
- **Source Sans 3** stays for prose and Slovak sentences; **JetBrains Mono** for code and key hints; CMU Serif for the tutor's session names.

## Navigation

Seven doors in the sidebar, named for what the learner does there: Today, Climb (`/curriculum`), Review (with its due count in gold), Stories (`/read`), Speak, Words, Progress (`/plan`, which also holds milestones, the map and My mistakes). The phone's bottom tabs hold five: Today, Climb, Review, Stories, Progress. The current door is lit by a gold bar at the edge and a gold icon, no pill.

## What was checked

Screens at 1440 px and on a 390 px phone with touch, dark, in a sandbox with a throwaway data folder and the demo week: Today, the climb, Review, Progress, Stories, Speak, Words, a lesson (question, verdict, end). Typecheck, lint, the focused tests and the full suite.

## Unverified

The owner has not used the built version on the PC. No light theme: the tokens are ready for one, the values are not. The Cyrillic subset is not loaded for Bricolage Grotesque; the Russian placeholder profile falls back to the system font for Cyrillic labels.

## Sources

- Nation, I. S. P. (2007). The four strands. *Innovation in Language Learning and Teaching*, 1(1), 2–13.
- Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal-gradient hypothesis resurrected. *Journal of Marketing Research*, 43(1), 39–58.
- Nunes, J. C., & Drèze, X. (2006). The endowed progress effect. *Journal of Consumer Research*, 32(4), 504–512.
- Klub slovenských turistov, turistické značenie (STN 01 8025): the four trail colors and the stripe mark.
- W3C, WCAG 2.1, success criterion 1.4.1 Use of Color.
- Material Design, dark theme guidance: tonal surfaces and desaturated accents on dark grounds.
- Triay, M. Bricolage Grotesque (Google Fonts, SIL Open Font License).
