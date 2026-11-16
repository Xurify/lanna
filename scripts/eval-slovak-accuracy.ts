/**
 * How often does a model mislead a Slovak learner? (LangHarness, 2026-11-01)
 *
 *   LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<sandbox>/auth.json \
 *     tsx scripts/eval-slovak-accuracy.ts <out-dir> <model>:<level>[:skill] ...
 *
 *   e.g. claude-haiku-5-5:max:skill claude-sonnet-5-5:medium
 *
 * Asks every item in scripts/eval/slovak-accuracy.json once per config and
 * grades it against the item's checked answer. With `:skill` the system
 * prompt carries .claude/skills/slovak-language/SKILL.md plus the one reference the
 * item names, the way a tutor prompt would route it. Writes one JSON file
 * per config to <out-dir> (raw answers, grades, cost) and prints a table.
 * Explanation items are saved ungraded: a person reads them.
 *
 * Needs a configured key in the sandbox's auth file; it never prints it.
 * EVAL_BUDGET_USD (default 1) caps the spend of every run into the same
 * <out-dir> together; calls already in flight can pass it by a few cents.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [outDir, ...configArgs] = process.argv.slice(2);
if (!outDir || configArgs.length === 0 || !process.env.LH_DATA_DIR) {
	console.error(
		"usage: LH_DATA_DIR=<sandbox> LH_AUTH_FILE=<sandbox>/auth.json tsx scripts/eval-slovak-accuracy.ts <out-dir> <model>:<level>[:skill] ...",
	);
	process.exit(1);
}

const { initAuthEnv } = await import("../src/server/keys.ts");
const { piEngineForSpec } = await import("../src/agent/models.ts");
const { runSubagent } = await import("../src/agent/subagents/pi-run.ts");
// The server does this at boot: saved keys become the provider env vars.
initAuthEnv();

type Item =
	| { id: string; kind: "sentence"; text: string; ok: boolean; fix?: string; ref: string }
	| { id: string; kind: "choice"; question: string; options: string[]; answer: number; ref: string }
	| { id: string; kind: "form"; question: string; answer: string[]; ref: string }
	| { id: string; kind: "translate"; en: string; check: string; ref: string }
	| { id: string; kind: "explain"; question: string; rubric: string; ref: string };

// EVAL_SET=hard reads slovak-accuracy-hard.json; EVAL_REPS asks every item that many times.
const SET = process.env.EVAL_SET ?? "base";
const REPS = Math.max(1, Number(process.env.EVAL_REPS ?? 1));
const items = (
	JSON.parse(
		fs.readFileSync(path.join(ROOT, `scripts/eval/slovak-accuracy${SET === "base" ? "" : `-${SET}`}.json`), "utf8"),
	) as { items: Item[] }
).items;
const SKILL_DIR = path.join(ROOT, ".claude/skills/slovak-language");
const skillCore = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8").replace(/^---[\s\S]*?---\s*/, "");
const reference = (name: string) => fs.readFileSync(path.join(SKILL_DIR, "references", name), "utf8");

const BASE = [
	"You are a Slovak tutor for an English-speaking learner. Software checks your answer.",
	"A wrong correction or a wrong rule misleads the learner, and that is worse than saying you are unsure.",
	"Answer with one JSON object and nothing else.",
].join(" ");

function systemPrompt(item: Item, skill: boolean): string {
	if (!skill) return BASE;
	return `${BASE}\n\n# Reference: the slovak-language skill\n\n${skillCore}\n\n# Reference file: ${item.ref}\n\n${reference(item.ref)}`;
}

function userPrompt(item: Item): string {
	switch (item.kind) {
		case "sentence":
			return `The learner wrote: "${item.text}"\nIs this correct standard Slovak? Reply as {"correct": true or false, "corrected": "the corrected sentence, or the same sentence if it is correct", "why": "one short sentence"}`;
		case "choice":
			return `${item.question}\nOptions:\n${item.options.map((o, i) => `${i}) ${o}`).join("\n")}\nReply as {"answer": the option number, "why": "one short sentence"}`;
		case "form":
			return `${item.question}. Reply as {"form": "the form only"}`;
		case "translate":
			return `Translate into standard Slovak: "${item.en}". Reply as {"slovak": "your translation"}`;
		case "explain":
			return `${item.question} Reply as {"text": "your explanation"}`;
	}
}

