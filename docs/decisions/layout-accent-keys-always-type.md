# Your own keyboard's accent keys always type (2026-11-11, branch `fix/dead-key-accents`)

This changes [E101](E101-task-screens-are-written-on-the-page.md): the key left of 1 no longer opens the Keyboard when the layout uses it for an accent.

The owner, on Listen, with Estonian and Slovak layouts on Windows: "I don't like how it deletes previous characters when I try to type with my own accent marks".

**Why:** the key left of 1 opened and closed the on-screen Keyboard on every layout, and its keydown was prevented. On the Estonian layout that key is the dead key ˇ (č, š, ž, ď, ľ, ň, ť); on US-International it is the dead grave, on German the dead ^. Chrome on Windows shows a dead key as a pending accent, and a prevented keydown cancels it, which can take letters typed before it.

**How to apply:**
- A dead key (`key: "Dead"`), or any key inside an IME composition (`isComposing`, or `keyCode` 229), is left to the layout: it never opens or closes the Keyboard and never picks from the held-letter accents (it only closes them). `belongsToLayoutAccent` in `src/core/accent-keys.ts`.
- Any new keydown handler that calls `preventDefault()` on a typing field lets these keys through.
- **Trade-off:** on a layout whose key left of 1 is a dead key, that key no longer opens the Keyboard; the Keyboard button still does. Layouts where it types a plain character (` on US, ; on Slovak) keep the shortcut.

**Not changed:** the held-letter accents and their digits by key position, the Keyboard button, the touch-screen pad.
