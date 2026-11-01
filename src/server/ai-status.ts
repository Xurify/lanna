/**
 * Whether the app can call a model for the features that are better with
 * one (the guide on /mistakes, custom milestones, stories…): a model is set
 * on the Cheap slot, or the Strong one when Cheap is empty (storyEngine in
 * reading.ts), and the provider's key is there. A slot with no key looks
 * set in Settings but fails at the first call, which is what this catches
 * before the learner presses a button.
 */

import { readSettings } from "../store/settings.ts";
import { providerKeyPresent } from "./keys.ts";

export type AiStatus = { ready: true; model: string } | { ready: false; reason: "no-model" | "no-key"; provider?: string };

export function aiStatus(): AiStatus {
	const models = readSettings()?.models;
	const slot = models?.cheap?.model ? models.cheap : models?.strong?.model ? models.strong : null;
	if (!slot?.model) return { ready: false, reason: "no-model" };
	const { provider, id } = slot.model;
	if (!providerKeyPresent(provider)) return { ready: false, reason: "no-key", provider };
	return { ready: true, model: `${provider}:${id}` };
}

/** What to tell the learner when AI is not ready, and where to fix it. */
export function aiMissing(status: AiStatus): string {
	if (status.ready) return "";
	return status.reason === "no-model"
		? "No model is set. Pick one for the Cheap slot in Settings → AI models, and add its key in Settings → API keys."
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
