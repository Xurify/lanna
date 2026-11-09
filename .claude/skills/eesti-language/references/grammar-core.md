# Estonian Grammar Core

A token-minimized reference for the foundational architecture of the Estonian language.

## 1. The 14 Cases (Käänded)

Estonian has 14 productive cases. There is no accusative or dative case; accusative functions are divided between nominative, genitive, and partitive, while dative functions are served by the allative (*alaleütlev*) or adpositional phrases.

| Case | Estonian Name | Question | Sg. Ending | Pl. Ending | Primary Function | Example (*maja* "house") | Example (*tuba* "room") |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Nominative | Nimetav | Kes? Mis? | — | *-d* | Subject, dictionary form, total object in plurals & imperatives | *maja / majad* | *tuba / toad* |
| 2. Genitive | Omastav | Kelle? Mille? | vowel | *-de / -te* | Possession, total object in singular, pre-adposition stem | *maja / majade* | *toa / tubade* |
| 3. Partitive | Osastav | Keda? Mida? | *-d / -t / -d / vowel* | *-sid / -id / -e / -i / -u* | Partial object, negative object, numbers > 1, open quantity | *maja / maju* | *tuba / tube* |
| 4. Illative | Sisseütlev | Kellesse? Kuhu? | *-sse* (short form: *-de, -he, -vowel*) | *-desse / -tesse / -isse* | Movement into (interior destination) | *majasse* | *tuppa* (short) |
| 5. Inessive | Seesütlev | Kelles? Kus? | *-s* | *-des / -tes / -is* | State inside (interior location) | *majas / majades* | *toas / tubades* |
| 6. Elative | Seestütlev | Kellest? Kust? | *-st* | *-dest / -test / -ist* | Movement out of, topic ("about") | *majast / majadest* | *toast / tubadest* |
| 7. Allative | Alaleütlev | Kellele? Kuhu? | *-le* | *-dele / -tele / -ile* | Movement onto, recipient (indirect object) | *majale / majadele* | *toale / tubadele* |
| 8. Adessive | Alalütlev | Kellel? Kus? | *-l* | *-del / -tel / -il* | State on top of, possession (*mul on*) | *majal / majadel* | *toal / tubadel* |
| 9. Ablative | Alaltütlev | Kellelt? Kust? | *-lt* | *-delt / -telt / -ilt* | Movement off of, source of information | *majalt / majadelt* | *toalt / tubadelt* |
| 10. Translative | Saav | Kelleks? Milleks? | *-ks* | *-deks / -teks / -iks* | Change of state, purpose, deadline ("by Monday") | *majaks / majadeks* | *toaks / tubadeks* |
| 11. Terminative | Rajav | Kelleni? Milleni? | *-ni* | *-deni / -teni / -ini* | Limit in space or time ("up to, until") | *majani / majadeni* | *toani / tubadeni* |
| 12. Essive | Olev | Kellena? Millena? | *-na* | *-dena / -tena / -ina* | State/role as ("as a teacher") | *majana / majadena* | *toana / tubadena* |
| 13. Abessive | Ilmaütlev | Kelleta? Milleta? | *-ta* | *-deta / -teta / -ita* | Absence ("without") | *majata / majadeta* | *toata / tubadeta* |
| 14. Comitative | Kaasaütlev | Kellega? Millega? | *-ga* | *-dega / -tega / -iga* | Accompaniment, instrument/tool | *majaga / majadega* | *toaga / tubadega* |

---

## 2. The Three Base Forms (Kolm põhivormi)

Almost all 14 cases are derived deterministically from three principal nominal forms:
1. **Nominative singular (*ainsuse nimetav*)**: Dictionary form.
2. **Genitive singular (*ainsuse omastav*)**: Forms the base for:
   - All singular oblique cases (cases 4–14 in the singular): stem + ending (`toa + s = toas`, `toa + le = toale`, `toa + ga = toaga`).
   - Nominative plural: genitive stem + *-d* (`toa + d = toad`).
   - Genitive plural in regular declensions: stem + *-de* (`toa + de = toade` / `tuba + de = tubade`).
3. **Partitive singular (*ainsuse osastav*)**: Distinct stem used for:
   - Partitive objects and counting with numerals.
   - Partitive plural and short illatives in certain paradigms.

---

## 3. Spatial Case System (Kohakäänded)

Estonian organizes 6 spatial cases into two parallel 3-way triads:

