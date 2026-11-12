# E81. Zvuk: shadowing with the tutorial's timing, verified lines, one listening check (2026-11-08, branch `t3/pronunciation-principles-review`)

**Why:** the owner asked whether the app's way of thinking matches Kjellin's pronunciation tutorial and Krashen's book, and then to start the sound step (phase 7). The comparison is in [research/shadowing.md](../research/shadowing.md). The app takes Kjellin's timing and his short-line rule. It does not take his advice to hold back all writing, or his repeat-one loop.

**How to apply:**
- The sounds are data: `curriculum/slovak/sounds.json` (chapter, a rule and a bridge, two twins, four verified lines). `src/core/sounds.ts` is pure: `checkSound` is the drop rule (the twins differ in exactly one sound, every line is a verified example of one twin, at most six words), `listenOrder` draws the four-item check, and `shadowVerdict` reads the Speak bar (`PRON_CLEAR`, unchanged).
- `/sound?id=<id>` runs the screen. A listening check comes first: choose the word heard, two of each twin, capped at four items. Then shadowing: a line plays, the learner has a 700 ms gap (`SHADOW_GAP_MS`), then says it. The recording goes through the same transcript and clarity score as Speak (`/api/stt`, `/api/pronounce`), so no Azure key is needed. Three tries per line, then the line is left as not yet.
- Without a microphone the line is said aloud and not scored. Without speech-to-text the screen says so and links to Settings → API keys.
- The twins meet only in the listening check. The soft consonant pair (de, te, ne) from the plan is not built: the lexicon has no verified twins for it, and it is not invented.
- Two vowel-length pairs so far: pas/pás (chapter "moving") and rad/rád (chapter "people"), each line taken from the lexicon's own verified examples.
- Not saved yet: the screen keeps its result on the page (E1 says learner-produced data is kept, so saving comes next). The sound step is not on the path yet either (`chapterArc` still says "not yet"), so the screen is reached by its link until the arc names it.
