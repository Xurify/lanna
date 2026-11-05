/**
 * The placement check, server side (LangHarness, 2026-10-28).
 *
 * Three stages, one session on disk (src/store/placement.ts):
 *
 *   1. The ladder — src/core/placement-ladder.ts chooses every next unit
 *      from the answers so far; the item is one typed cloze built from the
 *      dictionary (instant, no model). A typed answer that does not match
 *      the dictionary's word goes to the cheap model slot, which says
 *      whether it is a valid Slovak filling of the blank ("Zostal sam
 *      doma" is; the lexicon's word was samotný). No key → string grading.
 *   2. The edge — the Socratic stage: the tutor (strong slot, else cheap)
 *      reads the ladder's evidence and asks up to PROBE_TURNS production
 *      questions on the units at the edge, judging each as held / slip /
 *      gap. Its verdicts replace those units' ladder tallies.
 *   3. Words — the yes/no vocabulary-size check (src/core/vocab-probe.ts).
 *
 * `finishPlacement` folds all three into the outcome the map reads and
 * records it (src/server/lesson.ts recordPlacement). Every answer and
 * every model call is kept in the session file, and the index line goes
 * to Settings → Spending like a Speak scene.
 */

import { createFauxCore, fauxAssistantMessage, type Usage } from "@earendil-works/pi-ai";
import fs from "node:fs";
import { learnerProfileSegment } from "../agent/learner-profile.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { allChapters, curriculumState } from "../core/curriculum.ts";
import { buildLesson, unitInfo, type LessonItem, type RepVerdict, type UnitId } from "../core/lesson.ts";
import { placementTiers, PROBE_TURNS, parseProbeReply, probeUnits, tierForChapter, tierOfUnit, type PlacementOutcome, type ProbeReply, type ProbeVerdict, calmEntries } from "../core/onboarding.ts";
import { applyAnswer, ladderEdge, ladderOutcome, ladderStart, placementLadder, MAX_ITEMS, nextUnit, rungStatus } from "../core/placement-ladder.ts";
import { grammarWord } from "../core/reading.ts";
import type { StoryUsage } from "../core/reading.ts";
import { entryLemma, type LexiconEntry } from "../core/review.ts";
import { makePseudowords, PSEUDO_WORDS, scoreVocab, VOCAB_BANDS, WORDS_PER_BAND, type VocabAnswer, type VocabItem } from "../core/vocab-probe.ts";
import { rng, shuffle } from "../core/lesson.ts";
import { placementStore, type PlacementSession } from "../store/placement.ts";
import { defaultGoal, progressStore } from "../store/progress.ts";
import { readSettings } from "../store/settings.ts";
import { recordPlacement, type PlacementResult, type RepResult } from "./lesson.ts";
import { frequencyOrder } from "./milestones.ts";
import { storyEngine } from "./reading.ts";
import { activeLanguage } from "./active-language.ts";
import type { LanguageInfo } from "../core/language.ts";

// ─── Engines ────────────────────────────────────────────────────────────────

export interface PlacementOptions {
	/** Test seam: one engine for every model call. */
	engine?: PiEngine;
	model?: string;
	now?: Date;
}

/** The Socratic stage thinks: the strong slot when set, else the cheap one. */
export function probeEngine(): { engine: PiEngine; model: string } | null {
	const models = readSettings()?.models;
	const slot = models?.strong?.model ? models.strong : models?.cheap?.model ? models.cheap : null;
	if (!slot?.model) return null;
	const spec = { provider: slot.model.provider, id: slot.model.id, thinkingLevel: slot.thinkingLevel };
	return { engine: piEngineForSpec(spec, true), model: `${spec.provider}:${spec.id}` };
}

/** A scripted tutor for screenshots and UI work without a key:
 *  LH_PLACEMENT_SCRIPT=<path to JSON {"judge": {accept, note}, "probe": [reply, …]}>.
 *  Dev only; never set in the desktop app. Judge calls answer with the
 *  one judge object; probe calls walk the list (the last entry repeats). */
