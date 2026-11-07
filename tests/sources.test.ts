/**
 * SOURCES PINS (LangHarness, 2026-11-06, E63): the registry is the one
 * place pages get their research from, so it must hold together offline —
 * every cited id exists, nothing is cited twice or left over, every DOI is
 * shaped like one, and every feature points at a page that exists. The DOIs
 * themselves are checked against Crossref by `npm run sources:check`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { FEATURES, SOURCES, featureById, featuresCiting, sourceById, sourceUrl, sourcesOf } from "../src/core/sources.ts";

test("source ids are unique and every cited id exists", () => {
	assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
	for (const f of FEATURES) {
		assert.equal(new Set(f.sources).size, f.sources.length, `${f.id} cites a source twice`);
		for (const id of f.sources) assert.ok(sourceById(id), `${f.id} cites unknown source ${id}`);
		assert.equal(sourcesOf(f).length, f.sources.length);
	}
});

test("no source is left over: each one is cited by a feature", () => {
	for (const s of SOURCES) assert.ok(featuresCiting(s.id).length > 0, `${s.id} is not cited by any feature`);
});

test("feature ids are unique and each has all three honest paragraphs", () => {
	assert.equal(new Set(FEATURES.map((f) => f.id)).size, FEATURES.length);
	for (const f of FEATURES) {
		assert.ok(f.evidence.length > 40, `${f.id} says nothing about what the research found`);
		assert.ok(f.limits.length > 40, `${f.id} says nothing about what it did not show`);
		assert.ok(f.ours.length > 20, `${f.id} does not name the app's own choices`);
		assert.ok(f.sources.length >= 2, `${f.id} leans on a single source`);
		assert.equal(featureById(f.id), f);
	}
});

test("DOIs are shaped like DOIs, and a link exists exactly when there is one", () => {
	for (const s of SOURCES) {
		if (s.doi) {
			assert.match(s.doi, /^10\.\d{4,9}\/\S+$/, `${s.id} has a malformed DOI`);
			assert.equal(sourceUrl(s), `https://doi.org/${s.doi}`);
		} else {
			assert.equal(sourceUrl(s), undefined);
			assert.equal(s.checked, "listed", `${s.id} has no DOI, so it can only be "listed"`);
		}
		if (s.checked === "read") assert.ok(s.doi, `${s.id} was read, so it has a record to link`);
		assert.ok(s.year >= 1960 && s.year <= 2026, `${s.id} has an odd year`);
		assert.ok(s.cite.includes(String(s.year)) || s.id === "dornyei2009", `${s.id}: the cite and the year disagree`);
	}
	assert.equal(new Set(SOURCES.map((s) => s.doi).filter(Boolean)).size, SOURCES.filter((s) => s.doi).length, "two sources share a DOI");
});

test("every feature's route is a page that exists", () => {
	for (const f of FEATURES) {
		const route = f.route.split("?")[0]!;
		const dir = path.join(process.cwd(), "app", route === "/" ? "" : route);
		assert.ok(fs.existsSync(path.join(dir, "page.tsx")), `${f.id}: no page at ${f.route}`);
	}
});

test("the Speed note keeps its honest caveat", () => {
	const fast = featureById("speed-fast")!;
	assert.match(fast.limits, /Boers/);
	assert.match(fast.limits, /repetition/i);
	assert.ok(fast.sources.includes("boers2014") && fast.sources.includes("lambert2017"));
});
