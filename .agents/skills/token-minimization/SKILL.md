---
name: token-minimization
description: "Engineering methodology: token minimization over token maxing. Use frontier models to write and debug deterministic code and tests; run production workflows on standalone code and small task-specific models; never waste tokens on tasks solvable with traditional software engineering."
---

# Token Minimization: Pragmatic Software Engineering with AI

> _"The next big thing in AI is going to be **token minimizing**, not token maxing. Use the really smart models to write code, and then you create software systems like you did in the old days that run on their own. They don't need tokens."_  
> — Harper Carroll (@HarperCarrollAI), _Not Everything Needs an AI Agent_

## Overview & Philosophy

The default bias in modern AI development is "token-maxing" — chaining expensive, probabilistic frontier models into long, brittle agentic loops for tasks that traditional algorithms solve faster, cheaper, and with 100% determinism.

**Token Minimization** inverts this:

1. **Frontier models are software engineers, not runtime engines:** Use the current top frontier models (e.g. Claude Opus 5.5 or Gemini 4 Neon; check what's newest, since this list ages fast) during development to write code, design architectures, construct unit test suites, debug failures, and harden security.
2. **Production systems run on traditional code:** Runtime business logic, scheduling, validation, scoring, state transitions, and heuristics run as standalone code ($0 runtime cost, sub-millisecond latency, zero hallucinations).
3. **Tokens only enter at sharp, well-defined boundaries:** Only invoke models when semantic understanding, creative generation, or open-ended dialogue is strictly required. Where models are needed, favor small, task-specific, or fine-tuned models over frontier models.

---

## The Decision Matrix: Code vs. Small LLM vs. Frontier LLM

Before implementing any feature or pipeline step, evaluate it against this hierarchy:

```
                  ┌─────────────────────────────────────────┐
                  │ Can this be solved with code, math, or   │
                  │ deterministic rules/lookups?            │
                  └──────────────────┬──────────────────────┘
                                     │
                     YES ────────────┴─────────── NO
                      │                            │
                      ▼                            ▼
            ┌──────────────────┐    ┌─────────────────────────────────────────┐
            │ PURE CODE / DB   │    │ Is the task open-ended/creative, or     │
            │ Cost: $0.00      │    │ a narrow, structured semantic task?     │
            │ Latency: <1ms    │    └────────────────────┬────────────────────┘
            │ Reliability: 100%│                         │
            └──────────────────┘          NARROW ────────┴──────── OPEN-ENDED
                                             │                          │
                                             ▼                          ▼
                                   ┌──────────────────┐       ┌──────────────────┐
                                   │ SMALL/LOCAL LLM  │       │ FRONTIER MODEL   │
                                   │ Cost: ~$0.0001   │       │ Cost: Variable   │
                                   │ Latency: Low     │       │ Use: Synthesis,  │
                                   │ Specific tasks   │       │ deep reasoning   │
                                   └──────────────────┘       └──────────────────┘
```

### 1. Pure Code (Zero Tokens, Maximum Speed & Reliability)

Never use an LLM for:

- **Math, SRS, and Scheduling:** Spaced repetition calculations (SM-2, FSRS, Leeburg), daily streak counters, XP increments, mastery percentages.
- **Classification by Rule/Dictionary:** Grammar slip classification (e.g. matching an inflected form to its lemma or declension table), part-of-speech lookups, stem extraction.
- **Validation & Sanitization:** JSON schema validation, input bounds checking, profanity/character filtering.
- **Adaptive Routing & Selection:** Weighted random sampling, picking the next lesson unit, deciding review queue order, selecting contrast drills based on error tallies.
- **Dynamic Cues & Templates:** Composing explanation strings where the error category, target form, and trigger rule are known (e.g., _"Not '{given}'. '{trigger}' requires {case} (-{ending})"_).

### 2. Small / Task-Specific Models (Minimal Tokens)

Use small models (e.g. Claude Haiku 5.5, Gemini Omni 1.2 Flash, fine-tuned open-source models, local embeddings) for:

- Narrow semantic similarity (e.g. _"does this free-text answer mean the same as the target idiom?"_).
- Entity extraction or intent normalization from unstructured voice transcripts.
- Single-turn JSON field filling with tight constrained schemas.

### 3. Frontier Models (Targeted High-Leverage Tokens)

Reserve frontier models for:

- **Offline / Ahead-of-Time Generation:** Generating realistic lesson dialogs, cultural stories, lexicon examples, and reading comprehension questions batch-cached to disk.
- **Interactive Open-Ended Dialogue:** Real-time conversational tutoring (e.g., `/speak`, `/chat`) where the learner speaks freely and requires fluid, empathetic responses.
- **Deep Explanations on Demand:** When a learner explicitly clicks "Ask Tutor Why" on a confusing cultural nuance or complex idiom that templated rules cannot cover.
- **Development & Refactoring:** Writing code, writing exhaustive unit tests, debugging edge-case test failures, and refactoring architecture.

---

## Architectural Rules for Token Minimization

1. **Pre-compute and Cache Everything Possible:**
   - Don't ask an LLM to generate questions on the fly in the request path if they can be generated, verified, and stored ahead of time in `curriculum/` or database fixtures.
2. **Never Chain LLMs When Code Can Bridge Them:**
   - Avoid "Agent A talks to Agent B talks to Agent C". If Agent A outputs JSON, parse and validate it with standard code, apply business logic in code, and only pass the remainder to Agent B if strictly necessary.
3. **Fail Fast with Tests, Not Prompts:**
   - Write comprehensive unit tests for business logic. If a prompt or model output is inconsistent, harden the schema and parser with deterministic validation instead of adding more prompt instructions.
4. **Instrument Token Costs:**
   - Track every token consumed as an operational cost metric. A feature that costs 0 tokens is infinitely scalable and immune to third-party API rate limits and outages.
