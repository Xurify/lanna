/**
 * The day across languages (2026-11-05): every language in the learner's
 * list with its own plan for today, its minutes a day and what it has had
 * today. Each language's plan is the one Today shows when it runs, read by
 * borrowing the language for one synchronous call (config.ts withProfile).
 *
 * The split is not stored apart: a language's share of the day is its own
 * goal minutes (goal.minutesPerDay), so its plan, its pace and its
 * estimates all read the same number. Setting the split writes those.
 */

import { activeProfile, shownProfiles, withProfile } from "../../config.ts";
import type { DayLanguage, LanguageDay } from "../core/day-plan.ts";
import { profileLanguage } from "./active-language.ts";
import { progressSummary, setGoal, syncExperimentQuietly } from "./lesson.ts";

export function languageDay(tz?: number, now = new Date()): LanguageDay {
	const running = activeProfile();
	const languages: DayLanguage[] = shownProfiles().flatMap((id) => {
		const info = profileLanguage(id);
		if (!info) return [];
		const s = withProfile(id, () => progressSummary(tz, now, { syncExperiment: false }));
		const setUp = Boolean(s.goal.onboardedAt);
		return [
			{
				id,
				english: info.english,
				endonym: info.endonym,
				running: id === running,
				minutes: s.goal.minutesPerDay,
				practiced: s.todayMinutes,
				setUp,
				tasks: setUp ? s.plan.tasks : [],
			},
		];
	});
	languages.sort((a, b) => b.minutes - a.minutes || a.english.localeCompare(b.english));
	syncExperimentQuietly(now);
	return {
		minutes: languages.reduce((n, l) => n + l.minutes, 0),
		practiced: languages.reduce((n, l) => n + l.practiced, 0),
		languages,
	};
}

/** Set each language's minutes a day (the split of the day). Languages not
 *  named keep theirs; ids not in the list are ignored. */
export function setLanguageMinutes(minutes: Record<string, number>, tz?: number, now = new Date()): LanguageDay {
	const listed = new Set(shownProfiles());
	for (const [id, m] of Object.entries(minutes)) {
		if (!listed.has(id) || typeof m !== "number" || !Number.isFinite(m)) continue;
		withProfile(id, () => setGoal({ minutesPerDay: m }, tz, now));
	}
	return languageDay(tz, now);
}
