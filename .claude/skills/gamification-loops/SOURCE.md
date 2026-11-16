# Source

`gamification-loops` is a third-party agent skill, copied unchanged on 2026-11-02 from
https://github.com/omer-metin/skills-for-antigravity (skills/gamification-loops), licensed
Apache-2.0 by its author. Installed with `npx skills add https://github.com/omer-metin/skills-for-antigravity --skill gamification-loops`.

Why this one: of the gamification skills on the public registries (skills.sh, agent-skills.md,
claudskills.com) it is the only one that ships working references rather than a one-line
description: `references/patterns.md` (core loop, progress, reward and streak design, with the
anti-patterns), `references/sharp_edges.md` (addiction vs engagement, metric gaming, motivation
crowding, leaderboard demoralization) and `references/validations.md` (the checks a design must
pass: an off-ramp, intrinsic value, hard-to-game rewards, no notification spam, completion states).
It passed the registry's three security audits and had 580 installs at the time.

How Lanna uses it: read `SKILL.md` and the three references before adding or changing any
streak, stamp, goal or reward (docs/research/gamification.md records how the current design
measures against the validations). The repo's own rules in CLAUDE.md win where they differ.
