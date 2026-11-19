/**
 * The corpus export (2026-10-27) — `npm run corpus:export`
 * (scripts/corpus-export.ts) and, one day, a Settings button. Reads every
 * store of the active profile plus the shared audio library and writes
 * one normalized, app-independent file per kind of content into
 * <data>/export/<stamp>/, with a README naming every field. The raw
 * folders are never touched: the export is a view for whatever Xurify
 * builds next, not the record.
 */

import fs from "node:fs";
import path from "node:path";
import { activeProfile, PATHS } from "../../config.ts";
import type { ChatRecord } from "../core/contracts.ts";
import { activeLanguage } from "./active-language.ts";
import { userFacingTextOf, failedOutputCallIds } from "../core/chat-messages.ts";
import { chatStore } from "../store/chats.ts";
import { ensureReadmes, listAudioClips, listWhy, readLessonLog, type LessonLogEntry } from "../store/corpus.ts";
import { reviewStore } from "../store/review.ts";
import { storyStore } from "../store/stories.ts";
import { readingSourceStore } from "../store/reading-sources.ts";
import { fluencyStore, speakStore } from "../store/speak.ts";
import { notesStore } from "../store/notes.ts";
import { outsideStore } from "../store/outside.ts";
import { videoStore } from "../store/videos.ts";
import { knownWordStore } from "../store/known-words.ts";
import { wordCheckStore } from "../store/word-check.ts";
import { readWriting } from "../store/writing.ts";
import { cheatsheetStore } from "../store/cheatsheets.ts";
import { sheetPracticeStore } from "../store/sheet-practice.ts";
import type { Cheatsheet } from "../core/cheatsheets.ts";
import type { VideoRecord } from "../core/watch.ts";
import type { SpeakSession } from "../core/speak.ts";
import type { StoryRecord } from "../core/reading.ts";
import { sessionCost, turnCost } from "./pricing.ts";
import { migrateAudioOnce } from "./tts.ts";

/** At boot (the Today page's first render): move the old audio cache into
 *  the library and put the READMEs in place. Idempotent and cheap. */
export function prepareCorpus(): void {
	migrateAudioOnce();
	ensureReadmes();
}

interface ExportedMessage {
	role: "user" | "assistant";
	/** Learner-facing text only: no thinking, no tool plumbing. */
	text: string;
	/** `say:` phrases in this message, in order. */
	spoken: string[];
	at?: string;
}

interface ExportedDialogue {
	id: string;
	title: string;
	/** "learn" (course) or "practice" (Talk, Story, Why?, Practice). */
	kind: "learn" | "practice" | "chat";
	/** Why?, Talk, Story or Practice, read off the first message; null for a course. */
	practiceMode: "why" | "talk" | "story" | "practice" | null;
	deleted: boolean;
	createdAt: string;
	updatedAt: string;
	messages: ExportedMessage[];
	usage: {
		turns: number;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		costUsd: number | null;
		models: string[];
	};
}

interface ExportedExplanation {
	sentence: string;
	answer: string;
	lemma: string;
	learnerWrote: string;
	question: string;
	/** The tutor's first reply — the explanation itself. */
	explanation: string;
	chatId: string;
	askedAt: string;
	reopened: number;
}

interface ExportedSentence {
	sentence: string;
	translation: string;
	answer: string;
	lemma: string;
	gloss: string;
	unit: string;
	trigger?: string;
	timesSeen: number;
	timesRight: number;
	/** Every answer the learner gave for it, oldest first. */
	answers: Array<{ at: string; kind: string; given: string; verdict: string; assisted: boolean }>;
}

interface CorpusSummary {
	exportedAt: string;
	profile: string;
	language: string;
	counts: {
		audioClips: number;
		lessons: number;
		reps: number;
		sentences: number;
		dialogues: number;
		explanations: number;
		reviewCards: number;
		reviewAnswers: number;
		stories: number;
		readings: number;
		spokenScenes: number;
		fluencyRounds: number;
		videos: number;
		watchings: number;
		cheatsheets: number;
		writingChecks: number;
	};
	usage: {
		turns: number;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		costUsd: number;
		unpricedTurns: number;
		/** Story generations (the Read task), USD. */ storiesUsd: number;
		/** Spoken scenes (the Speak task), USD. */ speakUsd: number;
		/** Videos prepared for the Watch task (translation + questions), USD. */ videosUsd: number;
		writingUsd: number;
	};
}

