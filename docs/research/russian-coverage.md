# Russian A1 to B2: what the course must cover, and what the current draft gets wrong

Date: 2026-11-08. Question: what must a Russian course for an English-speaking adult cover from A1 to B2 so that nothing is missing, and how far is the app's drafted Russian content from that? The learner knows Slovak (about B1) and Estonian (A2); their Russian is A1; the goal is to understand speech and talk with friends and family.

## Short answer

- The official Russian levels (ТРКИ) put far more grammar into A1 than the draft does. A1 (элементарный уровень) already has all six cases in their basic meanings, both aspects, the past and the future, the imperative, motion verbs with по- and при-, short adjectives (рад, занят, должен, болен) and который in a limited way [S2]. The draft spreads this over A1 to B1.
- The draft has 14 grammar units. It never teaches the present tense for он, мы, вы, они; noun gender; adjective agreement; possessives; personal pronouns in cases; у меня есть; numbers as words; time and dates; the genitive plural; the plurals of the prepositional, dative and genitive; reflexive verbs; comparatives; the conditional; который.
- Four chapter taglines promise grammar that no unit teaches (adjective gender, the genitive plural, the conditional, comparatives). Three more rest on tutor sessions alone, so nothing is measured (aspect and motion verbs, participles, verbal adverbs).
- Several one-line rules are incomplete in ways that break the chapter they serve. The accusative rule leaves out animate masculine nouns, but the chapter it serves, "People You Love", is about people (люблю́ бра́та). The past-tense rule ties the endings to "he/she/it/they" instead of to the gender of the subject. The imperative rule gives no way to choose between -и and -ь.
- The tutor doctrine writes stress with Latin á and ó (U+00E1, U+00F3) inside Cyrillic words. The correct mark is the combining acute U+0301 after the vowel. It also never asks the tutor to write ё, which the 2006 spelling rules require in all texts for learners of Russian [S7].
- world.json: the places are real. Two details are wrong: there is no train to Innopolis (it is reached by bus or car), and no МФЦ office on Кремлёвская улица was found. A train "to Sviyazhsk" stops at a station 8.5 km from the island.

## Conventions in this file

- Levels follow the ТРКИ scale as set by the 2014 order [S1]: элементарный = A1, базовый = A2, первый (ТРКИ-1) = B1, второй (ТРКИ-2) = B2.
- Stress is marked with the combining acute (U+0301) on the taught form and in examples taken from Wiktionary. One-syllable words and ё are not marked.
- `[S2]` and similar tags point to the Sources table. "(ГОС A1)" after an example means the sentence is quoted from that standard.
- "EN" is the typical mistake of an English speaker; "SK" is where Slovak misleads.
- **not verified** means no fetched source confirmed the point.

## 1. Sources

| Tag | Source | URL | What was taken |
|---|---|---|---|
| S1 | Приказ Минобрнауки России от 01.04.2014 № 255 «Об утверждении уровней владения русским языком как иностранным языком и требований к ним» | https://legalacts.ru/doc/prikaz-minobrnauki-rossii-ot-01042014-n-255/ | The official levels and their CEFR labels; skills per level; vocabulary sizes (780, 1300, 2300, 10 000 with 6000 active). |
| S2 | Государственный образовательный стандарт по русскому языку как иностранному. Элементарный уровень. Общее владение (Златоуст, 2001) | https://www.unibg.it/sites/default/files/a1_standart1.pdf | A1 intents, situations, themes, listening and speaking parameters, the full grammar list (cases and their meanings, verb classes, pronouns, syntax). |
| S3 | Государственный образовательный стандарт … Базовый уровень (Златоуст, 2001) | https://www.unibg.it/sites/default/files/a2_standart_0.pdf | A2 intents, situations (incl. telephone), ten themes, grammar (comparatives, если, ли, motion verbs with в-, вы-, у-, по-, при-, лететь, нести, везти), 1300 words. |
| S4 | Государственный образовательный стандарт … Второй уровень (Златоуст) | https://www.unibg.it/sites/default/files/b2_standart.pdf | B2 intents, three circles of themes, formal writing (заявление, объяснительная записка, доверенность), all intonation constructions, case meanings beyond B1, participles, verbal adverbs, если бы, concessive clauses, 10 000 units. |
| S5 | НИУ ВШЭ, программа «Русский язык как иностранный», первый сертификационный уровень (ТРКИ-1), 2018 | https://preparatory.hse.ru/data/2019/05/14/1504183084/%D0%9F%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%B0%20%D0%BA%D1%83%D1%80%D1%81%D0%B0%206%20%D0%BC%D0%B5%D1%81%D1%8F%D1%86%D0%BE%D0%B2.pdf | The B1 grammar topics, built on the B1 state standard: all four participles, short passive participles, verbal adverbs, prefixed motion verbs, comparison, conditional and concessive clauses, -ся in passive constructions. The B1 standard itself was not found online (**not verified** directly). |
| S6 | Андрюшина Н. П. и др. Лексический минимум по русскому языку как иностранному. Второй сертификационный уровень (5-е изд., 2015), preface | https://www.plus.ac.at/wp-content/uploads/2021/06/Leksicheskii_minimum_po_russkomu_iazyku_kak_inostrannomu_2_uroven.pdf | The graded series of lexical minimums: 780 (A1), about 1300 (A2), 2300 (B1), "a little over 5000" (B2). |
| S7 | Правила русской орфографии и пунктуации. Полный академический справочник (2006), approved by the Orthographic Commission of the Russian Academy of Sciences | https://orfo.ruslang.ru/docs/biblio/pravila_2006.pdf | § 5: ё consistently in texts for foreigners learning Russian; § 116: stress marks consistently in texts for learners of Russian; §§ 13–23: spelling after ж ш ч щ ц and г к х; the soft sign after sibilants. gramota.ru was not fetched; this is the academic rulebook it relies on. |
| S8 | Wikipedia, "Russian declension" | https://en.wikipedia.org/wiki/Russian_declension | Full ending tables for the three declensions, adjectives, pronouns, numerals; irregular plurals; indeclinable nouns; short names and the colloquial vocative; comparison. |
| S9 | Wikipedia, "Russian grammar" | https://en.wikipedia.org/wiki/Russian_grammar | Conjugation (first, second, irregular), past tense and its irregulars, imperative, conditional, motion verbs (pairs, prefixes with prepositions), participles, verbal adverbs, impersonal sentences, negation, word order, the second prepositional and the partitive. Wikipedia has no separate "Russian conjugation" article; conjugation is in this one. |
| S10 | Wikipedia, "Russian phonology" | https://en.wikipedia.org/wiki/Russian_phonology | Vowel reduction, final devoicing, voicing assimilation, stress, with IPA. |
| S11 | Wikipedia, "Russian alphabet" | https://en.wikipedia.org/wiki/Russian_alphabet | 33 letters; ё is often printed as е. |
| S12 | Wikipedia, "Russian orthography" | https://en.wikipedia.org/wiki/Russian_orthography | The soft sign after sibilants marking feminine nouns; который in oblique cases (quoted examples). |
| S13 | Русская Википедия, «Интонационная конструкция» (after Е. А. Брызгунова, Русская грамматика 1980) | https://ru.wikipedia.org/wiki/Интонационная_конструкция | ИК-1 to ИК-7 with their meanings and examples. |
| S14 | English Wiktionary, Russian entries | https://en.wiktionary.org/wiki/лес (and each word named in the tables: мост, чай, город, друг, брат, стул, сын, человек, ребёнок, мать, дочь, время, сестра, окно, письмо, девушка, неделя, песня, деньги, месяц, музей, словарь, отец, день, кафе, кофе, метро, такси, пальто, меню, ночь, дверь, сад, шкаф, аэропорт, год, берег, пол, угол, снег, нос, ложка, кухня, семья, статья, солдат, глаз, раз, сапог, грамм, помидор, носок, туфля, гражданин, англичанин, яблоко, место, писать, любить, видеть, ездить, хотеть, бежать, мочь, есть, дать, идти, ехать, быть, пить, брать, взять, сказать, давать, вставать, петь, рисовать, умереть, нести, сесть, лечь, спать, платить, просить, ходить, сидеть, начать, понять, положить, ставить, стать, лететь, плыть, везти, вести, учиться, извинить, звонить, помогать, заниматься, интересоваться, бояться, ждать, рад, должен, занятый, больной, свободный, нужный, похожий, хороший, плохой, большой, маленький, дешёвый, дорогой, молодой, старый, высокий, близкий, простой, лёгкий, далёкий, весь, сам, который, никто, некого, кто-то, кто-нибудь, кое-кто, же, ведь, вот, ну, ли, щас, чё, тыща, ваще, полшестого, потому, потому что, and the false friends in § 3.10) | Every form, stress and case government in the inventory that is not from S8–S9. |
| S15 | Sveučilište u Zadru, Odjel za rusistiku, handout «Глагольный вид» (2013–2014) | https://www.unizd.hr/Portals/35/2013-2014/GLAGOLSKI%20VID.pdf | The five ways aspect pairs are formed; which verbs take an imperfective or a perfective infinitive; нельзя with each aspect; aspect in negative commands and in the negated past. |
| S16 | Макарова А. Б., Сай С. С. «Взаимодействие некоторых характеристик русских именных групп (статистический аспект)», 2007, Russian National Corpus "Studiorum" | https://studiorum.ruscorpora.ru/wp-content/themes/bootstrap-basic4-child/texts/makarova_say_interaction.pdf | How often each case occurs in 3022 noun phrases of spontaneous spoken Russian. Used for the teaching order. The corpus itself (ruscorpora.ru) was not queried. |
| S17 | Wikipedia, "Eastern Slavic naming customs" | https://en.wikipedia.org/wiki/Eastern_Slavic_naming_customs | Name + patronymic, patronymic suffixes, short names (Саша, Маша), diminutives and their register. |
| S18 | Wikipedia, "T–V distinction" | https://en.wikipedia.org/wiki/T%E2%80%93V_distinction | ты for intimates, вы as the unmarked norm, Вы capitalized in formal letters. |
| S19 | Wikipedia, "Slavic liquid metathesis and pleophony" | https://en.wikipedia.org/wiki/Slavic_liquid_metathesis_and_pleophony | Russian -оро-/-оло-/-ере- against Slovak -ra-/-la-/-re- (го́род, бе́рег, молоко́). |
| S20 | The repo's Slovak skill, copied from slovak.wiki at commit 337d5fc1 | `.claude/skills/slovak-language/references/` (valency-and-prepositions.md, adjectives-pronouns-numerals.md, phonology-and-orthography.md, lexical-choice-and-interference.md, foundations-and-core-communication.md) | Slovak facts used for the "SK" column: čakať na, zaujímať sa o, myslieť na, autobusom, v práci, 2–4 + nominative plural, mám 25 rokov, first-syllable stress, i = y in sound, final devoicing, zakázať, v pohode. |
| S21 | English Wiktionary, Slovak entries | https://en.wiktionary.org/wiki/čerstvý (and pozor, čas, hodina, ovocie, jahoda, pýtať, rodina, život, nedeľa, krásny, žena, palec, rok) | Slovak meanings of the false friends. |
| S22 | Русская Википедия: Казань-Пассажирская, Свияжск, Улица Баумана (Казань), Чёрное озеро (парк, Казань), Старо-Татарская слобода, Кремлёвская (станция метро), Центральный рынок (Казань), Вселенский храм, Иннополис, Казанский метрополитен | https://ru.wikipedia.org/wiki/Свияжск (same pattern for each title) | Whether each place in world.json exists and where it is. |
| S23 | Web search results (summaries, not full pages): Söyembikä Tower; Innopolis transport; National Library of Tatarstan; МФЦ «Мои документы» in Kazan | https://en.wikipedia.org/wiki/S%C3%B6yembik%C3%A4_Tower · https://journal.sovcombank.ru/puteshestviya/nauchnii-grad-innopolis-gde-nahoditsya-i-kak-tuda-popast · https://experience.tripster.ru/articles/innopolis/ · https://rusneb.ru/library/natsionalnaya-biblioteka-respubliki-tatarstan/ · https://mert.tatarstan.ru/eng/index.htm/news/1052959.htm | The leaning tower; no train to Innopolis (bus 108, 40 km); the library at ул. Пушкина, 86 since 2020; МФЦ branches found elsewhere, none on Кремлёвская. |

Not consulted: Wade, *A Comprehensive Russian Grammar* (no open copy found); the lexical minimums for A1, A2 and B1 (only their sizes, from S1 and S6; their thematic grouping is **not verified**); the Russian National Corpus interface.

## 2. What each level expects

Sources: S1 (all levels), S2 (A1), S3 (A2), S5 (B1, via the HSE program, because the B1 standard was not found), S4 (B2), S6 (vocabulary).

| | A1 · элементарный | A2 · базовый | B1 · ТРКИ-1 | B2 · ТРКИ-2 |
|---|---|---|---|---|
| Vocabulary [S1, S6] | up to 780 units | up to 1300 | up to 2300 | up to 10 000, of them 6000 active [S1]; the lexical minimum itself has "a little over 5000" [S6]. The two sources disagree; S1 is the legal norm, S6 is the published word list. |
| Functions [S2–S4] | start a conversation, meet someone, introduce yourself and others, greet, say goodbye, address someone, thank, apologize, answer thanks and apologies, ask someone to repeat; ask and tell about a fact, a person, a thing, presence or absence, quality, ownership, an action, its time, place and cause; express a wish, request, offer, invitation, agreement, disagreement, refusal; give an evaluation | all of A1, plus: congratulate, ask again, wish someone well; ask about quantity and purpose; express intention, advice, permission or prohibition, a promise, uncertainty | (S1) understand dialogues and recorded announcements and news; start, keep up and end a dialogue on many topics; give your attitude to what people say and do; retell a text | open and steer a conversation, change the topic, close it to fit the situation; offer condolences, wish luck; request, advise, demand, order; agree, object, doubt, promise, reassure; ask about conditions, causes, consequences, possibility, probability; express and ask opinions, preferences, assumptions; praise, reproach, blame, defend; compare with a norm; express surprise, disappointment, irritation, hope, fear |
| Situations [S2–S4] | shop, kiosk, ticket desk; post office; bank, exchange office; restaurant, café, canteen; library; class; street and transport; clinic, doctor, pharmacy | all of A1, plus an administrative office, an excursion, **a telephone call** | (S1) a wide range of everyday situations | bank, clinic, insurance company, restaurant, transport; theater, cinema, club, exhibition, museum, library; administration, tax office, traffic police — being there and discussing what happened there |
| Speaking themes [S2–S4, S1] | about yourself (childhood, study, work, interests); my friend or relative; family; my working day; free time and interests | the A1 themes, plus study and work (workplace, profession); learning a foreign language; my day; my home town and the capital; health; weather | (S1) yourself, work, profession, interests, country, city, questions of culture | circle 1: personal life, family, work, leisure, man and woman, parents and children, travel, free time, hobbies; circle 2: society, politics, economy, science, art; circle 3: nature, "the Earth, our common home", spiritual development, space |
| Listening [S2, S3, S1, S4] | monologue 120–150 words, about 1% unknown words, 120–140 syllables a minute, heard twice; dialogue of up to 12 lines | short dialogues and monologues (topic, place, time, cause) | announcements, news, social and cultural information | radio news, advertising, dialogues from films and TV; heard once |
| Writing [S1, S3, S4] | a text about yourself, friends, family, your day, free time: at least 7 sentences | a short letter, a note, a greeting card; a summary: at least 15 sentences (S1), 15–18 (S3) | at least 20 sentences; pass on the content of a text | plans, theses, notes; a personal or formal business letter; a statement (заявление), a request, an explanatory note (объяснительная записка), a power of attorney (доверенность) |
| Grammar [S2–S5] | see § 4; in short: alphabet and ИК-1 to ИК-5; gender, number, animacy; all six cases in basic meanings; adjective agreement in the nominative and a first look at its cases; рад, занят, должен, болен; personal, possessive, interrogative pronouns, этот, каждый, никто; both aspects; present, past, future; 14 verb classes; imperative (читай, читайте; говори, говорите); verb government; идти, ходить, ехать, ездить, пойти, прийти; numbers with nouns (одна книга, два года); ordinals in the nominative; и, или, а, но, не только… но и, потому что, поэтому, что, где, куда, который (limited); reported speech with что | adjectives in all cases; готов added to the short forms; some comparatives; свой, тот, сам, весь; 17 verb classes (adds петь, пить, есть); встретил брата / встретился с братом; motion verbs with по-, при-, у-, вы-, в- and лететь/летать, нести/носить, везти/возить; ordinals declined; prepositions в, о, на, над, под, без, во время, через, после, с, до, к, по, от, из, у; чтобы, если, ли, неужели, разве; sentences without a subject (Газеты продают в киосках); word order and new information | (S5) all four participles and short passive participles; verbal adverbs; prefixed motion verbs and their aspect; comparison of adjectives and adverbs; full and short adjectives; который; чтобы; conditional and concessive clauses; generalized-personal sentences; reported speech; active and passive constructions with -ся | all of the above in use; extra case meanings (cause: из-за дождя, от радости; time: за год, через месяц, на неделю, по вторникам; manner: поездом, с улыбкой); indefinite pronouns (кто-то, кто-нибудь, кое-кто); adverbs never-, some-; prepositions в течение, по мере, благодаря, несмотря на; если бы, раз; хотя, несмотря на то что; так как, благодаря тому что, ибо; turning participle phrases into который clauses and back; register: academic, newspaper, official |

## 3. The inventory

Sources for the whole section: S2–S5 (levels), S7–S19 (rules and forms), S20–S21 (Slovak), S16 (frequency). Each table names its own sources.

### 3.1 Alphabet and sounds

Sources: S10, S11, S7 (§§ 5, 13–23, 116), S13, S2–S4 (levels), S20 (Slovak). IPA from S10.

**The 33 letters** [S11, S10]