let scripted: { file: string; judge: PiEngine; probe: PiEngine } | null = null;
function scriptedEngines(): { judge: PiEngine; probe: PiEngine } | null {
	const path = process.env.LH_PLACEMENT_SCRIPT;
	if (!path || process.env.NODE_ENV === "production") return null;
	let file = path;
	try {
		file = `${path}@${fs.statSync(path).mtimeMs}`; // an edited script is read again
	} catch {
		return null;
	}
	if (scripted?.file === file) return scripted;
	try {
		const script = JSON.parse(fs.readFileSync(path, "utf-8")) as { judge?: unknown; probe?: unknown[] };
		const make = (next: (prompt: string) => unknown): PiEngine => {
			const faux = createFauxCore({ tokenSize: { min: 32, max: 32 } });
			return {
				model: faux.getModel(),
				streamFn: (model, context, options) => {
					const last = context.messages[context.messages.length - 1];
					const text = last && typeof last.content === "string" ? last.content : Array.isArray(last?.content) ? last.content.map((c) => ("text" in c ? c.text : "")).join("") : "";
					faux.setResponses([fauxAssistantMessage(JSON.stringify(next(text)))]);
					return faux.streamSimple(model, context, options);
				},
			};
		};
		let i = 0;
		const probe = Array.isArray(script.probe) && script.probe.length ? script.probe : [{ say: "", ask: null, done: "Scripted: nothing to probe." }];
		// judge: {"accept": true|false|["word", …], "note"}: a list accepts only those typed words.
		const judge = (script.judge ?? {}) as { accept?: unknown; note?: unknown };
		scripted = {
			file,
			judge: make((prompt) => {
				const typed = /The learner typed: (.*)$/m.exec(prompt)?.[1]?.trim() ?? "";
				const accept = Array.isArray(judge.accept) ? judge.accept.includes(typed) : judge.accept === true;
				return { accept, note: accept ? judge.note : "" };
			}),
			probe: make((prompt) => {
				// A new stage starts the script over.
				if (/Open the stage/.test(prompt)) i = 0;
				return probe[Math.min(i++, probe.length - 1)];
			}),
		};
		return scripted;
	} catch {
		return null;
	}
}

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

async function ask(engine: PiEngine, systemPrompt: string, prompt: string, usage: StoryUsage): Promise<string> {
	const { text } = await runSubagent([], { role: "researcher", engine, systemPrompt, prompt, maxTurns: 1, onUsage: (u) => usage.steps.push(stepOf(u)) });
	return text;
}

// ─── Stage 1: the ladder ────────────────────────────────────────────────────

export interface PlacementStart {
	id: string;
	from: number;
	/** The first item. */
	item: LessonItem;
	progress: PlacementProgress;
	/** The check can judge typed answers (a model is set). */
	judges: boolean;
}

export interface PlacementProgress {
	asked: number;
	max: number;
	/** The rung being asked, its tier, and the bracket so far. */
	unit: UnitId | null;
	tier: { id: string; level: string; title: string } | null;
	floor: UnitId | null;
	ceiling: UnitId | null;
	phase: "bracket" | "confirm" | "done";
}

function progressOf(s: PlacementSession): PlacementProgress {
	const unit = nextUnit(s.ladder);
	const tier = unit ? tierOfUnit(unit) : undefined;
	const edge = ladderEdge(s.ladder);
	return { asked: s.ladder.asked, max: MAX_ITEMS, unit, tier: tier ? { id: tier.id, level: tier.level, title: tier.title } : null, floor: edge.floor, ceiling: edge.ceiling, phase: s.ladder.phase };
}

let calm: { source: Lexicon | null; entries: LexiconEntry[] } | null = null;
/** The lexicon without its grim sentences (src/core/onboarding.ts
 *  calmEntries), filtered once per loaded lexicon. */
function entries(): LexiconEntry[] {
	const lexicon = loadLexicon();
	if (!calm || calm.source !== lexicon) calm = { source: lexicon, entries: calmEntries(lexicon?.entries ?? []) };
	return calm.entries;
}

/** One typed item of `unit` the session has not shown. */
function itemFor(s: PlacementSession, unit: UnitId): LessonItem {
	const p = progressStore.read();
	const recent = new Set<string>([...p.recent, ...s.items.map((r) => r.item.id)]);
	const plan = buildLesson(entries(), unit, { seed: s.seed + s.items.length * 131, length: 1, pattern: ["type"], recent });
	const item = plan.items[0];
	if (!item) throw new Error(`no placement item for ${unit}`);
	return item;
}

