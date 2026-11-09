# Russian Grammar Core

The Russian grammatical architecture rests on a fusional synthetic morphology with free mobile stress, 6 cases across 3 grammatical genders, animate/inanimate distinctions, a binary verbal aspect system, and a flexible functional sentence perspective (topic-comment word order).

## 1. Grammatical Categories

| Category | Values & Behaviour |
| --- | --- |
| **Gender (*Род*)** | Masculine (*он*), Feminine (*она*), Neuter (*оно*). Inherent to nouns; inflected in adjectives, past-tense verbs, demonstratives, and pronouns. |
| **Number (*Число*)** | Singular (*единственное*) and Plural (*множественное*). Some nouns are singularia tantum (*молоко, чай, любовь*) or pluralia tantum (*деньги, очки, часы*). |
| **Case (*Падеж*)** | 6 primary grammatical cases: Nominative, Accusative, Genitive, Dative, Instrumental, Prepositional. (Traces of Vocative in colloquial names `Маш! Вань!`, Partitive in `-у` `выпить чаю`, Locative in `-у́` `в лесу́`). |
| **Animacy (*Одушевлённость*)** | Grammaticalized in the accusative: animate nouns (people and animals) take the genitive ending; inanimate nouns take the nominative ending. |
| **Aspect (*Вид*)** | Imperfective (*несовершенный*, НСВ) vs. Perfective (*совершенный*, СВ). Inherent to almost every verb stem. |
| **Tense (*Время*)** | Present (НСВ only: 6 personal forms), Past (both aspects: 4 gender/number forms `-л, -ла, -ло, -ли`), Future (НСВ compound `буду + инф`; СВ simple conjugated). |

---

## 2. The Six Cases At A Glance

| Case | Russian Name | Primary Question | Core Function & Syntax | Anchor Examples |
| --- | --- | --- | --- | --- |
| **Nominative** | Именительный | Кто? Что? | Subject of finite verb, predicate nominal in present tense, dictionary citation form. | *Студент читает книгу.* *Это мой брат.* |
| **Accusative** | Винительный | Кого? Что? Куда? | Direct object of transitive verbs, destination of motion (`в/на + accusative`), duration of time (`всю неделю`). | *Я вижу брата (anim).* *Я вижу стол (inanim).* *Мы идём в театр.* |
| **Genitive** | Родительный | Кого? Чего? Откуда? Чей? | Possession, absence/negation (`нет + genitive`), quantity, paucal numerals (`2, 3, 4 + genitive singular`, `5+ + genitive plural`), prepositions (`из, с, от, до, без, для, около, после, у`). | *Книга студента.* *У меня нет времени.* *Два стола, пять столов.* *Письмо от друга.* |
| **Dative** | Дательный | Кому? Чему? К кому? | Indirect object (recipient), age (`мне 25 лет`), impersonal modal states (`мне надо, можно, холодно`), prepositions `к, по`. | *Я звоню маме.* *Мне нужно работать.* *Пойдём к врачу.* |
| **Instrumental** | Творительный | Кем? Чем? С кем? | Means or instrument, accompaniment (`с + instrumental`), predicate nominal of past/future/infinitive (`он был врачом`), prepositions `с, над, под, перед, за, между`. | *Я пишу карандашом.* *Мы гуляем с другом.* *Она работает учителем.* |
| **Prepositional** | Предложный | О ком? О чём? Где? | Used ONLY with prepositions: location (`в/на + prepositional`), topic of thought/speech (`о/об + prepositional`), transport mode (`на метро, на поезде`). | *Они живут в Москве.* *Мы говорим о музыке.* |

---

## 3. Animacy Mechanics

Animacy (*одушевлённость*) affects the accusative case across all genders and numbers:

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

Every finite verb belongs to either the 1st conjugation (*-е- / -ут/-ют*) or 2nd conjugation (*-и- / -ат/-ят*):

| Person | 1st Conjugation (*читать*) | 2nd Conjugation (*говорить*) | Mixed / Consonant (*жить*) |
| --- | --- | --- | --- |
| 1sg (*я*) | чита́-**ю** | говор-**ю́** | жив-**у́** |
| 2sg (*ты*) | чита́-**ешь** | говор-**и́шь** | жив-**ёшь** |
| 3sg (*он/она/оно*) | чита́-**ет** | говор-**и́т** | жив-**ёт** |
| 1pl (*мы*) | чита́-**ем** | говор-**и́м** | жив-**ём** |
| 2pl (*вы*) | чита́-**ете** | говор-**и́те** | жив-**ёте** |
| 3pl (*они*) | чита́-**ют** | говор-**я́т** | жив-**у́т** |

### Tense & Aspect Pairing

| Tense | Imperfective (*читать*) | Perfective (*прочитать*) | Meaning Contrast |
| --- | --- | --- | --- |
| **Past** | чита́л, чита́ла, чита́ло, чита́ли | прочита́л, прочита́ла, прочита́ли | Process/habit vs. completed result |
| **Present** | чита́ю, чита́ешь, чита́ет... | — (*no present tense*) | Ongoing action / general truth |
| **Future** | бу́ду чита́ть, бу́дешь чита́ть... | прочита́ю, прочита́ешь... | Process in future vs. future result |

---

## 5. Basic Syntactic Patterns

### 1. Possession: *У кого есть что*
- Positive: `У + Genitive + (есть) + Nominative` (*У меня есть машина.* In conversational statements about attributes, *есть* is often omitted: *У него тёмные волосы*).
- Negative: `У + Genitive + нет + Genitive` (*У меня нет машины.* Past: *У меня не было машины.* Future: *У меня не будет машины.*).

### 2. Impersonal States & Modals: *Кому + Adverb / Infinitive*
- `Dative + надо / нужно / можно / нельзя + Infinitive`:
  - *Мне надо идти.* (I must go.)
  - *Здесь нельзя курить.* (One cannot smoke here.)
  - *Ему скучно / холодно.* (He is bored / cold.)

### 3. Spatial Triad: *Где? Куда? Откуда?*
| Position | At Rest (*Где?*) | Destination (*Куда?*) | Origin (*Откуда?*) |
| --- | --- | --- | --- |
| **Enclosed / City** | `в + Prep` (*в банке, в Москве*) | `в + Acc` (*в банк, в Москву*) | `из + Gen` (*из банка, из Москвы*) |
| **Open surface / Event** | `на + Prep` (*на почте, на концерте*) | `на + Acc` (*на почту, на концерт*) | `с/со + Gen` (*с почты, с концерта*) |
| **Person** | `у + Gen` (*у врача*) | `к + Dat` (*к врачу*) | `от + Gen` (*от врача*) |