| Letter | Sound | Trap |
|---|---|---|
| А а | [a]; reduced when unstressed (PH-6) | — |
| Б б | [b]; [p] at the end of a word | — |
| В в | [v]; [f] at the end of a word | EN: looks like B |
| Г г | [g]; [v] in the endings -ого/-его | EN: reads it as "r"; SK: Slovak often has h where Russian has г (гора́ / hora) (**not verified**) |
| Д д | [d] | — |
| Е е | [je] at the start of a word and after a vowel; after a consonant it softens it and gives [e]; [ɪ] when unstressed | EN and SK: read it as plain "e" |
| Ё ё | [jo], or soft consonant + [o]; always stressed; often printed as е (PH-5) | — |
| Ж ж | [ʐ], always hard | SK: Slovak ž is not retroflex |
| З з | [z] | EN: looks like 3 |
| И и | [i]; softens the consonant before it | — |
| Й й | [j] | — |
| К к | [k] | — |
| Л л | [ɫ] (hard) or [lʲ] (soft) | — |
| М м | [m] | — |
| Н н | [n] | EN: looks like H |
| О о | [o] only under stress | — |
| П п | [p] | — |
| Р р | [r], rolled | EN: looks like P |
| С с | [s] | EN: looks like C |
| Т т | [t] | — |
| У у | [u] | EN: looks like y |
| Ф ф | [f] | — |
| Х х | [x] | EN: looks like X; SK: this is Slovak ch |
| Ц ц | [ts], always hard | SK: Slovak c |
| Ч ч | [tɕ], always soft | SK: close to č |
| Ш ш | [ʂ], always hard | SK: close to š |
| Щ щ | [ɕː], a long soft "sh" | SK: not šč |
| Ъ ъ | no sound; after a prefix, before е, ё, ю, я, keeps the [j] (въезжа́ть) | — |
| Ы ы | [ɨ], a central vowel | SK: Slovak y sounds the same as i [S20]; Russian ы does not |
| Ь ь | no sound; softens the consonant before it; separates (семья́); after ж ш ч щ it marks a feminine noun (ночь) and is absent in masculine ones (нож) [S7, S12] | — |
| Э э | [e] with no softening | — |
| Ю ю | [ju], or soft consonant + [u] | — |
| Я я | [ja], or soft consonant + [a]; [ɪ] when unstressed | — |

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| PH-1 | Hard and soft consonants | Most consonants come in a hard and a soft pair; the vowel letter after the consonant, or ь, shows which | hard: а э о у ы; soft: я е ё ю и, ь | ж ш ц are always hard, ч щ й always soft, whatever letter follows | брат [brat] / брать [bratʲ] | A1 | EN: ignores softness, so мат and мать sound alike · SK: Slovak marks softness on the consonant (ď ť ň ľ), Russian on the next vowel letter | S10, S7 |
| PH-2 | Vowel letter pairs | Each vowel sound has two letters: one after hard consonants, one after soft ones | а/я, э/е, о/ё, у/ю, ы/и | after ж ш ц, и and е are written but the consonant stays hard: жить [ʐɨtʲ] | рад / ряд | A1 | EN: reads я and ю as two vowels | S10 |
| PH-3 | The hard sign ъ | After a prefix ending in a consonant, before е ё ю я, it keeps [j] and the consonant hard | въ-, объ-, подъ-, съ- | — | въезжа́ть "to drive in" | A1 (reading) | EN: tries to pronounce it | S9, S11 |
| PH-4 | The soft sign ь | Softens the consonant before it; separates a consonant from a following vowel letter; after a sibilant it marks a feminine noun | брать, семья́, ночь (f) / нож (m) | ь also after sibilants in verb forms: пи́шешь, пла́чь | Мать до́ма. "Mother is at home." | A1 | EN: drops it, so мать becomes мат | S7, S12, S9 |
| PH-5 | ё and е | ё is always stressed; ordinary print often writes е; learner texts must write ё consistently | ё = [jo] or soft + [o] | — | всё "everything" / все "everyone" | A1 | EN: reads a printed е that stands for ё as [e] | S7 § 5, S11 |
| PH-6 | Unstressed о and а (аканье) | Unstressed о and а merge: [ʌ] in the syllable before the stress and at the start of a word, [ə] elsewhere | наро́д [nʌˈrot], о́блако [ˈobɫəkə] | some loanwords keep [o]: ве́то [ˈvʲeto] | Моро́з [mʌˈros] "frost" | A1 | EN: says every о as [o] · SK: Slovak has no reduction and reads the letter | S10 |
| PH-7 | Unstressed е, я, а after soft consonants (иканье) | They merge into [ɪ] | язы́к [jɪˈzɨk]; лиса́ and леса́ both [lʲɪˈsa] | — | ядро́ [jɪˈdro] | A1 | SK: reads я as [ja] in every position | S10 |
| PH-8 | Unstressed е after ж ш ц | Pronounced [ɨ] | жена́ [ʐɨˈna] | — | шевели́ть [ʂɨvʲɪˈlʲitʲ] | A2 | — | S10 |
| PH-9 | Final devoicing | Voiced consonants are voiceless at the end of a word | б→[p], в→[f], г→[k], д→[t], ж→[ʂ], з→[s] | not before a word that starts with a voiced consonant | наро́д [nʌˈrot], ёж [jɵʂ] | A1 | SK: Slovak does the same (dub [dup]), so this transfers [S20] | S10 |
| PH-10 | Voicing assimilation | In a cluster, the last consonant decides voicing for all of them; this crosses word boundaries | про́сьба [ˈprozʲbə], во́дка [ˈvotkə], к вдове́ [ɡvdʌˈvʲe] | в does not voice the consonant before it (твой) | без впу́ска [bʲɪs ˈfpuskə] | A1 | SK: the same process exists in Slovak (prosba) [S20] | S10 |
| PH-11 | Free, mobile stress | Stress can fall on any syllable and can move between the forms of one word; it can change meaning | му́ка "torment" / мука́ "flour"; до́ма "at home" / дома́ "houses"; пишу́ / пи́шешь; сестра́ / сёстры; пятьдеся́т / се́мьдесят | — | Он сего́дня до́ма. "He is at home today." | A1 | EN: guesses from spelling · SK: Slovak stresses the first syllable [S20] | S10, S14 |
| PH-12 | Stress marks in learner texts | Learner texts mark stress consistently; the mark is the acute over the vowel (in Unicode: U+0301 after the vowel letter) | ма́ма, молоко́ | not on one-syllable words; never on ё | — | A1–B2 | Tooling: a Latin á inside a Cyrillic word is a different letter and breaks search and speech | S7 § 116 |
| PH-13 | Spelling rule: и after г к х ж ч ш щ | Write и, never ы, after these letters | кни́ги, де́вушки, хоро́шие, лучи́ | ы after г к х only in loans and interjections (кыш) | Это кни́ги. "These are books." | A1 | EN: writes *книгы by analogy with столы́ | S7 §§ 12, 14 |
| PH-14 | Spelling rule: а у after ж ч ш щ ц | Write а and у, never я and ю, after these letters; я ю after г к х only in loans | молчу́, слы́шат, скажу́, отцу́ | — | Я скажу́ отцу́. | A1 | EN: writes *слышят by analogy with говоря́т | S7 § 13, § 2 note |
| PH-15 | Spelling rule: unstressed о → е after ж ч ш щ ц | In endings and suffixes, write о when stressed, е when not | отцо́м / ме́сяцем; большо́го / хоро́шего; хоро́шее | some loanwords keep о (шокола́д) | Я говорю́ с отцо́м. | A1 | EN: writes *хорошое | S7 §§ 20, 23; S8 |
| PH-16 | ы after ц | After ц, endings take ы; roots mostly take и | отцы́, ме́сяцы, огурцы́; цирк | ы in a few roots: цыга́н, цыплёнок | — | A1 | — | S7 §§ 15–16 |
| PH-17 | Spelling against sound | г in -ого/-его is [v]; что and чего are [што], [чиво]; -ться and -тся are both [tsə] | его́ [jɪˈvo], кото́рого | — | Чего́ ты хо́чешь? | A1 | EN and SK: say [g] in его | S8, S9 |
| PH-18 | Intonation ИК-1 | Falling tone on the stressed word: a finished statement | — | — | Это Андре́й. (ГОС A1) | A1 | — | S13, S2 |
| PH-19 | Intonation ИК-2 | Fall with stronger stress: question with a question word; address; request | — | — | Ско́лько сто́ит э́та кни́га? (ГОС A1) | A1 | EN: rises at the end of a wh-question | S13, S2 |
| PH-20 | Intonation ИК-3 | Sharp rise on the questioned word, then fall: a yes/no question with no question word; an unfinished part of a sentence | — | — | Вы бы́ли в теа́тре? "Were you at the theater?" | A1 | EN: rises at the very end, not on the word in question; the same words with ИК-1 are a statement | S13, S2 |
| PH-21 | Intonation ИК-4 | Fall then rise: a contrastive question with а | — | — | Я иду́. А вы? | A1 | — | S13, S2 |
| PH-22 | Intonation ИК-5 | Two centers, rise then fall: strong evaluation | — | — | (no example in the sources fetched) | A1 (hearing) | — | S13, S2 |
| PH-23 | Intonation ИК-6 and ИК-7 | ИК-6: rise and level, evaluative exclamation or puzzlement; ИК-7: rise cut off by a glottal stop, ironic evaluation | — | — | Како́й ве́чер тёплый! (ИК-6); Како́й он отли́чник! "Some star pupil he is!" (ИК-7) | B2 | EN: misses the irony of ИК-7 | S13, S4 |

### 3.2 Nouns

Sources: S8 (tables), S9 (additional cases), S14 (every named form), S7 (soft sign), S2–S4 (levels), S16 (frequency), S20 (Slovak).

**Ending tables** [S8]. "Accusative = nominative or genitive" means: inanimate nouns use the nominative form, animate nouns the genitive form.

First declension (nouns in -а, -я, -ия; feminine, plus masculine nouns like па́па, дя́дя, мужчи́на)

| Case | -а (рабо́та) | -я (неде́ля) | -ия (ли́ния) |
|---|---|---|---|
| nominative singular | -а | -я | -ия |
| accusative singular | -у | -ю | -ию |
| genitive singular | -ы (-и after г к х ж ч ш щ: кни́ги) | -и | -ии |
| dative singular | -е | -е | -ии |
| instrumental singular | -ой (-ей when unstressed after ж ч ш щ ц) | -ей (-ёй when stressed: семьёй) | -ией |
| prepositional singular | -е | -е | -ии |
| nominative plural | -ы (-и after г к х ж ч ш щ) | -и | -ии |
| accusative plural | = nominative or genitive | = nominative or genitive | = nominative or genitive |
| genitive plural | no ending (рабо́т, книг); stressed -ья → -ей (семе́й) | -ь or nothing, learn each: неде́ль, ку́хонь, пе́сен | -ий (ли́ний) |
| dative plural | -ам | -ям | -иям |
| instrumental plural | -ами | -ями | -иями |
| prepositional plural | -ах | -ях | -иях |

Second declension, masculine (consonant, -ь, -й, -ий)

| Case | consonant (фильм) | -ь (писа́тель) | -й (геро́й) | -ий (коммента́рий) |
|---|---|---|---|---|
| nominative singular | — | -ь | -й | -ий |
| accusative singular | = nominative or genitive | = nominative or genitive | = nominative or genitive | = nominative or genitive |
| genitive singular | -а | -я | -я | -ия |
| dative singular | -у | -ю | -ю | -ию |
| instrumental singular | -ом (-ем when unstressed after ж ч ш щ ц: ме́сяцем; but отцо́м) | -ем (-ём when stressed: словарём) | -ем | -ием |
| prepositional singular | -е | -е | -е | -ии |
| nominative plural | -ы (-и after г к х ж ч ш щ); some take stressed -а́ (N-12) | -и (a few take stressed -я́: я́корь → якоря́) | -и | -ии |
| genitive plural | -ов (-ев when unstressed after ц: ме́сяцев; -ей after ж ч ш щ) | -ей | -ев | -иев |
| dative plural | -ам | -ям | -ям | -иям |
| instrumental plural | -ами | -ями | -ями | -иями |
| prepositional plural | -ах | -ях | -ях | -иях |

Second declension, neuter (-о, -е, -ие)

| Case | -о (ме́сто) | -е (мо́ре) | -ие (зда́ние) |
|---|---|---|---|
| nominative and accusative singular | -о (-е when unstressed after ж ч ш щ ц) | -е (-ё when stressed) | -ие |
| genitive singular | -а | -я | -ия |
| dative singular | -у | -ю | -ию |
| instrumental singular | -ом | -ем | -ием |
| prepositional singular | -е | -е | -ии |
| nominative and accusative plural | -а (ме́ста → места́) | -я (моря́) | -ия |
| genitive plural | no ending (мест) | -ей after a consonant (море́й), -й after a vowel | -ий (зда́ний) |
| dative / instrumental / prepositional plural | -ам / -ами / -ах | -ям / -ями / -ях | -иям / -иями / -иях |

Third declension (feminine -ь; neuter -мя; путь)

