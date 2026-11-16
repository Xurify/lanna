import type { ChatAnswer } from "./chat-answers.ts";
import { isUnitId, unitInfo, type UnitId } from "./lesson.ts";
import { trendOf, TREND_DAYS, TREND_MIN_REPS, WEAK_BAR, wilson, type Trend } from "./mistakes.ts";

export const WEAK_CHAT_MISSES = 2;
export const WEAK_CHAT_DAYS = 21;

const TOPICS_SHOWN = 8;
const SAMPLES_SHOWN = 8;
const DAY_MS = 86_400_000;

export interface ChatUnitStat {
	unit: UnitId;
	title: string;
	answers: number;
	right: number;
	misses: number;
	accuracy: number;
	recent: number | null;
	earlier: number | null;
	trend: Trend;
	low: number;
	high: number;
	weak: boolean;
}

export interface ChatTopicStat {
	focus: string;
	unit?: UnitId;
	answers: number;
	misses: number;
	chats: number;
	lastGiven: string;
	lastExpected: string;
	lastAt: string;
}

export interface ChatMiss {
	at: string;
	chatId: string;
	focus: string;
	unit?: UnitId;
	given: string;
	expected: string;
	verdict: "wrong" | "dont_know";
}

export interface ChatAnalysis {
	answers: number;
	firstTryRight: number;
	misses: number;
	hinted: number;
	chats: number;
	from: string | null;
	to: string | null;
	units: ChatUnitStat[];
	topics: ChatTopicStat[];
	samples: ChatMiss[];
}

export const isChatMiss = (a: Pick<ChatAnswer, "verdict">): boolean =>
	a.verdict === "wrong" || a.verdict === "dont_know";
const isFirstTryRight = (a: Pick<ChatAnswer, "verdict" | "hinted">): boolean =>
	(a.verdict === "right" || a.verdict === "slip") && !a.hinted;

export function chatMissesOnUnit(answers: readonly ChatAnswer[], unit: string, now: Date): number {
	const cut = now.getTime() - WEAK_CHAT_DAYS * DAY_MS;
	return answers.filter((a) => a.unit === unit && isChatMiss(a) && Date.parse(a.at) >= cut).length;
}

type Window = { reps: number; right: number };
type UnitTally = { answers: number; right: number; misses: number; recent: Window; earlier: Window };
type TopicTally = ChatTopicStat & { chatIds: Set<string>; lastMissAt: string };

export function analyzeChats(answers: readonly ChatAnswer[], now: Date): ChatAnalysis {
	const cut = now.getTime() - TREND_DAYS * DAY_MS;
	const units = new Map<UnitId, UnitTally>();
	const topics = new Map<string, TopicTally>();
	const chatIds = new Set<string>();
	const samples: ChatMiss[] = [];
	let firstTryRight = 0;
	let misses = 0;
	let hinted = 0;
	let from: string | null = null;
	let to: string | null = null;
	for (const a of answers) {
		const at = Date.parse(a.at);
		if (!Number.isFinite(at)) continue;
		const right = isFirstTryRight(a);
		const miss = isChatMiss(a);
		const unit = isUnitId(a.unit) ? a.unit : undefined;
		const focus = a.focus.trim();
		chatIds.add(a.chatId);
		if (right) firstTryRight++;
		if (miss) misses++;
		else if (a.hinted) hinted++;
		const day = a.at.slice(0, 10);
		if (!from || day < from) from = day;
		if (!to || day > to) to = day;
		if (unit) {
			const u = units.get(unit) ?? {
				answers: 0,
				right: 0,
				misses: 0,
				recent: { reps: 0, right: 0 },
				earlier: { reps: 0, right: 0 },
			};
			const window = at >= cut ? u.recent : u.earlier;
			u.answers++;
			window.reps++;
			if (right) {
				u.right++;
				window.right++;
			}
			if (miss) u.misses++;
			units.set(unit, u);
		}
		const key = focus.toLowerCase();
		const t = topics.get(key) ?? {
			focus,
			answers: 0,
			misses: 0,
			chats: 0,
			lastGiven: "",
			lastExpected: "",
			lastAt: "",
			lastMissAt: "",
			chatIds: new Set<string>(),
		};
		t.answers++;
		t.chatIds.add(a.chatId);
		if (!t.lastAt || a.at >= t.lastAt) {
			t.focus = focus;
			t.lastAt = a.at;
			if (unit) t.unit = unit;
		}
		if (miss) {
			t.misses++;
			if (a.at >= t.lastMissAt) {
				t.lastMissAt = a.at;
				t.lastGiven = a.given.trim();
				t.lastExpected = a.expected;
			}
			samples.push({
				at: a.at,
				chatId: a.chatId,
				focus,
				...(unit ? { unit } : {}),
				given: a.given.trim(),
				expected: a.expected,
				verdict: a.verdict as ChatMiss["verdict"],
			});
		}
		topics.set(key, t);
	}
	const unitList: ChatUnitStat[] = [...units.entries()]
		.map(([unit, u]) => {
			const { low, high } = wilson(u.right, u.answers);
			return {
				unit,
				title: unitInfo(unit).grammarTerm ?? unitInfo(unit).title,
				answers: u.answers,
				right: u.right,
				misses: u.misses,
				accuracy: u.right / u.answers,
				recent: u.recent.reps >= TREND_MIN_REPS ? u.recent.right / u.recent.reps : null,
				earlier: u.earlier.reps >= TREND_MIN_REPS ? u.earlier.right / u.earlier.reps : null,
				trend: trendOf(u.recent, u.earlier),
				low,
				high,
				weak: high < WEAK_BAR,
			};
		})
		.filter((u) => u.misses > 0)
		.sort((a, b) => b.misses - a.misses || a.accuracy - b.accuracy);
	const topicList = [...topics.values()]
		.filter((t) => t.misses > 0)
		.sort((a, b) => b.misses - a.misses || b.lastAt.localeCompare(a.lastAt))
		.slice(0, TOPICS_SHOWN)
		.map(({ chatIds: ids, lastMissAt: _lastMissAt, ...t }) => ({ ...t, chats: ids.size }));
	return {
		answers: answers.length,
		firstTryRight,
		misses,
		hinted,
		chats: chatIds.size,
		from,
		to,
		units: unitList,
		topics: topicList,
		samples: samples.sort((a, b) => b.at.localeCompare(a.at)).slice(0, SAMPLES_SHOWN),
	};
}
