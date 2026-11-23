# Russian Phonology and Orthography

Russian phonology features an opposition between hard (unpalatalized) and soft (palatalized) consonants, dynamic mobile stress, extensive vowel reduction (_аканье_ and _иканье_), and systematic voicing assimilation.

## 1. The Russian Alphabet and Sound Values

The Cyrillic alphabet for Russian consists of 33 letters:

- 10 vowels: `а, о, у, э, ы` (indicating hardness of preceding consonant) and `я, ё, ю, е, и` (indicating softness of preceding consonant or jotation `/j/` initially/after vowels).
- 21 consonants.
- 2 signs: `ь` (soft sign — indicates palatalization or syllable boundary) and `ъ` (hard sign — indicates syllable separation before iotated vowels).

| Category | Letters | Phonetic Behavior |
| --- | --- | --- |
| **Always Hard** | `ж, ш, ц` | Never palatalized phonetically, even when spelled with `е, и` (_жить_ = [жыт'], _центр_ = [цэнтр]). |
| **Always Soft** | `ч, щ, й` | Inherently palatalized: `ч` = [tɕ], `щ` = [ɕː], `й` = [j]. |
| **Paired Consonants** | `б/п, в/ф, д/т, з/с, г/к, л, м, н, р` | Each has a hard and soft phonemic counterpart (_был_ [bɨl] vs _бил_ [bʲil]). |

---

## 2. Vowel Reduction (_Редукция гласных_)

Unstressed vowels lose duration and clarity in Russian:

### 1. _Аканье_ (Reduction of `а` and `о`)

- In the immediately pre-tonic syllable (one syllable before stress) and in word-initial position: both `а` and `о` are pronounced as short `[ɐ]` (like 'u' in English _cup_):
  - _молоко́_ → `[məlɐˈko]`
  - _Москва́_ → `[mɐsˈkva]`
  - _окно́_ → `[ɐkˈno]`
- In other unstressed syllables (post-tonic or two+ syllables before stress): reduced further to weak `[ə]` (schwa):
  - _хорошо́_ → `[xərɐˈʂo]`.

### 2. _Иканье_ (Reduction of `е` and `я`)

- After soft consonants in unstressed syllables: both `е` and `я` are reduced to a short `[ɪ]` (approaching `[i]`):
  - _сестра́_ → `[sʲɪsˈtra]`
  - _язы́к_ → `[jɪˈzɨk]`
  - _часы́_ → `[tɕɪˈsɨ]` (after soft `ч`).

---

## 3. Consonant Assimilation & Devoicing

1. **Final Devoicing (_Оглушение на конце слова_):**
   Voiced consonants (`б, в, г, д, ж, з`) become their voiceless counterparts (`п, ф, к, т, ш, с`) when occurring at the end of a word:
   - _клуб_ → `[клуп]`
   - _друг_ → `[друк]`
   - _город_ → `[го́рат]`
   - _нож_ → `[нош]`
   - _глаз_ → `[глас]`.

2. **Regressive Voicing Assimilation (_Регрессивная ассимиляция_):**
   A consonant cluster takes the voicing of its final consonant:
   - Voiced + Voiceless → Voiceless: _ложка_ → `[ло́шка]`, _автобус_ → `[афто́бус]`, _подруга_ → `[падру́га]`.
   - Voiceless + Voiced → Voiced: _вокзал_ → `[вагза́л]`, _сделать_ → `[зде́лат']`, _футбол_ → `[фудбо́л]`.
     _(Note: Sonorants `л, м, н, р, й` and `в` do not trigger voicing of preceding voiceless consonants: `свет` stays `[св'эт]`)._

---

## 4. Fundamental Orthographic Rules

### The 7-Letter Rule (_Правило семи букв_)

After the velars and sibilants `г, к, х, ж, ч, ш, щ`:

- **Never write `ы`**: write **`и`** (_книги, руки, стихи, лужи, тучи, машины, борщи_).
- **Never write `я`**: write **`а`** (_чай, чашка, площадка_).
- **Never write `ю`**: write **`у`** (_чудо, щука, хожу_).

### The 5-Letter Rule (_Правило пяти букв_)

After sibilants and affricate `ж, ч, ш, щ, ц`:

- Under stress, write `о` or `ё` (_ножо́м, плечо́м, врачо́м, лицо́м_).
- In **unstressed position**, **never write `о`**: write **`е`** (_му́жем, на́шей, па́льцем, со́лнцем, ме́сяцем_). (Exception: unassimilated foreign loanwords retain unstressed `о`, such as _шокола́д, шофёр, шоссе́_).

### The Letter `Ё` (_Буква Ё_)

- `Ё` is always stressed in native Russian words (_её, ещё, самолёт, актёр_).
- In educational texts, dictionaries, and learner materials, writing `ё` is mandatory under standard § 5 of the 2006 Academic Orthographic Rules. Omitting `ё` causes semantic confusion (_все_ = all vs. _всё_ = everything; _узнаем_ = we will know vs. _узнаём_ = we are getting to know).

### Stress Marking Notation

Under standard § 116 of the Academic Rules, stress in teaching texts is marked with the **combining acute accent (U+0301)** after the stressed vowel (`за́мок, замо́к, города́`), never with Latin letters (`á, ó`).
