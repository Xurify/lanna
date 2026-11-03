import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LevelProgress, StrandBars, StreakCalendar, WeekXpChart } from "@/components/quiet/charts";
import { chartData } from "@/components/quiet/chart-data";

const day = (n: number) => new Date(Date.UTC(2026, 10, 2 - (6 - n))).toISOString().slice(0, 10);
const base = {
	week: Array.from({ length: 7 }, (_, i) => ({ day: day(i), xp: 0 })),
	dailyGoal: 50,
	todayXp: 0,
	streak: { days: 0 },
	level: { level: 1, into: 0, span: 100 },
};

describe("progress charts", () => {
	it("an empty week says so instead of drawing a row of numbers", () => {
		const html = renderToStaticMarkup(createElement(WeekXpChart, { data: chartData(base) }));
		assert.ok(html.includes("No XP yet this week"));
		assert.ok(html.includes("goal 50 a day"));
	});

	it("a week with practice counts the days that reached the goal", () => {
		const week = base.week.map((d, i) => ({ ...d, xp: [60, 20, 0, 55, 0, 0, 10][i]! }));
		const html = renderToStaticMarkup(createElement(WeekXpChart, { data: chartData({ ...base, week }) }));
		assert.ok(html.includes("145 XP in 7 days. 2 of 7 days reached the goal."));
	});

	it("the streak calendar fills the days of the streak and says how many in a row", () => {
		const week = base.week.map((d, i) => ({ ...d, xp: i >= 4 ? 30 : 0 }));
		const html = renderToStaticMarkup(createElement(StreakCalendar, { data: chartData({ ...base, week, streak: { days: 3 }, log: { longestStreak: 9 } }) }));
		assert.ok(html.includes("3 days in a row"));
		assert.ok(html.includes("longest 9"));
	});

	it("an empty streak calendar names today as the first square", () => {
		const html = renderToStaticMarkup(createElement(StreakCalendar, { data: chartData(base) }));
		assert.ok(html.includes("No days yet"));
	});

	it("level progress shows the XP to the next level and today's goal", () => {
		const html = renderToStaticMarkup(createElement(LevelProgress, { data: chartData({ ...base, todayXp: 44, level: { level: 5, into: 214, span: 500 } }) }));
		assert.ok(html.includes("286 XP to level 6"));
		assert.ok(html.includes("6 to today"));
	});

	it("strand bars show an intentional empty state before anything is counted", () => {
		const html = renderToStaticMarkup(createElement(StrandBars, { balance: null }));
		assert.ok(html.includes("Nothing counted yet this week"));
	});
});
