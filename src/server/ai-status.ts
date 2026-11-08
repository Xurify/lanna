/**
 * Whether the app can call a model for the features that are better with
 * one (the guide on /mistakes, custom milestones, stories…): a model is set
 * on the Cheap slot, or the Strong one when Cheap is empty (storyEngine in
 * reading.ts), and the provider's key is there. A slot with no key looks
 * set in Settings but fails at the first call, which is what this catches
 * before the learner presses a button.
 */

import type { ModelSlot } from "../core/settings.ts";
import { readSettings } from "../store/settings.ts";
import { providerKeyPresent } from "./keys.ts";

import type { AiStatus } from "../core/ai-status.ts";


/** Which slot a feature asks for first: most run on Cheap, falling back to
 *  Strong; the analysis of a learner's mistakes runs rarely and is reasoning,
 *  so it asks for Strong first and falls back to Cheap. */
type SlotPreference = "cheap" | "strong";

export function aiSlot(prefer: SlotPreference = "cheap"): ModelSlot | null {
	const models = readSettings()?.models;
	const order = prefer === "strong" ? [models?.strong, models?.cheap] : [models?.cheap, models?.strong];
	return order.find((slot) => slot?.model) ?? null;
}

export function aiStatus(prefer: SlotPreference = "cheap"): AiStatus {
	const slot = aiSlot(prefer);
	if (!slot?.model) return { ready: false, reason: "no-model" };
	const { provider, id } = slot.model;
	if (!providerKeyPresent(provider)) return { ready: false, reason: "no-key", provider };
	return { ready: true, model: `${provider}:${id}` };
}

/** What to tell the learner when AI is not ready, and where to fix it. */
export function aiMissing(status: AiStatus): string {
	if (status.ready) return "";
	return status.reason === "no-model"
		? "No model is set. Pick one in Settings → AI models, and add its key in Settings → API keys."
		: `The ${status.provider} key is missing. Add it in Settings → API keys, or pick another model in Settings → AI models.`;
}

/** A provider error that means "no key" in pi-ai's words, as the same plain message. */
export function friendlyAiError(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	const m = /Provider is not configured: (\S+)/.exec(message);
	if (m) return `The ${m[1]} key is missing. Add it in Settings → API keys, or pick another model in Settings → AI models.`;
	if (/\b(401|403)\b|invalid.*(api )?key|unauthori[sz]ed/i.test(message)) return "The model refused the key. Check it in Settings → API keys.";
	return message;
}
