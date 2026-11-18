/**
 * Regenerate kept audio with the newest ElevenLabs model (2026-11-07). The
 * plan reads the audio index and picks every clip ElevenLabs can now make
 * better: one made by an older model, or one Edge or Piper made while
 * ElevenLabs was not available, in a language and voice ElevenLabs reads
 * now. It counts the characters first, so the cost is known before anything
 * is spent (`npm run audio:regen`, `-- --yes` to spend).
 *
 * Nothing is deleted (E1): a replaced file moves to
 * audio/replaced/<stamp>/ and the new clip takes its index line.
 */

import { addedLanguageIds } from "../../config.ts";
import { languageByCode, languageById, type LanguageInfo } from "../core/language.ts";
import { profileLanguage } from "./active-language.ts";
import { getSoundNotes, soundGuideWords } from "../core/sound-notes.ts";
import { audioKey, findAudioClip, readAudioIndex, setAsideAudioClip, storeAudioClip } from "../store/corpus.ts";
import { elevenLabs, elevenLabsModelsFor, elevenLabsVoiceFor, keptByElevenLabs, latestElevenLabsModel } from "./tts.ts";
import { NARRATOR_VOICE } from "./voices.ts";

/** ElevenLabs bills text to speech by the character: one credit a character
 *  in the app, dollars per 1,000 characters on the API. The API rate seen on
 *  elevenlabs.io/pricing/api on 2026-11-07 ranged from $0.022 (a newer,
 *  possibly promotional page) to $0.08 (an older one); check before trusting it. */
const CREDITS_PER_CHAR = 1;
export const USD_PER_1K_CHARS = { low: 0.022, high: 0.08 } as const;

type RegenReason = "older model" | "made without ElevenLabs" | "not made yet";

export interface RegenItem {
	/** `file` is empty for a clip that was never made. */
	entry: { key: string; lang: string; voice: string; text: string; file: string };
	lang: LanguageInfo;
	reason: RegenReason;
	chars: number;
	/** The reader's own reading style; guessed from the voice when absent. */
	style?: "narration" | "dialogue";
}

export interface RegenPlan {
	model: string;
	items: RegenItem[];
	chars: number;
	/** Clips left alone, by why. */
	kept: Record<string, number>;
}

function knownLanguages(): void {
	for (const id of addedLanguageIds()) profileLanguage(id);
}

export function regenPlan(): RegenPlan {
	knownLanguages();
	const model = latestElevenLabsModel();
	const items: RegenItem[] = [];
	const kept: Record<string, number> = {};
	const keep = (why: string) => (kept[why] = (kept[why] ?? 0) + 1);
	for (const entry of readAudioIndex().values()) {
		if (!entry.text) {
			keep("text not known (migrated clip)");
			continue;
		}
		const lang = languageByCode(entry.lang);
		if (!lang) {
			keep("language not on this install");
			continue;
		}
		if (entry.tier === "elevenlabs" && entry.model === model) {
			keep("already the newest model");
			continue;
		}
		if (elevenLabsModelsFor(lang.code).length === 0) {
			keep("no ElevenLabs model reads the language");
			continue;
		}
		if (!elevenLabsVoiceFor(entry.voice, lang.code)) {
			keep("no ElevenLabs voice for this language's words (Edge)");
			continue;
		}
		const text = entry.text;
		items.push({
			entry: { ...entry, text },
			lang,
			reason: entry.tier === "elevenlabs" ? "older model" : "made without ElevenLabs",
			chars: [...text].length,
		});
	}
	return { model, items, chars: items.reduce((n, i) => n + i.chars, 0), kept };
}

const SOUND_GUIDE_LANGUAGES = ["slovak", "russian", "estonian"];

/** Every word the Sound guide plays that ElevenLabs has not read yet, in the
 *  voice the guide asks for (`prefer=elevenlabs`, the language's default voice). */
