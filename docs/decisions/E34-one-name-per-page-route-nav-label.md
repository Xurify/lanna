# E34. One name per page: route, nav label and page title (2026-11-03, branch `feat/quiet-tool-redesign`)

- A page has one name, and the route, the sidebar label and the page title all say it. The table is `lib/nav.ts`; the sidebar, the jump palette and the document titles read it, and `tests/nav.test.ts` fails when a page under `app/` is missing from it or a label and a title differ.
- The names: Today, Curriculum, Review; Practice: Read, Listen, Watch, Speak, Fluency (now Speed, E48); Understand: Words, Grammar, Map; Track: Progress, Milestones, Mistakes, Log. Lesson, Exam, the Tutor chats and Set up are reached from inside other pages and keep their own one-word titles. The Curriculum page's second view is called Mountain; "Your climb to B2" is its subtitle, not its name.
- The Progress page was `/plan`; `/plan` redirects to `/progress`. A subtitle may carry the old, longer name ("When can I…?" under Milestones).
