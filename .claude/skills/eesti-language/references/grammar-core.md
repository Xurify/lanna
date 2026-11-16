# Estonian Grammar Core

A token-minimized reference for the foundational architecture of the Estonian language.

## 1. The 14 Cases (Käänded)

Estonian has 14 productive cases. There is no accusative or dative case; accusative functions are divided between nominative, genitive, and partitive, while dative functions are served by the allative (_alaleütlev_) or adpositional phrases.

| Case            | Estonian Name | Question          | Sg. Ending                              | Pl. Ending                  | Primary Function                                                | Example (_maja_ "house") | Example (_tuba_ "room") |
| --------------- | ------------- | ----------------- | --------------------------------------- | --------------------------- | --------------------------------------------------------------- | ------------------------ | ----------------------- |
| 1. Nominative   | Nimetav       | Kes? Mis?         | —                                       | _-d_                        | Subject, dictionary form, total object in plurals & imperatives | _maja / majad_           | _tuba / toad_           |
| 2. Genitive     | Omastav       | Kelle? Mille?     | vowel                                   | _-de / -te_                 | Possession, total object in singular, pre-adposition stem       | _maja / majade_          | _toa / tubade_          |
| 3. Partitive    | Osastav       | Keda? Mida?       | _-d / -t / -d / vowel_                  | _-sid / -id / -e / -i / -u_ | Partial object, negative object, numbers > 1, open quantity     | _maja / maju_            | _tuba / tube_           |
| 4. Illative     | Sisseütlev    | Kellesse? Kuhu?   | _-sse_ (short form: _-de, -he, -vowel_) | _-desse / -tesse / -isse_   | Movement into (interior destination)                            | _majasse_                | _tuppa_ (short)         |
| 5. Inessive     | Seesütlev     | Kelles? Kus?      | _-s_                                    | _-des / -tes / -is_         | State inside (interior location)                                | _majas / majades_        | _toas / tubades_        |
| 6. Elative      | Seestütlev    | Kellest? Kust?    | _-st_                                   | _-dest / -test / -ist_      | Movement out of, topic ("about")                                | _majast / majadest_      | _toast / tubadest_      |
| 7. Allative     | Alaleütlev    | Kellele? Kuhu?    | _-le_                                   | _-dele / -tele / -ile_      | Movement onto, recipient (indirect object)                      | _majale / majadele_      | _toale / tubadele_      |
| 8. Adessive     | Alalütlev     | Kellel? Kus?      | _-l_                                    | _-del / -tel / -il_         | State on top of, possession (_mul on_)                          | _majal / majadel_        | _toal / tubadel_        |
| 9. Ablative     | Alaltütlev    | Kellelt? Kust?    | _-lt_                                   | _-delt / -telt / -ilt_      | Movement off of, source of information                          | _majalt / majadelt_      | _toalt / tubadelt_      |
| 10. Translative | Saav          | Kelleks? Milleks? | _-ks_                                   | _-deks / -teks / -iks_      | Change of state, purpose, deadline ("by Monday")                | _majaks / majadeks_      | _toaks / tubadeks_      |
| 11. Terminative | Rajav         | Kelleni? Milleni? | _-ni_                                   | _-deni / -teni / -ini_      | Limit in space or time ("up to, until")                         | _majani / majadeni_      | _toani / tubadeni_      |
| 12. Essive      | Olev          | Kellena? Millena? | _-na_                                   | _-dena / -tena / -ina_      | State/role as ("as a teacher")                                  | _majana / majadena_      | _toana / tubadena_      |
| 13. Abessive    | Ilmaütlev     | Kelleta? Milleta? | _-ta_                                   | _-deta / -teta / -ita_      | Absence ("without")                                             | _majata / majadeta_      | _toata / tubadeta_      |
| 14. Comitative  | Kaasaütlev    | Kellega? Millega? | _-ga_                                   | _-dega / -tega / -iga_      | Accompaniment, instrument/tool                                  | _majaga / majadega_      | _toaga / tubadega_      |

---

## 2. The Three Base Forms (Kolm põhivormi)

