# What makes a UI look AI-made, and how agents should avoid it

**Question:** agents build most LangHarness screens. Which visual defaults make a generated UI read as "AI slop", and how do we keep agents off them?

**Date:** 2026-11-02

**Outcome:** the `anti-slop-design` skill in `.claude/skills/anti-slop-design/`, a "Design: no AI slop" section in `AGENTS.md` so every agent sees it, and rule [E32](../decisions/E32-no-ai-slop-defaults.md).

## Source

Developers Digest, "AI design slop and how to spot it": https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it

## What it found

The tells fall into five groups:

- **Type:** Inter as the default for everything, a centered Inter hero, recurring picks (Space Grotesk, Instrument Serif, Geist), and one italic-serif accent word in the headline.
- **Color:** a lavender-purple accent that recurs across generated pages, permanent dark mode with mid-gray body text that often fails WCAG AA, gradients, and large colored glows and shadows.
- **Layout:** a centered hero with a badge above the H1, cards with a colored top or left border (the article calls this the most specific tell), identical icon-on-top feature cards, "1, 2, 3" step rows, stat banners, emoji in the navigation, and all-caps labels.
- **Components:** shadcn/ui left at its defaults, since agents copy its look unchanged.
- **Effects:** glassmorphism.

Remedies: pick one layout primitive and repeat it (the highest-leverage change), make one bold choice rather than many safe ones, choose a palette and typeface with a point of view, meet contrast standards, restyle shadcn tokens, and write design decisions down where the agent reads them every session. The article measures pages with deterministic DOM and CSS checks run in Playwright rather than a model judging screenshots.

## What it means for LangHarness

Most of the remedies are already rules: the trail design (E30) has one action color, flat surfaces, no gradients or shadows, and its own type pair; E4a bans uppercase on learning screens; E31 caps the top of Today at four indicators. What was missing is the agent-facing side: a list of the tells next to the rule that replaces each, read before design work starts, and a cheap check on the diff after. The skill does both. Its checks are greps over added lines, in the article's deterministic spirit, without a Playwright run.

A count on `main` at the time found older files that still match some checks (backdrop blur, large shadows, uppercase, a few gradients), mostly in upstream chat and settings UI. They are not changed here; the checks judge added lines only.
