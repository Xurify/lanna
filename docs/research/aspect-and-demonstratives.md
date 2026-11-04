# Practising aspect and demonstratives without a model writing the practice

Date: 2026-11-04. Question: should aspect and demonstratives be practised in tutor-chat units (`kind: "tutor"`, a practice session the tutor runs), or in verified drills that the app measures?

## Short answer

Keep the tutor for explaining and for one Socratic question after a miss. Move the practice into machinery the app already has: the mix-up families (E24) and the chapter's pairs step (E11), fed by verified lexicon sentences and measured on first tries (E18). Aspect is ready for this now. Demonstratives need lexicon data first.

## What the code does now

- `src/core/curriculum.ts` has `tutor("aspect", …)` (A2, "Moving around") and `tutor("gender-this-my", …)` (A1, "Family"). Both are run as practice sessions with the tutor, and a tutor unit is done after two sessions (the unit-completion rule in `docs/DECISIONS.md`), not after a count of right answers.
- The tutor writes the sentences in those sessions. Nothing checks them against the lexicon, and nothing records a first try, so the app cannot say which aspect or which demonstrative a learner gets wrong.
- The research note already says tutor units are for explanation: `docs/research/comprehensible-input.md` lists "Why? and tutor units" as "explanation, which is what they are for". The unit brief asks for practice. The code and the note disagree.
- The rules say no sentence a learner drills comes from a model (P8, E26), and a wrong form in a drill is learned as right at A1–A2 (P8).
- Existing machinery that fits: `curriculum/slovak/mixups.json` (families of lexicon twins with one rule and one bridge, a two-way probe, mended after three right first tries), `curriculum/slovak/pairs.json` (recognition choice in a verified sentence, E11), and the grammar atlas (E12).

## Lexicon coverage (checked 2026-11-04 in `curriculum/slovak/lexicon.json`)

| Entry | Examples | Sources |
|---|---|---|
| robiť, urobiť | 10, 9 | curated, Tatoeba |
| písať, napísať | 9, 8 | curated, Tatoeba |
| čítať, prečítať | 8, 8 | curated, Tatoeba |
| kupovať, kúpiť | 8, 8 | curated, Tatoeba |
| ten, tento, to | 4 each | curated only |
| tamten, táto, toto, tá | not lexicon entries | forms are mapped to lemmas in `src/core/reading.ts` (lines 499–500) |

Aspect pairs already have enough verified sentences for a family. Demonstratives do not: the lemma `ten` has four curated examples, and three of the forms have no entry.

## Proposal

### 1. Aspect as mix-up families (now)

Add families to `curriculum/slovak/mixups.json`, one per context where aspect is taught:

- Twins: the imperfective and perfective of one verb (písať / napísať, čítať / prečítať, robiť / urobiť, kupovať / kúpiť).
- Rule, one English line: imperfective for a process, a habit or the action itself; perfective for one act seen as finished, with a result. The English tense does not decide it.
- Bridge: the Estonian total and partial object (`lugesin raamatut` / `lugesin raamatu läbi`, from `curriculum/slovak/seed.json`).
- Probe: a two-way choice in a verified sentence whose context makes the aspect clear (a time phrase, a result, `už`). Each sentence holds exactly one twin, as E11 requires; the existing filter enforces this.
- Measure: the mix-up record (first tries, misses, mended after three right first tries) already does this.
- Later, a typed variant: the English meaning is shown, the learner types the Slovak form, and the dictionary-expected form is the answer. The Cheap slot judges only typed answers the dictionary did not expect (P7, E27).

### 2. Demonstratives (after lexicon data)

- Lemma level, first: a `tento` / `ten` family (this here / that), using the existing pair in `curriculum/slovak/pairs.json`. This needs three or more sentences that hold only one of the two. `ten` has four curated examples; more are needed, from Tatoeba or the owner's curated set (P8).
- Form level, second: a case-and-gender drill. Demonstratives follow the noun's gender and case, so they belong in the grammar atlas (E12), which already shows the case × gender grid. Each demonstrative form needs its own verified sentences. Add `tamten`, `táto`, `toto` as lexicon entries, or keep them as form rows that point to a lemma.
- Measure on first tries in the atlas cells (E18).

### 3. The tutor's role

- Explain on request (Why?, bridge lines), as the research note already intends.
- After a miss, ask one question that names the cue: "What decided the form: a result, or a process?" (the question-first pattern from `docs/research/level-assessment-audit.md`).
- Check a typed answer only when the dictionary did not expect it (P7, E27).
- Do not write the practice sentences (E26).

Prompts beat recasts (`docs/research/desirable-difficulties.md`, citing Lyster & Ranta 1997 and Lyster & Saito 2010). A cue that makes the learner choose again is more useful than the tutor's correct sentence.

## Decisions for the owner

- Should the `aspect` and `gender-this-my` tutor units stay as explanation-only units, or be removed once the families exist?
- Who writes the curated sentences for `ten`, `tento`, `to`, `tamten` and their forms?
- Aspect sits in the A2 chapter. Should aspect families open earlier, for A1 learners who already meet `robiť` and `urobiť`?

## Not checked