Almost all 14 cases are derived deterministically from three principal nominal forms:

1. **Nominative singular (_ainsuse nimetav_)**: Dictionary form.
2. **Genitive singular (_ainsuse omastav_)**: Forms the base for:
   - All singular oblique cases (cases 4–14 in the singular): stem + ending (`toa + s = toas`, `toa + le = toale`, `toa + ga = toaga`).
   - Nominative plural: genitive stem + _-d_ (`toa + d = toad`).
   - Genitive plural in regular declensions: stem + _-de_ (`toa + de = toade` / `tuba + de = tubade`).
3. **Partitive singular (_ainsuse osastav_)**: Distinct stem used for:
   - Partitive objects and counting with numerals.
   - Partitive plural and short illatives in certain paradigms.

---

## 3. Spatial Case System (Kohakäänded)

Estonian organizes 6 spatial cases into two parallel 3-way triads:

| Direction / State            | Question | Internal (_Sisekohakäänded_)                         | External (_Väliskohakäänded_)              |
| ---------------------------- | -------- | ---------------------------------------------------- | ------------------------------------------ |
| **Destination** ("Whither?") | _Kuhu?_  | **Illative** (_-sse_ / short form): _linna_, _kooli_ | **Allative** (_-le_): _tänavale_, _lauale_ |
| **Location** ("Where?")      | _Kus?_   | **Inessive** (_-s_): _linnas_, _koolis_              | **Adessive** (_-l_): _tänaval_, _laual_    |
| **Source** ("Where from?")   | _Kust?_  | **Elative** (_-st_): _linnast_, _koolist_            | **Ablative** (_-lt_): _tänavalt_, _laualt_ |

- **Settlements**: Most Estonian towns use internal cases (_Tallinnas, Tartus, Pärnus, Narvas, Viljandis_), but some use external cases by historical convention (_Tapal, Elvas, Otepääl, Sauel, Keilas, Sillamäel_). Foreign countries usually take internal (_Soomes, Rootsis_; _Inglismaal_ takes external because of _-maa_).

---

## 4. Verb Architecture & 4 Principal Forms

Estonian verbs have no future tense inflection (the present tense + context or particle verbs expresses future) and no Slavic-style verbal aspect prefixes. Aspect is handled primarily via object marking and particle verbs.

Every verb is governed by 4 basic forms:

1. **_ma_-infinitive**: The dictionary lemma (`lugema` "to read"). Base for:
   - Motion goals: _lähen lugema_ ("I am going to read").
   - Action initiation: _hakkama_ + _ma_ (`hakkab sadama` "it starts raining").
   - Inflected _ma_-forms: _-mas_ (in-progress), _-mast_ (from doing), _-mata_ (without doing), _-maks_ (in order to do).
2. **_da_-infinitive**: (`lugeda`). Base for:
   - Modals and ability: _saama, võima, oskama, suutma, tahtma_ (`ma oskan ujuda`, `ma tahan lugeda`).
   - Impersonal statements: _on vaja teha_, _on raske õppida_.
3. **1st Person Present (_olevik_)**: (`loen`). Weak/strong stem for present indicative conjugation.
4. **3rd Person Simple Past (_lihtminevik_)**: (`luges`). Past indicative stem.

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
  - _Mees ostis eile poest leiba._ (S-V-Adv-Adv-O)
  - _Eile ostis mees poest leiba._ (Adv-V-S-Adv-O)
- **Existential Clauses**: Location + Verb (_on_) + Subject:
  - _Laual on raamat._ ("There is a book on the table.") vs. _Raamat on laual._ ("The book is on the table.")
- **Possession Clause**: Possessor in Adessive + _on_ + Possessed item:
  - _Mul on kass._ ("I have a cat.")
  - _Mul ei ole kassi._ ("I do not have a cat." — possessed entity in partitive!).
- **Negation**: Auxiliary _ei_ + connegative verb stem:
  - Present: _ma ei loe_ (stem from _loen_ minus _-n_).
  - Past: _ma ei lugenud_ (_ei_ + _-nud_ participle).
  - Perfect: _ma ei ole lugenud_.
