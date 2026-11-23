# Should some of the app's own text be in the language being learned?

Date: 2026-11-08. Branch `fix/lesson-end-layout`. Rule: E78.

## The question

The owner, on the lesson end screen: "Also should some of the text be in Slovak?" The app explains in English. A few Slovak exclamations were already hardcoded ("Výborne!", "Presne tak!" after a right answer). Because they were hardcoded, an Estonian lesson also praised in Slovak.

## What the research says

- **Repeated meetings build word knowledge.** Webb (2007) had learners meet new words 1, 3, 7 or 10 times in sentences. More meetings gave more knowledge of the word's form, meaning and use, and 10 meetings still did not give full knowledge. A phrase the learner sees after every lesson gets that many meetings within days.
- **Fixed phrases are worth learning as wholes.** Boers et al. (2006) taught one group to notice formulaic sequences. That group used more of them in an oral interview and was judged more proficient by raters who did not know which group a student was in. "Bez chyby!" and "Je to hotové!" are such phrases.
- **A gloss keeps a new phrase comprehensible.** Yoshii (2006) found that glosses beside a text helped learners pick up words while reading, whether the gloss was in their first language or the new one. Input is useful when nearly all of it is understood (the 95 to 98 percent rule in [comprehensible-input.md](comprehensible-input.md)).

## What it did not show

No study we found tested the interface language of a learning app. The findings above are about words met in reading and speech, not about the labels of an app. Moving instructions, numbers or buttons into the language being learned would make them slower to read, and none of these studies supports that.

## The app's own choices

- Only fixed, frequent exclamations are in the language being learned: the praise after a right answer (lesson, Listen, Speak) and the heading of the lesson end screen. Labels, numbers, instructions and buttons stay in English.
- The heading carries a small English gloss beside it ("Je to hotové! it's done"). The praise has none, because the verdict around it (green, a tick) already says what it means.
- The phrases come from the active language (`src/core/cheers.ts`), never from a model. A language without a checked set gets English, never another language's phrases.
- The sets are Slovak, Estonian and Russian, the learner's three languages. The forms are backed by these sources:

| Language | Phrase | Source |
| --- | --- | --- |
| Slovak | Je to hotové! (it's done) | Lexicon: hotový with verified forms (hotové); curated example "Mýliš sa, ak sa nazdávaš, že to je hotové." |
| Slovak | Bez chyby! (no mistakes) | Lexicon: chyba with verified forms (genitive chyby); curated example "Do formulára zadajte každý údaj bez chyby."; sk.wiktionary.org/wiki/chyba (genitive singular chyby) |
| Slovak | Koniec! (the end) | Lexicon: koniec; Tatoeba "Koniec hry." |
| Slovak | Nový rekord! (new record) | Lexicon: rekord, nový (verified forms); Tatoeba "Urobila nový svetový rekord." |
| Slovak | Výborne! Super! Presne tak! Skvelé! | Lexicon: výborne ("Mám sa výborne!"), super, presne, skvelý (verified form skvelé). Already in the app before this change. |
| Slovak | Bravo! Paráda! | Already in the app before this change. Not in the lexicon. No Slovak dictionary page could be read for them: the Slovak Academy portal answers automated reads with a browser check, and sk.wiktionary has no page. |
| Estonian | Valmis! Vigadeta! Aeg on läbi! Uus rekord! | en.wiktionary.org: valmis ("completed, ready"), viga (abessive plural vigadeta), aeg ("time") and läbi ("finished, ended"), rekord |
| Estonian | Tubli! Väga hea! Täpselt! Suurepärane! Õige! | en.wiktionary.org: tubli (interjection "Good for you!"), väga + hea, täpselt, suurepärane, õige ("right, correct") |
| Russian | Готово! Без ошибок! Время вышло! Новый рекорд! | en.wiktionary.org: готовый (short neuter готово), ошибка (genitive plural ошибок), выйти (past neuter вышло, "to be used up") with время (neuter), рекорд |
| Russian | Отлично! Молодец! Верно! Точно! Здорово! | en.wiktionary.org: отлично, молодец (interjection "well done!"), верно, точно, здо́рово (praise; здоро́во is the greeting) |

The Slovak "Hotovo!" and "Čas vypršal!" were the first choice and were dropped: neither is in the lexicon, and no Slovak source could be read to back them.

## Sources

- Boers, F., Eyckmans, J., Kappel, J., Stengers, H. & Demecheleer, M. (2006). Formulaic sequences and perceived oral proficiency: putting a Lexical Approach to the test. _Language Teaching Research_ 10(3), 245–261. doi:10.1191/1362168806lr195oa
- Webb, S. (2007). The effects of repetition on vocabulary knowledge. _Applied Linguistics_ 28(1), 46–65. doi:10.1093/applin/aml048
- Yoshii, M. (2006). L1 and L2 glosses: their effects on incidental vocabulary learning. _Language Learning & Technology_ 10(3), 85–101.

The bibliographic records were checked on Crossref on 2026-11-08. The summaries above were not re-checked against the full papers for this note. The Wiktionary pages were read on 2026-11-08.