const norm = (s: string) =>
	s
		.normalize("NFC")
		.toLocaleLowerCase("sk")
		.replace(/[.!?,"„“]/g, "")
		.replace(/\s+/g, " ")
		.trim();

function parse(text: string): Record<string, unknown> | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/** pass, or the kind of miss: a correct sentence rejected misleads most. */
function grade(item: Item, out: Record<string, unknown> | null): { pass: boolean | null; miss?: string } {
	if (item.kind === "explain") return { pass: null };
	if (!out) return { pass: false, miss: "unreadable" };
	if (item.kind === "sentence") {
		if (item.ok) return out.correct === true ? { pass: true } : { pass: false, miss: "rejected a correct sentence" };
		if (out.correct !== false) return { pass: false, miss: "accepted a wrong sentence" };
		const fixed = typeof out.corrected === "string" && new RegExp(item.fix!, "i").test(out.corrected.normalize("NFC"));
		return fixed ? { pass: true } : { pass: false, miss: "flagged it but fixed it wrong" };
	}
	if (item.kind === "translate") {
		const said = typeof out.slovak === "string" ? out.slovak.normalize("NFC") : "";
		return new RegExp(item.check, "i").test(said)
			? { pass: true }
			: { pass: false, miss: `wrong translation (${said || "none"})` };
	}
	if (item.kind === "choice")
		return Number(out.answer) === item.answer ? { pass: true } : { pass: false, miss: "wrong rule" };
	const form = typeof out.form === "string" ? norm(out.form) : "";
	return item.answer.map(norm).includes(form)
		? { pass: true }
		: { pass: false, miss: `wrong form (${form || "none"})` };
}

// Every call's cost goes to spend.jsonl as it lands, so a run that is
// stopped (or hits the key's limit) still says what it cost, and the
// budget counts every earlier run into the same folder.
const SPEND = path.join(outDir, "spend.jsonl");
const BUDGET = Number(process.env.EVAL_BUDGET_USD ?? 1);
let spent = fs.existsSync(SPEND)
	? fs
			.readFileSync(SPEND, "utf8")
			.split("\n")
			.filter(Boolean)
			.reduce((n, l) => n + ((JSON.parse(l) as { cost: number }).cost ?? 0), 0)
	: 0;
let halted: string | null = null;

async function ask(model: string, level: string, skill: boolean, item: Item) {
	if (halted || spent >= BUDGET) {
		halted ??= `budget of $${BUDGET} reached ($${spent.toFixed(4)} spent)`;
		return {
			id: item.id,
			kind: item.kind,
			text: "",
			out: null,
			pass: null,
			miss: `skipped: ${halted}`,
			cost: 0,
			output: 0,
			reasoning: 0,
			ms: 0,
		};
	}
	const engine = piEngineForSpec({ provider: "anthropic", id: model, thinkingLevel: level as never }, true);
	let cost = 0;
	let output = 0;
	let reasoning = 0;
	const started = Date.now();
	const record = (c: number) => {
		spent += c;
		fs.appendFileSync(
			SPEND,
			`${JSON.stringify({ at: new Date().toISOString(), config: `${model}:${level}${skill ? ":skill" : ""}`, id: item.id, cost: c })}\n`,
		);
	};
	try {
		const { text } = await runSubagent([], {
			role: "researcher",
			engine,
			systemPrompt: systemPrompt(item, skill),
			prompt: userPrompt(item),
			maxTurns: 1,
			onUsage: (u) => {
				cost += u.cost?.total ?? 0;
				output += u.output;
				reasoning += u.reasoning ?? 0;
				record(u.cost?.total ?? 0);
			},
		});
		const out = parse(text);
		return {
			id: item.id,
			kind: item.kind,
			text,
			out,
			...grade(item, out),
			cost,
			output,
			reasoning,
			ms: Date.now() - started,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		// A spending limit or a missing key fails every call after it: stop asking.
		if (/usage limits|credit balance|not configured|authentication/i.test(message)) halted ??= message.slice(0, 160);
		return {
			id: item.id,
			kind: item.kind,
			text: "",
			out: null,
			pass: null,
			miss: `error: ${message}`,
			cost,
			output,
			reasoning,
			ms: Date.now() - started,
		};
	}
}

async function pool<T, R>(list: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array(list.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: size }, async () => {
			while (next < list.length) {
				const i = next++;
				results[i] = await fn(list[i]!);
			}
		}),
	);
	return results;
}

fs.mkdirSync(outDir, { recursive: true });
for (const arg of configArgs) {
	const [model, level, flag] = arg.split(":");
	const skill = flag === "skill";
	const name = `${SET === "base" ? "" : `${SET}-`}${model}-${level}${skill ? "-skill" : ""}`;
	const asked = Array.from({ length: REPS }, () => items).flat();
	const results = await pool(asked, 6, (item) => ask(model!, level!, skill, item));
	const graded = results.filter((r) => r.pass !== null);
	const failed = results.filter((r) => r.miss?.startsWith("error") || r.miss?.startsWith("skipped")).length;
	const misses = graded.filter((r) => !r.pass);
	const summary = {
		config: name,
		graded: graded.length,
		errors: misses.length,
		rejectedCorrect: misses.filter((r) => r.miss === "rejected a correct sentence").length,
		cost: Math.round(results.reduce((n, r) => n + r.cost, 0) * 10000) / 10000,
		avgSeconds: Math.round(results.reduce((n, r) => n + r.ms, 0) / results.length / 100) / 10,
		avgReasoning: Math.round(results.reduce((n, r) => n + r.reasoning, 0) / results.length),
		notAsked: failed,
	};
	fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ summary, results }, null, "\t"));
	console.log(JSON.stringify(summary), misses.map((r) => `${r.id}: ${r.miss}`).join(" | "));
	if (halted) {
		console.error(`stopped: ${halted}. Spent so far in ${outDir}: $${spent.toFixed(4)}`);
		break;
	}
}
