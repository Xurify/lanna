# Practice for one situation: a game played in Russian only

2026-11-09. Decision: [E86](../DECISIONS.md).

## The question

The owner is at A1 in Russian and wants to play the Roblox co-op game "Animal Hospital (Anomaly)" with a friend, speaking only Russian. In their words: "I need to be able to understand and say whatever comes up." They brought two PDFs and three links, and asked:

1. Could Spline (3D), Spline Hana (2D) or Omma help build "an environment to learn Russian phrases and feel comfortable using them and understanding the things people say to me"?
2. Should the PDFs go into the app, with a feature that works beyond this one game?

## What the owner already has

- **A phrase guide** (8 pages): seven sections of phrase, pronunciation, English and note, then numbers, places, body parts, animals, three patterns and two tips. It is the text of the cheatsheet the app ships, `curriculum/russian/cheatsheets/animal-hospital.txt` (E50). The first two sections were compared line by line and match; the rest was not compared.
- **A workbook** (4 pages): four A/B dialogues (at the desk, jobs and rooms, fire and danger, coffee and after the shift), each with ten words, six phrases, a tip and four comprehension questions. The dialogues are built from the guide's phrases. They are not in the app.

## The three tools

Each product page was read once on 2026-11-09. What follows is only what the page states.

| Tool | What it is | Output | Stated | Not stated |
|---|---|---|---|---|
| [Spline, 3D design](https://spline.design/3d-design) | A web-based 3D design tool | A published link, an embedded viewer, or exported code ("Drop your design into your React projects"); also images, video, GLTF and USDZ | States and events, variables, conditional actions, game controls, physics, webhooks and API requests, custom code, WebGPU with a WebGL fallback | Audio or speech, the size of its runtime, pricing |
| [Spline Hana](https://spline.design/hana) | A 2D design canvas | A `<hana-viewer>` web component loaded from a CDN script; exports for site builders and HTML/JS | States and events, transitions | Audio or speech, variables, pricing, runtime size |
| [Omma](https://omma.build/) | An AI builder for "3D scenes, websites, games, and apps using natural language" | The page does not say | Takes CSV, JSON, images, video and 3D files as input; runs parallel agents | What it outputs, how it is embedded, pricing |

## Why none of them is the answer

- **The scene exists already.** The game is the 3D place. What the owner lacks is not a picture of the clinic but the ear and the mouth for what is said in it.
- **A clickable scene is recognition.** Clicking a dog to see «собака» shows the answer before any attempt. Every rep in this app is retrieval first (P3).
- **None of the pages mentions sound.** Playing a phrase, recording one and scoring it would be the app's own code in any case, and the app has all three (the audio library, speech to text, pronunciation scoring for `ru-RU`).
- **Cost.** A 3D runtime in the shell is the kind of dependency E36 warns about, and the app has no canvas or WebGL today. An embedded third-party viewer would also have to pass E4 (no layout shift, both themes, phone widths).
- **One use that would be real:** a map of the clinic for the direction phrases («Иди в комнату номер пять»). The app draws such pictures itself in ink (the `ink-drawing` skill), so it needs no tool. Not built.

## What the app had, and the gap

Cheatsheets (E50) were built for this case. A sheet could be read, played phrase by phrase, covered ("Say it, then show"), and its dictionary words sent to Review on the dictionary's own sentences. Nothing practiced the sheet's own lines, so nothing trained hearing "Камера не работает!" at speed, which is what a teammate will say.

The learner's stated gap is the one learner.md names: "I get a lot of words, but I can't put them together into meaning fast enough."

## What the research in the registry supports

- Listeners often know the words and still cannot parse them at speed (Goh 2000).
- Hearing a passage a second time helped listeners more than being taught its words first (Chang & Read 2006).

Neither tested dictation of a learner's own phrase list, and a phrase coming back in a later session is not the study's second hearing in one sitting. The session size and the order of phrases are the app's own choices.

## What was built

Listen on a sheet (E86): ten of the sheet's phrases, heard before they are seen and typed as heard; missed phrases come back first; a count of phrases caught by ear on the sheet. It is kept out of XP, Review, the listening speed, the listening trends and the Russian study (E82), because the lines are the learner's own and unchecked.

## Open

- **Saying the phrases** (cue in English, say the Russian, scored) and **a role-play of the shift** with the tutor as the teammate, held to the sheet's phrases. Both are spoken output in Russian, which the listening-first study drops from day 15 (E82). They wait for 2026-12-20, or for the owner to say that game practice is outside the study.
- **The four dialogues.** A sheet has no place for a dialogue with questions. Read's "dialogue" genre is model-written; a learner-supplied one would be new.
- **PDF import.** A sheet is one line per phrase, and the chat's `pdf` job already reads a PDF, so the short path is "read this PDF and give me the lines". No upload was added (the app has no document upload by an earlier decision).
- **"Write me a cheatsheet for…"** inside the app (E50, still open).

## Sources

- Goh, C. (2000). A cognitive perspective on language learners' listening comprehension problems. *System* 28(1). In the registry as `goh2000`.
- Chang, A. C.-S. & Read, J. (2006). The effects of listening support on the listening performance of EFL learners. *TESOL Quarterly* 40(2). In the registry as `chang2006`.
- Product pages, read 2026-11-09: https://spline.design/3d-design, https://spline.design/hana, https://omma.build/
