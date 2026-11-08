/**
 * THE CORE PUBLIC API — the only module the shell (app/, components/) may
 * import. Everything exported here is browser-safe: pure logic + types,
 * no node builtins, no fs, no network.
 *
 * Server-side surfaces (chat streaming, store reads) live behind
 * src/server's barrel instead — the import law (eslint.config.mjs):
 *
 *   components/**  →  "@/src/core"        (this barrel, ONLY)
 *   app/**         →  "@/src/core" + "@/src/server"
 *
 */

export * from "./contracts.ts";
export * from "./ports.ts";

export * from "./question-core.ts";
// The event bus (push architecture, 2026-10-02): vocabulary + emit/subscribe
// for every layer; the browser shell consumes the types + the runtime names
// through this barrel (shell law: pure core via @/src/core only).
export * from "./events.ts";
export * from "./pace.ts";
export * from "./plan-tree.ts";
export * from "./phases.ts";
export * from "./pending.ts";
export * from "./prompt-segments.ts";
// answer-presentation is not re-exported here: it pulls the Markdown parsers (about 250 KB), and a client component that imports this barrel would ship them on every route. Import them from "./tutor.ts" (client: "@/src/core/tutor").
// Wave B (owner-approved 2026-09-26): the native record (LhMessage), the
// and the input-events contract — all
// pure logic, browser-safe.
export * from "./native-messages.ts";
export * from "./compaction.ts";
export * from "./input-events.ts";
// Wave D (owner-approved 2026-09-26): the client view model — the grouping
// canon (one continuous assistant document, step separators) ported from
// the deleted server projection to the client side. Pure, browser-safe.
export * from "./view.ts";
export * from "./prices.ts";
export * from "./context-usage.ts";
export * from "./usage-report.ts";
export type { ChatGPTStatus, ChatGPTControlBridge } from "./contracts/chatgpt.ts";
export { NATIVE_SUBSCRIPTIONS } from "./contracts/subscriptions.ts";
export type { NativeSubscriptionProviderId, NativeSubscriptionStatus, NativeSubscriptionControlBridge } from "./contracts/subscriptions.ts";
export * from "./fuzzy.ts";
// settings.ts + settings-resolution.ts (settings-storage wave, 2026-09-19):
// the user-settings record's shape/sanitizer (pure) and its fully-resolved
// view. Browser-safe — the Wave-4 panel imports these directly.
export * from "./settings.ts";
export * from "./settings-resolution.ts";
export * from "./search.ts"; // search port (search wave, 2026-09-20)
export * from "./session-find.ts";
// auth-keys.ts (auth-keys wave, 2026-09-19): the curated key catalog +
// shape rules + masking — pure, browser-safe (the auth page binds to the
// /api/keys routes built on it).
export * from "./auth-keys.ts";
// keyboard.ts: the shortcut registry + binding normalization (pure, browser-safe).
export * from "./keyboard.ts";
// session-markdown.ts (2026-09-27 engine; first consumer 2026-10-06): the
// ONE session→markdown formatter — the extractor's view and the user-facing
// export share it. Pure, browser-safe.
export * from "./session-markdown.ts";
// LangHarness: target languages + answer comparison, the FSRS scheduler,
// and the cloze review model (all pure, browser-safe).
export * from "./language.ts";
export * from "./language-guard.ts";
export * from "./course.ts";
export * from "./variants.ts";
export * from "./fsrs.ts";
export * from "./review.ts";
export * from "./lesson.ts";
export * from "./reference-pages.ts";
export * from "./grammar.ts";
export * from "./form-slip.ts";
export * from "./review-miss.ts";
export * from "./first-try.ts";
export * from "./word-clusters.ts";
export * from "./pairs.ts";
export * from "./curriculum.ts";
export * from "./after-plan.ts";
export * from "./outside.ts";
export * from "./day-plan.ts";
export * from "./arc.ts";
export * from "./exam.ts";
export * from "./onboarding.ts";
export * from "./placement-ladder.ts";
export * from "./weak-spots.ts";
export * from "./mixups.ts";
export * from "./mistakes.ts";
export * from "./listen-analysis.ts";
export * from "./listen-guide.ts";
export * from "./ai-status.ts";
export * from "./personal.ts";
export * from "./vocab-probe.ts";
export * from "./unit-bridges.ts";
export * from "./reading.ts";
export * from "./listen.ts";
export * from "./active-time.ts";
export * from "./strands.ts";
export * from "./trajectory.ts";
export * from "./speak-script.ts";
export * from "./speak.ts";
export * from "./fluency.ts";
export * from "./sources.ts";
export * from "./saved-phrases.ts";
export * from "./cheatsheets.ts";
export * from "./word-search.ts";
export * from "./pronounce.ts";
export * from "./watch.ts";
export * from "./watch-sentences.ts";
export * from "./discover.ts";
export * from "./fragments.ts";
export * from "./ttl-memo.ts";
export * from "./watch-reps.ts";
export * from "./watch-sections.ts";
export * from "./watch-prep.ts";
export * from "./catch-mistake.ts";
export * from "./milestones.ts";
export * from "./dated-scene.ts";
export * from "./stamps.ts";
export * from "./plan.ts";
export * from "./storage.ts";
export * from "./daylog.ts";
export * from "./rules-map.ts";
export * from "./line.ts";
export * from "./stage.ts";
