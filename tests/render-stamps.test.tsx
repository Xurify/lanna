/**
 * THE STAMP BOOK ON SCREEN (LangHarness, 2026-11-02; E31): the disc, the
 * book and the stamps card render from their states alone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StampBook, StampDisc, StampsCard } from "@/components/stamp";
import { DEED_STAMPS, stampStates, type StampEvidence, type StampState } from "@/src/core";

const evidence: StampEvidence = {
	lessons: 4,
	streakDays: 3,
	wordsKnown: 40,
	reviews: 10,
	perfectLessons: 0,
	comebacks: 0,
	balancedWeek: false,
	storiesRead: 0,
	scenesSpoken: 0,
	listens: 0,
	bestBlitz: 0,
	hoursDone: 1,
	examsPassed: 0,
	chapters: new Map([["ch-a", 0.5]]),
	stages: new Map([["a1", 0]]),
};
const summit: StampState = {
	id: "summit:a1",
	kind: "summit",
	name: "A1 · Základy",
	line: "Every chapter of A1 done",
	goal: 1,
	level: "A1",
	stage: "a1",
	earned: null,
	have: 0,
	progress: 0,
};
const chapter: StampState = {
	id: "chapter:ch-a",
	kind: "chapter",
	name: "Pozdravy",
	line: "Chapter done · A1",
	goal: 1,
	level: "A1",
	stage: "a1",
	earned: null,
	have: 0.5,
	progress: 0.5,
};
const deeds = stampStates(DEED_STAMPS, evidence, { "first-step": "2026-11-01" }, "2026-11-02");
const all = [summit, chapter, ...deeds];

describe("StampDisc", () => {
	it("marks an earned stamp, and draws the progress arc on one in reach", () => {
		const earned = renderToStaticMarkup(
			createElement(StampDisc, { state: deeds.find((s) => s.id === "first-step")!, size: "sm", pressed: true }),
		);
		assert.ok(earned.includes('data-testid="stamp-first-step"'));
		assert.ok(earned.includes('data-earned="true"'));
		assert.ok(earned.includes("lh-stamp"), "the pressed animation class");
		assert.ok(!earned.includes('stroke-dasharray="3 5"'), "no dashed rim once earned");

		const words = renderToStaticMarkup(createElement(StampDisc, { state: deeds.find((s) => s.id === "words-50")! }));
		assert.ok(words.includes('data-earned="false"'));
		assert.ok(words.includes('stroke-dasharray="3 5"'), "dashed rim before it is earned");
		assert.ok(words.includes("stroke-dashoffset"), "the arc shows 40 of 50");
		assert.ok(!words.includes("lh-stamp"));
	});

	it("prints the level on a chapter or summit stamp", () => {
		const html = renderToStaticMarkup(createElement(StampDisc, { state: chapter, size: "md" }));
		assert.ok(html.includes(">A1<"));
		const small = renderToStaticMarkup(createElement(StampDisc, { state: chapter, size: "sm" }));
		assert.ok(!small.includes(">A1<"), "no room on the small disc");
	});
});

describe("StampBook", () => {
	it("counts the book and groups summits, chapters and the deeds", () => {
		const html = renderToStaticMarkup(createElement(StampBook, { stamps: all }));
		assert.ok(html.includes('data-testid="stamp-book"'));
		const count = html.split('data-testid="stamp-book-count"')[1]?.split("</p>")[0] ?? "";
		assert.ok(count.includes(">1</span> of " + all.length + " stamps"), count);
		for (const g of ["summits", "chapters", "deeds"]) assert.ok(html.includes(`data-testid="stamp-group-${g}"`), g);
		assert.ok(html.includes("Summits · 0 of 1"));
		assert.ok(html.includes("Chapters · 0 of 1"));
		assert.ok(html.includes(`On the trail · 1 of ${deeds.length}`));
		assert.ok(html.includes("40 of 50"), "the count toward the next words stamp");
		assert.ok(!html.includes('lang="sk"'), "stamp names take the active language, not a fixed one");
	});
});

describe("StampsCard", () => {
	it("shows the last stamp earned, the three closest, and the door to the book", () => {
		const html = renderToStaticMarkup(createElement(StampsCard, { stamps: all }));
		assert.ok(html.includes('data-testid="stamps-card"'));
		assert.ok(html.includes('href="/progress#stamps"'));
		assert.ok(html.includes(`1 of ${all.length} · all`));
		const recent = html.split('data-testid="stamps-recent"')[1]?.split("</div>")[0] ?? "";
		assert.ok(recent.includes("Prvý krok"), "the first step is the last earned");
		const next = html.split('data-testid="stamps-next"')[1] ?? "";
		assert.ok(next.includes("Prvé slová"), "40 of 50 words is the closest");
		assert.ok(next.includes("40 of 50"));
		assert.equal((next.match(/<li /g) ?? []).length, 3, "three next stamps");
		assert.ok(next.includes("--fill:0.8"), "the words bar is four fifths full");
	});

	it("says it is loading when there are no stamps yet", () => {
		const html = renderToStaticMarkup(createElement(StampsCard, { stamps: null }));
		assert.ok(html.includes("Loading…"));
		assert.ok(!html.includes('data-testid="stamps-all"'));
	});
});
