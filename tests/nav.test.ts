import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTEXTUAL_PAGES, NAV, NAV_ITEMS, navItemFor } from "@/lib/nav";

/** Plumbing: not navigation, not named for the learner. */
const PLUMBING = new Set(["/pair"]);

function pages(dir: string, base = ""): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		if (!e.isDirectory()) return e.name === "page.tsx" ? [base || "/"] : [];
		if (e.name === "api") return [];
		return pages(path.join(dir, e.name), `${base}/${e.name}`);
	});
}

const titleOf = (route: string) => {
	const file = path.join("app", route === "/" ? "" : route, "page.tsx");
	return /export const metadata[^=]*=\s*\{\s*title: (?:\{ absolute: )?"([^"]+)"/.exec(fs.readFileSync(file, "utf8"))?.[1]?.replace(" · LangHarness", "");
};

describe("the app's names", () => {
	it("every page under app/ is in the nav, a named contextual page, or plumbing", () => {
		const known = new Set([...NAV_ITEMS.map((i) => i.href), ...CONTEXTUAL_PAGES.map((p) => p.href), ...PLUMBING]);
		const missing = pages("app").filter((r) => !known.has(r) && !r.startsWith("/chat/"));
		assert.deepEqual(missing, []);
	});

	it("a nav item's route, label and page title say the same word", () => {
		for (const item of NAV_ITEMS) assert.equal(titleOf(item.href), item.label, item.href);
		for (const p of CONTEXTUAL_PAGES.filter((p) => !p.href.startsWith("/chat"))) assert.equal(titleOf(p.href), p.title, p.href);
	});

	it("the primary group stays short, the rest are named sections", () => {
		assert.ok(NAV[0]!.items.length <= 3);
		for (const g of NAV.slice(1)) assert.ok(g.label && g.items.length >= 2, g.id);
		assert.equal(new Set(NAV_ITEMS.map((i) => i.label)).size, NAV_ITEMS.length, "labels are unique");
	});

	it("the page is lit in the nav where it lives, including pages reached from inside it", () => {
		assert.equal(navItemFor("/exam")?.id, "curriculum");
		assert.equal(navItemFor("/curriculum")?.id, "curriculum");
		assert.equal(navItemFor("/grammar")?.id, "grammar");
		assert.equal(navItemFor("/")?.id, "today");
		assert.equal(navItemFor("/progress")?.id, "progress");
	});

	it("the old Progress address still works", () => {
		assert.ok(/source: "\/plan", destination: "\/progress"/.test(fs.readFileSync("next.config.ts", "utf8")));
	});
});
