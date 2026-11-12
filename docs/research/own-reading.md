# Your own reading: articles and newsletters, retold at the learner's level

*LangHarness, 2026-11-11. Thread "Read opens the library; import articles, links and emails". Code: `src/core/reading.ts`, `src/server/read-import.ts`, `src/store/reading-sources.ts`, `components/reading/`.*

## The question

The owner has newsletters and articles they mean to read and do not. Can the Read task take that text, so the same minutes count for the reading and for the language? The learner is at A1 to A2; most of the texts are not in the language being learned.

## Evidence

- **Coverage decides whether a text is input.** Reading needs about 95% known running words with help and 98% without (Hu & Nation 2000; Laufer & Ravenhorst-Kalovski 2010; Schmitt, Jiang & Grabe 2011, all in [reading.md](reading.md)). A real article in the language sits far under that for an A1 to A2 learner, so showing it as written with a dictionary tap is decoding, not reading.
- **Readers choose, and the text is easy.** Two of Day & Bamford's ten principles for extensive reading (2002): learners choose what they want to read, and the material is well within their competence. The Read shelf met the second and not the first: the app chose every topic.
- **Interest helps words stick.** In Lee & Pulido (2017), 135 Korean learners of English gained more new words from the passage on the topic that interested them more, at both higher and lower proficiency, and the difference was still there four weeks later.
- **A known topic helps a reader work out new words.** Pulido (2004, 2007): readers inferred and kept more words when the topic was familiar, and how much it helped depended on how many of the passage's words they already knew. Krashen (2004) argues the same for reading many texts on one subject or by one author ("narrow reading"): the vocabulary and the context repeat.
- **A rewritten text is understood better than the original.** Yano, Long & Ross (1994), 483 Japanese college students, 13 passages: the simplified version was understood best, and an elaborated version (repetition and paraphrase added, sentences left long) about as well.

## What none of this shows

- Every study is of English as a foreign language, with texts a teacher or researcher rewrote. None tested a model's rewrite, and none tested a text rewritten from another language.
- A model can drop a point or change a fact when it retells. Nothing here measures how often. That is why each part keeps the section it was written from, shown after the questions, and the link when there is one.
- A retelling at A1 in 20 to 25 short sentences cannot carry everything a 400-word section says. It is a shorter version, and the screen says so.
- Abstracts were read for Lee & Pulido (2017) and Yano, Long & Ross (1994). Pulido (2004, 2007), Day & Bamford (2002) and Krashen (2004) are cited from their titles, reference lists and summaries by others; the DOIs resolve, except Krashen (2004), which is a magazine article with none.

## Options considered

| Option | What it is | Verdict |
|---|---|---|
| As written, every word tappable | The article in the language, glossed by the lexicon, no model call | Right once the app counts about 92% of its words as known. Not built: no text the owner has reaches that today |
| Retold at the learner's level | The Cheap slot rewrites each section in the language with the learner's known words, the same rules as an episode | **Built.** Keeps coverage in the 95 to 98% band on a text the learner picked |
| Weave (words of the language inside the original text) | The text stays in its own language and more and more words are swapped | Not built. The learner reads the other language's sentences, so it is not input in the language, and P2 keeps input at the word level |
| Pull emails from the mailbox | Gmail or IMAP access, a label to read from | Not built. It needs mail credentials held by the app and a security review of its own; paste and links cover the first use, and show whether the habit holds |

## Design

- **Read opens the library.** With the learner's own texts beside the app's stories there is a choice to make, so the page starts on it. The day's pick is the first card.
- **Add a link or paste the text.** A link is fetched through the same guard as every other URL the app fetches for someone (`safeFetch`, [web-security-review.md](web-security-review.md)) and reduced to its article text; a page that cannot be read says so and asks for the text. Nothing is sent to a third-party reader service. The text as received is kept on disk before any model call.
- **Parts, not one summary.** The text is cut at paragraph ends into sections (about 250 source words a part at A1 up to 550 at C1, at most 8 parts), and each part is one Read story: the same length, known-word brief, coverage floor with one redraft, new words used three times, questions by level, and review queue as an episode. Earlier parts' recaps go into the next part's brief. Over 8 parts the sections grow instead, and the library says the version is shorter.
- **Written as it is read.** Adding a text writes part 1. Finishing a part writes the one after the next in the background, so the next part is ready and at most two unread parts exist per text. The spend follows the reading.
- **The original after the effort.** The part's own section of the original shows on the end screen behind one button, with the link. Reading it after the questions is the check on what was understood, and it is how the whole text gets read.
- **The learner's texts come first in the pick.** A text in progress, then the oldest one added, before the chapter's episode. The learner chose it; that is the interest the studies above measured.
- **Remove hides, never deletes.** A removed text leaves the library and the pick; its parts and their cost stay on disk and in Spending. Adding the same text again brings it back with no model call.

## Known gaps

- No measure yet of how faithful a retelling is to its section.
- One text per add; no reading list of several links, no share target from the phone, no mailbox.
- A text already in the language is still retold, even for a learner who could read it as written.
- Real generation on the PC with a live model has not been verified by the owner.

## Sources

- Day, R. & Bamford, J. (2002). Top ten principles for teaching extensive reading. *Reading in a Foreign Language* 14(2), 136–141. doi:10.64152/10125/66761
- Krashen, S. (2004). The case for narrow reading. *Language Magazine* 3(5), 17–19.
- Lee, S. & Pulido, D. (2017). The impact of topic interest, L2 proficiency, and gender on EFL incidental vocabulary acquisition through reading. *Language Teaching Research* 21(1), 118–135. doi:10.1177/1362168816637381
- Pulido, D. (2004). The relationship between text comprehension and second language incidental vocabulary acquisition: a matter of topic familiarity? *Language Learning* 54(3), 469–523. doi:10.1111/j.0023-8333.2004.00263.x
- Pulido, D. (2007). The effects of topic familiarity and passage sight vocabulary on L2 lexical inferencing and retention through reading. *Applied Linguistics* 28(1), 66–86. doi:10.1093/applin/aml049
- Yano, Y., Long, M. H. & Ross, S. (1994). The effects of simplified and elaborated texts on foreign language reading comprehension. *Language Learning* 44(2), 189–219. doi:10.1111/j.1467-1770.1994.tb01100.x
