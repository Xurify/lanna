---
name: anti-slop-design
description: "Checklist of the visual tells that make a UI look AI-generated (Inter everywhere, lavender accent, gradients, glows, glassmorphism, colored card edges, badge over a centered hero, identical icon cards, 1-2-3 steps, stat rows, emoji nav, all-caps labels, stock shadcn) and what Lanna does instead. Use before and after designing or restyling any screen, component, page, mockup or artifact, and when reviewing a UI diff."
---

# Anti-slop design

A page an agent builds from defaults looks like every other page an agent built from defaults. The learner notices, even without a name for it, and reads it as "nobody decided this". Lanna already has a direction of its own (the trail design, rule E30). This skill keeps new work on it.

Use it twice: once **before** you write markup (pick from the "Do instead" column), and once **after** (run the checks at the bottom on your diff).

## The tells

| Area | Slop tell | Do instead in Lanna |
| --- | --- | --- |
| Type | Inter (or Geist, Space Grotesk) for everything, especially a big centered headline | Chrome in Bricolage Grotesque, prose in Source Sans 3 (E30). Never add a third family. |
| Type | One hero word in italic serif on a sans page | No accent words. Emphasis comes from weight and size inside the existing scale. |
| Type | All-caps headings and section labels, letter-spaced | Sentence case everywhere (E4a). Labels are short words, not shouted ones. |
| Color | The lavender/violet accent ("vibe-code purple") | The sun (`--lanna-sun`) is the one action color; the four trail colors belong to the strands only (`components/strand-style.ts`). Nothing else is saturated. |
| Color | Permanent dark mode with mid-gray body text | Both themes from the tokens. Body text passes WCAG AA (4.5:1) in each; check the dark theme, where it usually fails. |
| Color | Gradients on backgrounds, buttons, text or borders | Flat tonal surfaces: ground, card, raised, edge (E30). |
| Effects | Colored glows, big colored box-shadows | No drop shadows except on menus (E30). Depth comes from the surface tone and a hairline. |
| Effects | Glassmorphism: frosted, blurred, translucent cards | Opaque surfaces. Blur only where content really scrolls under a fixed bar, and then quietly. |
| Layout | Centered hero with a pill badge above the H1 | No hero. A screen opens on the one next step (P1, E8). Badges carry data (a count, a state), never decoration. |
| Layout | Cards with a thick colored top or left border | A strand is shown by the trail mark (`components/trail.tsx`), not a colored edge. Cards are one tone and a hairline. |
| Layout | A row of identical cards, each with an icon on top and two lines of copy | If items differ in weight, show it. If they are a list, make it a list. |
| Layout | "1, 2, 3" numbered steps; a row of big stats | Only when the numbers are real and the order matters to the learner. The top of Today has exactly four indicators (E31); do not add a stat row elsewhere. |
| Layout | Several layout primitives on one screen (cards + stats + steps + sidebar cards) | Pick one primitive per screen and repeat it. This is the highest-leverage fix. |
| Icons | Emoji as navigation or feature icons | The app's icon set at one size and stroke. Emoji only inside learner-facing content where they mean something. |
| Components | shadcn/ui exactly as installed: default radius, default ring, default `shadow-sm`, default slate palette | Use the app's own primitives (`components/ui/learn-buttons.ts` for buttons) and tokens. When you take a shadcn component, restyle radius (12–24 px), color and shadow to the trail tokens before it ships. No native widgets (E4). |
| Copy | "Supercharge", "Unlock", "Seamless", "Elevate your…", three-word taglines | Plain and short (E30): say what the button does. See the `ux-microcopy` and `humanizer` skills for prose. |

## The bar

- **One bold choice per screen, and only one.** In Lanna that is usually the climb or the sun-colored main button. Everything around it stays quiet.
- **A decision you can name beats a default you cannot.** If you cannot say why a color, font, radius or shadow is there, take it out or replace it with a token.
- **Write the decision down.** A new visual rule that every later screen must follow goes into `CLAUDE.md` in the same PR, so the next agent does not fall back to defaults.

## Checks to run on your diff

Deterministic checks, no screenshot judging. Each hit is a question, not an automatic failure; some old upstream files (chat UI, settings) still match, so judge only the lines you added.

```bash
git diff main --unified=0 -- app components src | grep -nE '^\+.*(bg-gradient|linear-gradient|radial-gradient)'
git diff main --unified=0 -- app components src | grep -nE '^\+.*(backdrop-blur|backdrop-filter)'
git diff main --unified=0 -- app components src | grep -nE '^\+.*(shadow-(md|lg|xl|2xl)|shadow-\[|box-shadow)'
git diff main --unified=0 -- app components src | grep -nE '^\+.*(uppercase|tracking-widest|text-transform)'
git diff main --unified=0 -- app components src | grep -nE '^\+.*(border-[lt]-[248]|border-[lt]-\[)'
git diff main --unified=0 -- app components src | grep -nE '^\+.*(violet-|purple-|indigo-|fuchsia-|#8b5cf6|#a78bfa|#7c3aed)'
git diff main --unified=0 -- app components src | grep -nE '^\+.*(font-\[Inter|Inter,|Space_Grotesk|Instrument_Serif|italic font-serif)'
git diff main --unified=0 -- app components src | LC_ALL=C.UTF-8 grep -nP '^\+.*[\x{1F300}-\x{1FAFF}]'
```

Then look at the screen, at both window sizes from E4 and in both themes, and ask:

1. Does the screen use one layout primitive, or several?
2. Is there exactly one saturated thing the eye goes to first, and is it the next step?
3. Does dark-theme body text pass 4.5:1?
4. Would this screen look at home in any other AI-built app? If yes, find the default you kept and replace it.