export function startPlacement(opts: { recheck?: boolean } & PlacementOptions = {}): PlacementStart {
	const now = opts.now ?? new Date();
	const p = progressStore.read();
	const goal = p.goal ?? defaultGoal();
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const from = opts.recheck ? tierForChapter(state.current) : 0;
	const id = `pl_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
	const s: PlacementSession = {
		id,
		startedAt: now.toISOString(),
		recheck: !!opts.recheck,
		from,
		seed: now.getTime() % 1_000_000,
		ladder: ladderStart({ prior: goal.prior, from }),
		items: [],
		probe: { units: [], turns: [], verdicts: [] },
		usage: { model: opts.model ?? probeEngine()?.model ?? storyEngine()?.model ?? "none", steps: [] },
	};
	const unit = nextUnit(s.ladder)!;
	const item = itemFor(s, unit);
	s.items.push({ item, rung: unit, at: now.toISOString() });
	placementStore.put(s);
	return { id, from, item, progress: progressOf(s), judges: !!(opts.engine ?? scriptedEngines() ?? storyEngine()) };
}

export interface AnswerInput {
	id: string;
	itemId: string;
	given: string;
	/** The client's string verdict (src/core/language.ts compareAnswer). */
	verdict: RepVerdict;
	ms?: number;
}

export interface AnswerResult {
	/** The verdict that counted. */
	verdict: RepVerdict;
	judged?: { accepted: boolean; note: string };
	/** The next item, or null when the ladder is done. */
	item: LessonItem | null;
	progress: PlacementProgress;
}

type PromptLang = Pick<LanguageInfo, "english" | "promptExamples">;

export function judgeSystem(lang: PromptLang = activeLanguage()): string {
	const name = lang.english;
	const x = lang.promptExamples ?? {};
	return `You check one answer in a ${name} fill-the-blank exercise for a language-learning app. You get the sentence with its blank, its English meaning, the word the dictionary put in the blank, and what the learner typed. Decide whether the learner's word is a CORRECT and NATURAL filling of this blank in this sentence: the same meaning, correct grammar for this slot (case, number, gender, person, tense, aspect), including a synonym or an alternative form the sentence allows. Diacritics must be right${x.diacriticPair ? ` (${x.diacriticPair})` : ""}; a missing or wrong diacritic is not accepted. A different word that changes the meaning, or a form that does not fit the slot, is not accepted. Answer with ONE JSON object and nothing else: {"accept": true | false, "note": "<why, in English>"}. The note is ONE plain sentence of at most 25 words for the learner to read: when the miss is a case or ending, name the case and the pattern for this noun's class${x.caseNote ? ` (e.g. ${x.caseNote})` : ""}. Write ${name} words bare, with no quotation marks, and use no semicolons.`;
}

function parseJudge(text: string): { accepted: boolean; note: string } {
	const m = text.match(/\{[\s\S]*\}/);
	if (!m) return { accepted: false, note: "" };
	try {
		const o = JSON.parse(m[0]) as { accept?: unknown; note?: unknown };
		return { accepted: o.accept === true, note: typeof o.note === "string" ? o.note.trim().slice(0, 160) : "" };
	} catch {
		return { accepted: false, note: "" };
	}
}

/** Ask the cheap slot whether a typed miss is a valid alternative. Null
 *  when no model is set or the call fails (then the string verdict stands). */
export async function judgeAnswer(item: LessonItem, given: string, usage: StoryUsage, opts: PlacementOptions = {}): Promise<{ accepted: boolean; note: string } | null> {
	const script = scriptedEngines();
	const real = opts.engine ? { engine: opts.engine } : script ? { engine: script.judge } : storyEngine();
	if (!real) return null;
	const prompt = [`Sentence: ${item.before}___${item.after}`, `Meaning: ${item.translation}`, `Dictionary word in the blank: ${item.answer} (${item.lemma}, "${item.gloss}")`, `Hint the learner saw: ${item.hint ?? item.lemma}`, `The learner typed: ${given}`].join("\n");
	try {
		return parseJudge(await ask(real.engine, judgeSystem(), prompt, usage));
	} catch {
		return null;
	}
}

export async function answerPlacement(input: AnswerInput, opts: PlacementOptions = {}): Promise<AnswerResult> {
	const s = placementStore.get(input.id);
	if (!s) throw new Error("No such placement check.");
	const now = opts.now ?? new Date();
	const rec = s.items.find((r) => r.item.id === input.itemId && r.verdict === undefined);
	if (!rec) throw new Error("That item was answered already.");
	let verdict: RepVerdict = input.verdict;
	rec.given = input.given;
	if (input.ms !== undefined) rec.ms = input.ms;
	if (verdict === "wrong" && input.given.trim()) {
		const judged = await judgeAnswer(rec.item, input.given, s.usage, opts);
		if (judged) {
			rec.judged = judged;
			if (judged.accepted) verdict = "exact";
		}
	}
	rec.verdict = verdict;
	s.ladder = applyAnswer(s.ladder, rec.rung ?? rec.item.unit, verdict !== "wrong");
	const unit = nextUnit(s.ladder);
	let item: LessonItem | null = null;
	if (unit) {
		item = itemFor(s, unit);
		s.items.push({ item, rung: unit, at: now.toISOString() });
	}
	placementStore.put(s);
	return { verdict, ...(rec.judged ? { judged: rec.judged } : {}), item, progress: progressOf(s) };
}

// ─── Stage 2: the edge ──────────────────────────────────────────────────────

export function probeSystem(lang: PromptLang = activeLanguage()): string {
	const name = lang.english;
	const x = lang.promptExamples ?? {};
	return `You are the placement tutor of a ${name} learning app. The learner has just done an adaptive drill; its evidence is in the brief. Your job is the Socratic part a drill cannot do: find out, on the units at the learner's edge, whether a miss was a slip, a gap or a misconception, and whether a hit was knowledge or luck.

How you work:
- One question at a time, chosen from the answer before it. Make the learner PRODUCE the form under its trigger: a ${name} frame with ___ and the dictionary word in brackets${x.frame ? ` ("${x.frame}")` : ""}, or a short sentence to transform${x.pastSentence ? ` ("Put it in the past: ${x.pastSentence}")` : ""}. Never a multiple choice, never a yes/no.
- After a right form, you may ask WHY once: "What decided that ending?" — a right form with a right reason is held; a right form with no reason or a wrong one is a slip (fragile).
- Judge every answer: "held" (produces it and knows what decides it), "slip" (right form but shaky, or one miss then right), "gap" (cannot produce it, or a misconception). One verdict per unit; a later verdict on the same unit replaces the earlier one.
- At most ${PROBE_TURNS} questions in all; stop as soon as the edge is clear. Do not re-ask what the drill already showed twice. Enter at the unit the brief marks first.
- Speak to the learner in the explanation language of the profile (English unless it says otherwise); the frames in ${name}. Short: one or two sentences of feedback, then the next question.
- Unit ids are for the JSON fields only. In "say", "prompt" and "done", name the grammar in full words ("the feminine accusative", "the locative"), never an id like acc-fem or a short form like fem. or sg.
- Never give the level. The app computes it from your verdicts and the drill.

Answer with ONE JSON object and nothing else:
{"say": "<feedback on the last answer, one or two sentences; empty on the first turn>",
 "verdict": {"unit": "<unit id from the brief>", "result": "held" | "slip" | "gap", "note": "<the evidence in one line: what was produced or missed>"} | null,
 "ask": {"unit": "<unit id>", "prompt": "<the task in the explanation language>", "sk": "<the ${name} frame>", "kind": "produce" | "why"} | null,
 "done": "<when you stop: two sentences on the edge you found, in the explanation language, with the forms as evidence>" | null}
"ask" is null only when "done" is set.`;
}

/** A unit as the probe tutor should say it: the grammar term, then the title
 *  ("Feminine accusative (Objects: -a → -u)"), never the bare id. */
function unitName(id: UnitId): string {
	const info = unitInfo(id);
	return info.grammarTerm && info.grammarTerm !== info.title ? `${info.grammarTerm} (${info.title})` : info.title;
}

function probeBrief(s: PlacementSession, outcome: PlacementOutcome, units: UnitId[]): string {
	const lines: string[] = [];
	const edge = ladderEdge(s.ladder);
	lines.push(`Drill evidence (${s.items.length} typed items, adaptive): floor ${edge.floor ? unitInfo(edge.floor).title : "none"}, ceiling ${edge.ceiling ? unitInfo(edge.ceiling).title : "none (every rung held)"}.`);
	for (const r of s.items) {
		if (!r.verdict) continue;
		const tag = r.verdict === "wrong" ? "MISS" : r.verdict === "accents" ? "hit (diacritics off)" : r.judged?.accepted ? "hit (model accepted an alternative)" : "hit";
		lines.push(`- [${unitName(r.rung ?? r.item.unit)}${r.rung && r.rung !== r.item.unit ? ` · ${unitName(r.item.unit)}` : ""}] "${r.item.before}___${r.item.after}" (${r.item.translation}) → wrote "${r.given ?? ""}", form "${r.item.answer}": ${tag}`);
	}
	lines.push("");
	lines.push("Units you may probe, most valuable first (id for the JSON · its grammar name and title · its trigger):");
	for (const u of units) {
		const info = unitInfo(u);
		const t = s.ladder.tally[u];
		lines.push(`- ${u} · ${unitName(u)}: ${info.tagline}${t ? ` · drill ${t.hits}/${t.hits + t.misses}` : " · not asked by the drill"}`);
	}
	const tier = outcome.tiers.find((t) => !t.passed);
	lines.push("");
	lines.push(`The drill stops the learner at the ${tier ? `${tier.level} tier "${tier.title}"` : "top of the check"}; the chapter it would start them in is "${allChapters().find((c) => c.id === outcome.startChapter)?.title ?? outcome.startChapter}".`);
	const profile = learnerProfileSegment();
	if (profile) lines.push("", profile);
	return lines.join("\n");
}

function probeTranscript(s: PlacementSession): string {
	const out: string[] = [];
	for (const [i, t] of s.probe.turns.entries()) {
		if (t.reply.say) out.push(`Tutor: ${t.reply.say}`);
		if (t.reply.ask) out.push(`Tutor asks (${unitName(t.reply.ask.unit)}, ${t.reply.ask.kind}): ${t.reply.ask.prompt} — ${t.reply.ask.sk}`);
		if (t.answer !== undefined) out.push(`Learner: ${t.answer || "(nothing)"}`);
		else if (i === s.probe.turns.length - 1) out.push("Learner: (answering now)");
	}
	return out.join("\n");
}

export interface ProbeTurnResult {
	reply: ProbeReply;
	/** Turns asked so far, of PROBE_TURNS. */
	turn: number;
	max: number;
	verdicts: ProbeVerdict[];
	done: boolean;
	/** No model is set: the stage was skipped. */
	skipped?: boolean;
}

/**
 * One turn of the Socratic stage. The first call (no answer) opens it:
 * the tutor reads the brief and asks. Each later call carries the
 * learner's answer to the open question. Returns the tutor's reply.
 */
export async function probePlacement(input: { id: string; answer?: string }, opts: PlacementOptions = {}): Promise<ProbeTurnResult> {
	const s = placementStore.get(input.id);
	if (!s) throw new Error("No such placement check.");
	const now = opts.now ?? new Date();
	const script = scriptedEngines();
	const real = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:test" } : script ? { engine: script.probe, model: "faux:script" } : probeEngine();
	const outcome = ladderOutcome(s.ladder);
	if (s.probe.units.length === 0) s.probe.units = probeUnits(outcome);
	const finished = (): ProbeTurnResult => ({ reply: s.probe.turns.at(-1)?.reply ?? { say: "", done: s.probe.summary ?? "" }, turn: s.probe.turns.length, max: PROBE_TURNS, verdicts: s.probe.verdicts, done: true });
	if (!real || s.probe.units.length === 0) {
		s.probe.skipped = true;
		s.probe.summary = s.probe.units.length === 0 ? "Nothing at the edge to probe: the drill was clear." : "";
		placementStore.put(s);
		return { ...finished(), skipped: !real };
	}
	if (s.usage.model === "none") s.usage.model = real.model;
	const open = s.probe.turns.at(-1);
	if (open && open.reply.ask && open.answer === undefined) {
		if (input.answer === undefined) return { reply: open.reply, turn: s.probe.turns.length, max: PROBE_TURNS, verdicts: s.probe.verdicts, done: false };
		open.answer = input.answer.trim().slice(0, 600);
	}
	if (s.probe.summary !== undefined) return finished();
	const asked = s.probe.turns.filter((t) => t.reply.ask).length;
	const prompt = [probeBrief(s, outcome, s.probe.units), "", s.probe.turns.length ? `The stage so far:\n${probeTranscript(s)}` : "Open the stage: judge nothing yet, ask your first question.", asked >= PROBE_TURNS ? `\nThat was your last question: judge the answer and set "done".` : asked === PROBE_TURNS - 1 ? "\nOne question left after this answer at most." : ""].join("\n");
	let reply: ProbeReply;
	try {
		const text = await ask(real.engine, probeSystem(), prompt, s.usage);
		if (process.env.LH_PLACEMENT_DEBUG) console.error("[placement/probe]", JSON.stringify(text).slice(0, 400), s.probe.units);
		reply = parseProbeReply(text, s.probe.units);
		if (!reply.ask && !reply.done && asked < PROBE_TURNS) {
			// Neither a question about an offered unit nor a reading: once more, with the units named.
			const nudge = `${prompt}\n\nYour last reply had no question about one of the offered units (${s.probe.units.map((u) => `${u} = ${unitName(u)}`).join("; ")}) and no "done". Ask ONE question about one of those units, or set "done" with your reading.`;
			const again = await ask(real.engine, probeSystem(), nudge, s.usage);
			if (process.env.LH_PLACEMENT_DEBUG) console.error("[placement/probe retry]", JSON.stringify(again).slice(0, 400));
			reply = parseProbeReply(again, s.probe.units);
			if (!reply.ask && !reply.done) reply = { say: reply.say, done: "The tutor had no further question. The drill's evidence stands." };
		}
	} catch (err) {
		reply = { say: "", done: `The tutor could not answer (${err instanceof Error ? err.message : String(err)}). The drill's evidence stands.` };
	}
	if (asked >= PROBE_TURNS) reply = { ...reply, ask: undefined, done: reply.done ?? reply.say };
	if (reply.verdict) s.probe.verdicts.push(reply.verdict);
	s.probe.turns.push({ reply, at: now.toISOString() });
	if (reply.done !== undefined && !reply.ask) s.probe.summary = reply.done;
	placementStore.put(s);
	return { reply, turn: s.probe.turns.length, max: PROBE_TURNS, verdicts: s.probe.verdicts, done: s.probe.summary !== undefined };
}

