# E32. No AI-slop defaults (2026-11-02)

**Why:** agents build most screens, and left to defaults they produce the same page every AI tool produces: Inter, a lavender accent, gradients, glows, glass cards, colored card edges, icon-card rows, stat banners and all-caps labels. Research: [research/design-slop.md](../research/design-slop.md).

**How to apply:**
- Before designing or restyling a screen, read `.claude/skills/anti-slop-design/SKILL.md`; `AGENTS.md` points every agent there.
- One layout primitive and one bold choice per screen; body text passes WCAG AA in both themes; shadcn components are restyled to the app's tokens before they ship.
- Run the skill's diff checks before calling a UI change done. A hit on an added line needs a reason or a fix.
