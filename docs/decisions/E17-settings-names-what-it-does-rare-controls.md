# E17. Settings names what it does, rare controls sit under Advanced, and Review holds still (2026-10-30)

**Why:** The settings dialog had grown names only its author could read (Providers, Learner, Prompts). Rare knobs such as the background color, heading weight, compaction thresholds and system prompts sat beside everyday ones. A switch that was on looked disabled, and the Azure speech region had no field. On Review the page painted a skeleton, then the card, then the mode toggle. The owner saw that as a flicker, and it counted as layout shift (CLS, E4).

**How to apply:**
- The nav reads Keys, Tutor, Learning, Appearance, Skill map, Keyboard, Spending, General, Data, in that order. Keys opens first. (Order and names replaced by E22.) Storage and Reset are sections of Data.
- Rare settings sit under a closed **Advanced** disclosure (`SettingsDisclosure` in `components/settings/controls.tsx`). Tutor has long chats and system prompts. Appearance has the background, the heading weight and the bold and italic colors. Skill map has the map update size. An empty field's hint names the factory default, never the stored value.
- Values that are not secrets are plain settings and show in their field: the Azure speech region (`plain: true` in `src/core/auth-keys.ts`). Keys stay masked and out of chat (E5).
- A switch is green with a white knob when on and gray when off. A choice among a few values is a segmented control (playback speed, quiz mechanics). The chosen font is marked with a tick and `aria-current`, not a fill.
- Mode is a fact until light mode exists ("Light mode is coming soon"), so it has no control.
- Review: the loading skeleton waits 300 ms, the last deck stays in memory for the page's life, a refresh that brings the same card keeps the typed answer, and mode and sound are read before the first paint. The header counts wait for the language.
- Desktop: `electron/main.cjs` and the modules it loads start once. After changing them, quit the window and run `npm run desktop:dev` again (see `docs/development.md`).
- A language added in onboarding starts with no level pressed ("Pick a level"), so the picker never guesses one. A pressed level is saved, B2 included: the server used to drop B2 because it equals the default, so the picker showed a level that was not stored. `DEFAULT_LANG_LEVEL` stays B2 as the tutor's fallback for a language with no level.
- Repeated class strings belong in a component (`MenuOption` in `components/settings/model-menu.tsx`), not in an exported string constant.
- Stepper buttons are inset squares inside a bordered group, so the hover fill stays inside the control.
- A section with a size or status that loads later reserves its rows up front (Data), so the layout does not move when the value arrives.
