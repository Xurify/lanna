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
- WCAG 2.2 success criterion 1.4.3 (contrast, 4.5:1 for text). Nav group labels use `--q-ink-3`: 4.98:1 in Day (`#656b72` on `#f6f6f4`) and 6.19:1 in Night (`#9399a0` on `#16181a`). Section group titles use `--q-ink-2`, 9.08:1 in Day. Day nav labels pass, but only just.

## Decision

- One scale on an 8 px base, in 4 px steps: 32 px between groups, 12 px from a group title to its rows, 8 px between rows, 12 to 16 px inside a row.
- Section title 20 px, hint 14 px, group title 14 px semibold, row text 14 px, row hint 12 px.
- The nav shows the same thirteen sections in four labelled groups, lesson settings first: Lessons (Learning, Sound, Notifications), Look and controls (Appearance, Keyboard), AI (AI models, API keys, Spending), App and data (General, Devices, Data, Backup, Sources). Reset stays last, inside Data.
- Section ids, test ids and deep links are unchanged.

## Not changed

Autosave on each toggle, the search, the wording of every label, and the internals of the AI, keys and devices sections. Those need their own notes.
