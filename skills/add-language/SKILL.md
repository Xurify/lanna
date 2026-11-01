---
name: add-language
description: Guides the agent to scaffold, configure, and validate a new language profile in LangHarness following token-minimization and schema conventions.
---

# Add Language Skill

Use this skill whenever the user asks to add, configure, or support a new target language in LangHarness (e.g. Czech, Romanian, German, Spanish, French, Italian, Japanese, etc.).

## Philosophy & Core Rules
1. **Token Minimization**: Do not reinvent code or add heavy runtime prompt abstractions. LangHarness uses declarative code registries and static JSON schemas.
2. **Profile Isolation**: Each target language stores its learner records, FSRS reviews, and knowledge graphs under `<data>/profiles/<language>/`. The server reads the active profile from `config.ts` `LANGUAGE_PROFILES`.
3. **No Parity Drift**: `LANGUAGE_PROFILES` in `config.ts` and `LANGUAGE_IDS` in `src/core/language.ts` MUST always have identical sorted arrays.
4. **Cloze Integrity**: In `curriculum/<language>/lexicon.json`, every `cloze.answer` MUST match `text.slice(at, at + answer.length)`.

---

## Step-by-Step Procedure

### 1. Identify Language Parameters
Gather:
- `id`: Lowercase identifier (e.g. `"czech"`, `"romanian"`, `"german"`).
- `code`: ISO 639-1 code (e.g. `"cs"`, `"ro"`, `"de"`).
- `tag`: BCP-47 tag (e.g. `"cs-CZ"`, `"ro-RO"`, `"de-DE"`).
- `endonym`: Native script name (e.g. `"Čeština"`, `"Română"`, `"Deutsch"`).
- `english`: English name (e.g. `"Czech"`, `"Romanian"`, `"German"`).
- `specialLetters`: Characters not standard on English QWERTY for the diacritic bar.
- `edgeVoices`: Microsoft Edge TTS neural voices (e.g. `["cs-CZ-VlastaNeural", "cs-CZ-AntoninNeural"]`).
- `referenceSite`: Optional dictionary site `{ label: string, baseUrl: string }`.

*Note: Check `LANGUAGE_PRESETS` in `src/core/language.ts` first — presets for Czech, Romanian, German, and Spanish are already pre-written!*

### 2. Register in Core & Config
1. In `src/core/language.ts`:
   - Add id to `type LanguageId`.
   - Add entry to `LANGUAGES`.
2. In `config.ts`:
   - Add id to `export const LANGUAGE_PROFILES = [...] as const;`.

### 3. Scaffold Lexicon (`curriculum/<language>/lexicon.json`)
Create `curriculum/<language>/lexicon.json` with initial high-frequency vocabulary.
Follow this exact schema:
```json
[
  {
    "slug": "unique-slug",
    "lemma": "dictionary-form",
    "pos": "noun | verb | adj | adv | prep | conj | phrase",
    "en": "English meaning",
    "examples": [
      {
        "text": "Full sentence in target language.",
        "en": "English translation.",
        "cloze": {
          "answer": "exact_word_in_sentence",
          "at": 0
        }
      }
    ]
  }
]
```

### 4. (Optional) Scaffold Language Prompt (`prompts/language/10-<language>.md`)
Create markdown guidance for the LLM teacher:
- Tone and pronunciation peculiarities.
- Common diacritic slips to watch out for.
- Grammar nuances and transliteration conventions if non-Latin.

### 5. Validate & Test
Run the automated test runner:
```bash
node ./node_modules/tsx/dist/cli.mjs --test tests/multi-language.test.ts tests/langharness.test.ts
```
Verify all tests pass with code 0.
