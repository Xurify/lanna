# Comprehensible Input & SLA Roadmap: Watch/Read Tuning, Silent Period, and Error Correction

_Lanna Architecture & Roadmap Plan, November 2026. Aligned with Krashen (1982, 1985), Nation (2007), and modern SLA cognitive research._

---

## 1. Executive Summary

While Lanna established the four strands (Nation 2007) and built initial Watch and Read tasks, our cognitive audit reveals three critical pedagogical bottlenecks:

1. **The Comprehensible Input (CI) Pipeline in Watch/Read is raw:** Authentic YouTube videos often drop to 75–80% coverage (overwhelming the working memory), while Read episodes test forms immediately rather than allowing multiple immersion sweeps.
2. **Onboarding lacks a "Silent Period":** New language profiles force oral production, speech recognition, and active cloze generation from Day 1, spiking the learner's _Affective Filter_ and triggering reliance on L1 translation crutches.
3. **Tutor Error Correction is overly didactic:** When a learner makes an agreement or case slip in dialogue, the tutor interrupts the communicative flow with red-pen grammatical taxonomy ("Incorrect! You used feminine accusative instead of locative"). This activates the conscious _Monitor_ instead of building implicit acquisition.

This roadmap details the three implementation phases to resolve these gaps.

---

## 2. Track A: Tuning the Comprehensible Input Pipeline (Watch & Read)

### A.1. Watch Task Tuning (Authentic Video → Truly Comprehensible i+1)

- **Lexical Pre-Priming (The 95% Scaffold):**
  - _Current Problem:_ Authentic YouTube videos frequently present 15–25% unknown vocabulary, far below the 95% unassisted comprehension floor (van Zeeland & Schmitt 2013).
  - _Pipeline Solution:_ Before playback begins, the server identifies the top 5–7 most frequent unknown lemmas in the video. The learner undergoes a 60-second rapid audio-visual primer (audio pronunciation + image/gloss). This artificially lifts effective coverage of the video from 80% to ≥ 94% prior to the first play.
- **Adaptive Speech-Rate Normalization:**
  - _Current Problem:_ Native Slovak/Russian speech often runs at 160–210 WPM, exceeding the A1/A2 auditory parsing limit (~110–130 WPM).
  - _Pipeline Solution:_ Granular line-level acoustic tempo detection. Lines exceeding the learner's measured processing speed play at an automatic 0.85× or 0.9× tempo with pitch-preserving time-stretching.
- **Interlinear i+1 Smart Glossing:**
  - Instead of binary "English on or off", display target-language subtitles with subtle, non-intrusive gloss pills strictly above unknown words (i+1), preserving pure target-language cognitive processing.

### A.2. Read Task Tuning (Graded Episodic Immersion)

- **Multi-Pass Immersion Architecture:**
  - _Pass 1 (Extensive Flow):_ Audio-synchronized reading with continuous auto-advance. No quizzes, no popups. Pure auditory-orthographic binding.
  - _Pass 2 (Interactive Noticing):_ Tap-to-gloss inspection, saving unknown expressions directly into the FSRS Review deck.
  - _Pass 3 (Fluency Acceleration):_ Unassisted re-read against the clock to measure WPM gains without comprehension degradation.
- **Strict i+1 Clause Syntactic Constraints:**
  - Enforce via prompt schema that each generated sentence contains at most _one_ unmastered grammatical form or lexical item, surrounded by known structural anchors.

---

## 3. Track B: Early Onboarding "Silent Period" Phase

### B.1. Theoretical Rationale (Krashen 1982)

In natural first and second language acquisition, learners undergo an initial stage (weeks to months) where they produce little to no oral language. During this phase, internal competence is constructed through receptive listening. Forcing early speech forces learners to substitute native-language (L1) syntactic structures, generating fossilized bad habits and speech anxiety.

### B.2. Structural Implementation in Lanna

- **A0 / Early A1 Mode ("Receptive Foundation"):**
  - All microphone tasks (`speak`, `fluency`, oral shadowing) are deactivated during the first 14 days or until 200 receptive sentences are comprehended.
  - Replaced with **Meaning-Verification Interaction:**
    - Listen → Tap matching illustration or scenario.
    - Sound → Pure auditory discrimination (e.g. vowel length pairs _pas/pás_ without forced recording).
    - Read → Comprehension verification via picture/meaning selection rather than typing.
- **Explicit "Speech Readiness" Gate:**
  - Speaking tasks are introduced only when receptive vocabulary reaches ≥ 250 words and listening comprehension accuracy exceeds 85% on first play.

---

## 4. Track C: Redesigning Tutor Error Correction (Conversational Recasting)

### C.1. The Shift: Didactic Critique → Communicative Recast

Instead of acting like a red-pen schoolmaster who lectures for three paragraphs or burying corrections in a hidden drawer, the AI tutor uses an **Immediate Visual Diff (High Noticing)** model:

| Dimension               | Legacy Schoolmaster Approach                        | Immediate Visual Diff (High Noticing)                                   |
| :---------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------- |
| **Primary Goal**        | Grammatical taxonomy & overt rule memorization      | Rapid gap noticing (Schmidt 1990) + unbroken communication              |
| **Response to Error**   | Interruption, red text, lengthy declension lectures | Instant strike-through diff (`~~slip~~ → correct (rule cue)`)           |
| **Affective Impact**    | High anxiety, freezes spontaneous output            | High clarity, zero shame, immediate visual comprehension                |
| **Conversational Flow** | Freezes conversation, forces manual re-typing       | Unbroken: tutor answers the idea in natural target language right below |
| **Retention Action**    | Lost when chat scrolls away                         | One-tap button to save the exact sentence slip to FSRS Review deck      |

### C.2. The High-Noticing Card Format

The tutor prepends a crisp visual correction box at the top of its turn whenever a slip occurs:

```markdown
┌──────────────────────────────────────────────────────────┐
│ ~~malé mesto~~ ➔ malom meste (v + locative) │
└──────────────────────────────────────────────────────────┘
"V malom meste? To je super! Máš tam radšej pokoj, alebo ruch?"
```

1. **Instant Visual Gap:** The learner sees the crossed-out slip and the native form side-by-side in under a second.
2. **Minimal Rule Cue:** A brief contextual tag (`v + locative`) explains _why_ without a textbook sermon.
3. **Continuous Dialogue:** The conversational reply follows immediately below, modeling natural usage without forcing the learner to re-type before speaking again.
4. **FSRS Card Bridge:** The error pair can be saved directly to the review deck with one click.