| Case | -ь (кость) | мать, дочь | -мя (и́мя) | путь (m) |
|---|---|---|---|---|
| nominative singular | -ь | мать, дочь | и́мя | путь |
| accusative singular | -ь | мать, дочь | и́мя | путь |
| genitive, dative, prepositional singular | -и | ма́тери, до́чери | и́мени | пути́ |
| instrumental singular | -ью | ма́терью, до́черью | и́менем | путём |
| nominative plural | -и | ма́тери, до́чери | имена́ | пути́ |
| accusative plural | = nominative or genitive | матере́й, дочере́й | имена́ | пути́ |
| genitive plural | -ей | матере́й, дочере́й | имён | путе́й |
| dative plural | -ям (-ам after ж ч ш щ: мыша́м) | матеря́м, дочеря́м | имена́м | путя́м |
| instrumental plural | -ями (-ами after ж ч ш щ) | матеря́ми, дочерьми́ (дочеря́ми) | имена́ми | путя́ми |
| prepositional plural | -ях (-ах after ж ч ш щ) | матеря́х, дочеря́х | имена́х | путя́х |

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| N-1 | Gender by ending | The nominative singular ending usually shows the gender | masculine: consonant, -й, some -ь; feminine: -а, -я, -ия, some -ь; neuter: -о, -е, -ие, -мя | masculine nouns in -а/-я (N-3); -ь nouns of both genders (N-2); indeclinables (N-5) | но́вый фильм, но́вая рабо́та, но́вое зда́ние | A1 | EN: has no gender, so forgets agreement · SK: most genders match Slovak, but not all (N-2) | S8 |
| N-2 | Nouns in -ь | The ending does not show gender; learn each word with its gender | masculine: день, слова́рь, писа́тель, путь, рубль; feminine: ночь, дверь, кость, мать, дочь, мышь | after ж ч ш щ the ь itself shows the feminine: ночь (f) vs нож (m) | Э́тот слова́рь, э́та дверь. | A1 | SK: Slovak gender of a cognate can differ (**not verified** per word) | S7, S8, S14 |
| N-3 | Masculine nouns in -а/-я | They decline like feminine nouns but take masculine agreement | па́па, дя́дя, мужчи́на; short names Са́ша, Ва́ня | — | Мой па́па до́ма. "My dad is at home." | A1 | EN: says *моя папа | S8 |
| N-4 | Neuter nouns in -мя | Ten nouns; stem grows -ен- outside the nominative and accusative singular | и́мя, и́мени, и́менем; имена́, имён; вре́мя, вре́мени, времена́, времён | — | У меня́ нет вре́мени. "I have no time." | A1 (вре́мя, и́мя) | EN: treats время as feminine because of -я | S8, S14 |
| N-5 | Indeclinable nouns | Most loanwords ending in a vowel other than -а/-я do not change; gender is mostly neuter | кафе́ (n), метро́ (n), такси́ (n), меню́ (n), пальто́ (n); ко́фе (m; colloquially also n) | пальто́ has a colloquial declined form (пальта́), proscribed | Мы в кафе́. "We are in the café." | A1 | EN: *в кафее · SK: Slovak declines kaviareň, so this looks odd | S8, S14 |
| N-6 | Animacy and the accusative | Animate masculine nouns in the singular, and all animate plurals, use the genitive form as accusative | ви́жу бра́та, ви́жу отца́, ви́жу друзе́й, ви́жу сестёр; but ви́жу фильм, ви́жу сестру́ | feminine nouns in -а/-я keep their own accusative in the singular (сестру́); -ь feminine nouns keep -ь (мать) | Я встре́тил А́нну. (ГОС A1) Я люблю́ бра́та. | A1 | EN: *Я вижу брат · SK: Slovak does the same for masculine animates (Vidím brata.), but animal plurals go inanimate in Slovak (Vidím psy.) and stay animate in Russian (ви́жу соба́к) [S20] | S8, S2 |
| N-7 | First declension in full | See the first table above | — | — | Я жду ма́му. "I am waiting for Mom." | A1 (singular), A1–A2 (plural) | EN: confuses the dative and prepositional -е with the nominative plural | S8 |
| N-8 | Second declension masculine in full | See the second table | — | — | Я говорю́ с бра́том. | A1–A2 | — | S8 |
| N-9 | Second declension neuter in full | See the third table | — | — | Я живу́ в э́том зда́нии. | A1–A2 | EN: writes *в здание (the prepositional is -ии) | S8 |
| N-10 | Third declension in full | See the fourth table; мать and дочь insert -ер- outside the nominative and accusative singular | — | дочерьми́ and людьми́, детьми́ have -ьми́ in the instrumental plural | Я говорю́ с ма́терью. "I am talking with my mother." | A1–A2 | EN: *с матьей | S8, S14 |
| N-11 | Nominative plural: the regular endings | Masculine and feminine: -ы (hard) or -и (soft, and after г к х ж ч ш щ); neuter: -а (hard) or -я (soft) | фи́льмы, кни́ги, неде́ли, писа́тели, геро́и, ли́нии; места́, моря́, зда́ния | N-12 to N-14; stress often moves (о́кна, сёстры, места́) | Это но́вые кни́ги. | A1 | EN: adds -с | S8, S14 |
| N-12 | Nominative plural in stressed -а́ / -я́ | A group of masculine nouns takes stressed -а́ (-я́) | города́, дома́, леса́, глаза́, доктора́; учителя́, вечера́, поезда́ (**not verified**) | — | Э́ти дома́ но́вые. "These houses are new." | A1–A2 | EN and SK: *городы (Slovak mestá is regular) | S8, S10, S14 |
| N-13 | Plurals in -ья | Some nouns add -ья in the plural and keep it in all plural cases | бра́тья (бра́тьев), сту́лья (сту́льев), друзья́ (друзе́й), сыновья́ (сынове́й), мужья́, дере́вья, ли́стья | друг and сын change the stem | Мои́ бра́тья живу́т в Каза́ни. "My brothers live in Kazan." | A1 (друзья́), A2 (others) | EN: *други, *братов · SK: Slovak bratia, priatelia go another way | S8, S14 |
| N-14 | Irregular and suppletive plurals | Learn as separate words | челове́к → лю́ди (люде́й, лю́дям, людьми́); ребёнок → де́ти (дете́й, де́тям, детьми́); хозя́ин → хозя́ева; сосе́д → сосе́ди (soft); граждани́н → гра́ждане (гра́ждан), англича́нин → англича́не (англича́н); мать → ма́тери; дочь → до́чери; не́бо → небеса́; чу́до → чудеса́ | after numerals челове́к stays: пять челове́к; ребя́та is the plural of ребёнок meaning "guys" | В па́рке мно́го люде́й. "There are a lot of people in the park." | A1 (лю́ди, де́ти), A2 (rest) | EN: *человеки, *ребёнки | S8, S14 |
| N-15 | Genitive plural with no ending | Feminine -а/-я and neuter -о nouns usually drop the ending; a vowel о or е is often inserted between the last two consonants | книг, рабо́т, мест, я́блок; неде́ль (soft sign); о́кон (окно́), пи́сем (письмо́), де́вушек, ло́жек, сестёр, пе́сен, ку́хонь, ту́фель, де́нег | семья́ → семе́й, статья́ → стате́й (-ья → -ей); ли́ния → ли́ний, зда́ние → зда́ний | Пять книг, де́сять я́блок. | A2 | EN: *пять книгов · SK: Slovak also drops the ending (kníh, okien), a good bridge, but the inserted vowel differs (**not verified** in S20) | S8, S14 |
| N-16 | Genitive plural -ов / -ев | Masculine nouns ending in a hard consonant take -ов; in -й take -ев; unstressed after ц take -ев | фи́льмов, отцо́в, городо́в, лесо́в, мосто́в; геро́ев, музе́ев; ме́сяцев; коммента́риев; -ья plurals: бра́тьев, сту́льев | after ж ч ш щ: -ей (N-17) | Мно́го фи́льмов. | A2 | — | S8, S14 |
| N-17 | Genitive plural -ей | Masculine nouns in -ь and in ж ч ш щ; feminine nouns in -ь; some others | писа́телей, словаре́й, дней; ноче́й, двере́й, косте́й, матере́й, дочере́й; люде́й, дете́й, друзе́й; море́й | — | Семь дней. "Seven days." | A2 | EN: *днёв, *ночов | S8, S14 |
| N-18 | Genitive plural equal to the nominative singular | A short list of masculine nouns has no ending | раз, глаз, солда́т, сапо́г, челове́к (after numerals); colloquial гра́мм, помидо́р beside гра́ммов, помидо́ров; носо́к beside носко́в | — | Сто гра́ммов сы́ра (colloquial: сто грамм). | A2 | — | S14 |
| N-19 | Fleeting vowels | The о or е of the last syllable drops when an ending is added | оте́ц → отца́, день → дня, ребёнок → ребёнка, у́гол → угла́, носо́к → носка́, ме́сяц keeps its е | — | У отца́ нет вре́мени. | A1 | EN: *отеца · SK: Slovak has the same pattern (otec → otca), a good bridge (**not verified** in S20) | S8, S14 |
| N-20 | Second prepositional (locative) in stressed -у́ | After в and на meaning "where", some masculine nouns take stressed -у́ (-ю́); after о they take the ordinary -е | в лесу́, на мосту́, в саду́, в шкафу́, в аэропорту́, на берегу́, в году́, на полу́, в углу́, в снегу́, на носу́; optional в чаю́ | о ле́се, о са́де | Мы гуля́ли в лесу́. "We walked in the forest." | A2 | EN: *в лесе · SK: Slovak says v lese (**not verified** in S20), so the learner writes *в лесе | S9, S14 |
| N-21 | Partitive in -у (-ю) | For "some of" a substance, some masculine nouns may take -у instead of the genitive -а | ча́ю, са́хару; ча́шка ча́ю = ча́шка ча́я | the ordinary genitive is always correct | Вы́пейте ча́шку ча́ю. (ГОС A2) | A2 (recognize) | — | S9, S3, S14 |
| N-22 | Colloquial vocative | In speech, a short name or family word in -а/-я drops the vowel when calling someone | Ма́ша → Маш!, Ва́ня → Вань!, ма́ма → мам!, па́па → пап!, ребя́та → ребя́т! | not for names without a short form in a vowel (Влади́мир) | Мам, ты меня́ слы́шишь? "Mom, can you hear me?" | A2 (hear), B1 (use) | EN: hears Маш and thinks it is a different name | S8, S9 |
| N-23 | Prepositional, dative and genitive of nouns in -ий, -ия, -ие | Endings are -ии, not -ие | в зда́нии, о ли́нии, о коммента́рии; к ли́нии | в тече́ние and в продолже́ние as prepositions are written with -е | Он рабо́тает в зда́нии ба́нка. | A1 | EN: writes *в здание | S8 |
| N-24 | Family names | -ов/-ова, -ев/-ева, -ин/-ина decline partly like nouns, partly like adjectives; -ский like adjectives; -ко and -их do not change | Гага́рин: Гага́рина, Гага́рину, Гага́риным, о Гага́рине; Гага́рина (f): Гага́рину in the accusative, Гага́риной in every other case; plural Гага́рины, Гага́риных | foreign names in -ин/-ов take -ом: Да́рвином, Ча́плином | Я говори́л с Ива́ном Петро́вым. | A2 | EN: *с Петровом | S8, S7 |
| N-25 | Nouns used only in the plural | They take plural agreement and a numeral form like дво́е (NUM-8) | де́ньги (де́нег), очки́; часы́ "watch" (**not verified**) | — | Где мои́ очки́? "Where are my glasses?" | A1 | EN: *моя деньга | S8, S14 |
| N-26 | Nouns that are adjectives | They decline like adjectives | рабо́чий, учёный, столо́вая | — | Мы обе́даем в столо́вой. | A1 | EN: *в столовае | S8 |

### 3.3 Adjectives

Sources: S8 (declension, comparison), S14 (short forms, comparatives, superlatives), S7 (§§ 20, 42), S2–S5 (levels).

**Full-form endings** [S8]. Accusative masculine singular and accusative plural: nominative form for inanimate nouns, genitive form for animate ones.

| Case | masculine | neuter | feminine | plural |
|---|---|---|---|---|
| nominative | -ый (-ий soft, after г к х ж ч ш щ; -о́й stressed) | -ое (-ее soft and after unstressed ж ч ш щ) | -ая (-яя soft) | -ые (-ие soft and after г к х ж ч ш щ) |
| accusative | = nominative or genitive | = nominative | -ую (-юю soft) | = nominative or genitive |
| genitive | -ого (-его soft) | -ого (-его) | -ой (-ей soft) | -ых (-их) |
| dative | -ому (-ему) | -ому (-ему) | -ой (-ей) | -ым (-им) |
| instrumental | -ым (-им) | -ым (-им) | -ой (-ей) | -ыми (-ими) |
| prepositional | -ом (-ем) | -ом (-ем) | -ой (-ей) | -ых (-их) |

Model words: но́вый (hard), си́ний (soft), высо́кий (velar), хоро́ший (sibilant: хоро́шее, хоро́шего), большо́й (stressed -о́й: большо́го, больши́е) [S8].

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| ADJ-1 | Agreement | An adjective agrees with its noun in gender, number and case; it usually stands before the noun | see the table | — | интере́сная вы́ставка (ГОС A1) | A1 (nominative), A2 (all cases) | EN: leaves the adjective unchanged · SK: same system as Slovak, so the risk is the endings, not the idea | S8, S2, S3 |
| ADJ-2 | Hard, soft, velar and sibilant stems | The spelling rules (PH-13 to PH-15) pick и/ы and о/е; soft stems take я ю е и | но́вая / си́няя; высо́кие; хоро́шее | stressed -о́й (большо́й, молодо́й) | Си́нее не́бо. | A1 | EN: *хорошое, *высокые | S8, S7 |
| ADJ-3 | Pronunciation of -ого/-его | Read as [-ово]/[-ево] | но́вого [ˈnovəvə] | — | — | A1 | SK and EN: say [g] | S8 |
| ADJ-4 | Short forms: how they are made | Masculine: stem with no ending; feminine -а, neuter -о, plural -ы (-и); an е or о may appear in the masculine | бо́лен, больна́, больно́, больны́; свобо́ден, свобо́дна, свобо́дно, свобо́дны; ну́жен, нужна́, ну́жно, нужны́; за́нят, занята́, за́нято, за́няты; до́лжен, должна́, должно́, должны́ | stress moves to the ending in the feminine of many: молода́, стара́, проста́, дешева́, легка́ | Она́ занята́. "She is busy." | A1 (рад, занят, должен, болен), A2 (готов), B1 (others) | EN: *она занят · SK: Slovak short forms are rare (rád, rada exist), so the system looks strange except for рад | S14, S2, S3 |
| ADJ-5 | Short forms: when they are used | Only as the predicate after the subject (with or without быть); a few words exist only or mainly as short forms | рад (ра́да, ра́до, ра́ды), до́лжен + infinitive, гото́в, за́нят, бо́лен, свобо́ден, ну́жен (+ dative of the person), похо́ж на + accusative | full forms are used before a noun (за́нятый челове́к) | Он похо́ж на своего́ отца́. "He looks like his father." | A1–B1 | EN: *я рады; *я должен, что | S14, S2 |
| ADJ-6 | Comparative in -ее (-ей) | Add -ее to the stem; it does not change for gender or number | красне́е, интере́снее, нове́е (**not verified**), старе́е, дешеве́е | stems ending in г к х д т ст change: see ADJ-7 | Э́та статья́ интере́снее. (ГОС B2) | A2 (some forms), B1 | EN: *более интереснее | S8, S14, S3 |
| ADJ-7 | Short irregular comparatives in -е | Many common adjectives form a short comparative with a consonant change and -е | хоро́ший → лу́чше; плохо́й → ху́же; большо́й → бо́льше; ма́ленький → ме́ньше; дешёвый → деше́вле; дорого́й → доро́же; молодо́й → моло́же (of people: мла́дше); ста́рый → ста́рше (of people), старе́е (of things); высо́кий → вы́ше; бли́зкий → бли́же; далёкий → да́льше; просто́й → про́ще; лёгкий → ле́гче; глубо́кий → глу́бже | the comparative also serves as an adverb (лу́чше, бо́льше, ме́ньше) | Мой брат ста́рше меня́. (**not verified**: the genitive after a comparative is not in the fetched sources) | A2 | EN: *хорошее (for "better") · SK: Slovak lepší, horší, väčší are adjectives that decline; Russian лу́чше does not | S14, S8 (лу́чший, бо́льший), S4 (глу́бже) |
| ADJ-8 | Comparing with чем or the genitive | The thing compared stands in the genitive after a short comparative, or after чем in the nominative | ста́рше бра́та / ста́рше, чем брат | only чем after бо́лее and after long phrases | — | A2 | — | **not verified** |
| ADJ-9 | Compound comparative | бо́лее / ме́нее + full adjective; it declines | бо́лее до́брый, ме́нее интере́сная | rarely used when a short comparative exists | бо́лее ста́рый дом | B1 | EN: *более лучше | S8 |
| ADJ-10 | Declined comparatives | Four adjectives have comparatives that decline like adjectives | лу́чший, ху́дший, бо́льший, ме́ньший (also мла́дший, ста́рший) | — | лу́чший друг "best friend" | A2 | — | S8, S14 |
| ADJ-11 | Superlative with са́мый | са́мый + full adjective, both declined | са́мый до́брый, са́мая интере́сная, в са́мом большо́м го́роде | — | Это са́мый большо́й го́род. | A2 | EN: puts са́мый with the short comparative (*самый лучше) | S8 |
| ADJ-12 | Superlative in -ейший / -айший | Bookish; -айший after г к х, which change to ж ч ш | добре́йший, интереснейший, краси́вейший (stress of the last two **not verified**); высоча́йший, легча́йший, ближа́йший, дорожа́йший | наибо́льший, наилу́чший with наи- | ближа́йшая ста́нция "the nearest station" | B1 (recognize), B2 | EN: reads it as "very" only | S8, S14, S7 § 42 |
| ADJ-13 | Possessive adjectives in -ин / -ов | Colloquial "Mom's", "Dad's"; a mixed declension | ма́мин, ма́мино, ма́мина, ма́мины; ма́миного or ма́мина | — | Это ма́мина ку́ртка. (**not verified**: example made for this file) | B1 | EN: *мамы куртка is also fine; the error is using -ин with a non-family noun | S8 |
| ADJ-14 | Adverbs from adjectives | -о (or -е) for manner; по- + -ски for languages and ways | хорошо́, пло́хо, ме́дленно, бы́стро; по-ру́сски | — | Джон чита́ет по-ру́сски без словаря́. (after ГОС A2) | A1 | EN: *русски · SK: Slovak po slovensky is the same pattern, a good bridge | S2, S3 |

### 3.4 Pronouns

Sources: S8 (tables), S9 (negation), S14 (весь, сам, который, никто, некого, кто-то, кто-нибудь, кое-кто), S2–S4 (levels).

**Personal pronouns** [S8]. After a preposition, the third-person forms add н- (у него́, с ней, о нём).

| Case | я | ты | он, оно | она | мы | вы | они | себя |
|---|---|---|---|---|---|---|---|---|
| nominative | я | ты | он, оно́ | она́ | мы | вы | они́ | — |
| accusative | меня́ | тебя́ | его́ (него́) | её (неё) | нас | вас | их (них) | себя́ |
| genitive | меня́ | тебя́ | его́ (него́) | её (неё) | нас | вас | их (них) | себя́ |
| dative | мне | тебе́ | ему́ (нему́) | ей (ней) | нам | вам | им (ним) | себе́ |
| instrumental | мной (мно́ю) | тобо́й (тобо́ю) | им (ним) | ей, е́ю (ней, не́ю) | на́ми | ва́ми | и́ми (ни́ми) | собо́й (собо́ю) |
| prepositional | обо мне | о тебе́ | о нём | о ней | о нас | о вас | о них | о себе́ |

**Other pronouns that decline** [S8, S14]

