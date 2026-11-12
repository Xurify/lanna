# E30. The trail design: four marks, one gold, a climb (2026-11-02)

**Why:** the owner wanted the app to feel like a language app, but not a copy of the best-known one, and rejected both a Duolingo-like build and a flat editorial one. The direction has to be the app's own and still keep what works: one next step, a visible path, streaks and XP, feedback in a fixed place. Research and sources: [research/trail-design.md](../research/trail-design.md).

**How to apply:**
- The four kinds of practice (Nation's strands) are the four Slovak trail colors, carried by the trail mark (`components/trail.tsx`): input red, speaking blue, words & rules green, speed yellow. Strand colors come from `components/strand-style.ts` only.
- One action color, the sun (`--lh-sun`): the main button (`components/ui/learn-buttons.ts`), the streak (a flag, not a flame), XP, the Review badge, every finished stop and the walked stretch of any progress bar. Right answers are the trail green, wrong ones the trail red; nothing else is saturated.
- The path is the climb (`components/climb.tsx`): levels as stretches of a mountain read from the bottom up, chapters as stops on a switchback trail, done in solid gold, ahead dotted, the current stop ringed. Today shows the current stage; `/curriculum` the whole mountain. No winding road of icons, no list of dots.
- Flat tonal surfaces (ground, card, raised, edge), hairlines, radii 12–24 px, no gradients, no drop shadows except on menus. The chrome font is Bricolage Grotesque; prose stays Source Sans 3.
- Copy stays short and plain; the design's words are "climb", "stop", "days in a row", never a metaphor the learner has to decode. The mountain is kept to the climb card and the ridge line; nowhere else.
