import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { NAV, rendersAhead } from "../lib/nav.ts";
import { FRESH_FOR_MS, NEXT_MAY_STILL_HOLD_MS, NEXT_REUSES_FOR_MS, createRenderAheadLog } from "../lib/render-ahead.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STARTS_WORK_ON_RENDER = ["nextStory", "unitLesson", "lessonWithBetterOptions", "refreshIfStale", "refreshDiscover", "fillAvatars", "kickShelf", "keepOneReady"];

function clock(start = 1_000_000) {
	let t = start;
	return { now: () => t, pass: (ms: number) => (t += ms) };
}

describe("which pages render before the click", () => {
	it("is only the sidebar's own pages, by their exact path", () => {
		assert.equal(rendersAhead("/"), true);
		assert.equal(rendersAhead("/progress"), true);
		assert.equal(rendersAhead("/phonology"), true);
		assert.equal(rendersAhead("/lesson"), false);
		assert.equal(rendersAhead("/chat/abc"), false);
		assert.equal(rendersAhead("/progress/"), false);
	});

	it("has no page whose render starts paid or network work", () => {
		for (const item of NAV.flatMap((g) => g.items)) {
			const source = fs.readFileSync(path.join(ROOT, "app", item.href, "page.tsx"), "utf8");
			const starts = STARTS_WORK_ON_RENDER.filter((name) => source.includes(name));
			assert.deepEqual(starts, [], `${item.href} is rendered when a pointer passes its link, and its page calls ${starts.join(", ")}`);
			if (source.includes("readingState(")) assert.match(source, /topUpShelf: false/, `${item.href} reads the shelf without topping it up`);
		}
	});
});

describe("the render-ahead log", () => {
	it("asks for a page once, then again only when the router would", () => {
		const t = clock();
		const log = createRenderAheadLog(t.now);
		assert.equal(log.shouldRender("/progress", "/"), true);
		t.pass(NEXT_REUSES_FOR_MS - 1);
		assert.equal(log.shouldRender("/progress", "/"), false);
		t.pass(1);
		assert.equal(log.shouldRender("/progress", "/"), true);
	});

	it("never asks for the page it is on, or for a page that is not rendered ahead", () => {
		const log = createRenderAheadLog(clock().now);
		assert.equal(log.shouldRender("/progress", "/progress"), false);
		assert.equal(log.shouldRender("/lesson", "/"), false);
	});

	it("shows a page rendered a moment ago as it is", () => {
		const t = clock();
		const log = createRenderAheadLog(t.now);
		log.shouldRender("/progress", "/");
		t.pass(FRESH_FOR_MS - 1);
		assert.equal(log.arrive("/progress"), "as-rendered");
	});

	it("refreshes a page that was rendered a while before the click, and forgets every other render", () => {
		const t = clock();
		const log = createRenderAheadLog(t.now);
		log.shouldRender("/progress", "/");
		log.shouldRender("/log", "/");
		t.pass(FRESH_FOR_MS);
		assert.equal(log.arrive("/progress"), "refresh");
		assert.equal(log.arrive("/progress"), "as-rendered");
		assert.equal(log.shouldRender("/log", "/progress"), true);
	});

	it("does not refresh a page the router fetched itself", () => {
		const t = clock();
		const log = createRenderAheadLog(t.now);
		assert.equal(log.arrive("/words"), "as-rendered");
		log.shouldRender("/progress", "/");
		t.pass(NEXT_MAY_STILL_HOLD_MS);
		assert.equal(log.arrive("/progress"), "as-rendered");
	});

	it("refreshes a page asked for again just past 30 s, which the router may still hold from the first time", () => {
		const t = clock();
		const log = createRenderAheadLog(t.now);
		log.shouldRender("/progress", "/");
		t.pass(NEXT_REUSES_FOR_MS + 20);
		assert.equal(log.shouldRender("/progress", "/"), true);
		t.pass(50);
		assert.equal(log.arrive("/progress"), "refresh");
	});
});