/** Leave the stage (the learner skipped it, or lost the thread). */
export function skipProbe(id: string): void {
	const s = placementStore.get(id);
	if (!s) throw new Error("No such placement check.");
	if (s.probe.summary === undefined) {
		s.probe.skipped = true;
		s.probe.summary = s.probe.verdicts.length ? "Stopped early; the verdicts so far stand." : "";
	}
	placementStore.put(s);
}

// ─── Stage 3: words ─────────────────────────────────────────────────────────

/** Forty real lemmas across the bands and eight pseudowords, shuffled. */
export function wordsFor(id: string, lexicon: Lexicon | null = loadLexicon()): VocabItem[] {
	const s = placementStore.get(id);
	if (!s) throw new Error("No such placement check.");
	if (s.words?.items.length) return s.words.items;
	if (!lexicon) throw new Error("No dictionary loaded.");
	const rand = rng(s.seed + 977);
	const order = frequencyOrder(lexicon);
	const usable = (e: LexiconEntry | undefined): e is LexiconEntry => !!e && e.cat !== "Places" && !grammarWord(entryLemma(e)) && !entryLemma(e).includes(" ") && entryLemma(e).length >= 3 && entryLemma(e).charAt(0) === entryLemma(e).charAt(0).toLocaleLowerCase("sk-SK");
	const items: VocabItem[] = [];
	for (const b of VOCAB_BANDS) {
		const slugs = order.slice(b.from, b.to).filter((slug) => usable(lexicon.bySlug.get(slug)));
		for (const slug of shuffle(slugs, rand).slice(0, WORDS_PER_BAND)) items.push({ id: slug, word: entryLemma(lexicon.bySlug.get(slug)!), band: b.id });
	}
	const real = (w: string) => lexicon.byForm.has(w) || lexicon.byFolded.has(w) || lexicon.bySlug.has(w);
	const source = order.slice(0, 3000).map((slug) => lexicon.bySlug.get(slug)?.sk ?? "").filter(Boolean);
	for (const [i, w] of makePseudowords(source, PSEUDO_WORDS, rand, real).entries()) items.push({ id: `pseudo-${i}`, word: w, band: null });
	s.words = { items: shuffle(items, rand) };
	placementStore.put(s);
	return s.words.items;
}

