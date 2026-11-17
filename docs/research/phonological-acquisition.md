# Phonological Acquisition: Empirical Research and Pedagogical Applications for Lanna

_Lanna Research Synthesis, November 2026. Theoretical grounding, empirical evidence, and implementation architecture for second-language speech perception, articulatory production, and automated pronunciation assessment._

---

## Executive Summary

Phonological acquisition is the process through which a learner establishes the perceptual categories, phonotactic constraints, articulatory motor routines, and suprasegmental patterns of a target phonological system.

While first language (L1) acquisition is characterized by rapid perceptual attunement and the gradual suppression of innate phonological simplification processes, adult second language (L2) acquisition faces a fundamentally different hurdle: **perceptual interference and equivalence classification mediated by an entrenched L1 phonological architecture**.

Decades of empirical research in psycholinguistics, acoustic phonetics, and Computer-Assisted Pronunciation Training (CAPT) demonstrate that:

1. **Perception bounds production:** Accurate articulatory motor execution is constrained by the precision of underlying perceptual representations (Flege 1995; Best 1995).
2. **Equivalence classification blocks learning:** L2 sounds that are "similar" to L1 categories are assimilated into L1 representations, preventing the formation of distinct L2 phonetic targets unless exposed to high acoustic variability (Flege & Bohn 2021; Logan, Lively & Pisoni 1991).
3. **High-Variability Phonetic Training (HVPT) transfers to production:** Multi-talker, multi-context perceptual discrimination training reliably restructures perceptual categories ($g \approx 0.70$) and spontaneously enhances spoken production without explicit articulatory training ($g \approx 0.40$).
4. **Explicit diagnostic feedback outperforms global scoring:** Automated pronunciation assessment produces meaningful uptake only when feedback isolates the specific phoneme and supplies actionable articulatory motor guidance rather than aggregate scores (Ngo, Chen & Lai 2024; Neri et al. 2008).
5. **Orthography corrupts phonological representations:** Presenting written text simultaneously with acoustic input triggers top-down orthographic interference, causing learners to construct spurious phonetic categories based on L1 grapheme-to-phoneme rules (Bassetti 2006; Nimz 2016).
6. **Intelligibility hinges on functional load:** Phonological errors do not degrade communication equally; pedagogical systems must prioritize high-functional-load contrasts (lexical minimal pairs, morphological markers) over low-functional-load phonetic subtleties (Catford 1987; Munro & Derwing 2006; Levis 2018).

This document outlines the theoretical foundations and describes the architecture of phonological training implemented in Lanna.

---

## 1. Theoretical Models of L2 Speech Acquisition

### 1.1 Speech Learning Model (SLM & SLM-r)

James Flege's Speech Learning Model (Flege 1995) and revised model (SLM-r, Flege & Bohn 2021) posit that L1 and L2 phonetic systems reside in a common phonological space. As learners acquire their L1, phonetic categories become attuners.

- **Equivalence Classification:** When an L2 sound is acoustically close to an L1 sound, the learner assimilates it into the L1 category. No new phonetic category is formed, and the learner's production permanently approximates the L1 value.
- **"New" vs. "Similar" Sounds:** "New" sounds (which have no close L1 counterpart, such as Slovak syllabic /r̩, l̩/ for an English speaker) are easier to establish as distinct phonetic categories than "similar" sounds (such as Slovak dental /t, d/ vs English alveolar /t, d/, or short /a/ vs long /aː/).

### 1.2 Perceptual Assimilation Model (PAM & PAM-L2)

Catherine Best's Perceptual Assimilation Model (Best 1995; Best & Tyler 2007) categorizes how non-native contrasts are assimilated into native gestural categories:

1. **Two-Category (TC):** Both L2 sounds assimilate to two distinct L1 categories (e.g., Slovak /p/ vs /b/ for English speakers). Discrimination is near-ceiling; no training needed.
2. **Single-Category (SC):** Both L2 sounds assimilate equally to a single L1 category (e.g., Slovak /a/ vs /aː/, or /t/ vs /c/ for English speakers). Discrimination is extremely poor; highest pedagogical priority.
3. **Category-Goodness (CG):** Both L2 sounds assimilate to one L1 category, but one is perceived as a "good" exemplar and the other as "deviant" (e.g., Slovak alveolar /d/ vs palatal /ɟ/ for Russian speakers). Discrimination is intermediate.
4. **Uncategorized-Categorized (UC):** One L2 sound maps to an L1 category; the other falls in phonetic white space. Discrimination is moderately good.

### 1.3 High-Variability Phonetic Training (HVPT)

Logan, Lively & Pisoni (1991) and Bradlow et al. (1997, 1999) established the empirical standard for modifying adult phonetic categories:

- **Architecture:** Multiple native speakers (minimum 4–6, balanced across genders), varied phonetic environments (word-initial, medial, final), minimal-pair 2AFC (Two-Alternative Forced Choice), immediate feedback.
- **Key Finding:** Robust perceptual category expansion ($d \approx 0.8$) that transfers directly to novel, untrained words and voices. Crucially, Bradlow et al. demonstrated that pure auditory HVPT transfers directly to spoken production without any articulatory instruction.

---

## 2. Architecture Implemented in Lanna

Lanna translates these psycholinguistic principles into four concrete components:

