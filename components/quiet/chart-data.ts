import type { StrandBalance } from "@/src/core";

export interface ChartData {
	week: Array<{ day: string; xp: number }>;
	dailyGoal: number;
	todayXp: number;
	streak: number;
	longestStreak?: number;
	level: { level: number; into: number; span: number };
	balance: StrandBalance | null;
	/** Minutes practiced per day, oldest first (the trajectory's day record). */
	days: readonly { day: string; minutes: number }[];
	goalMinutes: number;
}

/** What a chart needs from the progress summary. */
export function chartData(s: {
	week: Array<{ day: string; xp: number }>;
	dailyGoal: number;
	todayXp: number;
	streak: { days: number };
	level: { level: number; into: number; span: number };
	balance?: StrandBalance | null;
	trajectory?: { days: readonly { day: string; minutes: number }[] } | null;
	log?: { longestStreak?: number } | null;
	pace?: { goalMinutes: number } | null;
	goal?: { minutesPerDay: number } | null;
}): ChartData {
	return {
		week: s.week,
		dailyGoal: s.dailyGoal,
		todayXp: s.todayXp,
		streak: s.streak.days,
		longestStreak: s.log?.longestStreak,
		level: s.level,
		balance: s.balance ?? null,
		days: s.trajectory?.days ?? [],
		goalMinutes: s.pace?.goalMinutes ?? s.goal?.minutesPerDay ?? 0,
	};
}
