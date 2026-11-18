/**
 * ElevenLabs audio for every story on the shelf, made ahead of time. The
 * reader asks /api/tts for each sentence with the voice `storySpeech`
 * picks; this makes the same clips in one go, so a story plays at once and
 * never falls back to Edge. The plan counts the characters first, so the
 * cost is known before anything is spent; one batch runs at a time and
 * reports its progress (GET /api/read/audio, `npm run audio:stories`).
 */

import { processWide } from "../core/process-wide.ts";
import { languageByCode } from "../core/language.ts";
import { storySpeech, type StoryAudioJob, type StoryAudioStatus } from "../core/reading.ts";
import { findAudioClip } from "../store/corpus.ts";
import { storyStore } from "../store/stories.ts";
import { regenCost, regenerate, type RegenItem, type RegenPlan } from "./audio-regen.ts";
import { activeLanguage } from "./active-language.ts";
import { keyValue } from "./keys.ts";
import { library } from "./reading.ts";
import { elevenLabsModelsFor, elevenLabsVoiceFor, latestElevenLabsModel, ttsCacheKey, ttsVoice } from "./tts.ts";

export interface StoryAudioPlan extends RegenPlan {
	stories: number;
	/** Stories whose every sentence already has an ElevenLabs clip. */
	storiesReady: number;
}

export function storyAudioPlan(): StoryAudioPlan {
	const items: RegenItem[] = [];
	const planned = new Set<string>();
	const kept: Record<string, number> = {};
	const keep = (why: string) => (kept[why] = (kept[why] ?? 0) + 1);
	let stories = 0;
	let storiesReady = 0;
	for (const entry of library()) {
		const story = storyStore.get(entry.id);
		if (!story) continue;
		stories++;
		const lang = languageByCode(story.lang) ?? [activeLanguage()].find((l) => l.code === story.lang);
		if (!lang || elevenLabsModelsFor(lang.code).length === 0) {
			keep("no ElevenLabs model reads the language");
			continue;
		}
		let missing = 0;
		for (const sentence of story.sentences) {
			const text = sentence.sk.trim();
			if (!text) continue;
			const speech = storySpeech(story, sentence);
			const voice = ttsVoice(speech.voice);
			if (!elevenLabsVoiceFor(voice, lang.code)) {
				keep("no ElevenLabs voice for the speaker");
				continue;
			}
			const key = ttsCacheKey({ text, lang: lang.code, voice });
			const hit = findAudioClip(key);
			if (hit?.tier === "elevenlabs") continue;
			missing++;
			if (planned.has(key)) continue;
			planned.add(key);
			items.push({
				entry: {
					key,
					lang: lang.code,
					voice,
					tier: hit?.tier ?? "none",
					text,
					file: hit?.file ?? "",
					bytes: hit?.bytes ?? 0,
					createdAt: hit?.createdAt ?? "",
				},
				lang,
				reason: hit ? "made without ElevenLabs" : "not made yet",
				chars: [...text].length,
				style: speech.style,
			});
		}
		if (missing === 0) storiesReady++;
	}
	return {
		model: latestElevenLabsModel(),
		items,
		chars: items.reduce((n, i) => n + i.chars, 0),
		kept,
		stories,
		storiesReady,
	};
}

const job = processWide("storyAudio.job", () => ({ current: null as StoryAudioJob | null }));

export function storyAudioJob(): StoryAudioJob | null {
	return job.current;
}

export function storyAudioStatus(): StoryAudioStatus {
	const plan = storyAudioPlan();
	return {
		hasKey: !!keyValue("ELEVENLABS_API_KEY"),
		stories: plan.stories,
		storiesReady: plan.storiesReady,
		sentences: plan.items.length,
		chars: plan.chars,
		cost: regenCost(plan.chars),
		job: job.current,
	};
}

export class StoryAudioError extends Error {}

/** Start making every missing clip in the background; the returned promise
 *  settles when the batch is done (the script waits on it, the route does not). */
export function startStoryAudio(
	opts: { maxChars?: number; concurrency?: number; onClip?: (item: RegenItem, ok: boolean) => void } = {},
): Promise<StoryAudioJob> {
	if (job.current && !job.current.finishedAt) throw new StoryAudioError("Audio is already being made.");
	if (!keyValue("ELEVENLABS_API_KEY")) throw new StoryAudioError("Add an ElevenLabs key in Settings first.");
	const plan = storyAudioPlan();
	const running: StoryAudioJob = {
		total: plan.items.length,
		done: 0,
		failed: 0,
		chars: 0,
		startedAt: new Date().toISOString(),
	};
	job.current = running;
	return regenerate(plan, {
		maxChars: opts.maxChars,
		concurrency: opts.concurrency ?? 3,
		onClip: (item, ok) => {
			if (ok) {
				running.done++;
				running.chars += item.chars;
			} else running.failed++;
			opts.onClip?.(item, ok);
		},
	})
		.then((result) => {
			if (result.failed[0]) running.error = result.failed[0].error;
			return running;
		})
		.catch((err: unknown) => {
			running.error = err instanceof Error ? err.message : String(err);
			return running;
		})
		.finally(() => {
			running.finishedAt = new Date().toISOString();
		});
}