- No new literature on aspect or demonstrative acquisition was searched. The sources are the ones already in `docs/research/`.
- The app was not run. The coverage counts come from the lexicon file, not from what a learner sees.
- The quality and context of the existing aspect examples were not reviewed.

## Changes

Built on `feat/aspect-demonstrative-drills` (2026-11-04, decision E42 in `docs/DECISIONS.md`). The rules that set the limits are P8, E26 and E27; the verifier reviewed the rows (`/mnt/project-files/council/verifier-rows-1.md`). The status of each item:

| Item | Status | Evidence or reason |
|---|---|---|
| U1 Aspect families | DONE | One family `aspect` covers the 12 pairs (not one per chapter: the twins span chapters). `curriculum/slovak/mixups.json`. |
| U2 Twins | DONE | 12 pairs, including pisat/napisat, citat/precitat, robit/urobit, kupovat/kupit. `tests/aspect-families.test.ts` "lists twelve pairs". |
| U3 Rule | DONE | The family's `rule`: one English line, the tense does not decide it. |
| U4 Bridge | DONE | `lugesin raamatut` / `lugesin raamatu läbi` checked against `curriculum/slovak/seed-source.json` line 290. |
| U5 Probe | DONE for the mechanism; BLOCKED for supply | 18 verifier-approved rows only; 9 of 12 pairs have one; none has both aspects, so no pair is drilled (D2). |
| U6 Measure | DONE for the mechanism | Balance gate, mend and clear across both aspects, record gate: `tests/aspect-families.test.ts`. The record never gets an aspect pair until D2. |
| U7 Typed variant | DEFERRED | Typed reps exist for open mix-ups, graded deterministically. The Cheap-slot judge runs only in placement, after a string miss; a lesson judge is a new path, and no aspect pair can reach a typed rep yet. |
| U8 tento/ten family | BLOCKED | `this-vs-that` has 4 + 4 whole-word sentences, but no approved rows, and the English gloss must decide: the verifier has approved none (D2). |
| U9 More curated sentences | BLOCKED | Tatoeba is not reachable from the build container. Per-cell counts are in the PR; the verifier has approved no demonstrative row (D2). |
| U10 Form-level atlas drill | DEFERRED | Needs approved demonstrative rows per form and atlas cells of three or more (`src/core/grammar.ts` ties a cell to a learner's stats). The grid explanation is built as a static table instead. |
| U11 First tries in atlas cells | DEFERRED | Depends on U10. |
| U12 Explain on request | DONE | `components/lesson/grammar-explain.tsx`, shown in the Why? panel under "Parallels and examples"; a render test. Reachable only once a pair is drillable. |
| U13 One question after a miss | DONE | The family `cue`, shown after a miss by the lesson player's hint panel (`components/lesson/lesson-player.tsx`, the `pair.cue` branch). No model call; E18 unchanged. |
| U14 Typed answers | DONE (verified, unchanged) | Lessons grade typed answers with `compareAnswer`; the model judge runs only in placement, after a string miss. No model call added. |
| U15 Tutor units | DONE (left unchanged) | `tutor("aspect")` and `tutor("gender-this-my")` are untouched (D1). They still write practice in tutor chats. |
| R1 DECISIONS entry | DONE | E42. |
| R2 This note | DONE | This section; the research facts are unchanged. |
| R3 Changelog | DONE | `docs/CHANGELOG-2026-11.md`, 4 November section. |
| R4 Tests, typecheck, lint | DONE | Run on the branch; the counts are in the PR. |

Also built: the three cue points and a case grid for the explanations, a page-level slovak.wiki allowlist, the excluded sentences (four, with reasons), the `vtomto` typo in `reading.ts`, the empty frame file with its switch (`curriculum/slovak/aspect-frames.json`, `src/server/aspect-frames.ts`), and a simulator in the tests. Not built: the form-reading grid and the "pick the word that decided it" task (new rep kinds with nothing drillable to show them), Playwright screenshots (no lesson reaches the explanation in the shipped state), and any change to the Dvojičky pairs step. That step (E11) still drills 12 aspect pairs from raw verified sentences, 167 of its 230 sentences, without the approved rows or the both-aspects gate. Gating it would empty five chapter pairs-steps, so it is a coordinator decision, with the gate recommended.

Item bank: 18 rows give 18 unique items and 16 distinct (pair, cue type, phrase). The first repeat comes at the 19th choice rep, about 3 minutes (10 s a rep) or about 6 minutes typed (20 s, an assumption). An hour without a repeat needs about 360 distinct rows. The shipped state gives 0 sentences in 50 seeds.

## Owner decisions

- D1 The `aspect` and `gender-this-my` tutor units: keep them unchanged until the families have run in use (recommended). Open.
- D2 Who writes the curated sentences: the aspect sentences (9 pairs have one aspect, 3 have none, and none has both), and the demonstrative sentences. Open; blocks U5, U8, U9, U10.
- D3 Aspect families open earlier for A1 learners? Not decided; chapter placement unchanged. Open.
- D4 Authored cue frames. Recommendation: no frames until D2 is answered. If the owner wants them, each row needs the owner's approval and a verifier approval, and it counts apart from the verified pool. The mechanism is in place and holds no rows. Open.
