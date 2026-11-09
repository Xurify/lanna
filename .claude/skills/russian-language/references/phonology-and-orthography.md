# Russian Phonology and Orthography

Russian phonology features an opposition between hard (unpalatalized) and soft (palatalized) consonants, dynamic mobile stress, extensive vowel reduction (*аканье* and *иканье*), and systematic voicing assimilation.

## 1. The Russian Alphabet and Sound Values

The Cyrillic alphabet for Russian consists of 33 letters:
- 10 vowels: `а, о, у, э, ы` (indicating hardness of preceding consonant) and `я, ё, ю, е, и` (indicating softness of preceding consonant or jotation `/j/` initially/after vowels).
- 21 consonants.
- 2 signs: `ь` (soft sign — indicates palatalization or syllable boundary) and `ъ` (hard sign — indicates syllable separation before iotated vowels).

| Category | Letters | Phonetic Behavior |
| --- | --- | --- |
| **Always Hard** | `ж, ш, ц` | Never palatalized phonetically, even when spelled with `е, и` (*жить* = [жыт'], *центр* = [цэнтр]). |
| **Always Soft** | `ч, щ, й` | Inherently palatalized: `ч` = [tɕ], `щ` = [ɕː], `й` = [j]. |
| **Paired Consonants** | `б/п, в/ф, д/т, з/с, г/к, л, м, н, р` | Each has a hard and soft phonemic counterpart (*был* [bɨl] vs *бил* [bʲil]). |

---

## 2. Vowel Reduction (*Редукция гласных*)

Unstressed vowels lose duration and clarity in Russian:

### 1. *Аканье* (Reduction of `а` and `о`)
- In the immediately pre-tonic syllable (one syllable before stress) and in word-initial position: both `а` and `о` are pronounced as short `[ɐ]` (like 'u' in English *cup*):
  - *молоко́* → `[məlɐˈko]`
  - *Москва́* → `[mɐsˈkwa]`
  - *окно́* → `[ɐkˈno]`
- In other unstressed syllables (post-tonic or two+ syllables before stress): reduced further to weak `[ə]` (schwa):
  - *хорошо́* → `[xərɐˈʂo]`.

### 2. *Иканье* (Reduction of `е` and `я`)
- After soft consonants in unstressed syllables: both `е` and `я` are reduced to a short `[ɪ]` (approaching `[i]`):
  - *сестра́* → `[sʲɪsˈtra]`
  - *язы́к* → `[jɪˈzɨk]`
  - *часы́* → `[tɕɪˈsɨ]` (after soft `ч`).

---

## 3. Consonant Assimilation & Devoicing

1. **Final Devoicing (*Оглушение на конце слова*):**
   Voiced consonants (`б, в, г, д, ж, з`) become their voiceless counterparts (`п, ф, к, т, ш, с`) when occurring at the end of a word:
   - *клуб* → `[клуп]`
   - *друг* → `[друк]`
   - *город* → `[го́рат]`
   - *нож* → `[нош]`
   - *глаз* → `[глас]`.

2. **Regressive Voicing Assimilation (*Регрессивная ассимиляция*):**
   A consonant cluster takes the voicing of its final consonant:
   - Voiced + Voiceless → Voiceless: *ложка* → `[ло́шка]`, *автобус* → `[афто́бус]`, *подруга* → `[падру́га]`.
   - Voiceless + Voiced → Voiced: *вокзал* → `[вагза́л]`, *сделать* → `[зде́лат']`, *футбол* → `[фудбо́л]`.
   *(Note: Sonorants `л, м, н, р, й` and `в` do not trigger voicing of preceding voiceless consonants: `свет` stays `[св'эт]`).*

---

## 4. Fundamental Orthographic Rules

### The 7-Letter Rule (*Правило семи букв*)
After the velars and sibilants `г, к, х, ж, ч, ш, щ`:
- **Never write `ы`**: write **`и`** (*книги, руки, стихи, лужи, тучи, машины, борщи*).
- **Never write `я`**: write **`а`** (*чай, чашка, площадка*).
- **Never write `ю`**: write **`у`** (*чудо, щука, хожу*).

### The 5-Letter Rule (*Правило пяти букв*)
After sibilants and affricate `ж, ч, ш, щ, ц`:
- Under stress, write `о` or `ё` (*ножо́м, плечо́м, врачо́м, лицо́м*).
- In **unstressed position**, **never write `о`**: write **`е`** (*му́жем, на́шей, пальцем, солнцем, месяцем*).

### The Letter `Ё` (*Буква Ё*)
- `Ё` is always stressed in native Russian words (*её, ещё, самолёт, актёр*).
- In educational texts, dictionaries, and learner materials, writing `ё` is mandatory under standard § 5 of the 2006 Academic Orthographic Rules. Omitting `ё` causes semantic confusion (*все* = all vs. *всё* = everything; *узнаем* = we will know vs. *узнаём* = we are getting to know).

### Stress Marking Notation
Under standard § 116 of the Academic Rules, stress in teaching texts is marked with the **combining acute accent (U+0301)** after the stressed vowel (`за́мок, замо́к, города́`), never with Latin letters (`á, ó`).
