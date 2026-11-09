/**
 * The eesti-language skill lives in .claude/skills, where Claude Code loads
 * it, and is mirrored to .agents/skills for agents that read that folder. The
 * two copies must hold the same files, and the skill must not be left in the
 * top-level skills/ folder.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE = path.join(ROOT, ".claude", "skills", "eesti-language");
const AGENTS = path.join(ROOT, ".agents", "skills", "eesti-language");

function tree(dir: string, rel = ""): Map<string, string> {
	const out = new Map<string, string>();
	for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
		const name = path.join(rel, entry.name);
		if (entry.isDirectory()) {
			for (const [k, v] of tree(dir, name)) out.set(k, v);
		} else {
			out.set(name, fs.readFileSync(path.join(dir, name), "utf8"));
		}
	}
	return out;
}

describe("the eesti-language skill location", () => {
	it("has the same files in .claude/skills and .agents/skills", () => {
		const claude = tree(CLAUDE);
		const agents = tree(AGENTS);
		assert.deepEqual([...agents.keys()].sort(), [...claude.keys()].sort());
		for (const [name, text] of claude) assert.equal(agents.get(name), text, `${name} differs between the two copies`);
	});

	it("ships SKILL.md and the references the tutor reads at runtime", () => {
		const files = [...tree(CLAUDE).keys()];
		assert.ok(files.includes("SKILL.md"));
		assert.ok(files.includes(path.join("references", "grammar-core.md")));
		assert.ok(files.includes(path.join("references", "aspect-and-object.md")));
		assert.ok(files.includes(path.join("references", "gradation.md")));
		assert.ok(files.includes(path.join("references", "verb-forms.md")));
	});

	it("is not left in the top-level skills/ folder", () => {
		assert.equal(fs.existsSync(path.join(ROOT, "skills", "eesti-language")), false);
	});
});
