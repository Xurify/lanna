# Settings layout

Question: how should the settings screen group its sections and space its rows, so a learner finds one setting, changes it and leaves?

## What was wrong

Checked by screenshot at 1280 and 390 px in Day and Night, before the change:

- Thirteen sections in one flat nav, split only by a single divider before "AI models". Nothing said what a section was for.
- Gaps came from several unrelated values (8, 10, 12 and 16 px for the same job). A group sat about as far from the next group as from its own rows, so the page read as one stack.
- Group titles were 13 px, below the type scale the rest of the screen uses.
- The disclosure panel used a different surface and padding from every other row.
- Inside Learning, a wrapper set its groups to 8 px apart, so "Add a language" sat on top of "Languages you know".

## Sources

- The settings and layout rules in the `ux-settings` and `ux-layout-spacing-grids` skills: order by how often a setting changes, group with headings and white space rather than dividers, keep proximity (tight within a group, looser between groups), and keep destructive actions last. Those skills cite Uxcel lessons; this note did not re-read them.
- WCAG 2.2 success criterion 1.4.3 (contrast, 4.5:1 for text). Nav group labels and section group titles use `--q-ink-2`: 9.08:1 in Day (`#3f444a` on `#f6f6f4`) and 10.47:1 in Night (`#c3c7cb` on `#16181a`). `--q-ink-3` measured 4.98:1 in Day, a pass by a hair, so the labels moved off it.

## Decision

- One scale on an 8 px base, in 4 px steps: 32 px between groups, 12 px from a group title to its rows, 8 px between rows, 12 to 16 px inside a row.
- Section title 20 px, hint 14 px, group title 14 px semibold, row text 14 px, row hint 12 px.
- The nav shows the same thirteen sections in four labelled groups, lesson settings first: Lessons (Learning, Sound, Notifications), Look and controls (Appearance, Keyboard), AI (AI models, API keys, Spending), App and data (General, Devices, Data, Backup, Sources). Reset stays last, inside Data.
- Section ids, test ids and deep links are unchanged. Settings opens on Learning, the first item, instead of General, which now sits in the last group.
- The nav scrolls on every width: with four group headings it is taller than the 640 px dialog, and without scrolling Backup and Sources were cut off on desktop.
- A search field above the nav (a search icon, "Search", and a `/` key hint, as the owner asked) narrows it by label, group or keyword; Enter opens the first match, and `/` focuses it from anywhere in Settings. It has no visible label, against the typed-field rule in `CLAUDE.md`, by the owner's choice; screen readers get "Search settings". On desktop it takes focus when Settings opens, and it answers the app-wide Tab field cycle, because Tab does not move focus in this app (owner rule in `components/keyboard-shortcuts.tsx`). Escape clears a typed search before it closes Settings.
- Learning shows only the languages the learner has chosen, with "Change languages" for the full list. Onboarding keeps the full list.
- With no API key, AI models says no model is available yet and links to API keys, instead of showing empty pickers.
- Notifications, Spending and Keyboard now use the same headings and spacing as the other sections: sentence case, the section titled "Notifications" like its nav item, switches on the right.

## Not changed

Autosave on each toggle. Row hints stay at 12 px: 14 px would make every row taller and the hint as loud as its label; they use `--q-ink-3`, which measures 4.9:1 on the row background in Day. The layout of the API keys, Devices, Data and Backup sections beyond the shared spacing.
