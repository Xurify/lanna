# Can a model explain a Review miss on another word, from the app's own evidence?

2026-11-11, branch `feat/review-miss-contrast-ai`. The question after [review-miss-explains-from-the-apps-own-data](../decisions/review-miss-explains-from-the-apps-own-data.md): 62.3% of common word pairs that share a meaning get only an example sentence when a learner types one for the other. Can the Cheap slot write a note on what tells them apart without stating a rule from memory, and what does it cost?

## Method

- **Pairs:** 42 from the `npm run miss:coverage` queue and the curated pairs: 4 prepositions, 16 near-synonyms, 8 aspect pairs, 6 derived words, 2 other verbs, and 6 pairs with a curated rule (kam/kde, ísť/chodiť, sem/tu, nikto/niekto, už/ešte, vstávať/vstať) to compare with the hand-written rule.
- **Evidence only:** for each word, its gloss, its part of speech and up to 5 of its shortest verified lexicon sentences that hold only one of the two words (`twinSentences`), with their translations. The prompt (`missNoteBrief`, `src/core/miss-note.ts`) says to use nothing else, to set `"differ": false` rather than guess, to name no grammar category the evidence does not name, to put every Slovak word in asterisks and to cite the sentences it reads.
- **Check in code** (`verifyMissNote`): every Slovak word in the note is in the evidence; no Slovak word outside the asterisks; both words named; no grammar term (case, aspect, perfective, formal…) that the glosses and translations do not use; the citations exist and cover both words; at most 60 words.
- **Judge:** a second Cheap call sees the same evidence and the note. Run 1 asked a strict question (every statement shown, and not a coincidence of the few sentences); run 2 a softer one (every statement shown, the note need not cover every use; reject what the evidence contradicts or does not show, or a contrast that does not separate the words).
- **Model:** the owner's Cheap slot, `claude-sonnet-5-5`, thinking off (the `storyEngine` setting), through `runSubagent`. 105 calls, $0.32 in all.
- **Grading:** every note read against its sentences and standard usage: correct; vague (true, but not the difference, or too thin to help); partly wrong (a statement a learner would take away wrongly). For "no clear difference": correct none (near-synonyms) or missed.

Raw replies, costs and both judges' verdicts: [miss-note-eval/](miss-note-eval/).

## Results

With the final check, the soft judge, and no call when a word has fewer than 2 sentences (ahoj/dobrý deň: dobrý deň has none):

| Outcome | Pairs | Graded |
|---|---|---|
| Note shown | 30 | 27 correct, 2 vague, 1 partly wrong |
| No clear difference | 8 | 4 correct (synonyms), 4 missed |
| Rejected by the judge | 3 | 2 vague, 1 partly wrong |
| Not asked (thin evidence) | 1 | |

Of the 30, 6 are the curated pairs: all 6 notes are correct and agree with the hand-written rule, which still wins on the card. On the 36 pairs with no curated rule, 24 notes are shown and 21 are correct. Of every note shown, 90% are correct, none has an invented form, and one is partly wrong (učiť/naučiť implies only učiť means *teach*).

- **The check in code** rejected 5 of 34 notes in its first version, all wrongly (a 52-word note, the word "habitual", a two-word dictionary form). After the fix it rejects none of the 34 real notes; its tests show it catches an invented form, Slovak outside the asterisks, an unnamed grammar category, a missing word and bad citations. In this run the prompt alone kept every Slovak word inside the evidence.
- **Strict judge (run 1):** rejected 9 of 29, and 4 of those were correct notes (v/na, kto/ktorý, pekný/milý, skoro/čoskoro). **Soft judge (run 2):** rejected 3 of 34, all vague or partly wrong, and no correct note; it let through 2 vague notes and učiť/naučiť.
- **"No clear difference"** is honest for synonyms (len/iba, opäť/zasa, zostať/ostať, spolu/spoločne). It misses register and diminutives (niečo/dačo, trochu/trošku, človek/osoba), which the evidence never names, and once a gloss it did have (žiť/bývať, "to reside").
- **Against the curated rules:** the notes agree and quote the sentences, but the hand-written rules reach further (nikto/niekto: the *ne-* on the verb; už/ešte: with *nie*).

