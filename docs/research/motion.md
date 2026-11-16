# Motion: what the app's animation should do, and how it should run

**Question:** the owner asked for drastic UX improvements guided by four animation skills. Where does the app's motion hurt the feel, what does it cost on a phone, and what single system should every screen use?

**Date:** 2026-11-03. **Branch:** `feat/motion-pass`. **Decision:** E35.

## Sources

- Raphael Salaja, _12 principles of animation_ (ui-skills.com): Disney's principles applied to interfaces. The page carries only the summary; the principles used here are the standard ones (anticipation, slow in and slow out, follow-through, timing, staging, exaggeration).
- Wes Hobson, _Interaction design_ (ui-skills.com): a timing scale (100–150 ms for press and hover, 200–300 ms for small swaps, 300–500 ms for larger ones), ease-out to enter and ease-in to leave, motion only for feedback, orientation, focus or continuity, reduced motion always honored, never block input during an animation.
- iart-ai, _60fps animation_ (ui-skills.com): animate only `transform` and `opacity`; replace width and left with transforms; no layout reads between writes; `will-change` only just in time; the grid `0fr → 1fr` trick for auto heights.
- Emil Kowalski, _Animation performance_ (ui-skills.com): a 16.7 ms frame budget (8 ms at 120 Hz); never `transition: all`; never animate a `box-shadow`; CSS and the Web Animations API stay smooth while the main thread is busy, `requestAnimationFrame` and React state per frame do not.

## What the audit found (main, 2026-11-03)

| Finding                                                                                                      | Where                                                                                                               | Cost                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Eleven progress bars animated `width`                                                                        | lesson blitz bar, task frame, Read, Watch, Review, Curriculum, stamps, Milestones, strand balance, placement, Words | layout and paint on every frame of a 300–700 ms move; the row reflows                                   |
| Fifteen `transition-all`                                                                                     | shadcn `Button`, settings, onboarding chips, Words cards, setup dialog                                              | animates whatever changes, including layout properties                                                  |
| The active unit's ring animated `box-shadow` forever                                                         | `unit-badge.tsx`                                                                                                    | a repaint every frame while Curriculum is open                                                          |
| Nine durations and five easings for the same kind of move                                                    | `globals.css`, `quiet.css`                                                                                          | Today rose over 500 ms, a lesson rep over 220 ms with Tailwind's soft `ease-out`, which reads as slow   |
| Press dimmed to 78 % opacity                                                                                 | `press.css`                                                                                                         | a pressed button looks disabled, not pushed                                                             |
| The learn buttons listed `transform` in their transition, but Tailwind 4's `translate-y-px` sets `translate` | `learn-buttons.ts`                                                                                                  | the press nudge snapped instead of easing                                                               |
| The gloss popover popped from 85 % with a bounce, from its centre                                            | `reading/word.tsx`                                                                                                  | a popover should grow from its word, quietly                                                            |
| Review had no motion on a verdict                                                                            | `review-session.tsx`                                                                                                | a miss and a hit felt the same until the colour was read; the next card swapped with no sign it changed |
| `:hover` rules in `quiet.css` were not gated by `(hover: hover)`                                             | buttons, letters, gear                                                                                              | a tapped button on the iPad keeps its hover colour                                                      |

## What changed

- **One timing scale and one curve** (`app/globals.css`): `--dur-press` 100 ms, `--dur-fast` 160 ms, `--dur-base` 220 ms, `--dur-slow` 320 ms; `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out` and a mild `--ease-spring` beside it. They override Tailwind's own `--ease-out` and default transition, so every existing `ease-out` and bare `transition-*` utility picks them up without an edit.
- **Press** (`.lanna-press`, `.q-btn`): a pushed control scales to 0.97 in 100 ms and comes back in 160 ms. Learn buttons, option tiles, play buttons, the Speak microphone and the shadcn `Button` use it. Links and rows keep the old dim.
- **Bars on the compositor** (`.lanna-fill`, `components/ui/fill.ts`): the fill is full width and moved with `translateX`, inside the track that already clipped it. On first paint the bar fills from empty (`@starting-style`, where supported).
- **Explicit transitions:** no `transition-all` is left in `components/`.
- **The ring** is a pseudo-element scaled and faded, the same keyframes as the climb's ring.
- **Popovers and dialogs** (`.lanna-menu-in`, `.lanna-fade`): scale from 0.96 with no overshoot, from the side of the trigger; backdrops fade. The jump palette, the gloss card, the selection word card and the leave-lesson dialog use it.
- **Review feedback** (`components/motion.ts`): a miss shakes the sentence (the lesson already did); the answer pops into the blank; the verdict line fades in; the next card settles in over 200 ms. The Web Animations API plays them without remounting, so the typed text and focus stay.
- **Shorter moves:** reps and the feedback sheet rise 8 px, not 16; Today's sections 320 ms, not 500.
- **Hover only where there is hover**, in `quiet.css` (Tailwind 4 already gates its `hover:` variant).
- **Reduced motion:** a global rule lands every animation and transition in its end state; the spinner and rings keep their static frame.

## Left out, on purpose

- Card hover lifts and drop shadows (the skills' examples): E30 keeps surfaces flat.
- Page transitions between routes: Next's app router has no exit phase without a library, and a learner moves between pages many times a session.
- Animating the sidebar's width: the sidebar no longer collapses (E33), so the transition is idle.
- Confetti and other celebration motion: E31.

## Unverified

The PC, Safari on the iPad and iPhone, and a frame recording on a slow device. Checked in the cloud: computed styles and a press in headless Chromium, screenshots of Today, Review, Milestones and a lesson miss.