export function soundGuidePlan(): RegenPlan {
	knownLanguages();
	const items: RegenItem[] = [];
	const kept: Record<string, number> = {};
	const keep = (why: string, n = 1) => (kept[why] = (kept[why] ?? 0) + n);
	for (const id of SOUND_GUIDE_LANGUAGES) {
		const lang = languageById(id);
		const words = soundGuideWords(id);
		if (!lang || !getSoundNotes(id)) continue;
		if (elevenLabsModelsFor(lang.code).length === 0 || !elevenLabsVoiceFor("female", lang.code)) {
			keep(`no ElevenLabs voice for ${lang.english} words (Edge)`, words.length);
			continue;
		}
		for (const text of words) {
			const key = audioKey(lang.code, "female", text);
			if (keptByElevenLabs(key, lang.code)) {
				keep("already read by ElevenLabs");
				continue;
			}
			const hit = findAudioClip(key);
			items.push({
				entry: { key, lang: lang.code, voice: "female", text, file: hit?.file ?? "" },
				lang,
				reason: hit ? "made without ElevenLabs" : "not made yet",
				chars: [...text].length,
			});
		}
	}
	return { model: latestElevenLabsModel(), items, chars: items.reduce((n, i) => n + i.chars, 0), kept };
}

/** The cost of a plan in credits and in dollars at the low and high API rate. */
export function regenCost(chars: number): { credits: number; usdLow: number; usdHigh: number } {
	return {
		credits: chars * CREDITS_PER_CHAR,
		usdLow: (chars / 1000) * USD_PER_1K_CHARS.low,
		usdHigh: (chars / 1000) * USD_PER_1K_CHARS.high,
	};
}

/** Narration for the story narrator and the language voices; a story
 *  character's own voice reads its line as dialogue. The cache key never
 *  held the style, so this is the same guess the reader makes. */
function styleOf(voice: string): "narration" | "dialogue" {
	return voice === "female" || voice === "male" || voice === NARRATOR_VOICE ? "narration" : "dialogue";
}

export interface RegenResult {
	done: number;
	chars: number;
	failed: Array<{ text: string; error: string }>;
	stoppedAt?: string;
}

/** Make each planned clip again, oldest index order, `concurrency` at a time,
 *  stopping before `maxChars` would be passed. A clip is replaced only after
 *  the new audio arrived. */
export async function regenerate(
	plan: RegenPlan,
	opts: { maxChars?: number; concurrency?: number; now?: Date; onClip?: (item: RegenItem, ok: boolean) => void } = {},
): Promise<RegenResult> {
	const now = opts.now ?? new Date();
	const result: RegenResult = { done: 0, chars: 0, failed: [] };
	const queue: RegenItem[] = [];
	let budget = opts.maxChars ?? Infinity;
	for (const item of plan.items) {
		if (item.chars > budget) {
			result.stoppedAt = item.entry.text;
			break;
		}
		budget -= item.chars;
		queue.push(item);
	}
	const work = async (item: RegenItem) => {
		const { entry, lang } = item;
		try {
			const spoken = await elevenLabs(
				{
					text: entry.text,
					lang: lang.code,
					voice: entry.voice,
					gender: entry.voice === "male" ? "male" : "female",
					style: item.style ?? styleOf(entry.voice),
				},
				lang,
			);
			if (!spoken || spoken.data.length === 0) throw new Error("ElevenLabs returned nothing");
			setAsideAudioClip(entry, now);
			storeAudioClip({
				key: entry.key,
				lang: entry.lang,
				voice: entry.voice,
				tier: "elevenlabs",
				...(spoken.model ? { model: spoken.model } : {}),
				text: entry.text,
				ext: "mp3",
				data: spoken.data,
			});
			result.done++;
			result.chars += item.chars;
			opts.onClip?.(item, true);
		} catch (err) {
			result.failed.push({ text: entry.text, error: err instanceof Error ? err.message : String(err) });
			opts.onClip?.(item, false);
		}
	};
	const lanes = Math.max(1, opts.concurrency ?? 3);
	let next = 0;
	await Promise.all(
		Array.from({ length: lanes }, async () => {
			while (next < queue.length) await work(queue[next++]!);
		}),
	);
	return result;
}
