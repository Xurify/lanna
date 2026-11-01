# The goal line, the calculators and the Plan page: a UX audit

**Date:** 2026-10-28. **Question:** where should the goal, the hours, the milestones and the level re-check live, and why did the goal line on Today read as "very bad placement"? **Method:** the Uxcel-derived lenses (design review as orchestrator; heuristics, microcopy, information architecture, navigation, tooltips, dashboard, settings) and the dataviz checks, run on the goal line, the hours sheet, `/milestones` and Settings → Learner. **Changed:** the Plan page (`/plan`, `components/plan/plan-page.tsx`, `src/core/plan.ts`), the Today goal line, the sidebar, the milestone timeline, the real-pace gate, Settings → Learner, `/start?edit=1&check=1`. This note was written by the thread that ran the audit; the build landed from the same brief in the Plan commits of 2026-10-28 and was revamped in the Today, sidebar and honest-plan passes that followed.

## What the owner saw

Two screenshots. One: the goal line on Today, two lines holding the target, the purposes, "2 of ~400 guided hours", two dates and four underlined links (Change, Re-check my level, How long does it take?, When can I…?), one of them reading "at your real pace (1 min/day) November 2144". Two: the milestone timeline with labels cut to "Understand my mother-in-law'…" and nothing to recover the name. Their words: re-checking the level should be easier and somewhere else; the placement is bad and some of it does not belong there; hover should give the full name and more; the tools need a standard, natural place, not only a link; the values should be tweakable like a savings projection.

## Findings, by lens

Context for every lens: desktop app, one learner, design system in play (the app's tokens, Nunito, the chip and card language), primary task on Today = start the next task. The design-system lenses (color, type, spacing, aesthetics) were suppressed as the policy says; heuristics, microcopy and IA ran; tooltips, navigation, dashboard and settings were used as generators for the fix.

### Critical

- **Honest numbers broken (heuristics #2, P8).** "At your real pace (1 min/day) November 2144" came from one logged minute in fourteen days. A date from almost no history is not a date. Fix: a real-pace date needs seven study days of the last fourteen (`MIN_PACE_DAYS`); below that the page says "not enough data yet" and shows the study-day count instead. The same gate sits in the milestone estimate (`paceDays`), and `when()` refuses any date beyond ten years ("more than 10 years away").
- **No home for the planning tools (IA #5, #6; navigation "every page is a front door").** The hours sheet, the milestones page and the re-check were reachable only from four underlined links at the bottom of the plan card. Known-item seeking ("where do I re-check my level?") had no scent anywhere in the navigation. Fix: a **Plan** door in the sidebar beside Today, Review and Skill map, selected on `/plan` and `/milestones`; `/milestones` now returns to Plan, not Today.

### Major

- **Overloaded goal line (heuristics #8 minimalism; dashboard "when everything is important, nothing is").** Nine facts and four equal-weight links in two lines of 11px text. The dashboard lens asks what decision each widget supports on Today: only "am I on track, and roughly when" does. Fix: Today keeps `Goal: B1 · about March 2027 at 30 min a day` (plus the real-pace month once it exists) and one door, "Plan: pace, dates, milestones". Purposes, hours done, the sheet and the re-check moved to Plan.
- **Re-check hidden (heuristics #6 recognition; settings "make settings easy to reach").** The check lived behind "Re-check my level" on Today, which opened the setup on screen 1 of 4. Fix: a "Your level" group in Settings → Learner with the last check's date and level and one button; the same button on the Plan page; both open `/start?edit=1&check=1`, which lands on the check screen directly.
- **Truncated labels with no recovery (tooltips: truncation + tooltip is the legitimate pairing; dataviz interaction: a hover layer by default).** The timeline used native `<title>` on the dots only: slow, dot-only, and the row label stayed cut. Fix: one HTML chip (`role="tooltip"` in the Timeline) anchored to the hovered row, kept inside the figure, never covering the mark, carrying the full title, the situation's line, both dates and which gap decides. The hours sheet keeps its readout under the plot. Nothing lives only in the chip: the cards and the list under the chart carry the same facts.
- **No way to try a pace (heuristics #7 flexibility; the owner's Acorns comparison).** Changing minutes meant re-running the setup and saving before seeing the effect. Fix: two custom sliders (`components/plan/slider.tsx`; no native range input, per E4) that re-run the pure estimators (`levelDates`, `withPlan` + `estimateMilestone` in `src/core/plan.ts`) on every move, redrawing the landing month, the hours and the milestone timeline with no request and no layout shift, and a line saying how far the date moved against the saved pace. Save model per the settings lens: a grouped, deliberate change gets an explicit **Apply** (disabled until something changes, "Saving…", "Applied"), plus Reset; atomic toggles elsewhere keep autosaving.

### Minor

- **Microcopy.** "How long does it take?" and "When can I…?" are questions, not destinations; as links beside "Change" and "Re-check my level" the syntax was mixed (IA labeling: one syntax). On Plan the sections are nouns ("Your pace", "Hours to each level", "When can I…?" kept as the calculator's own name) and the buttons are verb + object ("Change the goal", "Re-check my level", "Apply this pace"). The hours sheet's last line now points at Plan rather than at the milestones page.

### Working well

- The timeline's form: one series per row, labels in a left column so nothing collides, a shared axis from today (dataviz "choose the form").
- The evidence panel on `/milestones` (P8) and the per-card words and speed meters; untouched.
- The hours chart's zero baseline, three named series with a legend, and the FSI reference lines.

## What was decided

1. **Today shows the goal, the next date and one door.** Anything a learner would compare, tweak or read about lives on Plan.
2. **Plan is the standard place** for the goal, the pace, the hours, the milestones, the weak spots and the level re-check. The sidebar carries it.
3. **Re-check my level is one click** from Settings → Learner and from Plan, and it opens on the check.
4. **Real-pace dates wait for evidence**: seven study days in fourteen; no date beyond ten years.
5. **Live what-if, explicit Apply.**

## Sources

- Uxcel, 10 Usability Heuristics; Dashboard best practices; Tooltips and when to use them; Types of navigation systems; "You're here" navigation; Labeling systems; How people seek information; Saving changes; How to design useful settings pages.
- Nielsen, J. (1994), heuristic evaluation severity (frequency × impact × persistence).
- The dataviz skill's form, mark and interaction references (hover layer by default; thin marks; no dual axes).