const SAY_SPAN = /`say:\s*([^`]+)`/g;

function spokenIn(text: string): string[] {
	return [...text.matchAll(SAY_SPAN)].map((m) => m[1]!.trim());
}

export function exportDialogue(chat: ChatRecord, deleted = false): ExportedDialogue {
	const failed = failedOutputCallIds(chat.messages);
	const messages: ExportedMessage[] = [];
	for (const m of chat.messages) {
		if (m.role !== "user" && m.role !== "assistant") continue;
		const text = userFacingTextOf(m.content, failed).join("\n\n").trim();
		if (!text) continue;
		const at =
			typeof (m as { timestamp?: unknown }).timestamp === "number"
				? new Date((m as { timestamp: number }).timestamp).toISOString()
				: undefined;
		messages.push({ role: m.role, text, spoken: spokenIn(text), ...(at ? { at } : {}) });
	}
	const first = messages.find((m) => m.role === "user")?.text ?? "";
	const practiceMode =
		chat.kind === "chat"
			? /^why\b/i.test((first || chat.title).trim())
				? "why"
				: null
			: chat.kind !== "practice"
				? null
				: /^why\?/i.test(first)
					? "why"
					: /^talk:/i.test(first)
						? "talk"
						: /^story:/i.test(first)
							? "story"
							: "practice";
	const usage = {
		turns: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		costUsd: null as number | null,
		models: [] as string[],
	};
	const models = new Set<string>();
	for (const turn of chat.turns ?? []) {
		usage.turns++;
		models.add(turn.model);
		for (const s of turn.steps) {
			usage.inputTokens += s.inputTokens ?? 0;
			usage.outputTokens += s.outputTokens ?? 0;
			usage.cacheReadTokens += s.cacheReadTokens ?? 0;
			usage.cacheWriteTokens += s.cacheWriteTokens ?? 0;
		}
	}
	usage.models = [...models];
	try {
		const priced = sessionCost(chat);
		usage.costUsd = priced.unpriced === (chat.turns?.length ?? 0) && usage.turns > 0 ? null : priced.cost;
	} catch {
		usage.costUsd = null;
	}
	return {
		id: chat.id,
		title: chat.title,
		kind: chat.kind === "practice" || chat.kind === "chat" ? chat.kind : "learn",
		practiceMode,
		deleted,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		messages,
		usage,
	};
}

function readTrash(): ChatRecord[] {
	const dir = path.join(PATHS.chats, "trash");
	let files: string[];
	try {
		files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
	} catch {
		return [];
	}
	const out: ChatRecord[] = [];
	for (const f of files) {
		try {
			out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ChatRecord);
		} catch {
			// a torn file is skipped
		}
	}
	return out;
}

export function sentencesFrom(lessons: LessonLogEntry[]): ExportedSentence[] {
	const map = new Map<string, ExportedSentence>();
	for (const lesson of lessons) {
		for (const rep of lesson.reps) {
			if (!rep.sentence) continue;
			const key = `${rep.sentence}\u0000${rep.answer}`;
			let s = map.get(key);
			if (!s) {
				s = {
					sentence: rep.sentence,
					translation: rep.translation,
					answer: rep.answer,
					lemma: rep.lemma,
					gloss: rep.gloss,
					unit: rep.unit,
					...(rep.trigger ? { trigger: rep.trigger } : {}),
					timesSeen: 0,
					timesRight: 0,
					answers: [],
				};
				map.set(key, s);
			}
			s.timesSeen++;
			if (rep.verdict !== "wrong") s.timesRight++;
			s.answers.push({ at: lesson.at, kind: rep.kind, given: rep.given, verdict: rep.verdict, assisted: rep.assisted });
		}
	}
	return [...map.values()].sort((a, b) => a.sentence.localeCompare(b.sentence, "sk"));
}

const EXPORT_README = `# Lanna corpus export