| Pair | Curated | Note | Verdict | Check | Judge v1 | Judge v2 |
|---|---|---|---|---|---|---|
| v/na |  | *na* appears with surfaces and destinations like *stole* (on the table), *stanicu* (to the station) and *pošte* (at the post office). *v* appears with being inside a place or container: *meste*, *taške*, *nemocnici* (in). | **vague**: right core (in vs on), but files *pošte* under surfaces/destinations | kept | no | yes |
| kam/kde | yes | *kam* means "where to" and is used with movement or placement toward a place: *Kam ideš?* "Where are you going?" *kde* means "where" for location: *Kde bývaš?* "Where do you live?" | **correct**: same as the curated rule | kept | yes | yes |
| z/od |  | *od* is used for a person as the source (*od mamy*), for distance from a place (*od centra*), and for a starting time (*od rána*, *od pondelka*). *z* is used for coming out of a place or container (*z domu*, *z vrecka*) and for where someone or something is from (*z Bratislavy*). | **correct**: source person, distance, start time vs out of, origin | kept | not asked | yes |
| pre/za |  | *pre* means "for" a person's benefit (*pre teba*, *pre mamu*). *za* means "for" in thanks or payment (*za pomoc*, *za lístok*), and also "behind" or "in" a time (*za domom*, *za týždeň*). | **correct**: benefit vs thanks/payment, plus behind and in (time) | kept | yes | yes |
| na/ďalej |  | *ďalej* means continuing or what comes next (*Čítaj ďalej*, 'Keep reading'). *na* links to a place or target: going to, being at or on something (*Idem na stanicu*, *Kniha je na stole*). | **correct**: the pair itself is a gloss accident (on); the note is right | kept | yes | yes |
| len/iba |  | (no clear difference) | **correct none**: true synonyms | none |  |  |
| krajina/štát |  | *Krajina* is glossed "country; landscape" and is used with descriptive words like big, old, beautiful, hospitable. *Štát* is glossed "state; country" and appears with political-status words: *ostrovný štát* (island country), *suverénny štát* (sovereign nation). | **vague**: adjective coincidence; misses state as political entity | kept | no | no |
| spolu/spoločne |  | (no clear difference) | **correct none**: near-synonyms | none |  |  |
| človek/osoba |  | (no clear difference) | **missed**: osoba is the more formal or counted person; not in the evidence | none |  |  |
| žiť/bývať |  | (no clear difference) | **missed**: bývať = reside; the gloss says so, the model said none | none |  |  |
| zákon/právo |  | *právo* is used for a right that someone has, as in *Má právo vedieť pravdu*, while *zákon* is used only for the law as a rule, as in *Tom porušuje zákon*. | **correct**: a right vs a statute | kept | yes | yes |
| opäť/zasa |  | (no clear difference) | **correct none**: synonyms | none |  |  |
| trochu/trošku |  | (no clear difference) | **missed**: trošku is the diminutive; the evidence does not say so | none |  |  |
| cesta/spôsob |  | *cesta* is a physical road, path or journey/trip (*Cesta odtiaľ prudko stúpa*), while *spôsob* is a way or method of doing something (*spôsob, ako to urobiť*). | **correct**: road/journey vs method | kept | yes | yes |
| jednoduchý/ľahký |  | In these sentences *jednoduchý* is translated as "simple", while *ľahký* is translated as "easy". The dictionary also lists "light" for *ľahký*, but no sentence shows that meaning. | **vague**: simple vs easy is right but thin; light only mentioned | kept | no | yes |
| tiež/príliš |  | *príliš* means 'too' in the sense of 'excessively', and it comes before an adjective or adverb (*príliš lenivý*, *príliš rýchlo*). *tiež* means 'too' in the sense of 'also' (*Ja tiež*, *Mám tiež psa*). | **correct**: also vs excessively | kept | yes | yes |
| kto/ktorý |  | *Kto* is a stand-alone question word meaning "who" (*Kto je to?*). *Ktorý* goes with a noun, as in "which bus" (*Ktorý autobus ide do centra?*), or links a clause to a person, as in *Muž, ktorý tam stojí*. | **correct**: who vs which + noun / relative | kept | no | yes |
| ahoj/dobrý deň |  | *ahoj* is used both as "hi" and as "bye" (see *Ahoj, maj sa!*), with friendly questions like *Ahoj, ako sa máš?*. *dobrý deň* is glossed "good day; hello" and no sentences show it, so it appears only as a greeting. | **vague**: no sentence for dobrý deň; misses informal vs formal | kept | not asked | yes |
| niečo/dačo |  | (no clear difference) | **missed**: dačo is colloquial; not in the evidence | none |  |  |
| pekný/milý |  | *milý* can describe kind behavior or people (*To je od vás veľmi milé*, *milí* neighbors), while *pekný* in these examples is about looks or beauty (*Si tak pekný!*, *pekný oblek*). Both fit a smile. | **correct**: kind/dear vs good-looking; one filler phrase | kept | no | yes |
| zostať/ostať |  | (no clear difference) | **correct none**: synonyms | none |  |  |
| rozhodnúť/rozhodovať |  | *Rozhodnúť* in these sentences is a single choice or outcome: making the right choice, deciding today, can't decide where. *Rozhodovať* describes ongoing or repeated deciding: parents still deciding for children, deciding together, being the one who decides. | **correct**: single decision vs ongoing deciding | kept | yes | yes |
| nájsť/nachádzať |  | In these examples, *nachádzať* appears as *nachádzať sa* meaning 'to be located', asking or saying where something is. *Nájsť* means to find something, such as a book, time or a job. | **correct**: find vs nachádzať sa = be located; omits that nachádzať also means find | kept | yes | yes |
| zmeniť/meniť |  | In these examples, *meniť* describes something ongoing or happening over time, like *Svet sa mení* or a price that *sa bude meniť*. *zmeniť* describes changing a particular thing, like *Môžem to zmeniť*. | **partly wrong**: 'a particular thing' is not the difference | kept | no | no |
| pozrieť/pozerať |  | *Pozerať* appears in ongoing or habitual watching and looking: *Pozerám film*, *Pozerám filmy takmer denne*. *Pozrieť* appears in single, one-time looks or watches: *Pozriem si ten film večer*, *Pozrieme sa na zmluvu spolu*. | **correct**: one look vs ongoing or habitual watching | kept | not asked | yes |
| platiť/zaplatiť |  | *platiť* also means 'to be valid' or 'to hold true' (*To isté platí aj pre teba*), and its 'pay' sentences describe paying in general or habitually. *zaplatiť* only means 'to pay', in single, specific payments like *Ja zaplatím*. | **correct**: platiť also 'be valid'; single payment vs paying in general | kept | not asked | yes |
| ukázať/ukazovať |  | *ukázať* appears in sentences about showing someone something once, as with a photo or 'I have to show you something'. *ukazovať* appears with things that point or indicate, like a compass or map, and with ongoing showing ('were showing', 'is showing'). | **correct**: once vs pointing/ongoing | kept | yes | yes |
| učiť/naučiť |  | In these sentences *naučiť sa* is about getting a skill or language learned, ending in success (*naučiť sa po anglicky*, 'master English'). *učiť sa* is ongoing studying (*Budem sa učiť*, *Musíš sa viac učiť*), and *učiť* is teaching. | **partly wrong**: implies only učiť means teach; naučiť does too | kept | no | yes |
| priniesť/prinášať |  | *prinášať* is used for things that happen repeatedly or in general, like autumn bringing cooler evenings or the post bringing parcels every day. *priniesť* is used for a single bringing of something to someone, like a glass of water. | **correct**: repeated/general vs single bringing | kept | yes | yes |
| skoro/čoskoro |  | *čoskoro* only means "soon", as in *Čoskoro sa vrátim*. *skoro* mostly means "almost" (*Som si skoro istý*, *Je skoro šesť hodín*) or "early" (*Stále je veľmi skoro*). | **correct**: čoskoro soon; skoro mostly almost or early | kept | no | yes |
| veľa/oveľa |  | *oveľa* intensifies comparisons, as in *oveľa lepšie* (much better) and *oveľa dlhšie* (much longer). *veľa* means a lot or many of something, as in *veľa pršalo*, *veľa ľudí* and *veľa práce*. | **correct**: oveľa with comparatives | kept | yes | yes |
| ďalej/naďalej |  | *ďalej* appears with action verbs to mean going on or what to do next (*Čítaj ďalej*, *Čo mám ďalej robiť?*). *naďalej* means a situation continues as before: still open, still in touch, still running. | **vague**: 'with action verbs' is coincidence | kept | no | no |
| stále/neustále |  | *neustále* means 'constantly' or 'all the time', as in 'She lied all the time'. *stále* is shown mostly as 'still', as in 'It is still raining outside', though its gloss also lists 'constantly'. | **correct**: still vs constantly | kept | yes | yes |
| hneď/ihneď |  | Both *hneď* and *ihneď* mean 'immediately' in time. Only *hneď* also means 'right' in the sense of position, as in *hneď za tebou* ('right behind you'). *ihneď* appears only for time. | **correct**: only hneď also means right (next to) | kept | yes | yes |
| dopredu/vopred |  | *dopredu* can mean physical direction, forward or at the front, as well as in advance. *vopred* is only shown meaning in advance or beforehand, never direction. | **correct**: direction vs in advance | kept | yes | yes |
| povedať/rozprávať |  | *povedať* is used for saying or telling something specific, such as *to po slovensky* or *niečo*. *rozprávať* (*sa*) is used for talking or conversing with someone, as in *s tebou* or *so zvieratami*. | **correct**: say something vs talk with someone | kept | yes | yes |
| žiadať/pýtať |  | *pýtať* (as *pýtať sa*) is used for asking a question or asking about something, as in *Prečo sa ma pýtaš na Toma?*. *žiadať* is for asking for or demanding something, like silence or a refund, as in *Žiadame ticho počas skúšky*. | **correct**: ask for/demand vs ask a question | kept | yes | yes |
| ísť/chodiť | yes | *chodiť* is for habitual or repeated going, like *Chodím do školy* and *Často chodím*, and it also means 'to walk'. *ísť* is for going on a particular occasion, like *Idem do školy* ('I'm going to school'). | **correct**: same as the curated rule, plus 'to walk' | kept | not asked | yes |
| sem/tu | yes | *sem* is used with movement toward the speaker, as in 'come here'; *tu* says where something or someone is, as in 'I am here' or 'wait here'. | **correct**: to here vs at here | kept | yes | yes |
| nikto/niekto | yes | *niekto* means "someone" or "anyone" and refers to a person who exists or might exist, as in *Niekto volá*. *nikto* means "nobody" or "no one", as in *Nikto neprišiel*. | **correct**: nobody vs somebody; the curated rule adds the ne- on the verb | kept | yes | yes |
| už/ešte | yes | *Ešte* means "still" or "not yet" (*Otec je ešte v posteli*, *Ešte nie som unavený*), a situation that continues. *Už* means "already" or "anymore" (*Už som ich otestoval*, *Už to viac nerobím*). | **correct**: already/anymore vs still/not yet | kept | yes | yes |
| vstávať/vstať | yes | *Vstať* appears in sentences about one completed getting up, like *Vstal som o siedmej* (I got up at seven). *Vstávať* appears for habits, wishes and general statements, like *Vstávam o šiestej* (I get up at six) and *Je čas vstávať*. | **correct**: same as the curated rule | kept | yes | yes |

"Check" is the final check run on the reply as it came; ahoj/dobrý deň would now not be asked at all.

## Cost and time

| Step | Cost | Time |
|---|---|---|
| Write, a note | $0.0030 | 2.6 s |
| Write, "no clear difference" | $0.0019 | 1.0 s |
| Judge (soft) | $0.0039 | 2.7 s |
| One pair, all in | about $0.006 | about 5 s |

The judge costs more than the note although it writes a few words; the cache-write share of each call was not broken out, so this is not explained yet.

- The 296 uncovered common pairs: about $1.80, once.
- All 4,773 uncovered pairs: about $28, once.
- Only pairs a learner misses: the owner's record holds 7 mixed-up pairs after 8 days, and a note is asked only for a pair that shares a meaning and has no rule, so under one a day: about $2 a year.

## What follows

A note per pair, written once on the first real miss and cached (E1), kept only after the check and the soft judge, and labeled on the card as an AI note from the dictionary's sentences. Never a call per miss: the card does not wait for it, and a pair never costs twice. Writing the 296 common pairs in one batch costs under $2 and would let the owner read them before a learner does.
