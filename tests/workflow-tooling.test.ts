import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { auditAllContent, auditStoryDraft, hasUnbalancedParens } from "../scripts/audit-content.ts";
import {
	findLocalImages,
	findUnresolvedLocalImages,
	parsePrAttachArgs,
	rewriteAttachedBody,
} from "../scripts/pr-attach.mjs";
import { copyLanguageAssets, parseSandboxRunArgs, substituteCommandArgs } from "../scripts/sandbox-run.ts";
import { isIgnoredMissingAudio, parseShotSpec, parseVerifyArgs } from "../scripts/verify-ui.mjs";
import { parseWorktreeArgs, resolveWorktreePath } from "../scripts/worktree.ts";
import type { ShippedStory } from "../src/server/chapter-stories.ts";

const tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

after(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("audit-content", () => {
	it("passes on all shipped curriculum stories and word pictures", () => {
		const report = auditAllContent();
		assert.deepEqual(report.issues, []);
		assert.equal(report.languages.length, 3);
		const slovak = report.languages.find((entry) => entry.language === "slovak")!;
		assert.equal(slovak.lexiconLoaded, true);
		assert.ok(slovak.storiesChecked >= 12);
		assert.ok(slovak.mappedPictureWords >= 40);
		assert.ok(slovak.picturedSentenceChecks > 0);
	});

	it("catches unbalanced parentheses, missing word overrides, and out-of-range occurrence overrides", () => {
		assert.equal(hasUnbalancedParens("beer (drink)"), false);
		assert.equal(hasUnbalancedParens("beer (verbal noun of (pit)"), true);
		assert.equal(hasUnbalancedParens("beer)"), true);

		const badStory: ShippedStory = {
			title: "Test",
			topic: "test",
			cover: "cup",
			cast: [{ name: "Ana", gender: "f", age: "adult" }],
			sentences: Array.from({ length: 20 }, () => ({
				who: "Ana",
				sk: "Dnes prší.",
				en: "Today it rains.",
			})),
			newWords: [{ sk: "dážď", en: "rain)" }],
			questions: [
				{ kind: "recall", q: "Q1", options: ["A", "B"], answer: 0 },
				{ kind: "recall", q: "Q2", options: ["A", "B"], answer: 0 },
				{ kind: "recall", q: "Q3", options: ["A", "B"], answer: 0 },
			],
			recap: "Recap.",
			glosses: { missingword: { lemma: "x", gloss: "y" } },
			occurrences: [
				{ sentence: 99, token: "prší", lemma: "pršať", gloss: "rains" },
				{ sentence: 0, token: "prší", occurrence: 2, lemma: "pršať", gloss: "rains" },
			],
		};

		const issues = auditStoryDraft("slovak", "story-bad", badStory, null);
		assert.ok(issues.some((issue) => issue.message.includes("unbalanced parentheses")));
		assert.ok(issues.some((issue) => issue.message.includes("missingword")));
		assert.ok(issues.some((issue) => issue.message.includes("sentence 99 is out of range")));
		assert.ok(issues.some((issue) => issue.message.includes("occurrence 2 out of range")));
	});
});

describe("sandbox-run helpers", () => {
	it("parses flags, command arguments, and placeholders", () => {
		const parsed = parseSandboxRunArgs([
			"--seed",
			"--copy-languages",
			"--timeout",
			"45",
			"--",
			"node",
			"scripts/verify-ui.mjs",
			"{URL}",
			"{DATA_DIR}/shots",
		]);
		assert.equal(parsed.seed, true);
		assert.equal(parsed.timeoutSeconds, 45);
		assert.ok(parsed.copyLanguagesFrom?.endsWith(path.join("data", "languages")));
		assert.deepEqual(substituteCommandArgs(parsed.command, "http://127.0.0.1:4321", "/tmp/sbx"), [
			"node",
			"scripts/verify-ui.mjs",
			"http://127.0.0.1:4321",
			"/tmp/sbx/shots",
		]);
	});

	it("copies only read-only language files and ignores learner profiles or auth files", () => {
		const source = makeTempDir("lanna-lang-src-");
		const target = makeTempDir("lanna-lang-dst-");
		fs.mkdirSync(path.join(source, "languages", "estonian"), { recursive: true });
		fs.mkdirSync(path.join(source, "profiles", "estonian"), { recursive: true });
		fs.writeFileSync(path.join(source, "languages", "estonian", "course.json"), "{}");
		fs.writeFileSync(path.join(source, "languages", "estonian", "lexicon.json"), '{"words":[]}');
		fs.writeFileSync(path.join(source, "languages", "estonian", "secret.txt"), "skip");
		fs.writeFileSync(path.join(source, "profiles", "estonian", "progress.json"), "{}");
		fs.writeFileSync(path.join(source, "auth.json"), "{}");

		const copied = copyLanguageAssets(source, target);
		assert.deepEqual(copied, ["estonian"]);
		assert.equal(fs.existsSync(path.join(target, "languages", "estonian", "course.json")), true);
		assert.equal(fs.existsSync(path.join(target, "languages", "estonian", "lexicon.json")), true);
		assert.equal(fs.existsSync(path.join(target, "languages", "estonian", "secret.txt")), false);
		assert.equal(fs.existsSync(path.join(target, "profiles")), false);
		assert.equal(fs.existsSync(path.join(target, "auth.json")), false);
	});
});

describe("verify-ui helpers", () => {
	it("parses multi-language options and shot specs", () => {
		const { baseUrl, outDir, shots, options } = parseVerifyArgs([
			"http://127.0.0.1:4321",
			"./shots",
			"path=/curriculum@.chapter-card",
			"--languages",
			"slovak,russian,estonian",
			"--expand-chapters",
			"--check-icons",
			"--wait-for",
			"main",
		]);
		assert.equal(baseUrl, "http://127.0.0.1:4321");
		assert.equal(outDir, "./shots");
		assert.deepEqual(shots, ["path=/curriculum@.chapter-card"]);
		assert.deepEqual(options.languages, ["slovak", "russian", "estonian"]);
		assert.equal(options.expandChapters, true);
		assert.equal(options.checkIcons, true);
		assert.equal(options.waitFor, "main");
		assert.deepEqual(parseShotSpec("path=/curriculum@.chapter-card"), {
			name: "path",
			route: "/curriculum",
			selector: ".chapter-card",
		});
		assert.throws(() => parseShotSpec("bad=C:/Program Files/Git/curriculum"), /MSYS_NO_PATHCONV/);
		assert.equal(isIgnoredMissingAudio("Failed to load /api/audio/123"), true);
		assert.equal(isIgnoredMissingAudio("TypeError: Cannot read properties of undefined"), false);
	});
});

describe("pr-attach and worktree helpers", () => {
	it("extracts local images and flags unresolved local links", () => {
		const markdown = [
			"| ![Day](./shots/a-day-1280.png) | ![Night](https://github.com/user-attachments/assets/abc) |",
			"| ![Dup](./shots/a-day-1280.png) | ![Mobile](./shots/a-day-390.png) |",
		].join("\n");
		const images = findLocalImages(markdown, "/tmp/pr");
		assert.equal(images.length, 2);
		assert.deepEqual(findUnresolvedLocalImages(markdown), [
			"./shots/a-day-1280.png",
			"./shots/a-day-1280.png",
			"./shots/a-day-390.png",
		]);
		assert.deepEqual(findUnresolvedLocalImages("![ok](https://github.com/user-attachments/assets/1234)"), []);
		const parsed = parsePrAttachArgs(["edit", "24", "--body-file", "pr-body.md", "-R", "Xurify/lanna"]);
		assert.equal(parsed.mode, "edit");
		assert.equal(parsed.prNumber, "24");
		assert.equal(parsed.bodyFile, "pr-body.md");
		assert.equal(parsed.repo, "Xurify/lanna");

		const original = "| ![Day](./shots/a-day-1280.png) | ![Night](./shots/a-night-1280.png) |";
		const liveWithAppended = [
			original,
			"",
			"![a-day-1280](https://github.com/user-attachments/assets/1111)",
			"",
			"![a-night-1280](https://github.com/user-attachments/assets/2222)",
		].join("\n");
		const rewritten = rewriteAttachedBody(original, liveWithAppended, findLocalImages(original, "/tmp/pr"));
		assert.equal(
			rewritten,
			"| ![Day](https://github.com/user-attachments/assets/1111) | ![Night](https://github.com/user-attachments/assets/2222) |",
		);
		assert.deepEqual(findUnresolvedLocalImages(rewritten), []);
	});

	it("resolves sibling worktree paths and parses commands", () => {
		const root = path.join(os.tmpdir(), "lanna");
		assert.equal(
			resolveWorktreePath("feat/words-in-context", undefined, root),
			path.join(os.tmpdir(), "lanna-words-in-context"),
		);
		const parsed = parseWorktreeArgs(["create", "feat/audio-fix", "--no-install", "--base", "main"]);
		assert.equal(parsed.action, "create");
		assert.equal(parsed.branch, "feat/audio-fix");
		assert.equal(parsed.install, false);
		assert.equal(parsed.base, "main");
	});
});
