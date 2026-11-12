# Dropped or deferred

Work that was considered and dropped, or put off, with the day and the reason. A TODO in code becomes a line here.

- **Clozemaster integration (dropped 2026-10-28).** Its terms forbid automated access; the official CLI's MCP server only edits collections. The in-app Review deck is the replacement, and the aim is to be better than it. A file the owner uploads by hand is not automated access: see E89.
- **Russian profile (closed 2026-11-05).** The built-in Russian profile, which shipped prompts and no words, is gone: Russian is added from the app like any other language, and keeps its hand-written tutor doctrine.
- **Folder rename** langharness-2 → langharness: wanted, deferred until the app can be closed.
- **Windows installer and sync:** not built; data is local only.
- **One `Pip` for the ear gym and Listen (deferred 2026-11-09, E96).** `components/phonology/ear-gym.tsx` still draws its marks with its own copy. It changed on `feat/ear-gym-estonian` and `feat/sound-guide` while this branch was open, so moving it to `Pip` in `components/task-frame.tsx` is a change of its own.
- **A flat card on a phone for the other task screens (deferred 2026-11-09, E96).** Only Listen passes `phone="flat"`. The lesson, the exam, Speak and the ear gym keep their card at 390 px until each has been looked at.
