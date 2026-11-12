# Your own reading: articles and newsletters, retold at the learner's level

*LangHarness, 2026-11-11. Thread "Read opens the library; import articles, links and emails". Code: `src/core/reading.ts`, `src/server/reading.ts`, `src/server/read-import.ts`, `src/store/reading-sources.ts`, `components/reading/`.*

## The question

The owner has newsletters and articles they mean to read and do not. Can the Read task take that text, so the same minutes count for the reading and for the language? The learner is at A1 to A2; most of the texts are not in the language being learned.

## Evidence

- **Coverage is a slope, not a gate.** Comprehension rose steadily with the share of words known and showed no threshold in Schmitt, Jiang & Grabe (2011). The 95% and 98% figures (Laufer & Ravenhorst-Kalovski 2010; Hu & Nation 2000, all in [reading.md](reading.md)) are where readers passed a comprehension test with no help, in English. They say how easy a text must be to read it fluently and alone. They do not say a harder text teaches nothing: with a gloss on every word, a translation, audio, a topic the reader knows and words shared with a language they already have, a reader gets through much less, more slowly, and that is study of the language (P2's third strand), not input at speed. The app's count of known words is also an estimate, and it can run under what a learner recognizes ([../learner.md](../learner.md): reading ahead of production is normal).
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
| Not simplified, every word tappable | The text in the language as written (or translated in full when it is in another language), glossed by the lexicon, with the share of known words shown | **Built, as the learner's choice.** The owner does not accept that a text under 95% is not worth reading, and the evidence above does not say it is |
| Retold at the learner's level, or one level up | The Cheap slot rewrites each section in the language with the learner's known words, the same rules as an episode | **Built, the default.** The easy end of the choice: fluent reading on a text the learner picked |
| Weave (words of the language inside the original text) | The text stays in its own language and more and more words are swapped | Not built. The learner reads the other language's sentences, so it is not input in the language, and P2 keeps input at the word level |
| Pull emails from the mailbox | Gmail or IMAP access, a label to read from | Not built. It needs mail credentials held by the app and a security review of its own; paste and links cover the first use, and show whether the habit holds |

## Design

- **Read opens the library.** With the learner's own texts beside the app's stories there is a choice to make, so the page starts on it. The day's pick is the first card.
- **Add a link or paste the text.** A link is fetched through the same guard as every other URL the app fetches for someone (`safeFetch`, [web-security-review.md](web-security-review.md)) and reduced to its article text; a page that cannot be read says so and asks for the text. Nothing is sent to a third-party reader service. The text as received is kept on disk before any model call.
- **The learner chooses how hard.** Three settings per text: at my level (the default), a step up (written for the next CEFR level), and not simplified (the section kept as written when it is already in the language, else translated in full; no coverage redraft, and only the words the learner taps go to Review). The share of words the app counts as known is shown either way.
- **Natural language before closeness to the original.** The owner, 2026-11-12: "It doesn't have to be 1 to 1 or anything, as long as I am learning the natural language." The retelling's first rule is natural phrasing, never word for word; its second is the section's main points with nothing invented. In Slovak, every written text (a part or an episode) is run through the rules a program can decide (`src/core/slovak-check.ts`: so/zo/ku/vo, nie je, Czech letters, budem with a perfective verb, dva/dve), and a draft that breaks one is written again once with the mistakes named. What is still broken after that is counted on the record (`ruleIssues`).
- **Parts, not one summary.** The text is cut at paragraph ends into sections (about 250 source words a part at A1 up to 550 at C1, at most 8 parts), and each part is one Read story: the same length, known-word brief, coverage floor with one redraft, new words used three times, questions by level, and review queue as an episode. Earlier parts' recaps go into the next part's brief. Over 8 parts the sections grow instead, and the library says the version is shorter.
- **Written as it is read.** Adding a text writes part 1. Finishing a part writes the one after the next in the background, so the next part is ready and at most two unread parts exist per text. The spend follows the reading.
- **Several links at once, in the background.** Up to 20 links, one on each line, are read three at a time and each becomes a book at once; the links that could not be read stay in the field with the reason. Their first parts are then written one after another in the background (one model call a link, no more), the shelf shows which are being written, and a first part the model failed on is not tried again until the learner opens the book.
- **The original after the effort.** The part's own section of the original shows on the end screen, beside the score, with the link. Reading it after the questions is the check on what was understood, and it is how the whole text gets read.
- **The library is a shelf.** Every story and every text of the learner's is a book: taller for a harder level, thicker for a longer text, grey once read. The next one to read is the teal one and stands open, with its Read button on the cover; tapping another spine turns that book to its cover. A book's size carries data, so the shelf is not decoration.
- **The learner's texts come first in the pick.** A text in progress, then the oldest one added, before the chapter's episode. The learner chose it; that is the interest the studies above measured.
- **Remove hides, never deletes.** A removed text leaves the library and the pick; its parts and their cost stay on disk and in Spending. Adding the same text again brings it back with no model call.

## Known gaps

- No measure of how faithful a retelling is to its section, and none is planned: the owner ranks natural language above closeness, and the original shows beside the score.
- The rule check covers five rules and Slovak only. It says nothing about word choice, case endings in general or how natural a sentence sounds; those rest on the model.
- Several links can be added at once (up to 20, one on each line); pasted text is still one text per add. No share target from the phone, no mailbox.
- Sponsor blocks and a newsletter's own promotion are left to the model to skip; nothing in code removes them, so a last part can hold little but those.
- A link to a site's home page is read as if it were an article.
- Under "not simplified", a text already in the language is kept as written, so a poor machine translation is shown as it is. The retold settings rewrite it, but they start from the same poor text; the original-language link is the better source.
- A page behind a bot check (HTTP 403 with a challenge page) cannot be read; the learner is asked to paste the text.
- Real generation on the PC with a live model has not been verified by the owner.

## Tried on the owner's links

Ten links from the owner's newsletters, 2026-11-11, through `addSource` with no model call: all ten were fetched and reduced to text (482 to 5,971 words, 2 to 7 parts). One was a podcast transcript over the word limit and was cut at 6,000 words. One was a site's home page, which came back as 442 words of marketing copy. Seven carried a sponsor block or a subscribe footer inside the extracted text. Mailchimp's archive link opened without the reader's id (`e`), which the import now drops along with `utm_*` and click ids.

A second batch of nine links, 2026-11-12: eight were read (109 to 5,990 words, 1 to 8 parts) and one, on blog.x.com, answered with a bot check and was refused with the "paste its text" message. A public LinkedIn post came back as one 471-word paragraph, which the section cutter splits at sentence ends. A gated report's landing page came back as its 109 words of blurb. A site's own Slovak version of an English article was a condensed machine translation with wrong forms (487 words against 1,215).

## Sources

- Day, R. & Bamford, J. (2002). Top ten principles for teaching extensive reading. *Reading in a Foreign Language* 14(2), 136–141. doi:10.64152/10125/66761
- Krashen, S. (2004). The case for narrow reading. *Language Magazine* 3(5), 17–19.
- Lee, S. & Pulido, D. (2017). The impact of topic interest, L2 proficiency, and gender on EFL incidental vocabulary acquisition through reading. *Language Teaching Research* 21(1), 118–135. doi:10.1177/1362168816637381
- Pulido, D. (2004). The relationship between text comprehension and second language incidental vocabulary acquisition: a matter of topic familiarity? *Language Learning* 54(3), 469–523. doi:10.1111/j.0023-8333.2004.00263.x
- Pulido, D. (2007). The effects of topic familiarity and passage sight vocabulary on L2 lexical inferencing and retention through reading. *Applied Linguistics* 28(1), 66–86. doi:10.1093/applin/aml049
- Yano, Y., Long, M. H. & Ross, S. (1994). The effects of simplified and elaborated texts on foreign language reading comprehension. *Language Learning* 44(2), 189–219. doi:10.1111/j.1467-1770.1994.tb01100.x
