# Russian Grammar Core

The Russian grammatical architecture rests on a fusional synthetic morphology with free mobile stress, 6 cases across 3 grammatical genders, animate/inanimate distinctions, a binary verbal aspect system, and a flexible functional sentence perspective (topic-comment word order).

## 1. Grammatical Categories

| Category                       | Values & Behaviour                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gender (_Род_)**             | Masculine (_он_), Feminine (_она_), Neuter (_оно_). Inherent to nouns; inflected in adjectives, past-tense verbs, demonstratives, and pronouns.                                                                       |
| **Number (_Число_)**           | Singular (_единственное_) and Plural (_множественное_). Some nouns are singularia tantum (_молоко, чай, любовь_) or pluralia tantum (_деньги, очки, часы_).                                                           |
| **Case (_Падеж_)**             | 6 primary grammatical cases: Nominative, Accusative, Genitive, Dative, Instrumental, Prepositional. (Traces of Vocative in colloquial names `Маш! Вань!`, Partitive in `-у` `выпить чаю`, Locative in `-у́` `в лесу́`). |
| **Animacy (_Одушевлённость_)** | Grammaticalized in the accusative: animate nouns (people and animals) take the genitive ending; inanimate nouns take the nominative ending.                                                                           |
| **Aspect (_Вид_)**             | Imperfective (_несовершенный_, НСВ) vs. Perfective (_совершенный_, СВ). Inherent to almost every verb stem.                                                                                                           |
| **Tense (_Время_)**            | Present (НСВ only: 6 personal forms), Past (both aspects: 4 gender/number forms `-л, -ла, -ло, -ли`), Future (НСВ compound `буду + инф`; СВ simple conjugated).                                                       |

---

## 2. The Six Cases At A Glance

| Case              | Russian Name | Primary Question         | Core Function & Syntax                                                                                                                                                                         | Anchor Examples                                                                      |
| ----------------- | ------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Nominative**    | Именительный | Кто? Что?                | Subject of finite verb, predicate nominal in present tense, dictionary citation form.                                                                                                          | _Студент читает книгу._ _Это мой брат._                                              |
| **Accusative**    | Винительный  | Кого? Что? Куда?         | Direct object of transitive verbs, destination of motion (`в/на + accusative`), duration of time (`всю неделю`).                                                                               | _Я вижу брата (anim)._ _Я вижу стол (inanim)._ _Мы идём в театр._                    |
| **Genitive**      | Родительный  | Кого? Чего? Откуда? Чей? | Possession, absence/negation (`нет + genitive`), quantity, paucal numerals (`2, 3, 4 + genitive singular`, `5+ + genitive plural`), prepositions (`из, с, от, до, без, для, около, после, у`). | _Книга студента._ _У меня нет времени._ _Два стола, пять столов._ _Письмо от друга._ |
| **Dative**        | Дательный    | Кому? Чему? К кому?      | Indirect object (recipient), age (`мне 25 лет`), impersonal modal states (`мне надо, можно, холодно`), prepositions `к, по`.                                                                   | _Я звоню маме._ _Мне нужно работать._ _Пойдём к врачу._                              |
| **Instrumental**  | Творительный | Кем? Чем? С кем?         | Means or instrument, accompaniment (`с + instrumental`), predicate nominal of past/future/infinitive (`он был врачом`), prepositions `с, над, под, перед, за, между`.                          | _Я пишу карандашом._ _Мы гуляем с другом._ _Она работает учителем._                  |
| **Prepositional** | Предложный   | О ком? О чём? Где?       | Used ONLY with prepositions: location (`в/на + prepositional`), topic of thought/speech (`о/об + prepositional`), transport mode (`на метро, на поезде`).                                      | _Они живут в Москве._ _Мы говорим о музыке._                                         |

---

## 3. Animacy Mechanics

Animacy (_одушевлённость_) affects the accusative case across all genders and numbers:

