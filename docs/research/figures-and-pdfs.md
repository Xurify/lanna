# Precise figures and Read PDFs: worth keeping?

**Question:** the tutor had two optional tools in Settings → AI models → Tools. Precise figures (`visual`) sent a brief to a background agent that drew one SVG. Read PDFs (`pdf`) sent a learner's PDF to a background reader that answered with page citations. Does either help a language learner, and what would make it worth the cost?

**Date:** 2026-11-15

## What was checked

- **A live test of each tool, on scratch data.** Precise figures was asked for a chart of the Slovak short and long vowels. It drew a table in which every "length" bar had the same width, so the one point of the picture, that a long vowel is held longer, was not shown. Read PDFs was given a two-page handout by its file path. Its page citations were right, but it called one rule and a table "three locative rules".
- **An independent review** of both tools against the product principles (P1 to P9) and the research notes, by a separate agent that was given the code and not this note's conclusion. It recommended removing Precise figures and keeping Read PDFs with fixes.
- **The research notes.** None tests a figure tool or a PDF reader. The nearest findings are about pictures in general: Herron, Hanley and Cole (1995) found that pictures added to a description before a video helped comprehension ([pre-listening.md](pre-listening.md)), and Lin et al. (2019) found that still side-view drawings of the mouth helped learners produce a new pair of sounds (listed on the Sources page). Both support pictures that show something words cannot. Neither says the picture must come from a separate background agent.

## What was concluded

**Precise figures: removed.**

- The chat already draws. Since E76 the tutor asks for an ink drawing with `draw`, made while the learner reads, in the app's own look ([riddled-chat.md](riddled-chat.md)). That covers the uses the teacher prompt named for `visual` (a vowel chart, a mouth diagram, a case overview).
- `visual` was built for math: its instructions talk about coordinates, vectors and function plots, and its agent never saw the lesson. The live test shows the cost: a picture that looked right and taught nothing.
- It was slow and paid twice. The figure arrived as a later message, and every figure ran a loop on the vision model, against P7.
- Figures already in old chats still render. A figure job left over from before the removal ends with a note instead of a model call.

**Read PDFs: kept, and changed so that it pays off.**

- Learners bring their own material: a textbook page, a teacher's handout, a phrase sheet ([situation-practice.md](situation-practice.md)). Answering from it with page numbers is evidence the learner can check (P5, P8).
- **A short PDF is read at once.** `read` returns the text of a PDF of up to ten pages, marked by page, when every page has real text. The tutor answers in the same turn. A long or scanned PDF still goes to the background reader, which can search and read pages by eye. Before this, `read` returned a PDF's raw bytes as text.
- **Language material, not math papers.** The reader copies forms exactly as printed, with their diacritics and page, keeps the document's own structure instead of counting rules it does not name, says what the document leaves out, and returns practice lines.
- **Practice, not a summary.** The document's example sentences are where the learner meets the forms (P4). The tutor then asks for a form with a word the document does not use, so the learner applies the rule instead of copying a line (P3). In two runs after the change, the tutor flagged the prepositions the handout lists without an example and asked for _pri okne_ and _na ulici_.
- **A PDF button in Ask.** The learner picks a file. It is kept under the profile's `sources/` folder and shown as a chip in the draft and in the message. The earlier rule of no document upload ([situation-practice.md](situation-practice.md)) is reversed. A typed file path is not something most learners will do, so without an upload the tool was out of reach.
- The Read PDFs switch now applies in the chat and in practice, not only in lessons.

## Not shown

- No learner has used either version over time. Whether answers from a learner's own handout lead to better retention than the app's own lessons is not measured.
- The tutor's replies vary by run. In one of four runs it still described the table with a count it does not use ("three endings" for four rows).
- Scanned PDFs were not tried in the app. The routing to the background reader is covered by a test with a page that has no text.

## Sources

- Herron, C., Hanley, J. E. B., & Cole, S. P. (1995). A comparison study of two advance organizers for introducing beginning foreign language students to video. _The Modern Language Journal_, 79(3), 387–395.
- Lin et al. (2019). The effects of phonetic training and visual feedback on novel contrast production. _Proceedings of the 19th International Congress of Phonetic Sciences_.
