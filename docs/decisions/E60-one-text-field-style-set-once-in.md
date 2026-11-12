# E60. One text field style, set once in global CSS (2026-11-06, branch `feat/icon-fields-creators`)

**Why:** the owner could hardly see the Creators field on Watch in Night ("Stuff like this should be fixed in global styles so we don't have to be redundant"). The Night well (#1a1d1f) is almost the card (#1b1e21), and every form field carried its own border, background, focus and placeholder classes.

**How to apply:**
- A typed field outside an exercise uses `.q-field` (`app/quiet.css`): its own surface `--q-field` (the well in Day, #23272a in Night), the checkbox grey `--q-box` as a 1 px inset outline (the hairline `--q-line-2` is 1.5:1 on a Night card), and a 1.5 px teal ring on focus. Height, padding, radius and font stay on the element.
- Placeholders get one color in the base layer: `--q-ink-3`, opacity 1 (4.9:1 in Day, 5.2:1 in Night). Utilities still override it.
- Answer fields inside exercises (lesson, placement, Read, Catch the mistake's answer states) keep their own right and wrong colors; they are not form fields.