| Case | э́тот (m / n / f / pl) | тот | весь | сам | мой (also твой, свой) | наш (also ваш) | чей | кто / что |
|---|---|---|---|---|---|---|---|---|
| nominative | э́тот, э́то, э́та, э́ти | тот, то, та, те | весь, всё, вся, все | сам, само́, сама́, са́ми | мой, моё, моя́, мои́ | наш, на́ше, на́ша, на́ши | чей, чьё, чья, чьи | кто, что |
| accusative | = nom./gen., э́то, э́ту, = nom./gen. | = nom./gen., то, ту | = nom./gen., всё, всю | = nom./gen., само́, саму́ | = nom./gen., моё, мою́ | = nom./gen., на́ше, на́шу | = nom./gen., чьё, чью | кого́, что |
| genitive | э́того, э́той, э́тих | того́, той, тех | всего́, всей, всех | самого́, само́й, сами́х | моего́, мое́й, мои́х | на́шего, на́шей, на́ших | чьего́, чьей, чьих | кого́, чего́ |
| dative | э́тому, э́той, э́тим | тому́, той, тем | всему́, всей, всем | самому́, само́й, сами́м | моему́, мое́й, мои́м | на́шему, на́шей, на́шим | чьему́, чьей, чьим | кому́, чему́ |
| instrumental | э́тим, э́той, э́тими | тем, той, те́ми | всем, всей, все́ми | сами́м, само́й, сами́ми | мои́м, мое́й, мои́ми | на́шим, на́шей, на́шими | чьим, чьей, чьи́ми | кем, чем |
| prepositional | э́том, э́той, э́тих | том, той, тех | всём, всей, всех | само́м, само́й, сами́х | моём, мое́й, мои́х | на́шем, на́шей, на́ших | чьём, чьей, чьих | ком, чём |

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| PR-1 | Personal pronouns in all cases | See the table | — | — | Мне два́дцать лет. (ГОС A1) Меня́ зову́т Серге́й. (ГОС A1) | A1 | EN: *Я двадцать лет; *Моё имя Сергей is possible but not the norm · SK: Slovak mám dvadsať rokov and volám sa transfer as the wrong structure [S20] | S8, S2 |
| PR-2 | н- after prepositions | Third-person pronouns take н- after any preposition | у него́, к ней, с ни́ми, о нём | no н- for the possessive его, её, их: у его́ бра́та (**not verified**) | У него́ есть маши́на. | A1 | EN: *у его | S8 |
| PR-3 | Possessives | мой, твой, наш, ваш, свой agree with the thing owned; его́, её, их never change | see the table; его́ кни́га, её брат, их дом | — | Ви́дел ли ты мою́ дочь? (WP) | A1 | EN: forgets that мой changes (*мой книга) · SK: Slovak jeho, jej, ich are also fixed, a good bridge | S8 |
| PR-4 | свой | When the owner is the subject of the same clause, use свой for any person; for the third person it is required | Он лю́бит свою́ жену́ (his own) / Он лю́бит его́ жену́ (someone else's) | in the first and second person мой/твой also occurs (Я люблю́ мою́ жену́) (**not verified**) | Она́ говори́т со свое́й ма́мой. | A2 | EN: uses его for "his own", which changes the meaning · SK: Slovak svoj works the same way, a good bridge (**not verified** in S20) | S8, S3 |
| PR-5 | э́тот and тот | э́тот "this", тот "that"; тот also points forward in complex sentences (то, что …) | see the table | э́то in "Э́то мой брат" does not change | Э́тот дом но́вый, а тот ста́рый. | A1 (э́тот), A2 (тот) | EN: *эта брат | S8, S2, S3 |
| PR-6 | весь | "all, the whole"; всё "everything", все "everyone" | see the table | — | Все бы́ли до́ма. | A2 | EN: confuses все and всё when ё is printed as е | S14, S3 |
| PR-7 | сам and са́мый | сам "oneself, in person" (stressed on the ending); са́мый "the very, the most" (stressed on the stem) | see the table | — | Я сам э́то сде́лал. | A2 | EN: confuses сам with себя́ | S14, S3 |
| PR-8 | себя́ | Reflexive pronoun for any person; no nominative | себя́, себе́, собо́й, о себе́ | — | Расскажи́те о себе́. | A2 | EN: *расскажите о вас (about yourselves → о себе́) | S8 |
| PR-9 | кто, что, како́й, чей, кото́рый, ско́лько | Question words decline: кто and что like the table; како́й and кото́рый like adjectives; ско́лько takes the genitive | како́й, кака́я, како́е, каки́е; кото́рый, кото́рая, кото́рое, кото́рые (кото́рого, кото́рому, кото́рым, о кото́ром …) | ско́лько + genitive singular for things you cannot count (ско́лько вре́мени), plural for things you can (ско́лько книг) (**not verified** as a rule) | Кото́рый час? "What time is it?" | A1 | EN: *кто книга (чья книга) | S8, S14, S2 |
| PR-10 | Negative pronouns and double negation | ни- pronouns and adverbs always go with не before the verb; any number of them | никто́ (никого́, никому́, нике́м, ни о ко́м), ничто́ (ничего́), никако́й, ниче́й; никогда́, нигде́, никуда́ | with a preposition the ни splits off: ни о ко́м, ни с кем | Никто́ никогда́ никому́ ничего́ не проща́ет. (WP) | A1 (никто́, ничего́), A2 | EN: *Никто знает · SK: Slovak also uses double negation (Nikto neprišiel.) [S20], a good bridge | S9, S14, S20 |
| PR-11 | не́кого, не́чего + infinitive | "there is no one / nothing to …"; the person goes into the dative | не́кого, не́кому (verified); не́кем, не́ с кем, не́чего, не́чему, не́чем (**not verified**) | — | Мне не́кого вини́ть. "I have no one to blame." | B1 | EN: confuses не́кого with никого́ | S14 |
| PR-12 | Indefinites -то, -нибудь, кое- | -то: a definite someone you cannot name; -нибудь: anyone at all (questions, commands, future); кое-: someone you choose not to name | кто́-то, что́-то, како́й-то, где́-то; кто́-нибудь, что́-нибудь, когда́-нибудь; ко́е-кто, ко́е-что | кто́-либо is a bookish synonym of -нибудь | Кто́-то здесь был? / Кто́-нибудь здесь был? (Wikt) | B1 (-то, -нибудь), B2 (кое-) | EN: uses -то in questions where -нибудь is needed | S14, S4 |
| PR-13 | ка́ждый, любо́й, друго́й | Decline like adjectives | ка́ждый день, любо́й челове́к | — | Ка́ждый ве́чер я звоню́ отцу́. (ГОС A2) | A1 (ка́ждый), B1 | — | S2, S3, S4 |

### 3.5 Numerals

Sources: S8 (declension, agreement, collective numerals), S14 (год, человек, полшестого), S2–S4 (levels and examples).

**Cardinal numbers** [S8]: 0 ноль (нуль); 1 оди́н, одна́, одно́, одни́; 2 два (m, n), две (f); 3 три; 4 четы́ре; 5 пять; 6 шесть; 7 семь; 8 во́семь; 9 де́вять; 10 де́сять; 11 оди́ннадцать; 12 двена́дцать; 13 трина́дцать; 14 четы́рнадцать; 15 пятна́дцать; 16 шестна́дцать; 17 семна́дцать; 18 восемна́дцать; 19 девятна́дцать; 20 два́дцать; 30 три́дцать; 40 со́рок; 50 пятьдеся́т; 60 шестьдеся́т; 70 се́мьдесят; 80 во́семьдесят; 90 девяно́сто; 100 сто; 200 две́сти; 300 три́ста; 400 четы́реста; 500 пятьсо́т; 600 шестьсо́т; 700 семьсо́т; 800 восемьсо́т; 900 девятьсо́т; 1000 ты́сяча; 1 000 000 миллио́н; 10⁹ миллиа́рд.

**Numerals in the cases** [S8]

| Case | 1 (m / n / f / pl) | 2 | 3 | 4 | 5–20, 30 | 40, 90, 100 | 50–80 | 200 / 500 | оба / обе |
|---|---|---|---|---|---|---|---|---|---|
| nominative | оди́н, одно́, одна́, одни́ | два, две | три | четы́ре | пять | со́рок, девяно́сто, сто | пятьдеся́т | две́сти, пятьсо́т | о́ба, о́бе |
| accusative | = nom./gen., одно́, одну́, = nom./gen. | = nom./gen. | = nom./gen. | = nom./gen. | пять | = nominative | пятьдеся́т | = nominative | = nom./gen. |
| genitive | одного́, одно́й, одни́х | двух | трёх | четырёх | пяти́ | сорока́, девяно́ста, ста | пяти́десяти | двухсо́т, пятисо́т | обо́их, обе́их |
| dative | одному́, одно́й, одни́м | двум | трём | четырём | пяти́ | сорока́, девяно́ста, ста | пяти́десяти | двумста́м, пятиста́м | обо́им, обе́им |
| instrumental | одни́м, одно́й, одни́ми | двумя́ | тремя́ | четырьмя́ | пятью́ | сорока́, девяно́ста, ста | пятью́десятью | двумяста́ми, пятьюста́ми | обо́ими, обе́ими |
| prepositional | одно́м, одно́й, одни́х | двух | трёх | четырёх | пяти́ | сорока́, девяно́ста, ста | пяти́десяти | двухста́х, пятиста́х | обо́их, обе́их |

11–19 decline like 20 (два́дцать, двадцати́, двадцатью́) with the stress kept on the stem. ты́сяча declines like a noun (ты́сячи, ты́сячу, ты́сячей or ты́сячью); миллио́н like a masculine noun.

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| NUM-1 | один | Agrees with the noun in gender, number and case; the noun is in the nominative singular | оди́н дом, одна́ кни́га, одно́ окно́, одни́ часы́ | numbers ending in 1 work the same: два́дцать одна́ маши́на | Ру́чка сто́ит оди́н рубль. | A1 | EN: *один книга | S8, S2 |
| NUM-2 | 2, 3, 4 and оба | Noun in the genitive singular; два/две and о́ба/о́бе change for gender | два бра́та, две сестры́, три окна́, четы́ре до́ма; о́ба бра́та, о́бе сестры́ | numbers ending in 2, 3, 4 (except 12–14) too: со́рок два окна́ | Сейча́с два часа́. (after ГОС A1) | A1 | EN: *два братья (nominative plural) · SK: Slovak puts 2–4 with the nominative plural (dva stoly, tri autá) [S20]; the learner writes *два столы | S8, S20 |
| NUM-3 | 5 and up, and 11–14 | Noun in the genitive plural; also after мно́го, ма́ло, не́сколько, ско́лько | пять книг, де́сять рубле́й, оди́ннадцать ме́тров, сто оди́ннадцать ме́тров; мно́го домо́в | — | Ру́чки сто́ят 5 рубле́й. (ГОС A1) | A1 | SK: Slovak also uses the genitive plural from 5 (päť stolov), a good bridge (**not verified** in S20) | S8, S2 |
| NUM-4 | Compound numbers | The last word decides the noun form | два́дцать оди́н год, два́дцать два го́да, два́дцать пять лет; сто пятьдеся́т три ры́бы | — | Ему́ два́дцать оди́н год. | A1 | EN: *двадцать один лет · SK: Slovak mám dvadsaťdva rokov uses the genitive plural where Russian has два́дцать два го́да [S20] | S8, S20 |
| NUM-5 | Numerals in the oblique cases | Both the numeral and the noun take the case; nouns ты́сяча, миллио́н keep the noun in the genitive plural | с двумя́ бра́тьями, к пяти́ часа́м, о трёх кни́гах; пятью́ ты́сячами маши́н | — | Я говори́л с двумя́ друзья́ми. | A2 (recognize), B1 | EN: *с два друга | S8 |
| NUM-6 | Collective numerals | дво́е, тро́е, че́тверо (to се́меро) for people as a group, for де́ти, and with nouns that have only a plural; the noun takes the genitive plural | дво́е дете́й, тро́е друзе́й, дво́е но́жниц | not with first names (три Ко́ли, not *тро́е Коль); with women only in colloquial speech (тро́е подру́г) | У неё дво́е дете́й. "She has two children." (WP) | A2 | EN: *два детей · SK: Slovak dvaja, traja (for men) look similar but take the nominative (dvaja bratia) [S20] | S8 |
| NUM-7 | Ordinals | Decline like adjectives; in compounds only the last word is ordinal | пе́рвый, второ́й, тре́тий (тре́тья, тре́тье), четвёртый, пя́тый, шесто́й, седьмо́й, восьмо́й, девя́тый, деся́тый; две ты́сячи пе́рвый | тре́тий has a soft mixed declension (**not verified**) | Пе́рвое января́. (ГОС A1) | A1 (nominative), A2 (declined) | EN: *в двух тысяча первом | S8, S2, S3 |
| NUM-8 | Age | Person in the dative; год / го́да / лет by NUM-1 to NUM-4 | мне оди́н год, два го́да, пять лет; ему́ два́дцать лет; моему́ дру́гу два́дцать лет | лет is the genitive plural of год after numerals | Мари́не два́дцать лет. (ГОС A2) | A1 | EN: *Я двадцать лет · SK: Slovak mám 20 rokov [S20], the learner says *у меня 20 лет | S2, S3, S14 |
| NUM-9 | Clock time | Hours with час / часа́ / часо́в; "at" is в + accusative; half past is пол- + genitive of the next ordinal | Кото́рый час? Сейча́с два часа́. Ле́кция начина́ется в 2 часа́. в пять часо́в; полшесто́го "5:30" | без че́тверти шесть, че́тверть шесто́го, в полови́не шесто́го (**not verified**) | Фильм начина́ется в семь часо́в. | A1 (hours), A2 (halves) | EN: "half six" in British English means 6:30, полшестого means 5:30 | S2, S3, S14 |
| NUM-10 | Dates | "What is the date": neuter ordinal in the nominative + month in the genitive; "on that date": ordinal in the genitive | Како́е сего́дня число́? Пе́рвое ма́рта. / Это бы́ло пе́рвого ма́я. | — | Сего́дня пе́рвое января́ 2001-го го́да. (ГОС A2) | A1 (nominative), A2 (genitive) | EN: *в первый мая | S2, S3 |
| NUM-11 | Years | "In a year": в + prepositional of the ordinal + году́ | в две ты́сячи двадца́том году́; в 2001 году́ | the second locative году́ (N-20) | Друг прие́хал в 2020 году́. | A2 | EN: *в 2020 год | S14, S3 |
| NUM-12 | Approximate numbers | Putting the noun first makes the number approximate | мину́ты три "about three minutes"; пять-шесть дней | — | Подожди́ мину́ты три. | B1 | EN: misses the meaning | S8 |
| NUM-13 | полтора́ and fractions | полтора́ (m, n) / полторы́ (f) + genitive singular | полтора́ часа́ | — | Я ждал полтора́ часа́. | A2 | — | S8 (полтора часа); полторы́ **not verified** |

### 3.6 Verbs

Sources: S9 (conjugation, past, imperative, conditional, motion verbs, participles, verbal adverbs), S14 (every named verb), S15 (aspect), S2–S5 (levels, verb classes).

**Present-tense endings** (also the perfective future) [S9]

| Person | First conjugation | Second conjugation |
|---|---|---|
| я | -у / -ю | -у / -ю |
| ты | -ешь (-ёшь stressed) | -ишь |
| он, она, оно | -ет (-ёт) | -ит |
| мы | -ем (-ём) | -им |
| вы | -ете (-ёте) | -ите |
| они | -ут / -ют | -ат / -ят |

-у, -ут, -ат after a hard consonant or ж ш щ ч; -ю, -ют, -ят elsewhere. Reflexive verbs add -ся after a consonant and -сь after a vowel: учу́сь, у́чишься, у́чится, у́чимся, у́читесь, у́чатся [S9, S14].

**The verb classes the standards list** [S2, S3]: чита́ть → чита́ю; уме́ть → уме́ю; чу́вствовать → чу́вствую; встре́тить → встре́чу; отдохну́ть → отдохну́; дава́ть → даю́т; ждать → ждут; писа́ть → пи́шут; петь → пою́т; мочь → мо́гут; идти́ → иду́т; е́хать → е́дут; хоте́ть → хотя́т; брать → беру́т; жить → живу́т; пить → пьют; есть → едя́т.

**Irregular and high-frequency verbs** [S9, S14]

| Verb | я | ты | он | мы | вы | они | Imperative | Past (m, f, n, pl) |
|---|---|---|---|---|---|---|---|---|
| быть | (есть) → future бу́ду | бу́дешь | бу́дет | бу́дем | бу́дете | бу́дут | будь, бу́дьте | был, была́, бы́ло, бы́ли |
| есть "eat" | ем | ешь | ест | еди́м | еди́те | едя́т | ешь, е́шьте | ел, е́ла, е́ло, е́ли |
| дать (pf) | дам | дашь | даст | дади́м | дади́те | даду́т | дай, да́йте | дал, дала́, да́ло (дало́), да́ли |
| хоте́ть | хочу́ | хо́чешь | хо́чет | хоти́м | хоти́те | хотя́т | (хоти́) | хоте́л, хоте́ла, хоте́ло, хоте́ли |
| бежа́ть | бегу́ | бежи́шь | бежи́т | бежи́м | бежи́те | бегу́т | беги́, беги́те | бежа́л, бежа́ла, бежа́ло, бежа́ли |
| мочь | могу́ | мо́жешь | мо́жет | мо́жем | мо́жете | мо́гут | (моги́, rare) | мог, могла́, могло́, могли́ |
| идти́ | иду́ | идёшь | идёт | идём | идёте | иду́т | иди́, иди́те | шёл, шла, шло, шли |
| е́хать | е́ду | е́дешь | е́дет | е́дем | е́дете | е́дут | поезжа́й (езжа́й) | е́хал, е́хала, е́хало, е́хали |
| жить | живу́ | живёшь | живёт | живём | живёте | живу́т | живи́ (**not verified**) | жил, жила́, жи́ло, жи́ли (**not verified**) |
| брать | беру́ | берёшь | берёт | берём | берёте | беру́т | бери́, бери́те | брал, брала́, бра́ло, бра́ли |
| взять (pf) | возьму́ | возьмёшь | возьмёт | возьмём | возьмёте | возьму́т | возьми́, возьми́те | взял, взяла́, взя́ло, взя́ли |
| пить | пью | пьёшь | пьёт | пьём | пьёте | пьют | пей, пе́йте | пил, пила́, пи́ло, пи́ли |
| петь | пою́ | поёшь | поёт | поём | поёте | пою́т | пой, по́йте | пел, пе́ла, пе́ло, пе́ли |
| дава́ть | даю́ | даёшь | даёт | даём | даёте | даю́т | дава́й, дава́йте | дава́л, дава́ла, дава́ло, дава́ли |
| спать | сплю | спишь | спит | спим | спи́те | спят | спи, спи́те | спал, спала́, спа́ло (**not verified**), спа́ли |
| сесть (pf) | ся́ду | ся́дешь | ся́дет | ся́дем | ся́дете | ся́дут | сядь, ся́дьте | сел, се́ла, се́ло, се́ли |
| лечь (pf) | ля́гу | ля́жешь | ля́жет | ля́жем | ля́жете | ля́гут | ляг, ля́гте | лёг, легла́, легло́, легли́ |
| нести́ | несу́ | несёшь | несёт | несём | несёте | несу́т | неси́, неси́те | нёс, несла́, несло́, несли́ |
| умере́ть (pf) | умру́ | умрёшь | умрёт | умрём | умрёте | умру́т | умри́ | у́мер, умерла́, у́мерло, у́мерли |
| нача́ть (pf) | начну́ | начнёшь | начнёт | начнём | начнёте | начну́т | начни́, начни́те | на́чал, начала́, на́чало (**not verified**), на́чали |
| поня́ть (pf) | пойму́ | поймёшь | поймёт | поймём | поймёте | пойму́т | пойми́, пойми́те | по́нял, поняла́, по́няло (**not verified**), по́няли |

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| V-1 | First conjugation | Most verbs in -ать, -ять, -еть (уме́ть), -овать, -нуть, -ти, -чь, and the -ить verbs бить, пить, жить, шить, лить, вить | see the table; чита́ю, чита́ешь … чита́ют | бри́ть, стели́ть also first (S9) | Я чита́ю, а ты что де́лаешь? | A1 | EN: drops the person ending (*я читать) | S9 |
| V-2 | Second conjugation | Most verbs in -ить; a list in -еть (ви́деть, смотре́ть, сиде́ть, лете́ть, терпе́ть, висе́ть, шуме́ть …); -ать after ж ч ш щ (слы́шать, держа́ть, лежа́ть, крича́ть, молча́ть, стуча́ть); стоя́ть, боя́ться, спать | говорю́, говори́шь … говоря́т | гнать is second (forms **not verified**) | Я говорю́ по-ру́сски. | A1 | EN: *говорешь · SK: Slovak -iť / -ieť verbs mostly match, a good bridge (**not verified**) | S9, S14 |
| V-3 | Stress in the present | Three patterns: fixed on the stem (чита́ю), fixed on the ending (говорю́, говори́шь), or on the ending in the я form only (пишу́, пи́шешь; люблю́, лю́бишь; могу́, мо́жешь) | — | — | Я пишу́ письмо́, а ты что пи́шешь? | A1 | EN: keeps the stress of the я form (*пише́шь) | S14 |
| V-4 | Stem changes in the first conjugation | Some -ать verbs change the consonant in every present form | писа́ть → пишу́, пи́шешь, пи́шут; сказа́ть → скажу́, ска́жешь; пла́кать → пла́чу; мочь → могу́, мо́жешь, мо́гут; печь → пеку́, печёшь, пеку́т; хоте́ть → хочу́, хо́чешь (singular only) | — | Что ты пи́шешь? | A1 | EN: *писаю | S9, S14 |
| V-5 | Consonant change in the я form of the second conjugation | Only the я form changes; the others keep the stem | б→бл (люби́ть: люблю́), в→вл (лови́ть: ловлю́), п→пл (топи́ть: топлю́), м→мл (корми́ть: кормлю́); с→ш (проси́ть: прошу́), з→ж (вози́ть: вожу́), т→ч (плати́ть: плачу́), д→ж (ходи́ть: хожу́; ви́деть: ви́жу; сиде́ть: сижу́), ст→щ (прости́ть: прощу́), зд→зж (е́здить: е́зжу); ста́вить: ста́влю | the perfective future works the same (встре́тить → встре́чу) | Я люблю́ ко́фе, а ты лю́бишь чай. | A1 | EN: *любю, *видю, *ходю | S9, S14, S2 |
| V-6 | Verbs in -овать / -евать | -ова-/-ева- becomes -у-/-ю- in the present | рисова́ть → рису́ю, рису́ешь; танцева́ть → танцу́ю; чу́вствовать → чу́вствую; интересова́ться → интересу́юсь; плева́ть → плюю́ | — | Я танцу́ю. | A1 | EN: *рисоваю · SK: Slovak -ovať keeps -uje (maľuje), a good bridge (**not verified**) | S9, S2 |
| V-7 | Verbs in -авать | -ва- drops in the present and comes back in the imperative | дава́ть → даю́, даёшь, даю́т; встава́ть → встаю́; узнава́ть (**not verified**); imperative дава́й, встава́й | — | Я встаю́ в семь часо́в. | A1 | EN: *даваю | S14, S2 |
| V-8 | Verbs in -нуть | Perfective, first conjugation | верну́ть → верну́, вернёшь; отдохну́ть → отдохну́ | — | Я скоро верну́сь. | A1 | — | S9, S2 |
| V-9 | Verbs in -сти, -зти, -чь | Stem ends in a consonant that shows up in the present | нести́ → несу́; вести́ → веду́; везти́ → везу́; мочь → могу́; печь → пеку́ | — | Я веду́ сы́на в шко́лу. | A2 | — | S9 |
| V-10 | Reflexive verbs | -ся after a consonant, -сь after a vowel; meaning: reflexive, reciprocal, or a verb that only exists with -ся; also a passive with things | учу́сь, у́чишься; встре́тился с бра́том; боя́ться, нра́виться; Дом стро́ится (**not verified**) | -ться and -тся sound the same (PH-17) | Брат у́чится в шко́ле. | A1 | EN: drops -ся (*я учу в школе = "I teach at school") | S9, S14, S3 |
| V-11 | Present of быть | There is no present form; есть means "there is / exists" | В го́роде есть теа́тр. / Брат — врач. | — | Мама до́ма. (ГОС A1) | A1 | EN: *Я есть студент · SK: Slovak som, si, je must be dropped [S9] | S9, S2 |
| V-12 | Past tense | Infinitive stem + -л (masculine), -ла (feminine), -ло (neuter), -ли (plural); the form agrees with the subject's gender for every person | я, ты, он чита́л; я, ты, она́ чита́ла; оно́ чита́ло; мы, вы, они́ чита́ли | see V-13; reflexive: -лся, -лась, -лось, -лись | Вчера́ я (a woman speaking) рабо́тала до́ма. | A1 | EN: thinks -л means "he" and says *я читала as a man · SK: Slovak needs som (čítal som); Russian has no auxiliary | S9, S2 |
| V-13 | Irregular past forms | Verbs in -сти, -зти, -чь, -ереть and идти́, есть | нёс, несла́; вёз, везла́; вёл, вела́; рос, росла́; мог, могла́; пёк, пекла́; у́мер, умерла́; лёг, легла́; сел, се́ла; шёл, шла, шло, шли (and ушёл, пришёл, нашёл, вы́шел); ел, е́ла | stress often moves to the feminine ending (была́, брала́, взяла́, пила́, дала́, начала́, поняла́, спала́) | Он шёл домо́й. | A1 (шёл, мог, ел), A2 | EN: *идил, *могл · SK: Slovak šiel, mohol, jedol are close, a good bridge (**not verified**) | S9, S14 |
| V-14 | Imperfective future | бу́ду, бу́дешь, бу́дет, бу́дем, бу́дете, бу́дут + imperfective infinitive | Она́ бу́дет чита́ть. | never with a perfective infinitive | За́втра я бу́ду рабо́тать. | A1 | EN: *я буду прочитать · SK: Slovak budem + imperfective works the same, a good bridge | S9, S2 |
| V-15 | Perfective future | The perfective takes present endings, and the meaning is future; perfectives have no present | Я прочита́ю, сде́лаю, скажу́, возьму́ | — | Я позвоню́ тебе́ ве́чером. | A1 | EN: reads прочитаю as present | S9, S2 |
| V-16 | Imperative: form | From the present stem: -й after a vowel; -и when the я ending is stressed or the stem ends in two consonants; -ь when the ending is unstressed after one consonant; plural and polite add -те | де́лать → де́лай; рисова́ть → рису́й; говори́ть → говори́; писа́ть → пиши́; смотре́ть → смотри́; нести́ → неси́; ве́рить → верь; забы́ть → забу́дь; пла́кать → плачь; тро́нуть → тронь; ста́вить → ставь | дава́ть → дава́й, встава́ть → встава́й; дать → дай; есть → ешь; пить → пей; петь → пой; е́хать → поезжа́й; лечь → ляг; быть → будь; бежа́ть → беги́; помо́чь → помоги́ (**not verified**) | Чита́йте, пожа́луйста. | A1 (ты and вы forms of known verbs) | EN: says the infinitive (*Читать!) · SK: Slovak čítaj, píš follow a similar stem rule | S9, S14, S2 |
| V-17 | Let's: дава́й / дава́йте | дава́й(те) + imperfective infinitive, or + the мы form of a perfective; perfective мы form alone also works; -те for вы | Дава́й пойдём! Пойдёмте! Пойдём в парк. (ГОС A1) | дава́й + perfective infinitive is wrong (**not verified** as a rule) | Дава́йте познако́мимся. (**not verified**) | A1 | EN: *Давай пойти | S9, S2 |
| V-18 | Third-person command | пусть + present or perfective future | Пусть они́ замолча́т! | — | Пусть он позвони́т. | B1 | — | S9 |
| V-19 | Aspect in commands | Positive: perfective for one concrete action, imperfective for an invitation or a general rule; negative: imperfective for "don't", perfective only as a warning ("mind you don't") | Скажи́! / Не говори́! / Смотри́, не опозда́й! | — | Не опа́здывайте на уро́ки! (Zadar) | A2 | EN: *Не скажи! for "don't say" | S15 |
| V-20 | Conditional | бы + past form; бы moves freely but usually follows the first word; no person forms | я бы сказа́л (a man), я бы сказа́ла (a woman), мы бы сказа́ли | — | Я бы поспа́л. "I'd have a nap." | A2 (я бы хоте́л), B1 | SK: Slovak robil by som adds the person [S20]; Russian has only бы | S9 |
| V-21 | Aspect pairs: how they are made | Five ways | 1 prefix: писа́ть/написа́ть, де́лать/сде́лать, чита́ть/прочита́ть, ви́деть/уви́деть, мыть/вы́мыть, проси́ть/попроси́ть; 2 suffix -ну- (single act): крича́ть/кри́кнуть, пры́гать/пры́гнуть; 3 suffix change: реша́ть/реши́ть, дава́ть/дать, расска́зывать/рассказа́ть, изуча́ть/изучи́ть, покупа́ть/купи́ть (**not verified** in S15), помога́ть/помо́чь; root change: начина́ть/нача́ть, понима́ть/поня́ть, умира́ть/умере́ть, посыла́ть/посла́ть, называ́ть/назва́ть; 4 different roots: брать/взять, говори́ть/сказа́ть, класть/положи́ть, иска́ть/найти́, лови́ть/пойма́ть, сади́ться/сесть, ложи́ться/лечь, станови́ться/стать; 5 stress: нареза́ть/наре́зать | a prefix that adds a new meaning makes a new verb, not a pair: дочита́ть, перечита́ть, записа́ть | Я до́лго писа́л письмо́ и наконе́ц написа́л его́. | A1 (the pairs in the word list), A2 | EN: has no aspect · SK: Slovak aspect pairs work the same way and often with the same prefix (písať/napísať) [S20], the best bridge in the course | S15, S2 |
| V-22 | Aspect: when to use which | Imperfective: a process, a duration, a repeated or habitual action, naming the action itself; perfective: one complete action with a result, a sequence of completed actions | Я чита́л кни́гу два часа́. / Я прочита́л кни́гу. / Я ка́ждый день чита́ю. | the English tense does not decide | Ты взял мою́ ру́чку? — Да, э́то я взял. (Zadar) | A1–B2 | EN: maps the English past simple to the perfective | S15, S9 |
| V-23 | Verbs followed by an imperfective infinitive | начина́ть/нача́ть, стать (= start), продолжа́ть, конча́ть/ко́нчить, броса́ть/бро́сить (= stop), перестава́ть/переста́ть; уме́ть, учи́ться/научи́ться; люби́ть, нра́виться, привыка́ть, надоеда́ть, устава́ть | Продолжа́йте рабо́тать! Я не уме́ю води́ть маши́ну. | — | Е́сли вы ко́нчили чита́ть текст, начина́йте его́ переводи́ть. (Zadar) | A1–A2 | EN: *начал прочитать | S15 |
| V-24 | Verbs followed by a perfective infinitive | успе́ть, уда́ться, забы́ть (to do something once), смочь, суме́ть | Я ча́сто не успева́ю поза́втракать. Мне удало́сь съе́здить к роди́телям. | — | Он никогда́ не забыва́ет поздра́вить дру́га с днём рожде́ния. (Zadar) | B1 | — | S15 |
| V-25 | нельзя́ with each aspect | нельзя́ + imperfective = it is not allowed; нельзя́ + perfective = it is not possible | Нельзя́ чита́ть чужи́е пи́сьма! / В ко́мнату нельзя́ войти́, у нас нет ключа́. | — | (both from Zadar) | A2 | EN: one word "can't" for both | S15 |
| V-26 | не на́до, не ну́жно, не сто́ит + imperfective | Advice not to do something takes the imperfective | Не ну́жно покупа́ть э́тот слова́рь. Не сто́ит смотре́ть э́тот фильм. | — | (Zadar) | A2 | EN: *не нужно купить | S15 |
| V-27 | Negated past | Imperfective = it did not happen at all; perfective = it has not happened yet but is expected | Нет, я не брал твое́й ру́чки. / Нет, ещё не принёс. | — | (Zadar) | B1 | EN: always uses the perfective | S15 |
| V-28 | Motion verbs: the pairs | Unprefixed motion verbs come in pairs: one direction now (unidirectional) and any other motion (multidirectional); all are imperfective | идти́/ходи́ть (on foot), е́хать/е́здить (by vehicle), бежа́ть/бе́гать, лете́ть/лета́ть, плыть/пла́вать, нести́/носи́ть (carry on foot), вести́/води́ть (lead), везти́/вози́ть (carry by vehicle), брести́/броди́ть, гнать/гоня́ть, кати́ть/ката́ть, лезть/ла́зить, ползти́/по́лзать, тащи́ть/таска́ть | — | Мы идём в библиоте́ку. / Она́ хо́дит в суперма́ркет ка́ждую неде́лю. (WP) | A1 (идти, ходить, ехать, ездить), A2 (лететь, нести, везти) | EN: one verb "go" · SK: Slovak ísť/chodiť matches идти́/ходи́ть, but Slovak ísť also serves for vehicles (ísť autom / vlakom / autobusom) [S20]; Russian needs е́хать | S9, S2, S3 |
| V-29 | Unidirectional uses | Motion in progress in one direction, at a given moment, or on a single trip in progress | Я шла на рабо́ту. Пти́цы летя́т на юг. | — | (WP) | A1 | — | S9 |
| V-30 | Multidirectional uses | Ability or habit; moving around; repeated trips; one completed round trip in the past | Ребёнок хо́дит шесть ме́сяцев. Мы ходи́ли по го́роду весь день. В про́шлом году́ я е́здил в Росси́ю. | — | (WP) | A1 | EN: *Я ехал в Россию for "I went (and came back)" | S9 |
| V-31 | по- + unidirectional = set off | Perfective: the motion starts; the person has not come back | пошёл, пое́хал, полете́л; пойду́, пое́ду | — | Где па́па? Он пошёл на рабо́ту. (WP) | A1 | EN: uses ходил for "has gone" | S9, S2 |
| V-32 | с- + multidirectional = there and back | Perfective, a single round trip | сходи́ть, съе́здить | — | Я сходи́л в апте́ку за лека́рством. (WP) | A2 | — | S9 |
| V-33 | Prefixed motion verbs and their aspect | Prefix + unidirectional stem = perfective; prefix + multidirectional stem = imperfective; the pair loses directionality | прийти́/приходи́ть, уйти́/уходи́ть, вы́йти/выходи́ть, войти́/входи́ть, перейти́/переходи́ть, прие́хать/приезжа́ть, уе́хать/уезжа́ть | идти́ → -йти (прийти́: приду́); е́здить → -езжа́ть; ъ before -е́хать/-езжа́ть (въе́хать, съе́здить); -бега́ть stressed on the ending; пла́вать → -плыва́ть; вы́- is stressed in the perfective (вы́йдешь) | Он прие́хал в Москву́ неде́лю наза́д. (WP) | A1 (при-, по-), A2 (в-, вы-, у-), B1 (all) | EN: *пришёл каждый день (needs приходи́л) | S9, S5 |
| V-34 | The prefixes and their prepositions | Each prefix has a meaning and goes with fixed prepositions | в- "in" (в/на + accusative); вы- "out" (из/с/от + genitive); при- "arrive" (в/на + accusative, к + dative); у- "leave" (из/с/от + genitive); под- "approach" (к + dative); от- "move away" (от + genitive); до- "reach" (до + genitive); за- "drop in, go behind" (в/на + accusative, к + dative, за + accusative); про- "pass, go through" (ми́мо + genitive, через + accusative); пере- "cross, move house" (через + accusative or none); вз-/вс-/вос- "up" (на + accusative); с- "down" (с + genitive); об-/обо- "around" (вокру́г + genitive); раз-…-ся "disperse"; с-…-ся "gather". Examples: Она́ вы́шла из кабине́та. Он подошёл к де́вушке. Мы прошли́ ми́мо ста́нции метро́. Я перее́хала в друго́й го́род. | за- with a multidirectional verb means "begin" (забе́гала); про- with one means "for a while" | По доро́ге домо́й я зашла́ в магази́н за хле́бом. (WP) | A2–B1 | EN: pairs the prefix with the wrong preposition (*вы́шел в до́ма for "came out of the house"; needs из до́ма) | S9 |
| V-35 | Transport | на + prepositional for the vehicle; the instrumental without a preposition is also possible | е́хать на авто́бусе, на по́езде; прие́хали по́ездом | — | Студе́нты е́дут в теа́тр на авто́бусе. (ГОС A1) | A1 | SK: Slovak uses the instrumental (ísť autobusom) [S20], so the learner says *ехать автобусом everywhere; it exists but на авто́бусе is the default | S2, S4, S20 |
| V-36 | Transitive and intransitive pairs | A verb with an object vs the same verb with -ся and с + instrumental | встре́тил бра́та / встре́тился с бра́том | — | Я встре́тился с дру́гом в кафе́. | A2 | EN: *встретил с братом | S3 |
| V-37 | Subjectless они-sentences | The они form with no subject means "people, someone" | Газе́ты продаю́т в кио́сках. Столо́вую откро́ют в 10 часо́в. | — | (ГОС A2) | A2 | EN: adds *они | S3 |
| V-38 | Active present participle | 3rd plural present, -т → -щ-, + adjective ending; imperfective verbs only | де́лают → де́лающий; живу́т → живу́щий; пи́шут → пи́шущий; иду́т → иду́щий | — | Лю́ди, живу́щие в э́том го́роде, о́чень до́брые. (WP) | B1 (recognize), B2 (use) | EN: reads it as a verb | S9, S14, S5, S4 |
| V-39 | Active past participle | Infinitive stem + -вш- (after a vowel) or -ш- (after a consonant) + adjective ending | де́лать → де́лавший; писа́ть → писа́вший; нести́ → нёсший (**not verified**); идти́ → ше́дший | — | Де́вушка, чита́вшая тут кни́гу, забы́ла свой телефо́н. (WP) | B1–B2 | — | S9, S14 |
| V-40 | Passive present participle | 1st plural present + adjective ending; transitive imperfective verbs only | обсужда́ем → обсужда́емый; люби́м → люби́мый; ви́дим → ви́димый | — | обсужда́емый вопро́с | B1–B2 | — | S9, S14 |
| V-41 | Passive past participle, full and short | Perfective stem + -нн- / -енн- or -т-; short forms with -н- / -т- are the passive predicate | написа́ть → напи́санный, напи́сан, напи́сана, напи́сано, напи́саны; сде́лать → сде́ланный; уби́ть → уби́тый, уби́т; дать → да́нный, дан, дана́, дано́, даны́ | full form has -нн-, short form one -н- | План соста́влен И́горем. (ГОС B2) | B1 (short forms), B2 | EN: confuses the short participle with the past tense | S9, S14, S4, S5 |
| V-42 | Verbal adverbs (деепричастия) | Imperfective: present stem + -я (-а after ж ч ш щ); perfective: past stem + -в (-вшись with -ся) or -ши after a consonant | ду́мая, уча́сь, идя́, едя́; сказа́в, научи́вшись, войдя́; бу́дучи "being" | some perfectives take -я: войдя́; придя́ (**not verified**) | Изуча́я тео́рию, на́до по́мнить о пра́ктике. (ГОС B2) | B1 (recognize), B2 | EN: dangling subject · bookish: in speech replaced by two verbs (Я пообе́дал и пошёл гуля́ть) | S9, S4, S5 |

### 3.7 Government and sentence patterns

Sources: S2–S4 (meanings of each case with their examples), S8, S9 (impersonal sentences, negation, word order), S14 (verb government), S15, S12 (который), S20 (Slovak).

**Prepositions and the case each takes** [S2, S3, S4, S9]

| Preposition | Case | Meaning | Example |
|---|---|---|---|
| в, на | accusative | direction "to, into, onto"; time with days and hours (в) | Утром я иду́ в институ́т, на рабо́ту. (ГОС A1) В сре́ду у нас экску́рсия. (ГОС A1) |
| в, на | prepositional | place "in, at, on"; time with months, years, weeks (на прошлой неделе); transport (на) | Мы бы́ли в магази́не, на стадио́не. Друг прие́хал в сентябре́, на про́шлой неде́ле. (ГОС A2) |
| о (об before a vowel, обо in обо мне, обо всём; these variants **not verified** in fetched sources) | prepositional | "about" | Я ча́сто ду́маю о семье́. (ГОС A1) |
| при | prepositional | "in the presence of, during, with the help of" | При чте́нии но́вого те́кста на́до выпи́сывать слова́. (ГОС B2) |
| из, с, от | genitive | "from": из out of в-places, с off на-places, от from a person | Они́ прие́хали из А́нглии. Мы пришли́ с конце́рта. Я пришёл от врача́. (ГОС A2) |
| у | genitive | "at someone's place"; possession | Я был у врача́. У Андре́я есть маши́на. (ГОС A2) |
| без, для, до, после, во вре́мя, из-за, кро́ме, о́коло, ми́мо, среди́, в тече́ние | genitive | "without, for, up to / until, after, during, because of, except, near, past, among, in the course of" | Как дое́хать до па́рка? Он пришёл по́сле обе́да. (ГОС A2) Мы не гуля́ли из-за дождя́. (ГОС B2) |
| к (ко) | dative | "toward, to a person" | Я иду́ к врачу́. (ГОС A1) |
| по | dative | "along, around, by (phone, TV), on (a subject)"; "on (each) …" with plural days | Я иду́ по у́лице. Я ви́дел э́тот фильм по телеви́зору. Это уче́бник по матема́тике. (ГОС A2) По вто́рникам я хожу́ в бассе́йн. (ГОС B2) |
| благодаря́ | dative | "thanks to" | (listed in ГОС B2) |
| с (со) | instrumental | "with, together with" | Оте́ц разгова́ривает с сы́ном. Я люблю́ чай с молоко́м. (ГОС A1) |
| над, под, пе́ред, за, ме́жду, ря́дом с | instrumental | place "above, below, in front of, behind, between, next to" | Ла́мпа над столо́м. Ря́дом с до́мом есть апте́ка? (ГОС A2) Магази́н за угло́м. (ГОС B2) |
| за, под | accusative | direction "behind, under" | Стару́шка зашла́ за угол. (WP) |
| че́рез | accusative | "across; in (time from now)" | Соревнова́ния бу́дут че́рез ме́сяц. (ГОС B2) |
| несмотря́ на | accusative | "despite" | (listed in ГОС B2) |

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| G-1 | Having: у + genitive + есть + nominative | The owner is in the genitive after у; the thing owned is the subject | у меня́, у тебя́, у него́, у неё, у нас, у вас, у них есть …; у бра́та есть … | есть is dropped when the point is a property, not existence (У неё краси́вые глаза́) (**not verified**) | У меня́ есть кни́га. (ГОС A1) | A1 | EN: *Я имею книгу · SK: Slovak mám (a verb "have") [S20]; Estonian mul on matches the Russian shape | S2, S8 |
| G-2 | Not having: нет + genitive | Absence takes the genitive; in the past не́ было, in the future не бу́дет, with no agreement | У меня́ нет бра́та. В го́роде нет теа́тра. (ГОС A1) В го́роде не́ было теа́тра. (ГОС A2) | не бу́дет **not verified** in the fetched sources | У меня́ нет вре́мени. | A1 | EN: *У меня нет брат · SK: Slovak nemám čas uses the accusative, Slovak keeps the negative genitive only in fixed phrases [S20] | S2, S3, S20 |
| G-3 | Genitive after a negated verb | A negated direct object may take the genitive, which makes it indefinite | Я не ви́жу кни́ги "I don't see a book / any book" / Я не ви́жу кни́гу "I don't see the book" | — | Мы не слы́шали уда́ра. (ГОС B2) | B1–B2 | EN: always uses the accusative (fine) or always the genitive (stiff) | S8, S4 |
| G-4 | Dative experiencer | The person who feels, needs, likes or is a certain age goes into the dative; there is no nominative subject | мне хо́лодно, мне ве́село, мне ску́чно, мне на́до, мне ну́жно, мне нра́вится, мне два́дцать лет | — | Мне бы́ло о́чень ве́село. (ГОС A2) | A1 | EN: *Я холодно · SK: Slovak je mi zima has the same shape | S2, S3, S9 |
| G-5 | нра́виться | The thing liked is the subject in the nominative and the verb agrees with it; the person is in the dative | мне нра́вится бале́т; мне нра́вятся э́ти кни́ги (**not verified**); мне понра́вился фильм | — | Андре́ю нра́вится футбо́л. (ГОС A2) | A1 | EN: *Я нравлюсь футбол · SK: Slovak páči sa mi has the same shape, a good bridge | S3, S15 |
| G-6 | Modal words | мо́жно, нельзя́, на́до, ну́жно + dative + infinitive; до́лжен (short adjective) + infinitive; хоте́ть, мочь, уме́ть + infinitive | Мне ну́жно пойти́ в банк. (ГОС A1) Вы должны́ извини́ться пе́ред ним. (ГОС B2) | мочь = be able / allowed; уме́ть = know how | Я не уме́ю води́ть маши́ну. (Zadar) | A1 | EN: *я надо · SK: Slovak musím is a verb; Russian на́до takes the dative | S2, S3, S15 |
| G-7 | ну́жен, нужна́, ну́жно, нужны́ + nominative | "need a thing": the thing is the subject; the short adjective agrees with it | Мне нужна́ кни́га. (ГОС A2) Мне ну́жен слова́рь. | ну́жно + infinitive does not agree | Мне нужны́ де́ньги. | A2 | EN: *Мне нужно книгу | S3, S14 |
| G-8 | Impersonal sentences | No subject: weather, states, the они́ form, a neuter verb | Хо́лодно. Смерка́лось. Меня́ тошни́т. Газе́ты продаю́т в кио́сках. | — | Зимо́й хо́лодно. (ГОС A2) | A1–B1 | EN: adds *это (*Это холодно) | S9, S3 |
| G-9 | меня́ зову́т | The person's name is in the nominative; the person is in the accusative | Меня́ зову́т Ле́на. Как вас зову́т? Ма́льчика зову́т Серге́й. | — | Меня́ зову́т Серге́й. (ГОС A1) | A1 | EN: *Моё имя Лена is possible but bookish · SK: in Slovak volám sa the person is the subject [S20]; in Russian the person is the object (меня́) | S2, S3, S20 |
| G-10 | Verbs and the case they govern | Learn the case with the verb | звони́ть кому́ (dative); помога́ть кому́ (dative); занима́ться чем (instrumental); интересова́ться чем (instrumental); боя́ться чего́ (genitive; colloquially accusative of a person); ждать кого́/что (accusative) or чего́ (genitive: ждать по́езда / по́езд); разгова́ривать с кем; ду́мать о ком; быть, стать, рабо́тать кем (instrumental); смотре́ть что (accusative) | — | Брат занима́ется спо́ртом. Подру́га интересу́ется му́зыкой. (ГОС A2) Ве́чером я звоню́ отцу́. (ГОС A1) | A1–A2 | SK: Slovak čakať na + accusative (*ждать на автобус), zaujímať sa o + accusative (*интересоваться о музыке), myslieť na + accusative (*думать на тебя) [S20]; Slovak venovať sa + dative for "do (sport)" (**not verified**) | S14, S2, S3, S20 |
| G-11 | Instrumental of role | быть (past and future), стать, рабо́тать + instrumental of the role | Бори́с бу́дет инжене́ром. (ГОС A1) Сын ста́нет врачо́м. Бори́с был хоро́шим дру́гом. (ГОС A2) | in the present there is no быть, so the nominative: Брат — врач | Я рабо́таю программи́стом. | A1 | EN: *Он был инженер (possible but less usual) | S2, S3 |
| G-12 | в or на for places | Most places take в; open spaces, events, some institutions and work take на; the "from" preposition mirrors it (из for в, с for на) | в магази́не, в институ́те, в шко́ле, в ба́нке; на рабо́те, на по́чте, на стадио́не, на экску́рсии, на конце́рте, на ле́кции | — | Я на рабо́те. "I'm at work." | A1 | SK: Slovak v práci where Russian has на рабо́те; Slovak na pošte, na koncerte match [S20] | S2, S3, S20 |
| G-13 | Time expressions | Each kind of time phrase has its own case | days, hours: в + accusative (в сре́ду, в два часа́); months, years, childhood: в + prepositional (в сентябре́, в 2001 году́, в де́тстве); weeks: на + prepositional (на про́шлой неде́ле); parts of the day and seasons: instrumental (у́тром, ве́чером, зимо́й); duration: accusative with no preposition (Я живу́ здесь ме́сяц); "in (from now)": че́рез + accusative; "ago": accusative + наза́д; "for (planned period)": на + accusative (на неде́лю); "within, it took": за + accusative (за год); "every": ка́ждый + accusative, по + dative plural (по вто́рникам); dates: genitive (пе́рвого ма́я); "from … to": с + genitive … до + genitive (с утра́ до ве́чера) | — | Студе́нт взял кни́гу в библиоте́ке на неде́лю. Я вы́учил иностра́нный язы́к за год. (ГОС B2) Он прие́хал в Москву́ неде́лю наза́д. (WP) | A1 (days, hours, parts of the day), A2 (months, weeks, че́рез, наза́д), B2 (на, за) | EN: *в понедельнике; *для недели for "for a week" · SK: Slovak o týždeň for "in a week" (**not verified**) | S2, S3, S4, S9 |
| G-14 | Word order | Neutral order: subject group, then predicate group; a place or time phrase can come first; new information goes last | Брат чита́ет. В го́роде есть теа́тр. И́горь верну́лся по́здно ве́чером (answers "when?") / По́здно ве́чером верну́лся И́горь (answers "who?") | adjectives precede the noun; adverbs in -о precede the verb, по-…-ски follow it | (all ГОС A2) | A2 | EN: keeps English order even when it puts the new information first | S2, S3, S9 |
| G-15 | Yes/no questions | Same words as the statement, with ИК-3 on the word asked about; ли after that word in careful or written style | Вы бы́ли в теа́тре? / Зна́ете ли вы? | — | Хорошо́ ли ему́? (Wikt) | A1 (intonation), A2 (ли) | EN: inverts the subject and verb | S13, S14, S3 |
| G-16 | Double negation | Every ни- word needs не before the verb; ни alone can carry the negation | Никто́ не пришёл. Вокру́г никого́ (нет). | — | В ко́мнате никого́ нет. (ГОС B2) | A1 | EN: *Никто пришёл · SK: same as Slovak (Nikto neprišiel.) [S20] | S9, S20 |
| G-17 | Answering yes or no to a negative question | да/нет follow the speaker's assumption, so a full answer is safer | — Ты не пойдёшь? — Нет, не пойду́. / — Да, пойду́. (**not verified**: example made for this file) | — | — | B1 | EN: answers "yes" meaning "yes, I won't" | S9 |
| G-18 | Coordinating conjunctions | и "and", а "and / but (contrast)", но "but", и́ли, ли́бо "or", не то́лько …, но и … "not only … but also" | — | а contrasts two different things: Я до́ма, а он на рабо́те | Он америка́нец, а она́ ру́сская. | A1 | EN: uses и where а is needed | S2, S3, S4 |
| G-19 | Subordinate clauses | что "that", что́бы "so that / to", потому́ что "because", поэ́тому "so", так как "since", е́сли "if", когда́ "when", пока́ "while", пока́ не "until", хотя́ "although", несмотря́ на то что "despite the fact that", по́сле того́ как, до того́ как, пре́жде чем | — | потому́ alone means "therefore", not "because" | Я сказа́л, что Пе́тя сейча́с в теа́тре. (ГОС A1) | A1 (что, потому́ что, когда́), A2 (е́сли, что́бы), B2 (хотя́, так как …) | EN: *потому for "because" | S2, S3, S4, S14 |
| G-20 | кото́рый | Gender and number come from the noun it refers to; the case comes from its role in its own clause | кото́рый, кото́рого, кото́рому, кото́рым, о кото́ром; кото́рая, кото́рую, кото́рой; кото́рые, кото́рых, кото́рым, кото́рыми | — | Мужчи́на, кото́рого вы вчера́ сби́ли, у́мер. Это стра́нное явле́ние, о кото́ром так ча́сто пи́шут в газе́тах … (WP) | A1 (nominative), A2–B1 (all cases) | EN: takes the case from the main clause | S12, S14, S2 |
| G-21 | что́бы | Purpose or wish; + infinitive when the subject is the same; + past form when the subject differs | Он подошёл к де́вушке, что́бы спроси́ть её но́мер. (WP) / Я хочу́, что́бы ты пришёл (**not verified**) | — | Мы прие́хали в Москву́ учи́ться. (ГОС A2, purpose without что́бы) | A2 | EN: *хочу, чтобы ты придёшь | S9, S3 |
| G-22 | Reported speech | Quotes become что-clauses; questions with a question word keep it; yes/no questions take ли; commands take что́бы; the tense of the original is kept | Он спроси́л: «Где Пе́тя?» → Он спроси́л, где Пе́тя. Я сказа́л, что Пе́тя в теа́тре. | — | (ГОС A1, A2) | A1 (что), A2 (ли, что́бы), B2 (all rules) | EN: shifts the tense back (*сказал, что Петя был) | S2, S3, S4 |
| G-23 | Real and unreal conditions | е́сли + indicative for a real condition (future when the future is meant); е́сли бы + past form, and бы in the main clause, for an unreal one | Е́сли бу́дет дождь, мы не пойдём гуля́ть (**not verified**). Е́сли бы у меня́ бы́ло вре́мя, я бы пое́хал. (**not verified**) | — | Вста́в пора́ньше, ты успе́ешь дописа́ть статью́. (ГОС B2, a verbal adverb for a condition) | A2 (е́сли), B1–B2 (е́сли бы) | EN: *Если я бы имел время | S3, S4, S9 |
| G-24 | Generalized "you" | The ты form with no subject means "anyone" | (example **not verified**) | — | — | B1 | — | S5 |

### 3.8 Word formation

Sources: S2–S4 (lists of models per level), S9, S15 (prefixes), S14 (diminutives), S17 (names), S7 § 42, S19 (pleophony).

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| WF-1 | Verb prefixes | A prefix on a non-motion verb either makes the perfective partner (на-, с-, про-, по-) or adds a meaning and makes a new verb | до- "finish" (дочита́ть), пере- "re-" (перечита́ть), за- "write down" (записа́ть), под- "sign" (подписа́ть), вы- (вы́писать), с- "copy" (списа́ть), раз-, из-, от-, о- (B2 list: в-, вы-, за-, до-, из-/ис-, на-, о-, от-, пере-, при-, про-, по-, под-, раз-/рас-, с-, у-) | — | Я дочита́л кни́гу. "I finished reading the book." | A1 (по-, при-, про-), B2 | EN: thinks every prefix makes the pair | S15, S4, S2 |
| WF-2 | Secondary imperfectives | A prefixed perfective makes its own imperfective with -ыва-/-ива- | дочита́ть → дочи́тывать; списа́ть → спи́сывать; рассказа́ть → расска́зывать | — | Он всегда́ спи́сывает. | B1 | — | S15, S4 |
| WF-3 | Diminutive suffixes | Diminutives add smallness or warmth; -ик, -чик, -ок/-ёк for masculine, -ка, -очка/-ечка, -ушка for feminine, -ко, -ышко for neuter (**not verified** as a full list) | мост → мо́стик; стул → сту́льчик; магази́н → магази́нчик; лес → лесо́к; день → денёк; жена́ → жёнушка; ча́сик | — | Дай мне ча́сик отдохну́ть. (**not verified**: example made for this file) | A2 (recognize) | SK: Slovak diminutives are similar (stolík, mamička) and common, a good bridge (**not verified** in S20) | S14 |
| WF-4 | Adjective diminutives -еньк-/-оньк- | Warmth or "nice and …" | ста́ренький, чи́стенький, сла́бенький, лёгонький / лёгенький, хоро́шенький | — | — | A2 (recognize) | — | S7 § 42, S14 |
| WF-5 | People nouns | -тель, -ист, -ник, -ец (m) with -ка, -ица, -ница (f); -анин/-янин with -анка for nationality | учи́тель → учи́тельница; студе́нт → студе́нтка; иностра́нец → иностра́нка; англича́нин | — | Она́ иностра́нка. (after ГОС A1) | A1 | EN: *студентша | S2, S3, S4 |
| WF-6 | Abstract and action nouns | -ость, -ство, -ение/-ание, -ация; the zero suffix from verbs | ра́дость, де́тство, чте́ние, организа́ция; вход, вы́ход | — | Чте́ние те́кста отмени́ли. (ГОС B2) | A2–B2 | — | S3, S4 |
| WF-7 | Adjective suffixes | -н-, -ск-, -ическ-, -ов-/-ев- | го́род → городско́й; Росси́я → росси́йский; ко́фе → кофе́йный | — | городско́й тра́нспорт | A1–A2 | — | S2, S3, S14 |
| WF-8 | Adverb models | -о from adjectives; по- + -ски for languages; по- + -ому/-ему for opinions and ways | бы́стро; по-ру́сски; по-мо́ему, по-сво́ему | — | По-мо́ему, э́то хоро́шая иде́я. | A1–B1 | — | S3, S4 |
| WF-9 | Pleophony: a bridge to Slovak | Many Russian roots have -оро-, -оло-, -ере- where Slovak has -ra-, -la-, -re- | го́род / hrad "castle" (a false friend); голова́ / hlava; бе́рег / breh; молоко́ / mlieko | — | — | A1 | SK: recognizing the pattern unlocks many words (**not verified**: the Slovak forms are not in S19) | S19 |

### 3.9 Register and spoken Russian

Sources: S17, S18, S8, S9, S14 (colloquial words, particles), S2–S4.

| ID | Item | Rule | Forms | Exceptions | Example | Level | Mistakes (EN · SK) | Src |
|---|---|---|---|---|---|---|---|---|
| R-1 | ты and вы | вы is the default with adults you do not know and with anyone older or senior; ты with family, friends, children; Вы is capitalized in letters to one person | быть на ты / на вы; ты́кать, вы́кать (colloquial) | — | Вы не зна́ете, где метро́? | A1 | EN: has no distinction · SK: Slovak tykať / vykať works the same way, a good bridge (**not verified** in S20) | S18 |
| R-2 | Name and patronymic | For older or senior people, and in formal settings, use first name + patronymic; in speech the patronymic shortens | Ива́н Ива́нович → [Ива́н Ива́ныч]; Ма́рья Ива́новна | — | Ма́рья Ива́новна, могу́ я спроси́ть …? (WP) | A1 | EN: uses the first name alone with an older or senior person; S17: leaving out the patronymic there "is considered offensive" | S17 |
| R-3 | Patronymic forms | Father's name + -ович / -овна; -евич / -евна after й or a soft consonant | Ива́н → Ива́нович, Ива́новна; Дми́трий → Дми́триевич, Дми́триевна | — | Серге́й Никола́евич | A2 | — | S17 |
| R-4 | Short names and diminutives | Friends use the short name; -к- forms are familiar or rude; -ечк-/-оньк- forms are tender | Алекса́ндр, Алекса́ндра → Са́ша; Мари́я → Ма́ша, Ма́шенька; А́нна → А́ня, А́нечка, А́нька; Ива́н → Ва́ня; Михаи́л → Ми́ша, Ми́шенька, Ми́шка | some names have no short form (Жа́нна, Марк) | Са́ша, приве́т! | A1 | EN: uses А́нька as neutral | S17 |
| R-5 | Colloquial vocative | See N-22 | Маш! Мам! Ребя́т! | — | Ребя́т, пойдёмте! (WP) | A2 | — | S9 |
| R-6 | Spoken reductions | Fast speech shortens common words; recognize them, do not write them | щас = сейча́с; чё = что; ты́ща = ты́сяча; ва́ще = вообще́; Ива́ныч = Ива́нович | чё is proscribed in standard speech | Ну чё, пойдём? (Wikt) | A2 (recognize), B1 | EN: cannot find щас in a dictionary | S14, S17 |
| R-7 | Particles | Short words that carry attitude | же (contrast, emphasis, "the same": тако́й же), ведь ("after all, you know"), вот ("here is, there"), ну ("well"), ли (question), ра́зве, неуже́ли ("really?"), бы, -то (B2 list) | — | Ведь я вам говори́л! "But I told you!" (Wikt) | A2 (ли, ра́зве, неуже́ли), B1–B2 | EN: drops them, so speech sounds flat · SK: Slovak veď matches ведь (**not verified**) | S14, S3, S4 |
| R-8 | Politeness formulas | Greet, thank, apologize, ask to repeat, say goodbye | здра́вствуйте, приве́т; спаси́бо, пожа́луйста; извини́те / извини́; прости́те / прости́; до свида́ния, пока́ (**not verified**); повтори́те, пожа́луйста | извини́те is the polite one to strangers | Извини́те, пожа́луйста, где метро́? | A1 | EN: uses one word for "sorry" in every register | S2, S14 |
| R-9 | Telephone | Answering, asking for someone, leaving a message | Алло́! Слу́шаю. Говори́те! | — | Говори́те! Я слу́шаю. (HSE test text) | A2 | — | S3, S5 |
| R-10 | Bookish forms | Participles and verbal adverbs belong to writing; in speech a clause with кото́рый or two verbs replaces them | Пообе́дав, я пошёл гуля́ть → Я пообе́дал и пошёл гуля́ть. | — | (WP) | B1–B2 | EN: uses participles in chat | S9 |
| R-11 | Formal writing | B2 asks for official genres | заявле́ние, объясни́тельная запи́ска, дове́ренность, рекоменда́ция | — | — | B2 | — | S4 |

### 3.10 Bridges and false friends for this learner

Sources: S14 (Russian meanings), S21 (Slovak meanings), S20 (zakázať, v pohode), S19.

| ID | Russian | Means | Slovak look-alike | Means | Level | Src |
|---|---|---|---|---|---|---|
| FF-1 | чёрствый | stale (bread); callous | čerstvý | fresh | A2 | S14, S21 |
| FF-2 | ужа́сный | terrible | úžasný | amazing (**not verified**) | A1 | S14 |
| FF-3 | позо́р | shame, disgrace | pozor | attention | A2 | S14, S21 |
| FF-4 | час | hour, o'clock | čas | time (hour = hodina) | A1 | S14, S21 |
| FF-5 | пого́да | weather | pohoda | (v pohode = "fine, relaxed") | A1 | S14, S20 |
| FF-6 | заказа́ть | to order (food, a ticket) | zakázať | to forbid | A1 | S14, S20 |
| FF-7 | о́вощи | vegetables | ovocie | fruit | A1 | S14, S21 |
| FF-8 | я́года | berry | jahoda | strawberry | A2 | S14, S21 |
| FF-9 | пыта́ть | to torture | pýtať (sa) | to ask | B1 | S14, S21 |
| FF-10 | ро́дина | homeland | rodina | family | A2 | S14, S21 |
| FF-11 | живо́т | belly | život | life | A2 | S14, S21 |
| FF-12 | неде́ля | week | nedeľa | Sunday (Russian: воскресе́нье) | A1 | S14, S21 |
| FF-13 | воня́ть | to stink | voňať | to smell nice (**not verified**) | B1 | S14 |
| FF-14 | за́пах | smell, scent | zápach | stench (**not verified**) | A2 | S14 |
| FF-15 | кра́сный | red | krásny | beautiful (Russian: краси́вый) | A1 | S14, S21 |
| FF-16 | магази́н | shop | magazín | magazine (**not verified**) | A1 | S14 |
| FF-17 | жена́ | wife (woman = же́нщина) | žena | woman; wife | A1 | S14, S21 |
| FF-18 | па́лец | finger or toe | palec | thumb, big toe | A2 | S14, S21 |
| FF-19 | рок | fate, doom | rok | year (Russian: год) | A2 | S14, S21 |
| FF-20 | го́род | city | hrad | castle (**not verified**) | A1 | S19 |

### 3.11 Vocabulary themes per level

Sources: S2, S3 (A1, A2 themes and situations), S1 (B1), S4 (B2), S6 (sizes). The A1–B1 lexical minimums are alphabetical lists; their thematic grouping was **not verified**, so the themes below come from the standards.

| Level | Size | Themes and situations the words must cover |
|---|---|---|
| A1 | 780 | greetings and etiquette; yourself (name, age, nationality, study, work, interests); family and friends; your working day and free time; shop, kiosk, ticket desk; post office; bank and exchange; café, restaurant, canteen; library; class; city streets and transport; clinic, doctor, pharmacy; numbers, prices, clock time, days, months; question words; basic adjectives of quality and evaluation |
| A2 | 1300 | all of A1; study and work (workplace, profession); learning languages; daily routine; home town and the capital; health; weather; office and administration; excursions; the telephone; congratulations and wishes; advice, permission, prohibition, promises |
| B1 | 2300 | yourself, work, profession, interests; country and city; culture; news and announcements; opinions and attitudes; texts from newspapers, magazines and books |
| B2 | 10 000 (6000 active) per S1; "a little over 5000" per S6 | personal life, family, work, leisure, man and woman, parents and children, travel, hobbies; society, politics, economy, science, art; nature, ecology, spiritual life, space; bank, insurance, transport, theater, museum, administration, tax office, traffic police; official letters and documents |

### Inventory count

| Area | Items |
|---|---|
| 3.1 Alphabet and sounds (PH-1 to PH-23, plus the 33-letter table) | 23 |
| 3.2 Nouns (N-1 to N-26) | 26 |
| 3.3 Adjectives (ADJ-1 to ADJ-14) | 14 |
| 3.4 Pronouns (PR-1 to PR-13) | 13 |
| 3.5 Numerals (NUM-1 to NUM-13) | 13 |
| 3.6 Verbs (V-1 to V-42) | 42 |
| 3.7 Government and sentence patterns (G-1 to G-24, plus the preposition table) | 24 |
| 3.8 Word formation (WF-1 to WF-9) | 9 |
| 3.9 Register and spoken Russian (R-1 to R-11) | 11 |
| 3.10 False friends (FF-1 to FF-20) | 20 |
| **Total** | **195** |

## 4. Recommended teaching order

Sources: S2–S5 (what each level contains), S16 (how often each case occurs in speech), S15 (aspect), S20 (Slovak).

What frequency says, and what it does not. In spontaneous spoken Russian [S16], nouns appear in the nominative 38.8% of the time, the accusative 21.8%, the genitive 18.1%, the prepositional 9.1%, the instrumental 7.1% and the dative 5%. For the pronouns of the speaker and listener (я, ты, мы, вы) the order is different: nominative 74.2%, dative 10.5% (мне, тебе), genitive 8.5% (у меня), accusative 4.7%. So the prepositional is **not** the most frequent case. It still comes early because it is regular (one ending, -е, for most nouns) and answers "where", which every A1 situation needs. The accusative and the genitive are more frequent and should not wait. The dative pronoun forms (мне нра́вится, мне на́до, мне два́дцать лет) are the second most frequent form of я in speech, so they are taught as chunks from the start.

| Step | Level | Teach | Why here |
|---|---|---|---|
| 1 | A1 | Letters, hard and soft consonants, ь and ъ, stress and its marks, аканье and иканье, final devoicing, ИК-1, ИК-2, ИК-3 | Every later item is read and heard through these; final devoicing and voicing assimilation transfer from Slovak, reduction and free stress do not (S20) |
| 2 | A1 | Это + nominative; gender by ending; мой, моя́, моё, мои́; э́тот; nominative plural with the spelling rule | Gender drives every agreement after this, including the past tense |
| 3 | A1 | The full present of both conjugations (all six persons), the consonant change in the я form, the stress patterns, the A1 verb classes (S2) | The learner's goal is to understand speech, which is mostly он, она, они; the draft teaches only я and ты |
| 4 | A1 | Chunks with pronouns: меня́ зову́т, мне … лет, мне нра́вится, мне на́до / ну́жно / мо́жно / нельзя́, у меня́ есть / нет | Frequent in conversation (S16); they need no declension table yet |
| 5 | A1 | The prepositional of place after в and на (где?), and after о "about"; the в / на choice | Regular, and answers "where"; on its own it is less frequent than the accusative (S16) |
| 6 | A1 | The accusative: objects, animate and inanimate together; в / на + accusative for direction (куда́?); the time phrases в сре́ду, в два часа́ | The most frequent oblique case for nouns (S16); animate objects are needed as soon as the learner talks about people |
| 7 | A1 | The genitive singular: у + genitive, нет + genitive, из / с / от, numbers 2–4, the date in the genitive | Frequent (S16); possession and absence are A1 functions (S2) |
| 8 | A1 | The past tense with gender agreement; был / была́ / бы́ли; не́ было + genitive | A1 in the standard (S2); simple to form; unlocks "what did you do" |
| 9 | A1 | Aspect pairs with the past and the future (бу́ду + imperfective; the perfective future) | The choice first matters in the past and the future, because a perfective has no present (S9) |
| 10 | A1 | идти́ / ходи́ть, е́хать / е́здить, пойти́, прийти́; на + prepositional for transport | A1 in the standard (S2); builds on step 6 (в / на + accusative) |
| 11 | A1 | The dative (к, звони́ть, помога́ть, the person who receives) and the instrumental (с, занима́ться, быть / стать кем) in the singular | A1 meanings in the standard (S2) |
| 12 | A1 | Adjective agreement in the nominative; рад, за́нят, до́лжен, бо́лен; adverbs in -о and по-…-ски | A1 in the standard (S2) |
| 13 | A1 | The imperative of known verbs, ты and вы forms; дава́й(те) | A1 in the standard (S2); the doctor and the café need the вы form |
| 14 | A1 | Numbers with nouns (1; 2–4; 5 and up; 11–14), prices, clock time, age; ordinals in the nominative; dates in the nominative | A1 situations: shop, ticket desk, bank (S2) |
| 15 | A1 | что, потому́ что, поэ́тому, когда́, где, куда́, который (nominative); reported speech with что | A1 in the standard (S2) |
| 16 | A2 | The genitive plural (with fleeting vowels), then the other plural cases | Numbers 5 and up, мно́го, ма́ло and ско́лько all need it |
| 17 | A2 | Adjectives and pronouns in every case; свой, весь, сам, тот; ordinals declined | A2 in the standard (S3) |
| 18 | A2 | The second prepositional in -у́, the partitive | They are exceptions to step 5, so they come after it |
| 19 | A2 | Motion verbs with в-, вы-, у-, по-, при-; лете́ть / лета́ть, нести́ / носи́ть, везти́ / вози́ть, вести́ / води́ть | A2 in the standard (S3) |
| 20 | A2 | Comparatives (the common short forms) and са́мый | A2 in the standard (S3); needed to compare cities and prices |
| 21 | A2 | е́сли, что́бы, ли, ра́зве, неуже́ли; indirect questions; the они́ sentence with no subject | A2 in the standard (S3) |
| 22 | A2 | Time phrases: months, years, на про́шлой неде́ле, че́рез, наза́д; dates in the genitive; the telephone | A2 situations and themes (S3) |
| 23 | A2 | Aspect in commands (не + imperfective), нельзя́ with each aspect, verbs that take only one aspect | Needs the aspect pairs of step 9 and the imperative of step 13 |
| 24 | B1 | All prefixed motion verbs and their aspect pairs | B1 topic (S5) |
| 25 | B1 | Participles and verbal adverbs for reading; short passive participles | B1 topic (S5); news and written texts start at B1 (S1) |
| 26 | B1 | The conditional with бы and е́сли бы; concession with хотя́ | B1 topic (S5) |
| 27 | B1 | -то, -нибудь; не́кого, не́чего; который in every case; что́бы + past | B1 grammar and reading (S5) |
| 28 | B1 | Name and patronymic in use, particles, spoken reductions, the colloquial vocative | The learner's goal is speech with friends and family; these are what native speech sounds like |
| 29 | B2 | Participles and verbal adverbs in use; turning them into который and other clauses | B2 standard (S4) |
| 30 | B2 | The B2 case meanings (из-за, от радости, за год, на неделю, по вторникам, поездом); prepositions благодаря́, несмотря́ на, в тече́ние | B2 standard (S4) |
| 31 | B2 | ИК-5, ИК-6, ИК-7; кое-; formal letters and statements | B2 standard (S4) |

## 5. Audit of the current Russian content

Files read (not edited): `C:\Users\Stream\Projects\langharness\data\languages\russian\course.json` (marked `"draft": true`), `C:\Users\Stream\Projects\langharness\data\languages\russian\world.json`, and `src/agent/prompts/language/10-russian.md`. Sources: S2–S5 (levels), S7–S9, S14, S15 (rules and forms), S20–S23 (Slovak, places).

### 5.1 Unit rules in course.json

| # | Unit | Quoted line | Problem | Correction | Source |
|---|---|---|---|---|---|
| 1 | `accusative-object` | "For a direct object, nouns in -а/-я switch to -у/-ю, while inanimate masculine and neuter nouns stay the same: я читаю книгу." | Incomplete in the way that matters most. Animate masculine nouns take the genitive form (ви́жу бра́та, люблю́ отца́), and so do all animate plurals (люблю́ дете́й). The chapter this unit serves, "People You Love", is about loving and missing people. Feminine -ь nouns stay the same (люблю́ мать) and are not mentioned. | "Feminine nouns in -а/-я take -у/-ю. Inanimate masculine and neuter nouns, and feminine nouns in -ь, stay the same. Animate masculine nouns, and every animate plural, take the genitive form: я люблю́ бра́та." | S8, S2 |
| 2 | `past-tense` | "For most verbs, drop -ть and add -л (he), -ла (she), -ло (it) or -ли (they): она читала." | Misleading. The endings show the gender and number of the subject in every person, not "he/she/it/they": a woman says я чита́ла, a man я чита́л; мы, вы and они́ all take -ли. The irregular pasts (шёл, мог, нёс, ел, у́мер) and the reflexive -лся/-лась are missing. | "Drop -ть and add -л for a masculine subject, -ла for a feminine one, -ло for a neuter one, -ли for any plural, with every person: я (a woman) чита́ла." List the irregulars of V-13. | S9 |
| 3 | `imperative-informal` | "Informal commands usually end in -й after a vowel and -и or -ь after a consonant: читай, скажи." | Gives no way to choose between -и and -ь. The chapter it serves, "At the Doctor", is a talk with a doctor, who uses the вы form (Отдыха́йте, пе́йте чай), which the unit does not teach. | "Start from the present stem. After a vowel add -й (чита́й). After a consonant add -и when the я form is stressed on the ending or the stem ends in two consonants (скажу́ → скажи́), otherwise -ь (ве́рить → верь). Add -те for вы. Irregular: дава́й, дай, ешь, пей, поезжа́й, ляг, будь." Teach the вы form in the same unit. | S9, S14 |
| 4 | `prepositional-place` | "After в, на or о, most nouns end in -е; nouns in -ия and feminine nouns in -ь take -и: в городе." | Incomplete. Nouns in -ие and -ий also take -ии (в зда́нии, о коммента́рии). Neuter -мя nouns take -мени (о вре́мени). The second prepositional in stressed -у́ (в лесу́, в саду́, на берегу́, в аэропорту́, в году́) is missing, and Slovak v lese pulls the learner toward *в лесе. The plural (-ах/-ях) is never taught. о means "about", not "where", so the title "Where something is" does not fit it. There is no rule for в or на (на рабо́те, на по́чте). | Add the -ии and -мени forms, the -у́ list, and the в / на choice; teach о as "about" separately or label it. | S8, S9, S14, S2 |
| 5 | `genitive-singular` | "After у, нет, без, из or для, masculine and neuter nouns take -а/-я, nouns in -а/-я take -ы/-и: у брата, нет воды." | Incomplete. Feminine -ь nouns take -и (у ма́тери); -мя nouns -мени (нет вре́мени); -ия nouns -ии. The spelling rule after г к х ж ч ш щ (кни́ги, not *книгы) is not stated. The chapter promises the genitive plural, and no unit teaches it. | Add the -ь, -мя and -ия lines and the spelling rule; add a genitive plural unit (N-15 to N-18). | S8, S7 |
| 6 | `dative-singular` | "After к and по, masculine and neuter nouns take -у/-ю, most nouns in -а/-я take -е: к брату, по улице." | The main uses of the dative are missing. These are the person who receives (звони́ть отцу́, помога́ть ма́ме, дать бра́ту) and the person who feels or needs (мне нра́вится, мне на́до). Both are A1 meanings in the standard, and the chapter beat is "who he does things for". Feminine -ь nouns take -и (к ма́тери); -ия nouns -ии. | Lead with "to whom": Я звоню́ отцу́ (ГОС A1); then к and по; add the -ь and -ия endings. | S2, S8 |
| 7 | `instrumental-singular` | "After с 'with', masculine and neuter nouns take -ом/-ем, nouns in -а/-я take -ой/-ей: с братом, с мамой." | Incomplete. Feminine -ь nouns take -ью (с ма́терью). After ж ч ш щ ц the ending is -ем/-ей when unstressed (с ме́сяцем) and -о́м/-о́й when stressed (с отцо́м). The instrumental without a preposition (занима́ться спо́ртом, быть / стать врачо́м) is A1 in the standard. The unit's trigger list includes за, под, над, пе́ред, ме́жду, but the rule mentions only с. | Add -ью, the spelling rule, the verbs and the place prepositions. | S2, S3, S8, S7 |
| 8 | `short-adjectives` | "Short adjectives serve as the predicate and agree in gender and number: он готов, она готова." | Right rule, wrong level. The draft puts it at B1, but рад, за́нят, до́лжен, бо́лен are A1 and гото́в is A2 in ТРКИ. The draft's own A1 unit `infinitive-after-modal` lists до́лжен and должна́ as triggers, so learners meet the form two stages before the rule. Stress shifts (занята́) and the inserted е (бо́лен, ну́жен) are not mentioned. | Move to A1 with рад, за́нят, до́лжен, бо́лен; give the four forms of each. | S2, S3, S14 |
| 9 | `plural-nominative` | "Masculine and feminine nouns usually take -ы or -и in the plural, neuter nouns -а or -я: столы, окна." | Incomplete. Missing: the spelling rule (кни́ги), stressed -а́ (города́, дома́, глаза́), -ья (бра́тья, друзья́, сту́лья, сыновья́), лю́ди and де́ти, -анин → -ане, имена́, and the stress shift (окно́ → о́кна, which the example itself shows without saying). | Add N-12 to N-14. | S8, S14 |
| 10 | `infinitive-after-modal` | "After хочу, могу, можно, надо, нужно or нельзя, use the infinitive: мне надо работать." | True, but it mixes two structures without saying so. хочу́ and могу́ have a nominative subject; мо́жно, на́до, ну́жно, нельзя́ take the person in the dative (мне). нельзя́ means "not allowed" with an imperfective and "impossible" with a perfective. | Split: "я хочу́ / могу́ + infinitive"; "мне на́до / ну́жно / мо́жно / нельзя́ + infinitive"; add the aspect note. | S15, S2 |
| 11 | `present-i` | "For 'I', present-tense verbs end in -ю or -у: я знаю." | True but thin. The я form is where stress shifts and consonants change (люблю́, хожу́, пишу́, могу́); the irregulars ем, дам, хочу́, бегу́ are not mentioned. No unit teaches он, мы, вы, они́ at all. | Teach the full table (V-1 to V-5) in one or two units. | S9, S14 |
| 12 | `present-you` | "For informal 'you', present-tense verbs end in -ешь or -ишь (-ёшь when stressed): ты знаешь." | Correct, but which verbs take -ишь is not said; the irregulars ешь, дашь, хо́чешь, бежи́шь are not mentioned. | Name the second conjugation (V-2). | S9 |
| 13 | `instrumental-plural` | "In the instrumental plural, almost all nouns end in -ами or -ями: с друзьями." | Correct; the exceptions should be named (людьми́, детьми́, дочерьми́). It is the only plural case after the nominative that the draft teaches, and it sits at B1. | Teach the plural cases together at A2, genitive plural first. | S8 |
| 14 | `future-i` | "For 'I will', a perfective verb takes present-type endings (я сделаю); an imperfective verb uses буду + infinitive." | Correct. Add the commonest error: бу́ду never goes with a perfective (*буду сделать). | — | S9 |

### 5.2 Word lists, tutor briefs and goals

| # | Where | Quoted line | Problem | Correction | Source |
|---|---|---|---|---|---|
| 15 | `lx-words-connectors` | lemmas include "потому"; tagline "because, so, then" | потому́ alone means "therefore"; "because" is потому́ что | Replace the lemma with потому́ что | S14 |
| 16 | `lx-words-motion` "Coming and going" | lemmas "идти, пойти, вернуться, уйти, остаться, найти, взять, дать" | найти́, взять, дать are not motion verbs; е́хать, ходи́ть, е́здить, which ТРКИ A1 requires, are missing | Swap them | S2 |
| 17 | `lx-words-greetings` | "привет, здравствуйте, спасибо, пожалуйста, да, нет, ладно, прости, алло, увидимся" | The A1 intents are greet, say goodbye, apologize, ask to repeat (S2). извини́те, до свида́ния and повтори́те are missing; прости́ is the informal form only | Add извини́те, до свида́ния, повтори́те, пожа́луйста | S2, S14 |
| 18 | `lx-words-people`, `lx-words-body` | "господин", "доктор"; "кровь", "смерть" | The doctor scene needs врач, the word the standards use (Я иду́ к врачу́; Я был у врача́). господи́н is a formal address, not a basic A1 word (**not verified** against the A1 lexical minimum). кровь and смерть look like film-subtitle frequency, not health vocabulary; the A2 standard uses У меня́ боли́т голова́, У ребёнка температу́ра | Add врач, боле́ть, температу́ра, апте́ка, лека́рство | S2, S3 |
| 19 | `tutor-soft-hard` | "how я, е, ё, ю, и soften the consonant before them" | Not after ж ш ц, which stay hard; ч щ are always soft. A drill built on the line as written will produce false pairs | Add the exception (PH-1) | S7, S10 |
| 20 | `tutor-stress` | "how unstressed о and е change sound" | а and я reduce too (PH-6, PH-7) | Add them | S10 |
| 21 | `tutor-numbers` | "how the noun form changes after один, два to четыре, and пять and up" | 11–14 take the genitive plural, and compound numbers follow their last word (два́дцать одна́ кни́га, два́дцать две кни́ги, два́дцать пять книг). A Slovak speaker will put 2–4 with the nominative plural (dva stoly) | Add both, and name the Slovak trap | S8, S20 |
| 22 | `tutor-phone` | placed at B1 ("If Only") | The telephone is an A2 situation in the standard | Move to A2 | S3 |
| 23 | goal `can-describe-home` | scene "hotel" | The hotel scene is a check-in; no scene has the learner describe a home (world.json lists "Describing your flat to a landlord over the phone" but has no scene for it) | Add a landlord scene or change the goal | world.json |
| 24 | `lx-words-family` tagline; `tutor-names` brief | "mum, dad and the rest"; "so I practise addressing them" | British spelling; the app uses American English | "mom", "practice" | project rule |

### 5.3 Chapter taglines that promise grammar no unit teaches

| Chapter | Tagline | Units in the chapter | What is missing |
|---|---|---|---|
| `things-around` (A1) | "adjective gender and plurals" | plural-nominative, tutor-soft-hard, words, goal | No unit teaches noun gender or adjective agreement; the draft has no adjective unit at all |
| `how-much` (A2) | "genitive singular and plural" | genitive-singular, tutor-numbers, goal | No genitive plural unit; "five apples" cannot be practiced |
| `if-only` (B1) | "conditional with бы" | tutor-phone, goal | No unit; tutor-phone touches only polite бы; the chapter beat ("what they would do if they had a free month") needs е́сли бы |
| `better-or-worse` (B1) | "comparatives and short adjectives" | short-adjectives, words, tutor-opinions, goal | No comparative unit; the beat compares two cities |
| `going-places` (A2) | "aspect, future, motion verbs" | tutor-aspect, future-i, words, tutor-motion, goal | Aspect and motion verbs exist only as tutor sessions, so nothing is measured |
| `in-the-news` (B2), `telling-stories` (B2) | "active and passive participles"; "adverbial participles" | tutor-written-style; tutor-storytelling | Tutor sessions only |
| `at-the-doctor` (A2) | "informal imperative" | imperative-informal, words, goal | Not missing, but mismatched: the doctor speaks with вы, so the scene needs the вы imperative |

### 5.4 Levels that differ from ТРКИ

| Topic | Draft stage | ТРКИ level | Source |
|---|---|---|---|
| Past tense | A2 (`yesterday`) | A1 | S2 |
| Genitive (у, нет, из, numbers 2–4) | A2 | A1 | S2 |
| Dative and instrumental, basic meanings | A2 | A1 | S2 |
| Aspect, the future | A2 | A1 | S2 |
| Imperative | A2 | A1 | S2 |
| идти́ / ходи́ть, е́хать / е́здить, пойти́, прийти́ | A2 | A1 | S2 |
| Short adjectives (рад, за́нят, до́лжен, бо́лен) | B1 | A1 (гото́в A2) | S2, S3 |
| Comparatives | B1 | A2 (common forms) | S3 |
| The telephone | B1 | A2 | S3 |
| Participles, verbal adverbs | B2 | B1 for reading, B2 for use | S5, S4 |
| Instrumental plural | B1 | the standards list the whole case system from A1 and do not split singular and plural; the problem is that no other plural case is taught | S2, S3 |

### 5.5 Grammar the ТРКИ A1–A2 standards require and no unit teaches

The present tense for он, она́, мы, вы, они́; the second conjugation as a pattern; noun gender; adjective agreement; possessives (мой, твой, наш, ваш, его́, её, их) and свой; personal pronouns in the cases (меня́, мне, у него́); у меня́ есть / нет + genitive; numbers as words and with nouns (only a tutor session); clock time, dates, age; the genitive plural; every other plural case; reflexive verbs in -ся; motion verbs with в-, вы-, у-; нести́, везти́, лете́ть; the second prepositional; comparatives; который; что, что́бы, е́сли, ли as clause words; reported speech; time phrases (че́рез, наза́д, в + month); the spelling rules [S2, S3].

### 5.6 world.json: places and names

| Item | Verdict | Evidence |
|---|---|---|
| улица Баумана, "the pedestrian street" | Real. The main, partly pedestrian street of the historic center, a pedestrian zone since 1996 | S22 |
| Казанский Кремль, "Kul Sharif Mosque and the Annunciation Cathedral" | Real; both stand inside the Kremlin (cathedral 1554–1562; mosque opened 24 June 2005) | en.wikipedia.org/wiki/Kazan_Kremlin |
| "The legend of the leaning Söyembikä Tower in the Kremlin" | Real; the tower leans (about 194 cm by the early 20th century) | S23 |
| парк Чёрное озеро | Real; a park and listed heritage site in the center (Вахитовский район) | S22 |
| Центральный рынок | Real; ОАО «Центральный рынок города Казани», since 1961, on ул. Мартына Межлаука; the transport stop is called «Колхозный рынок» | S22 |
| вокзал Казань-Пассажирская | Real; the main station (former name «Казань») | S22 |
| Старо-Татарская слобода | Real | S22 |
| "metro station Kremlyovskaya" | Real; «Кремлёвская», opened 27 August 2005. The Kazan metro has one line of 11 stations | S22 |
| "The Temple of All Religions on the outskirts of Kazan" | Real; Вселенский храм in Старое Аракчино, a part of Kazan | S22 |
| "The island town of Sviyazhsk"; scene `station`: "Buy a train ticket to Sviyazhsk" | Misleading. Свияжск is a village (село) on an island, joined to the shore by a causeway (2008) that has had a canal and bridge since 2011. Свияжск railway station is 8.5 km west, in Нижние Вязовые, so the train ticket gets you to the station, not the island; boats also run. | S22 |
| "A business trip by train to Innopolis" | Wrong. No train was found; Innopolis is about 40 km from Kazan and reached by bus (route 108, from the «Восточный» bus station) or by car | S23 |
| "Registering at the multifunctional centre on Kremlyovskaya Street" | **not verified**, probably wrong. Search found Kazan МФЦ «Мои документы» offices on ул. Кулахметова, 25к1 and ул. Победы, 100, none on Кремлёвская | S23 |
| "Getting a library card at the National Library of Tatarstan" | Real; since 2020 at ул. Пушкина, 86 (its old building is on Кремлёвская) | S23 |
| "a small hotel on Kremlyovskaya Street", "the main post office" | Кремлёвская улица is real; specific buildings not checked | S23 |
| Ildar's café, Galina Petrovna's flat, the gymnasium, the office | Fictional, not presented as real; fine | — |
| Names: Артём, Мари́на, Гали́на Петро́вна, Ильда́р, Али́я, Серге́й Никола́евич | Well formed; the patronymics follow -овна / -евич (S17). Ильдар and Алия as Tatar names: **not verified** | S17 |
| Spelling | "centre" (twice), "cosy", "neighbour", "neighbours", "roubles", "theatre" are British; the app uses American English: center, cozy, neighbor(s), rubles, theater | project rule |

### 5.7 The tutor doctrine (`src/agent/prompts/language/10-russian.md`)

| # | Quoted line | Problem | Correction | Source |
|---|---|---|---|---|
| D1 | `Mark stress with an acute accent (зáмок / замóк) on new words and wherever stress is the point; it is a learner aid, not standard spelling.` | The two stress marks are Latin letters: á is U+00E1 (LATIN SMALL LETTER A WITH ACUTE) and ó is U+00F3, inside Cyrillic words (checked with a script on the file). A model copying the example will write mixed-script words; search, the lexicon lookup and text-to-speech treat them as different letters. The second half is also wrong: the 2006 rules make consistent stress marks the norm for texts for learners of Russian (§ 116). | Write the Cyrillic vowel followed by U+0301 COMBINING ACUTE ACCENT: за́мок / замо́к. "Mark stress on every word of two or more syllables in teaching text, as the spelling rules require for learner texts; never on ё." | S7 § 116; Unicode chart U+0300–U+036F, https://www.unicode.org/charts/PDF/U0300.pdf (not fetched) |
| D2 | `If the learner types in transliteration or without ё, treat it as a spelling matter separate from grammar` | Nothing tells the tutor to write ё itself. The 2006 rules require ё consistently in learner texts (§ 5); without it, все / всё and other pairs are ambiguous | Add: "Always write ё in your own Russian." | S7 § 5 |
| D3 | `Another Slavic language … shares most of the grammar: six cases, aspect pairs, motion verbs (идти/ходить = ísť/chodiť).` | The "=" misleads: Slovak ísť also covers vehicles (ísť autobusom); Russian needs е́хать / е́здить. The section names stress, reduction, the alphabet and the missing auxiliary, but not the traps that cost a Slovak speaker most: 2–4 + genitive singular (Slovak takes the nominative plural); нет + genitive (Slovak nemám čas takes the accusative); у меня́ есть (Slovak mám); мне на́до / мо́жно with the dative (Slovak musím, môžem); на рабо́те (Slovak v práci); ждать with no preposition (Slovak čakať na); ду́мать о (Slovak myslieť na); ы (Slovak y sounds like i) | List these as the Slovak traps | S20, S8 |
| D4 | `Estonian … предложный падеж after в/на ↔ seesütlev (-s) / alalütlev (-l); творительный ↔ kaasaütlev (-ga) …; дательный ↔ alaleütlev (-le); "у меня есть" ↔ "mul on"` | The Estonian side was **not verified** in this research. On the Russian side the bridge leaves out о + prepositional "about", which has no -s / -l counterpart, and the instrumental of role (быть врачо́м). | Add "о + prepositional means 'about'; the bridge does not cover it" | S2 |
| D5 | `False friends … чёрствый (stale) vs Slovak čerstvý (fresh), ужасный (terrible) vs úžasný (amazing), позор (shame) vs pozor (attention), час (hour) vs čas (time).` | Correct on the Russian side (úžasný **not verified**); the list stops at four. | Add the FF table (заказа́ть / zakázať, о́вощи / ovocie, неде́ля / nedeľa, кра́сный / krásny, жена́ / žena, ро́дина / rodina …) | S14, S21 |
| D6 | `from A1 toward B1 unless the probe or the learner sets another target` | The course draft has two B2 chapters; the doctrine's default ceiling is B1 | Make the two agree | course.json |
| D7 | `Prepositions that take a vowel depend on the next word: с → со, в → во, к → ко …; о → об before a vowel (об этом) and обо in обо мне, обо всём.` | Correct as far as it goes (**not verified** independently). The gap-sentence section does not warn about the endings that most often break a frame: the second prepositional (в лесу́), 2–4 + genitive singular, and the и / ы and о / е spelling rules | Add these three checks to "Building a gap sentence" | S7, S8, S9 |

## 6. Not verified

Everything marked **not verified** above, collected:

- The ТРКИ-1 (B1) state standard itself; B1 content comes from the HSE program built on it (S5).
- The thematic grouping of the A1, A2 and B1 lexical minimums.
- Example sentences made for this file and marked so (ADJ-13, WF-3, G-17, G-21, G-23, V-17); PH-22 and G-24 have no example.
- Forms: вечера́, поезда́, учителя́; нове́е; the stress of интереснейший and краси́вейший; тре́тий's declension; полторы́; жить's imperative and past; спа́ло, на́чало, по́няло; нёсший; придя́; помоги́; узнава́ть; гнать's forms; не бу́дет + genitive; мне нра́вятся; не́кем, не́ с кем, не́чего, не́чему, не́чем; часы́ "watch"; без че́тверти, че́тверть шесто́го, в полови́не шесто́го.
- Rules: the genitive or чем after a comparative (ADJ-8); ско́лько with singular or plural; н- not added before the possessive его́; мой beside свой in the first person; дава́й + perfective infinitive being wrong; есть dropped for a property; Дом стро́ится as a -ся passive; об / обо before vowels.
- Slovak: hora / гора and the h / г correspondence; kníh, okien; v lese; svoj; the Slovak -iť / -ieť and -ovať correspondences; šiel, mohol; diminutives; tykať / vykať; veď; venovať sa; o týždeň; úžasný, voňať, zápach, magazín, hrad.
- Estonian: every case name and bridge in the doctrine (D4).
- world.json: an МФЦ on Кремлёвская улица; Tatar origin of Ильдар and Алия; the hotel and post office buildings.