A clean snapshot of everything generated or produced while learning, in
plain JSON. Made by \`npm run corpus:export\`; the raw data folders are the
source and stay as they are. Every file is a JSON array unless noted.

| File | One entry per | Fields |
|---|---|---|
| \`summary.json\` | the export (an object) | when, profile, counts per kind, total tokens and cost |
| \`audio.json\` | spoken clip | \`text\`, \`lang\`, \`voice\`, \`tier\` (engine), \`file\` (relative to \`<data>/audio/\`), \`bytes\`, \`createdAt\`, \`key\` |
| \`sentences.json\` | distinct lesson sentence | \`sentence\`, \`translation\`, \`answer\` (the blanked form), \`lemma\`, \`gloss\`, \`unit\`, \`trigger\`, \`timesSeen\`, \`timesRight\`, \`answers[]\` (\`at\`, \`kind\`, \`given\`, \`verdict\`, \`assisted\`) |
| \`lessons.json\` | finished lesson, blitz or placement drill | \`id\`, \`at\`, \`day\`, \`unit\`, \`mode\`, \`ms\`, \`xp\`, \`correct\`, \`total\`, \`perfect\`, \`queued\`, \`reps[]\` (every exercise with sentence, answer, what you gave, verdict) |
| \`dialogues.json\` | tutor session | \`id\`, \`title\`, \`kind\` (learn/practice/chat), \`practiceMode\` (why/talk/story/practice; why or null for a chat), \`deleted\`, dates, \`messages[]\` (\`role\`, \`text\`, \`spoken[]\` = the say: phrases), \`usage\` (tokens, cost, models) |
| \`explanations.json\` | Why? question | \`sentence\`, \`answer\`, \`lemma\`, \`learnerWrote\`, \`question\`, \`explanation\` (the tutor's reply), \`chatId\`, \`askedAt\`, \`reopened\` |
| \`review.json\` | an object | \`cards[]\` (every spaced-review card with its memory state) and \`answers[]\` (every review answer: card, given, verdict, rating, when) |
| \`writing.json\` | checked passage | \`targets[]\` (slug, lemma, gloss), learner \`text\`, \`reply\` (ok, feedback, or null if unusable), \`raw\` model output, \`usage\` (model and token steps), \`at\` |
| \`known.json\` | an object | \`words\` (the words you marked as known: by slug, the dictionary form and when) and \`updatedAt\` |
| \`word-check.json\` | an object | \`answers[]\` (every word asked in a word check: the word, its place in the frequency order, the meaning you typed, the verdict, whether the dictionary or a model marked it, when), \`sessions[]\` (every check with the estimate before and after), \`history\` (the estimate of words you know per day, with its parts) and \`judgements\` (every verdict a model gave on a typed meaning, kept so the same answer is never sent twice) |
| \`stories.json\` | an object | \`stories[]\` (every graded story episode written for the Read task: title, level, theme, sentences with glossed tokens, questions, new words, recap, coverage, usage), \`readings[]\` (every reading: story, when, score, words tapped and queued, XP) and \`sources[]\` (your own texts as added: the text, its sections and the difficulty chosen; a story written from one carries \`source\` and \`original\`) |
| \`videos.json\` | an object | \`videos[]\` (every YouTube video prepared for the Watch task: title, channel, length, caption source, every line with times, translation and glossed tokens, the pre-teach words, questions, coverage, usage), \`watchings[]\` (every watching: mode, lines got on the first listen, replays, the check, words tapped and queued, XP, per-line stats), \`sections[]\` (the study sections a model found per video) and \`preps[]\` (the briefing made per video before watching: what it is about, its parts, the keys, the short version at the learner's level, its cost, and when the keys were typed) |
| \`cheatsheets.json\` | an array | every cheatsheet you made under Words → Cheatsheets: title, when made and edited, and its sections with their rows (the phrase, how to say it, the meaning, a note) |
| \`cheatsheet-practice.json\` | an object | Listen and type on your cheatsheets: \`phrases\` (per sheet and phrase: times heard, how many times in a row it was caught by ear, when) and \`sessions[]\` (every session: the sheet, the day, and each phrase with what you typed and the verdict). Your own phrases, unchecked, so none of it is in \`lessons.json\` |
| \`spoken.json\` | an object | \`scenes[]\` (every spoken scene from the Speak task: scene, level, every line with role, the line in the language, meaning, prompts and repairs, how each of your lines arrived and its recording's file under \`<data>/profiles/<lang>/speak/<id>/\`, the end summary, usage) and \`fluency[]\` (every timed re-read and "say it faster" round) |
| \`notes.json\` | an array | every note from the Notes page: the title, the text with its \`[m:ss]\` time stamps, each link with its card (title, site, description, picture, the YouTube id for a video), when made and changed |
| \`outside-listening.json\` | an array | every stretch of listening you logged outside the app: the day, minutes, \`focused\` or \`background\`, and what it was. Logged by hand, never measured |

Text is UTF-8 with diacritics as written. Verdicts: \`exact\`,
\`accents\` (right apart from diacritics), \`wrong\`. Tokens are per provider
report; \`costUsd\` is null when a model had no price in the catalog.
`;

