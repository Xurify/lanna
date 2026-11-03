/**
 * The log of a day (src/core/daylog.ts), read from the lesson log, the review
 * log and cards, and the day's record. Today and every earlier day come from
 * the same function, so a past day is the same page, read only.
 */

import { buildDayLog, localDay, type DayLog } from "../core/index.ts";
import { progressStore } from "../store/progress.ts";
import { readLessonLog } from "../store/corpus.ts";
import { reviewStore } from "../store/review.ts";

function read(day: string, tz: number) {
	const lessons = readLessonLog();
	const reviews = reviewStore.readLog();
	const cards = Object.values(reviewStore.readCards());
	const days = progressStore.read().days;
	return { lessons, reviews, cards, days, log: buildDayLog(day, { lessons: lessons.filter((e) => e.day === day), reviews, cards, record: days[day], tz }) };
}

export function dayLog(day: string, tz = 0): DayLog {
	return read(day, tz).log;
}

/** The days that have something to show, newest first, with today always first. */
export function dayLogDays(today: string, tz = 0, limit = 30): DayLog[] {
	const { lessons, reviews, cards, days } = read(today, tz);
	const keys = new Set<string>([today]);
	for (const e of lessons) keys.add(e.day);
	for (const r of reviews) keys.add(localDay(r.reviewedAt, tz));
	for (const [d, rec] of Object.entries(days)) if ((rec.xp ?? 0) > 0 || (rec.reviews ?? 0) > 0 || (rec.lessons ?? 0) > 0) keys.add(d);
	return [...keys]
		.filter((d) => d <= today)
		.sort()
		.reverse()
		.slice(0, limit)
		.map((d) => buildDayLog(d, { lessons: lessons.filter((e) => e.day === d), reviews, cards, record: days[d], tz }));
}
