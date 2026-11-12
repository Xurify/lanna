# E41. Watch takes Czech captions when a video has no Slovak ones (2026-11-03, branch `feat/czech-captions`)

**Why:** the owner pasted a Czech cooking video into Watch and got "This video has captions in cs but none in Slovak." Czech is near enough to Slovak to follow, and many useful videos have no Slovak track at all. The owner asked to allow it.

**How to apply:**
- Slovak always comes first, in any form (made by people or automatic). Czech is used only when the video has no Slovak track, and a human Czech track beats an automatic one, as for Slovak. The order is `captionFallbacks` on the profile in `src/core/language.ts`; a language is added there, not in the Watch code.
- The track's language is kept in `source.trackLang`; the record's `lang` stays the learner's (`sk`). The preview names the language ("YouTube's automatic captions in Czech"), the translation prompt says the subtitles are Czech, and the error names every language tried ("none in Slovak or Czech").
- The on-screen labels "Slovak" (show the Slovak, T) and the Slovak word tags stay as they are. On a Czech video they show Czech text; the preview names the language so the learner knows which it is.
- Open, not decided here: Czech words are read against the Slovak lexicon, so a tapped Czech word can be queued into the Slovak deck, and a Czech watching counts toward the Slovak listening speed. See the November changelog.