interface ExportResult {
	dir: string;
	summary: CorpusSummary;
}

/** Write the export; `stamp` defaults to the current minute (local time). */
export function exportCorpus(opts: { stamp?: string; now?: Date } = {}): ExportResult {
	const now = opts.now ?? new Date();
	const stamp =
		opts.stamp ??
		`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
	const dir = path.join(/*turbopackIgnore: true*/ PATHS.exports, stamp);
	fs.mkdirSync(dir, { recursive: true });

	const audio = listAudioClips().sort((a, b) => (a.text ?? "").localeCompare(b.text ?? "", "sk"));
	const lessons = readLessonLog();
	const sentences = sentencesFrom(lessons);
	const live = chatStore
		.listChats()
		.map((c) => chatStore.getChat(c.id))
		.filter((c): c is ChatRecord => c !== null)
		.map((c) => exportDialogue(c, false));
	const trashed = readTrash().map((c) => exportDialogue(c, true));
	const dialogues = [...live, ...trashed].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	const byId = new Map(dialogues.map((d) => [d.id, d]));
	const explanations: ExportedExplanation[] = listWhy()
		.map((w) => {
			const d = byId.get(w.chatId);
			const question = d?.messages.find((m) => m.role === "user")?.text ?? "";
			const explanation = d?.messages.find((m) => m.role === "assistant")?.text ?? "";
			return {
				sentence: w.sentence,
				answer: w.answer,
				lemma: w.lemma,
				learnerWrote: w.given,
				question,
				explanation,
				chatId: w.chatId,
				askedAt: w.createdAt,
				reopened: w.reused ?? 0,
			};
		})
		.sort((a, b) => a.askedAt.localeCompare(b.askedAt));
	const cards = Object.values(reviewStore.readCards()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	const answers = reviewStore.readLog();
	const stories = storyStore
		.list()
		.map((s) => storyStore.get(s.id))
		.filter((s): s is StoryRecord => s !== null);
	const readings = storyStore.reads();
	let storiesUsd = 0;
	for (const s of stories) {
		try {
			storiesUsd += turnCost(s.usage as never) ?? 0;
		} catch {
			// unpriced model: not counted
		}
	}
	const scenes = speakStore
		.list()
		.map((e) => speakStore.get(e.id))
		.filter((s): s is SpeakSession => s !== null);
	const fluency = fluencyStore.list();
	const videos = videoStore
		.list()
		.map((e) => videoStore.get(e.id))
		.filter((v): v is VideoRecord => v !== null);
	const watchings = videoStore.watches();
	const sections = videoStore.allSections();
	const preps = videoStore.allPreps();
	let videosUsd = 0;
	for (const v of [...videos, ...sections, ...preps]) {
		try {
			videosUsd += turnCost(v.usage as never) ?? 0;
		} catch {
			// unpriced model: not counted
		}
	}
	let speakUsd = 0;
	for (const s of scenes) {
		try {
			speakUsd += turnCost(s.usage as never) ?? 0;
		} catch {
			// unpriced model: not counted
		}
	}

	const usage = {
		turns: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		costUsd: 0,
		unpricedTurns: 0,
		storiesUsd: Math.round(storiesUsd * 10000) / 10000,
		speakUsd: Math.round(speakUsd * 10000) / 10000,
		videosUsd: Math.round(videosUsd * 10000) / 10000,
	};
	for (const d of dialogues) {
		usage.turns += d.usage.turns;
		usage.inputTokens += d.usage.inputTokens;
		usage.outputTokens += d.usage.outputTokens;
		usage.cacheReadTokens += d.usage.cacheReadTokens;
		usage.cacheWriteTokens += d.usage.cacheWriteTokens;
		if (d.usage.costUsd === null) usage.unpricedTurns += d.usage.turns;
		else usage.costUsd += d.usage.costUsd;
	}
	usage.costUsd = Math.round(usage.costUsd * 10000) / 10000;

	const cheatsheets = cheatsheetStore
		.list()
		.map((s) => cheatsheetStore.get(s.id))
		.filter((s): s is Cheatsheet => s !== null);

	const writing = readWriting();
	const writingUsd = writing.reduce((sum, entry) => {
		for (const step of entry.usage.steps) {
			usage.inputTokens += step.inputTokens ?? 0;
			usage.outputTokens += step.outputTokens ?? 0;
			usage.cacheReadTokens += step.cacheReadTokens ?? 0;
			usage.cacheWriteTokens += step.cacheWriteTokens ?? 0;
		}
		try {
			const cost = turnCost(entry.usage as Parameters<typeof turnCost>[0]);
			if (cost === null) usage.unpricedTurns++;
			return sum + (cost ?? 0);
		} catch {
			usage.unpricedTurns++;
			return sum;
		}
	}, 0);
	usage.costUsd += writingUsd;
	const summary: CorpusSummary = {
		exportedAt: now.toISOString(),
		profile: activeProfile(),
		language: activeLanguage().code,
		counts: {
			audioClips: audio.length,
			lessons: lessons.length,
			reps: lessons.reduce((n, l) => n + l.reps.length, 0),
			sentences: sentences.length,
			dialogues: dialogues.length,
			explanations: explanations.length,
			reviewCards: cards.length,
			reviewAnswers: answers.length,
			stories: stories.length,
			readings: readings.length,
			spokenScenes: scenes.length,
			fluencyRounds: fluency.length,
			videos: videos.length,
			watchings: watchings.length,
			cheatsheets: cheatsheets.length,
			writingChecks: writing.length,
		},
		usage: { ...usage, writingUsd },
	};

	const write = (name: string, value: unknown) =>
		fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dir, name), JSON.stringify(value, null, "\t"), "utf-8");
	write("summary.json", summary);
	write("audio.json", audio);
	write("sentences.json", sentences);
	write("lessons.json", lessons);
	write("dialogues.json", dialogues);
	write("explanations.json", explanations);
	write("review.json", { cards, answers });
	write("writing.json", writing);
	write("known.json", knownWordStore.read());
	write("word-check.json", {
		answers: wordCheckStore.answers(),
		sessions: wordCheckStore.sessions(),
		history: wordCheckStore.history(),
		judgements: wordCheckStore.judgements(),
	});
	const readingSources = readingSourceStore.list().filter((s) => !s.removedAt);
	write("stories.json", { stories, readings, sources: readingSources });
	write("spoken.json", { scenes, fluency });
	write("videos.json", { videos, watchings, sections, preps });
	write("cheatsheets.json", cheatsheets);
	write("cheatsheet-practice.json", {
		phrases: Object.fromEntries(cheatsheets.map((s) => [s.id, sheetPracticeStore.read(s.id)])),
		sessions: sheetPracticeStore.readLog(),
	});
	write("notes.json", notesStore.read().notes);
	write("outside-listening.json", outsideStore.read().entries);
	fs.writeFileSync(path.join(dir, "README.md"), EXPORT_README, "utf-8");
	return { dir, summary };
}
