# E35. One motion system: a timing scale, transform-only, press that shrinks (2026-11-03, branch `feat/motion-pass`)

**Why:** the owner asked for a drastic UX improvement guided by four animation skills. The audit ([research/motion.md](../research/motion.md)) found eleven bars animating `width`, fifteen `transition-all`, a `box-shadow` animated forever, nine durations and five easings for the same kind of move, a press that looked like a disabled button, and a Review card with no motion on a verdict.

**How to apply:**
- Durations are `--dur-press` (100 ms), `--dur-fast` (160), `--dur-base` (220) and `--dur-slow` (320); the curve is `--ease-out`. Tailwind's own `ease-out` and default transition are overridden with them in `app/globals.css`, so a bare utility is already right. Nothing a learner waits on runs past 400 ms; reps and anything the keyboard triggers stay at the short end.
- Animate `transform` and `opacity` only. A progress bar is `.lh-fill` with `fillStyle(share)` (`components/ui/fill.ts`), inside a track with `overflow-hidden`. No `transition-all`, no animated `width`, `height`, `left` or `box-shadow`; a ring or glow is a pseudo-element scaled and faded.
- A pressed control shrinks: `.lh-press` (learn buttons, option tiles, play buttons) or `.q-btn` scale to 0.97. Links and rows dim as before.
- A popover or dialog uses `.lh-menu-in` with an `origin-*` toward its trigger, a backdrop `.lh-fade`. No overshoot on anything that is not a result.
- A result moves: a miss shakes, a right answer pops into its slot, new content in the same place settles (`components/motion.ts`, Web Animations, so nothing remounts).
- Hover styles live behind `(hover: hover)`; every animation has a reduced-motion end state, and a global rule catches the ones that forget.