1. **Curated Minimal-Pair Phonology Dataset (`curriculum/slovak/phonology-pairs.json`):**
   - High-contrast minimal pairs targeting Slovak phonemic distinctions:
     - Vowel quantity (short vs long vowels and diphthongs)
     - Palatal vs dental consonants (/t, d, n, l/ vs /c, ɟ, ɲ, ʎ/)
     - Syllabic liquids (/r, l/ vs /rː, lː/)
     - Voicing contrasts and final-obstruent voicing
   - Each pair is tagged with its contrast category, functional load, IPA, and gloss.

2. **Core Phonology Engine (`src/core/phonology.ts`):**
   - **Articulatory Motor Guidance:** Concrete anatomical cues (tongue placement, contact zone, lip shape, voicing) for tricky phonemes.
   - **Functional Load Weighting:** Weights pronunciation penalties by communicative impact. Vowel quantity distinguishing cases/aspect carries 1.5x weight, while low-load dialectal merges (like soft /ʎ/ into /l/) carry 0.3x weight.
   - **Cross-Linguistic PAM-L2 Prioritizer:** Inspects `learner.json` to customize contrast difficulty (e.g., English learners get SC priority on vowel length; Finnish/Estonian learners get TC skip).
   - **Deterministic Voicing Assimilation Rules (_spodobovanie_):** Explains regressive assimilation (_včera_ [ftʃɛra], _s bratom_ [z bratom]) and homophone graphemes (_i/y_).

3. **HVPT Minimal-Pair Ear Gym (`src/core/phonology.ts` & `components/phonology/ear-gym.tsx`):**
   - 2AFC auditory discrimination drills utilizing multi-voice TTS.
   - Rounds of ten trials in the task frame the other practice screens use. Both words stay on screen in a fixed order; after each answer each word plays from its tile and the cue is shown under them. The "Ear-First" masking toggle was removed (2026-11-09): it hid both options, so a trial could only be guessed.

4. **Actionable Articulatory Diagnostics (`components/speak/pron.tsx`):**
   - Replaces generic text in `PronWorkOn` with specific motor guidance badges.
   - Highlights high-functional-load sounds.
   - Adds instant audio listening and retry buttons for isolated phonetic repairs.

5. **Slovak Rhythmic Law & Suprasegmental Cadence Engine (`src/core/rhythm.ts` & `components/phonology/rhythmic-visualizer.tsx`):**
   - Syllable quantity analysis (mora counting: short 1μ vs long 2μ for vowels, diphthongs, and syllabic liquids).
   - Enforces the Slovak Rhythmic Law (_Rytmický zákon_), identifying consecutive long syllables and validating morphological suffix shortening (_chválim_, _krásny_, _trávam_, _vŕbam_, _biely_).
   - Shows each syllable as long or short, the forms where an ending turns short after a long stem, and the stress on the first syllable. This is a description of the language (Hanulíková & Hamann 2010), not a tested training method. Dupoux et al. (2001, 2008) found that speakers of a language with fixed stress (French) have trouble hearing contrastive stress (Spanish); that finding does not apply to learning Slovak, whose stress is fixed, and an earlier version of this note had it backwards.

---

## References

1. Best, C. T. (1995). A direct realist view of cross-language speech perception. _Speech Perception and Linguistic Experience_, 171-204.
2. Best, C. T., & Tyler, M. D. (2007). Nonnative and second-language speech perception: The PAS model. _Language Experience in Second Language Speech Learning_, 13-34.
3. Bradlow, A. R., Pisoni, D. B., Akahane-Yamada, R., & Tohkura, Y. (1997). Training Japanese listeners to identify English /r/ and /l/: IV. Some effects of perceptual learning on speech production. _The Journal of the Acoustical Society of America_, 101(4), 2299-2310.
4. Catford, J. C. (1987). Phonetics and the teaching of pronunciation: A systemic description of English phonology. _Current Perspectives on Pronunciation_, 87-100.
5. Dupoux, E., Peperkamp, S., & Sebastián-Gallés, N. (2001). A robust method to study stress 'deafness'. _The Journal of the Acoustical Society of America_, 110(3), 1606-1618.
6. Dupoux, E., Sebastián-Gallés, N., Navarrete, E., & Peperkamp, S. (2008). Persistent stress 'deafness': The case of French learners of Spanish. _Cognition_, 106(2), 682-706.
7. Flege, J. E. (1995). Second language speech learning: Theory, findings, and problems. _Speech Perception and Linguistic Experience_, 233-277.
8. Flege, J. E., & Bohn, O. S. (2021). The Revised Speech Learning Model (SLM-r). _Second Language Speech Learning: Theoretical and Empirical Progress_, 3-83.
9. Hanulíková, A., & Hamann, S. (2010). Slovak. _Journal of the International Phonetic Association_, 40(3), 373-378.
10. Logan, J. S., Lively, S. E., & Pisoni, D. B. (1991). Training Japanese listeners to identify English /r/ and /l/: A first report. _The Journal of the Acoustical Society of America_, 89(2), 874-886.
11. Munro, M. J., & Derwing, T. M. (2006). The functional load principle in ESL pronunciation instruction: An exploratory study. _System_, 34(4), 520-531.
12. Neri, A., Cucchiarini, C., & Strik, H. (2008). The effect of corrective feedback on L2 pronunciation in a computer-assisted learning environment. _CALL_, 21(3), 235-259.
13. Ngo, H., Chen, X., & Lai, C. (2024). A meta-analysis of computer-assisted pronunciation training (CAPT) on L2 pronunciation. _Language Learning & Technology_, 28(1), 1-28.