export function recordWords(id: string, answers: VocabAnswer[]) {
	const s = placementStore.get(id);
	if (!s?.words) throw new Error("No such placement check.");
	const ids = new Set(s.words.items.map((i) => i.id));
	s.words.answers = answers.filter((a) => ids.has(a.id));
	s.words.estimate = scoreVocab(s.words.items, s.words.answers);
	placementStore.put(s);
	return s.words.estimate;
}

// ─── Finish ─────────────────────────────────────────────────────────────────

export interface FinishResult extends PlacementResult {
	id: string;
	probe: { verdicts: ProbeVerdict[]; summary: string; skipped: boolean };
	vocabulary: PlacementSession["words"] extends infer W ? (W extends { estimate?: infer E } ? E | null : null) : null;
	/** The ladder items missed, for the result screen's evidence. */
	missed: Array<{ item: LessonItem; given: string }>;
}

/** Fold the three stages into the outcome, record it, index the session. */
export function finishPlacement(input: { id: string; ms?: number; activeMs?: number; tz?: number }, opts: PlacementOptions = {}): FinishResult {
	const s = placementStore.get(input.id);
	if (!s) throw new Error("No such placement check.");
	const now = opts.now ?? new Date();
	// The Socratic verdicts replace the ladder's tallies on those units.
	let ladder = s.ladder;
	const last = new Map<UnitId, ProbeVerdict>();
	for (const v of s.probe.verdicts) last.set(v.unit, v);
	if (last.size) {
		const tally = { ...ladder.tally };
		for (const [u, v] of last) tally[u] = v.result === "held" ? { hits: 2, misses: 0 } : v.result === "slip" ? { hits: 2, misses: 1 } : { hits: 0, misses: 2 };
		// The bracket moves with the verdicts: the floor is the highest rung
		// held with no gap below it, the ceiling the lowest gap.
		let lo = placementTiers().slice(0, ladder.from).reduce((n, t) => n + t.units.length, 0) - 1;
		let hi = placementLadder().length;
		for (const [i, u] of placementLadder().entries()) {
			const st = rungStatus(tally[u]);
			if (st === "gap") {
				hi = Math.min(hi, i);
				break;
			}
			if (st === "held") lo = i;
		}
		ladder = { ...ladder, tally, lo, hi: Math.max(hi, lo + 1) };
	}
	const outcome = ladderOutcome(ladder);
	s.outcome = outcome;
	s.endedAt = now.toISOString();
	if (input.ms !== undefined) s.ms = input.ms;
	const reps: Array<RepResult & { tier: string }> = s.items
		.filter((r) => r.verdict !== undefined)
		.map((r) => ({
			tier: tierOfUnit(r.rung ?? r.item.unit)?.id ?? "",
			itemId: r.item.id,
			slug: r.item.slug,
			kind: r.item.kind,
			verdict: r.verdict!,
			detail: { unit: r.item.unit, lemma: r.item.lemma, gloss: r.item.gloss, sentence: r.item.sentence, translation: r.item.translation, answer: r.item.answer, given: r.given, trigger: r.item.trigger, ...(r.judged?.accepted ? { hint: `accepted: ${r.judged.note}` } : {}) },
		}));
	// Why each missed unit was missed: the tutor's verdict first, else the
	// judge's note on the first miss, else the form itself.
	const weakNotes: Partial<Record<UnitId, string>> = {};
	for (const r of s.items) {
		const unit = (r.rung ?? r.item.unit) as UnitId;
		if (r.verdict === undefined || r.verdict !== "wrong" || weakNotes[unit]) continue;
		weakNotes[unit] = r.judged?.note ? r.judged.note : `wrote "${r.given}" for ${r.item.answer}`;
	}
	for (const [u, v] of last) if (v.result !== "held") weakNotes[u] = v.note ? `${v.result}: ${v.note}` : `the tutor saw a ${v.result}`;
	const result = recordPlacement({ outcome, reps, ms: input.ms, activeMs: input.activeMs, tz: input.tz, note: s.probe.summary || undefined, weakNotes, vocabulary: s.words?.estimate ? { size: s.words.estimate.size, at: now.toISOString(), reliable: s.words.estimate.reliable } : undefined }, now);
	placementStore.put(s);
	placementStore.index(s);
	return {
		...result,
		id: s.id,
		probe: { verdicts: s.probe.verdicts, summary: s.probe.summary ?? "", skipped: !!s.probe.skipped },
		vocabulary: s.words?.estimate ?? null,
		missed: s.items.filter((r) => r.verdict === "wrong").map((r) => ({ item: r.item, given: r.given ?? "" })),
	};
}
