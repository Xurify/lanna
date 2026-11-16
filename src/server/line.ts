/**
 * Today's line (2026-11-05) — behind /line, /api/line and the
 * Today card. The day's sentence is picked once from the dictionary and kept:
 * the morning hearing stores it, so the evening replay plays the same words.
 * Nothing here calls a model; the audio is the shared Listen audio.
 *
 * The evening replay is offered only after the learner has practiced that
 * day (XP, reps or a review), so the line never asks for a return visit on
 * its own (docs/research/creator-hooks.md, proposal 1).
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { activeProfile } from "../../config.ts";
import { addMinutes } from "../core/active-time.ts";
import { dayKey } from "../core/review.ts";
import {
	LINE_REPEAT_DAYS,
	lineSeed,
	pickLine,
	repeatWindowStart,
	scoreLine,
	type LineDay,
	type LineItem,
	type LineRecord,
	type LineScore,
	type LineState,
	type LineWord,
} from "../core/line.ts";
import { progressStore } from "../store/progress.ts";
import { lineStore } from "../store/line.ts";
import { knownWords, resolveWord, STORY_NAMES } from "./reading.ts";

const pickCache = new Map<string, LineItem | null>();

function lookupFor(lexicon: NonNullable<ReturnType<typeof loadLexicon>>) {
	const k = knownWords(lexicon);
	return {
		resolve: (form: string) => resolveWord(lexicon, form, k.known),
		known: k.known,
		names: STORY_NAMES,
	};
}

function recentIds(records: readonly LineRecord[], day: string): Set<string> {
	const from = repeatWindowStart(day);
	return new Set(records.filter((r) => r.day >= from && r.day < day).map((r) => r.itemId));
}

/** The day's pick before anyone has heard it. Cached per profile and day, since
 *  the past days it depends on do not change. */
function pickToday(day: string, records: readonly LineRecord[]): LineItem | null {
	const profile = activeProfile();
	const key = `${profile}|${day}`;
	if (pickCache.has(key)) return pickCache.get(key)!;
	const lexicon = loadLexicon();
	if (!lexicon) return null;
	const item = pickLine(lexicon.entries, lookupFor(lexicon), {
		seed: lineSeed(profile, day),
		recent: recentIds(records, day),
	});
	pickCache.set(key, item);
	return item;
}

function fromRecord(r: LineRecord): LineItem {
	return {
		id: r.itemId,
		slug: r.itemId.split("#")[0]!,
		sentence: r.sentence,
		translation: r.translation,
		words: r.words,
		newWords: r.newWords,
	};
}

function dayBefore(day: string, n: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - n);
	return d.toISOString().slice(0, 10);
}

function history(records: readonly LineRecord[], day: string): LineDay[] {
	const out: LineDay[] = [];
	for (let n = LINE_REPEAT_DAYS - 1; n >= 0; n--) {
		const d = dayBefore(day, n);
		const m = records.find((r) => r.day === d && r.phase === "morning");
		const e = records.find((r) => r.day === d && r.phase === "evening");
		out.push({
			day: d,
			morning: m ? { caught: m.caught, words: m.words } : null,
			evening: e ? { caught: e.caught, words: e.words } : null,
		});
	}
	return out;
}

function practicedToday(day: string): boolean {
	const d = progressStore.read().days[day];
	return !!d && ((d.xp ?? 0) > 0 || (d.reps ?? 0) > 0 || (d.reviews ?? 0) > 0);
}

export function lineState(now = new Date(), tz = now.getTimezoneOffset()): LineState {
	const day = dayKey(now, tz);
	const records = lineStore.read();
	const todays = records.filter((r) => r.day === day);
	const morning = todays.find((r) => r.phase === "morning") ?? null;
	const evening = todays.find((r) => r.phase === "evening") ?? null;
	const item = morning ? fromRecord(morning) : pickToday(day, records);
	return {
		day,
		item: item
			? {
					id: item.id,
					sentence: item.sentence,
					translation: item.translation,
					words: item.words,
					newWords: item.newWords,
				}
			: null,
		morning,
		evening,
		eveningOpen: practicedToday(day),
		history: history(records, day),
	};
}

interface LineAnswer {
	phase: "morning" | "evening";
	itemId: string;
	typed: string;
	plays?: number;
	activeMs?: number;
}

type LineOutcome = { ok: true; record: LineRecord; score: LineScore } | { ok: false; status: 409; message: string };

export function recordLine(input: LineAnswer, now = new Date(), tz = now.getTimezoneOffset()): LineOutcome {
	const day = dayKey(now, tz);
	const records = lineStore.read();
	const todays = records.filter((r) => r.day === day);
	const morning = todays.find((r) => r.phase === "morning");
	const evening = todays.find((r) => r.phase === "evening");
	let item: LineItem | null;
	if (input.phase === "morning") {
		if (morning) return { ok: false, status: 409, message: "Today's line was already heard this morning." };
		item = pickToday(day, records);
	} else {
		if (!morning) return { ok: false, status: 409, message: "Hear the line in the morning first." };
		if (evening) return { ok: false, status: 409, message: "Today's line was already heard again today." };
		if (!practicedToday(day))
			return { ok: false, status: 409, message: "The line comes back once you have practiced today." };
		item = fromRecord(morning);
	}
	if (!item) return { ok: false, status: 409, message: "There is no line today." };
	if (item.id !== input.itemId) return { ok: false, status: 409, message: "The line changed; reload the page." };
	const score = scoreLine(item.sentence, input.typed);
	const record: LineRecord = {
		day,
		phase: input.phase,
		itemId: item.id,
		sentence: item.sentence,
		translation: item.translation,
		newWords: item.newWords as LineWord[],
		typed: input.typed,
		words: score.words,
		caught: score.caught,
		plays: input.plays ?? 0,
		...(input.activeMs !== undefined ? { activeMs: input.activeMs } : {}),
		at: now.toISOString(),
	};
	lineStore.append(record);
	if (input.activeMs && input.activeMs > 0) {
		const p = progressStore.read();
		const d = (p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
		addMinutes(d, "listen", input.activeMs);
		progressStore.write(p);
	}
	return { ok: true, record, score };
}
