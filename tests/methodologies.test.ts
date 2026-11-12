import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { METHODOLOGIES, methodologyById } from "../src/core/methodologies.ts";

test("methodologies have unique ids and non-empty content", () => {
	assert.ok(METHODOLOGIES.length >= 3);
	const ids = new Set(METHODOLOGIES.map((m) => m.id));
	assert.equal(ids.size, METHODOLOGIES.length, "duplicate methodology ids");

	for (const m of METHODOLOGIES) {
		assert.ok(m.name.length > 3, `${m.id} has no name`);
		assert.ok(m.title.length > 5, `${m.id} has no title`);
		assert.ok(m.summary.length > 20, `${m.id} has no summary`);
		assert.ok(m.origin.length > 5, `${m.id} has no origin`);
		assert.ok(m.appApplication.length > 20, `${m.id} has no app application description`);
		assert.ok(m.keyPrinciples.length >= 2, `${m.id} has too few principles`);
		assert.ok(m.signatureTechniques.length >= 1, `${m.id} has too few techniques`);
		for (const p of m.keyPrinciples) {
			assert.ok(p.title.length > 2);
			assert.ok(p.detail.length > 10);
		}
		for (const t of m.signatureTechniques) {
			assert.ok(t.name.length > 2);
			assert.ok(t.summary.length > 10);
		}
		assert.ok(m.externalLinks.length >= 2, `${m.id} should have verified external links`);
		for (const link of m.externalLinks) {
			assert.ok(link.label.length > 5);
			assert.match(link.url, /^https?:\/\//);
		}
		assert.equal(methodologyById(m.id), m);
	}
});

test("core expected methodologies exist", () => {
	const machova = methodologyById("machova");
	assert.ok(machova, "machova methodology missing");
	assert.match(machova.name, /Lýdia Machová/);
	assert.match(machova.summary, /Slovak polyglot/i);

	const krashen = methodologyById("krashen");
	assert.ok(krashen, "krashen methodology missing");
	assert.match(krashen.name, /Stephen Krashen/);

	const nation = methodologyById("nation");
	assert.ok(nation, "nation methodology missing");
	assert.match(nation.name, /Paul Nation/);
});

test("the methodologies page exists in app/methodologies/page.tsx", () => {
	const pagePath = path.join(process.cwd(), "app", "methodologies", "page.tsx");
	assert.ok(fs.existsSync(pagePath), "app/methodologies/page.tsx does not exist");
});
