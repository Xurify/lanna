# E59. The mark is a cursor at an empty answer line, for any language (2026-11-06, branch `feat/icon-fields-creators`)

**Why:** the owner asked for a new app icon and a better brand. The old mark, two speech bubbles, came from the upstream app and looked like any chat app. A first draft, an `š` cut from Geist Bold, was dropped when the owner pointed out that this is a language tutor for any language, not a Slovak app. A háček over a line was dropped too, because it read as a download icon. Details and name ideas: [brand.md](../brand.md).

**How to apply:**
- The mark is a text cursor (ink) waiting at an empty answer line (teal): two rounded rectangles in a 1024 box, cursor 262,212 116×600 and line 418,696 344×116, radius 22 (bolder since 2026-11-07: the first bars, 72 wide, were too thin to read in a taskbar). It says what every task asks for: the blank first, your answer next (P3). It reads as an L.
- No letter, script, flag or diacritic goes into the mark, so it fits every language the app can add (E43).
- In the app, the cursor is `currentColor` and the line is `var(--q-teal)` (`components/lh-mark.tsx`), so the mark follows Day and Night like the wordmark ("Lang" in ink, "Harness" in teal). The app icon is a teal tile (#0D6764) with a white cursor and a pale teal line (#9FE3DE); the first ink tile disappeared on a dark taskbar.
- One geometry, kept in step by hand: `build/mark.svg`, `build/icon-flat.svg`, `app/icon.svg`, `components/lh-mark.tsx` and the Icon Composer layers in `build/icon.icon`. After changing it, run `node scripts/make-icons.mjs` and `node scripts/make-pwa-icons.mjs`.
- The name stays LangHarness (owner, 2026-11-06: "Let's keep LangHarness for now"). The name ideas in brand.md are kept for later; a rename is its own piece of work (app id, window title, PWA, repo).
