import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-milestone-management-"));
process.env.LANNA_DATA_DIR = dir;
process.env.LANNA_PROFILE = "slovak";
const { withProfile, PATHS } = await import("../config.ts");
const { milestoneStore } = await import("../src/store/milestones.ts");
const { milestonesReport, setMilestoneHidden } = await import("../src/server/milestones.ts");
const { datedScenesForToday } = await import("../src/server/dated-scene.ts");
const { customMilestone, MILESTONES } = await import("../src/core/milestones.ts");
const route = await import("../app/api/milestones/route.ts");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("legacy files, persisted hiding, repeated operations, restoration and profile isolation", () => {
	milestoneStore.write({ custom: [] });
	assert.deepEqual(milestonesReport().hiddenMilestones, []);
	for (const milestone of MILESTONES) {
		assert.equal(setMilestoneHidden(milestone.id, true), true);
		assert.equal(setMilestoneHidden(milestone.id, true), true);
	}
	assert.equal(milestoneStore.read().hiddenBuiltins?.length, MILESTONES.length);
	assert.equal(milestonesReport().milestones.length, 0);
	assert.equal(milestonesReport().hiddenMilestones.length, MILESTONES.length);
	withProfile("estonian", () => {
		assert.equal(milestoneStore.read().hiddenBuiltins?.length ?? 0, 0);
		assert.equal(milestonesReport().milestones.length, MILESTONES.length);
	});
	for (const milestone of MILESTONES) assert.equal(setMilestoneHidden(milestone.id, false), true);
	assert.equal(milestonesReport().milestones.length, MILESTONES.length);
	assert.deepEqual(milestonesReport().hiddenMilestones, []);
	assert.equal(setMilestoneHidden("missing", true), false);
	assert.equal(setMilestoneHidden("custom-missing", false), false);
});

test("hiding and restoring a dated milestone preserves its paid mapping, date and outcome", () => {
	const text = "lunch with family";
	const mapping = {
		title: "Lunch with family",
		line: "Follow lunch conversation.",
		genre: "conversation",
		coverage: 0.95,
		wpm: 150,
		support: "interactive",
	} as const;
	const record = {
		def: customMilestone(text, mapping),
		text,
		mapping,
		model: "test",
		usage: { model: "test", steps: [] },
		createdAt: "2026-11-01T12:00:00Z",
		date: "2026-11-02",
		outcome: { at: "2026-11-03T12:00:00Z", text: "It went well." },
	};
	milestoneStore.upsert(record);
	assert.equal(setMilestoneHidden(record.def.id, true), true);
	assert.equal(milestonesReport().scenes[record.def.id], undefined);
	assert.deepEqual(datedScenesForToday(), { next: null, awaitingOutcome: [] });
	assert.ok(milestonesReport().hiddenMilestones.some((m) => m.id === record.def.id));
	assert.equal(setMilestoneHidden(record.def.id, false), true);
	assert.deepEqual(milestoneStore.find(record.def.id), record);
	assert.equal(milestonesReport().scenes[record.def.id]?.outcome?.text, "It went well.");
});

test("visibility API accepts built-ins, rejects invalid ids and malformed restoration, and returns the updated report", async () => {
	const req = (method: string, query = "", body?: unknown) =>
		new Request(`http://localhost/api/milestones${query}`, {
			method,
			...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
		});
	const hidden = await route.DELETE(req("DELETE", "?id=vlog"));
	assert.equal(hidden.status, 200);
	const hiddenBody = await hidden.json();
	assert.ok(!hiddenBody.report.milestones.some((m: { def: { id: string } }) => m.def.id === "vlog"));
	assert.ok(hiddenBody.report.hiddenMilestones.some((m: { id: string }) => m.id === "vlog"));
	const restored = await route.PATCH(req("PATCH", "", { id: "vlog" }));
	assert.equal(restored.status, 200);
	assert.ok((await restored.json()).report.milestones.some((m: { def: { id: string } }) => m.def.id === "vlog"));
	assert.equal((await route.DELETE(req("DELETE", "?id=missing"))).status, 404);
	assert.equal((await route.PATCH(req("PATCH", "", { id: "missing" }))).status, 404);
	assert.equal((await route.PATCH(req("PATCH", "", { id: 12 }))).status, 400);
	assert.equal(
		(await route.PATCH(new Request("http://localhost/api/milestones", { method: "PATCH", body: "{" }))).status,
		400,
	);
});

test("invalid hidden preferences do not discard existing custom milestones", () => {
	const before = milestoneStore.read().custom;
	fs.writeFileSync(
		path.join(PATHS.data, "milestones.json"),
		JSON.stringify({ custom: before, hiddenBuiltins: [null, 12, "vlog"] }),
	);
	assert.deepEqual(milestoneStore.read().hiddenBuiltins, ["vlog"]);
	assert.deepEqual(milestoneStore.read().custom, before);
});
