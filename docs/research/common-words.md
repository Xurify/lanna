# Browsing common words and marking a starting vocabulary

2026-11-17.

The learner asked to see common words and mark the first 200, 500, or another number as known, rather than tapping every word individually.

## Evidence and limits

The [vocabulary-size review](vocabulary-size.md) covers frequency and self-report. Frequency is useful for ordering a list, not proof that someone knows every word above a cutoff. Stubbe (2015), doi:10.7820/vli.v04.2.stubbe, found that yes/no self-report overstated translation performance. This feature records a learner's declaration, not a test result, and leaves the meaning-recall check separate.

Lanna's existing frequency order counts dictionary forms in the dictionary's non-rejected example sentences. Unseen forms fall back to dictionary rank order. This is not a national-corpus ranking, and the screen says so. The same order already supports vocabulary estimates and input selection.

## Implementation

Words has a Common words tab. A slider picks the top 50 up to the whole dictionary in steps of 50, and the whole selection is listed at once. The list is split into bands of 100 by frequency position, each with its known count and a "Mark N known" action for that band. Every word shows its dictionary form and meaning; known words carry a check mark and words still to learn stand out, and a "To learn" view hides the known ones. Tapping a word marks or unmarks it. A confirmation names how many new marks will be added before the top-N bulk action writes anything.

The bulk action records only missing marks in one atomic write to the existing profile's `known.json`. Repeating it is harmless; existing timestamps and marks outside the selected range stay intact. Individual marks can be removed on the same list. Review cards, schedules, XP and test answers do not change. The words-known panel refreshes after a mark changes.

No model or translation calls are needed. There is no new corpus format: existing known-word export and coverage readers consume the same store.