```
Singular:
- Masculine Inanimate:  Accusative = Nominative  (Я вижу новый стол)
- Masculine Animate:    Accusative = Genitive    (Я вижу нового студента / кота)
- Feminine:             1st declension (-а/-я) takes distinct -у/-ю regardless of animacy (вижу книгу, вижу сестру); 3rd declension (-ь) has Accusative = Nominative (вижу мать, ночь, тетрадь)
- Neuter:               Accusative = Nominative  (Я вижу красивое окно)

Plural (ALL Genders):
- Inanimate Plural:     Accusative = Nominative  (Я вижу столы, книги, окна)
- Animate Plural:       Accusative = Genitive    (Я вижу студентов, сестёр, кошек)
```

---

## 4. Verbal Architecture: Aspect & Conjugation

Every finite verb belongs to either the 1st conjugation (_-е- / -ут/-ют_) or 2nd conjugation (_-и- / -ат/-ят_):

| Person             | 1st Conjugation (_читать_) | 2nd Conjugation (_говорить_) | Mixed / Consonant (_жить_) |
| ------------------ | -------------------------- | ---------------------------- | -------------------------- |
| 1sg (_я_)          | чита́-**ю**                 | говор-**ю́**                  | жив-**у́**                  |
| 2sg (_ты_)         | чита́-**ешь**               | говор-**и́шь**                | жив-**ёшь**                |
| 3sg (_он/она/оно_) | чита́-**ет**                | говор-**и́т**                 | жив-**ёт**                 |
| 1pl (_мы_)         | чита́-**ем**                | говор-**и́м**                 | жив-**ём**                 |
| 2pl (_вы_)         | чита́-**ете**               | говор-**и́те**                | жив-**ёте**                |
| 3pl (_они_)        | чита́-**ют**                | говор-**я́т**                 | жив-**у́т**                 |

### Tense & Aspect Pairing

| Tense       | Imperfective (_читать_)       | Perfective (_прочитать_)       | Meaning Contrast                    |
| ----------- | ----------------------------- | ------------------------------ | ----------------------------------- |
| **Past**    | чита́л, чита́ла, чита́ло, чита́ли | прочита́л, прочита́ла, прочита́ли | Process/habit vs. completed result  |
| **Present** | чита́ю, чита́ешь, чита́ет...     | — (_no present tense_)         | Ongoing action / general truth      |
| **Future**  | бу́ду чита́ть, бу́дешь чита́ть... | прочита́ю, прочита́ешь...        | Process in future vs. future result |

---

## 5. Basic Syntactic Patterns

### 1. Possession: _У кого есть что_

- Positive: `У + Genitive + (есть) + Nominative` (_У меня есть машина._ In conversational statements about attributes, _есть_ is often omitted: _У него тёмные волосы_).
- Negative: `У + Genitive + нет + Genitive` (_У меня нет машины._ Past: _У меня не было машины._ Future: _У меня не будет машины._).

### 2. Impersonal States & Modals: _Кому + Adverb / Infinitive_

- `Dative + надо / нужно / можно / нельзя + Infinitive`:
  - _Мне надо идти._ (I must go.)
  - _Здесь нельзя курить._ (One cannot smoke here.)
  - _Ему скучно / холодно._ (He is bored / cold.)

### 3. Spatial Triad: _Где? Куда? Откуда?_

| Position                 | At Rest (_Где?_)                      | Destination (_Куда?_)               | Origin (_Откуда?_)                   |
| ------------------------ | ------------------------------------- | ----------------------------------- | ------------------------------------ |
| **Enclosed / City**      | `в + Prep` (_в банке, в Москве_)      | `в + Acc` (_в банк, в Москву_)      | `из + Gen` (_из банка, из Москвы_)   |
| **Open surface / Event** | `на + Prep` (_на почте, на концерте_) | `на + Acc` (_на почту, на концерт_) | `с/со + Gen` (_с почты, с концерта_) |
| **Person**               | `у + Gen` (_у врача_)                 | `к + Dat` (_к врачу_)               | `от + Gen` (_от врача_)              |