| Direction / State | Question | Internal (*Sisekohakäänded*) | External (*Väliskohakäänded*) |
| --- | --- | --- | --- |
| **Destination** ("Whither?") | *Kuhu?* | **Illative** (*-sse* / short form): *linna*, *kooli* | **Allative** (*-le*): *tänavale*, *lauale* |
| **Location** ("Where?") | *Kus?* | **Inessive** (*-s*): *linnas*, *koolis* | **Adessive** (*-l*): *tänaval*, *laual* |
| **Source** ("Where from?") | *Kust?* | **Elative** (*-st*): *linnast*, *koolist* | **Ablative** (*-lt*): *tänavalt*, *laualt* |

- **Settlements**: Most Estonian towns use internal cases (*Tallinnas, Tartus, Pärnus, Narvas, Viljandis*), but some use external cases by historical convention (*Tapal, Elvas, Otepääl, Sauel, Keilas, Sillamäel*). Foreign countries usually take internal (*Soomes, Rootsis*; *Inglismaal* takes external because of *-maa*).

---

## 4. Verb Architecture & 4 Principal Forms

Estonian verbs have no future tense inflection (the present tense + context or particle verbs expresses future) and no Slavic-style verbal aspect prefixes. Aspect is handled primarily via object marking and particle verbs.

Every verb is governed by 4 basic forms:
1. ***ma*-infinitive**: The dictionary lemma (`lugema` "to read"). Base for:
   - Motion goals: *lähen lugema* ("I am going to read").
   - Action initiation: *hakkama* + *ma* (`hakkab sadama` "it starts raining").
   - Inflected *ma*-forms: *-mas* (in-progress), *-mast* (from doing), *-mata* (without doing), *-maks* (in order to do).
2. ***da*-infinitive**: (`lugeda`). Base for:
   - Modals and ability: *saama, võima, oskama, suutma, tahtma* (`ma oskan ujuda`, `ma tahan lugeda`).
   - Impersonal statements: *on vaja teha*, *on raske õppida*.
3. **1st Person Present (*olevik*)**: (`loen`). Weak/strong stem for present indicative conjugation.
4. **3rd Person Simple Past (*lihtminevik*)**: (`luges`). Past indicative stem.

---

## 5. Total vs. Partial Object (Täissihitis vs. Osasihitis)

The object form encodes whether an action is completed/bounded or ongoing/partial:

```
                  ┌───────────────────────────────┐
                  │ Is the sentence NEGATIVE?     │
                  └───────────────┬───────────────┘
                                  │
                   YES ───────────┴─────────── NO
                    │                           │
                    ▼                           ▼
          PARTITIVE OBJECT             Is the action unfinished,
         (Ma ei lugenud raamatut)      ongoing, unbounded, or on
                                       an indefinite amount?
                                                │
                                 YES ───────────┴─────────── NO
                                  │                           │
                                  ▼                           ▼
                        PARTITIVE OBJECT              TOTAL OBJECT (Täissihitis)
                       (Loen raamatut)               ┌────────────────────────┐
                                                     │ Plural? -> Nominative  │
                                                     │ (Ostsin raamatud)      │
                                                     │ Imperative? -> Nom.    │
                                                     │ (Loe see raamat!)      │
                                                     │ Singular? -> Genitive  │
                                                     │ (Ostsin raamatu)       │
                                                     └────────────────────────┘
```

---

## 6. Word Order & Negation

- **Standard Order**: V2 (Verb-Second) in neutral declarative clauses:
  - *Mees ostis eile poest leiba.* (S-V-Adv-Adv-O)
  - *Eile ostis mees poest leiba.* (Adv-V-S-Adv-O)
- **Existential Clauses**: Location + Verb (*on*) + Subject:
  - *Laual on raamat.* ("There is a book on the table.") vs. *Raamat on laual.* ("The book is on the table.")
- **Possession Clause**: Possessor in Adessive + *on* + Possessed item:
  - *Mul on kass.* ("I have a cat.")
  - *Mul ei ole kassi.* ("I do not have a cat." — possessed entity in partitive!).
- **Negation**: Auxiliary *ei* + connegative verb stem:
  - Present: *ma ei loe* (stem from *loen* minus *-n*).
  - Past: *ma ei lugenud* (*ei* + *-nud* participle).
  - Perfect: *ma ei ole lugenud*.
