/**
 * Whether a model can be called for the features that need one (LangHarness,
 * 2026-11-01). The type lives in the core barrel so the browser can read the
 * status it is given; the check itself is src/server/ai-status.ts.
 */

export type AiStatus =
	| { ready: true; model: string }
	| { ready: false; reason: "no-model" | "no-key"; provider?: string };
