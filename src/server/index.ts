/**
 * THE SERVER-SIDE SURFACE — the only src module (besides the core barrel)
 * that app/ may import. Route handlers and server components come through
 * here; nothing under app/ touches src/store or src/agent directly.
 */

export * from "./chat-handler.ts";
export * from "./events-stream.ts";
export * from "./chats.ts";
export * from "./jobs.ts";
export * from "./stores.ts";
// The settings record + prompt overrides (settings-storage wave, 2026-09-19).
// The *Record aliases keep the app/api/settings routes explicit about which
// seam they touch (the raw record, not the chat-section convenience view).
export {
	readSettings as readSettingsRecord,
	writeSettings as writeSettingsRecord,
	settingsStore,
} from "../store/settings.ts";
export { promptOverrides } from "../store/prompt-overrides.ts";
// The progress record (the grammar atlas reads each unit's counts).
export { progressStore } from "../store/progress.ts";
export { isValidSegmentPath } from "../core/prompt-segments.ts";
// The canonical segment discovery/resolution lives in the agent layer
// (composition is an agent concern); the barrel re-exports it for the
// routes — server→agent is the lawful direction (chat-handler precedent).
export { effectivePromptSegments, allSegmentPaths } from "../agent/prompt-segments.ts";

// The auth/keys composition (auth-keys wave, 2026-09-19): the curated
// key catalog + the env-reflecting store behind GET/PUT/DELETE /api/keys.
// Importing this module runs the idempotent boot fill-gap — every consumer
// keeps its plain process.env reads (that seam is the point).
export * from "./keys.ts";
export * from "./search.ts";
export * from "./settings-body.ts";
export * from "./turn-liveness.ts";
export * from "./turn-runs.ts";
export * from "./dismissal-park.ts";
export * from "./compaction.ts";
export { piTurnResponse } from "./pi/ui-stream.ts";
export * from "./observability.ts";
export * from "./tasks.ts";
export * from "./model-catalog.ts";
export { subscriptionControlsResponse, subscriptionBrowserResponse } from "./web-subscription-http.ts";
export { sessionCost } from "./pricing.ts";
// LangHarness: language profiles + curriculum seeding, speech synthesis,
// spaced review, and the lexicon lookup the review page and tutor share.
export * from "./language.ts";
export { addEstimates, languageCatalog, removeLanguage, restoreLanguage, startLanguageAdd } from "./language-add.ts";
export { activeLanguage } from "./active-language.ts";
export * from "./reset.ts";
export * from "./storage.ts";
export * from "./tts.ts";
export * from "./review.ts";
export * from "./lesson.ts";
export { languageDay, setLanguageMinutes } from "./day-plan.ts";
export * from "./stamps.ts";
export * from "./mixups.ts";
export * from "./ai-status.ts";
export * from "./mistakes.ts";
export * from "./personal.ts";
// The chapter exam (Skúška, phase 6a, E14): the draw and its record.
export * from "./exam.ts";
export * from "./why.ts";
export * from "./reading.ts";
export * from "./catch-mistake.ts";
export * from "./listen.ts";
export * from "./speak.ts";
export * from "./fluency.ts";
export * from "./pronounce.ts";
export { speakStore } from "../store/speak.ts";
export * from "./watch.ts";
export * from "./discover.ts";
export * from "./fragments.ts";
export * from "./watch-sections.ts";
export * from "./watch-prep.ts";
export { videoStore } from "../store/videos.ts";
export * from "./milestones.ts";
export * from "./outside.ts";
export * from "./dated-scene.ts";
export * from "./placement.ts";
export { storyStore } from "../store/stories.ts";
export * from "./corpus-export.ts";
export * from "./usage-report.ts";
export { loadLexicon } from "../agent/lexicon.ts";
export { shownProfiles, type LanguageProfile } from "../../config.ts";
export * from "./distractors.ts";
export * from "./word-bank.ts";
export { savedPhraseStore } from "../store/saved-phrases.ts";
export { knownWordStore } from "../store/known-words.ts";
export { cheatsheetStore } from "../store/cheatsheets.ts";
export * from "./cheatsheets.ts";
// Remote access (E21): the pairing and device-session API, for app/api/access and Settings.
export { desktopWindowRequest } from "./desktop-access.ts";
export {
	DEVICE_COOKIE,
	cleanDeviceName,
	clearDeviceCookie,
	deviceCookie,
	deviceNameFromAgent,
	formatCode,
	listeningPort,
	normalizeCode,
	readCookie,
	secureRequest,
} from "./remote-access.ts";
export {
	accessStatus,
	createPairingCode,
	disableRemoteAccess,
	enableRemoteAccess,
	isPairedToken,
	redeemPairingCode,
	revokeDevice,
} from "./remote-access-store.ts";
export * from "./daylog.ts";
export * from "./line.ts";
export * from "./stage.ts";
