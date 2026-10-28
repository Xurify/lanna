/**
 * SPEAK PINS (LangHarness, 2026-10-28): the spoken-scene task — the
 * tutor's JSON read into turns and prompts, the summary, the XP, word
 * matching for speech-to-text, and the server round trip on a scripted
 * engine (start → turns → end: the record on disk, the day's ledger, the
 * slips' words into the review deck, the lesson log, the index).
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-speak-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const { parseSummary, parseTutorReply, SPEAK_SCENES, SPEAK_TURNS, speakCounts, speakXp, wordMatch, foldedWords } = await import("../src/core/speak.ts");
const { STRAND_MINUTES, strandBalance } = await import("../src/core/strands.ts");
const { purposeScenes, PURPOSES } = await import("../src/core/onboarding.ts");
const speak = await import("../src/server/speak.ts");
const { speakStore } = await import("../src/store/speak.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}
const reply = (o: unknown) => fauxAssistantMessage(JSON.stringify(o));

test("every scene the purposes point at exists", () => {
	for (const p of PURPOSES) for (const id of purposeScenes([p.id])) assert.ok(SPEAK_SCENES.some((s) => s.id === id), `${p.id} → ${id}`);
	for (const s of SPEAK_SCENES) assert.ok(s.task.length > 10 && s.brief.length > 10);
});

test("parseTutorReply: JSON in, a turn out; a prompt needs both the slip and the hint; prose is taken as the line", () => {
	const r = parseTutorReply('```json\n{"sk":"Dobrý deň! Čo si dáte?","en":"Hello! What will you have?","prompt":null,"repaired":false,"end":false}\n```');
	assert.equal(r.sk, "Dobrý deň! Čo si dáte?");
	assert.equal(r.en, "Hello! What will you have?");
	assert.equal(r.prompt, undefined);
	const p = parseTutorReply('{"sk":"(do škol…? skús ešte raz) Áno?","en":"...","prompt":{"yours":"idem do škola","hint":"(do škol…? skús ešte raz)","kind":"case"},"end":false}');
	assert.deepEqual(p.prompt, { yours: "idem do škola", hint: "(do škol…? skús ešte raz)", kind: "case" });
	const half = parseTutorReply('{"sk":"Áno.","en":"Yes.","prompt":{"yours":"","hint":"(skús)","kind":"verb"}}');
	assert.equal(half.prompt, undefined, "a prompt without the learner's words is dropped");
	const odd = parseTutorReply('{"sk":"Áno.","en":"Yes.","prompt":{"yours":"x","hint":"y","kind":"nonsense"},"repaired":true,"end":true}');
	assert.equal(odd.prompt?.kind, "other");
	assert.equal(odd.repaired, true);
	assert.equal(odd.end, true);
	const prose = parseTutorReply("Dobrý deň, nech sa páči.");
	assert.equal(prose.sk, "Dobrý deň, nech sa páči.");
	assert.equal(prose.en, "");
	const wrapped = parseTutorReply('Here you go: {"sk":"Ahoj!","en":"Hi!"} hope that helps');
	assert.equal(wrapped.sk, "Ahoj!");
});

test("parseSummary: at most three corrections with both sides, two phrases, a note; garbage gives an empty summary", () => {
	const s = parseSummary(
		JSON.stringify({
			corrections: [
				{ yours: "idem do škola", right: "idem do školy", rule: "do takes the genitive", kind: "case", lemma: "škola" },
				{ yours: "ja chcem kávu", right: "chcem kávu", rule: "drop the pronoun", kind: "order" },
				{ yours: "", right: "x" },
				{ yours: "a", right: "b", kind: "verb" },
				{ yours: "c", right: "d", kind: "verb" },
			],
			keep: ["Nech sa páči.", "Ďakujem pekne.", "extra"],
			note: "Clear and polite.",
		}),
	);
	assert.equal(s.corrections.length, 3);
	assert.equal(s.corrections[0]!.lemma, "škola");
	assert.equal(s.corrections[1]!.lemma, undefined);
	assert.deepEqual(s.keep, ["Nech sa páči.", "Ďakujem pekne.", "extra"]);
	assert.equal(s.note, "Clear and polite.");
	assert.deepEqual(parseSummary("not json at all"), { corrections: [], keep: [] });
});

test("speakXp and speakCounts: lines, prompts and repairs", () => {
	assert.equal(speakXp(0, 0), 0);
	assert.equal(speakXp(5, 2), 5 * 3 + 2 * 5 + 10);
	assert.equal(speakXp(14, 0), 10 * 3 + 10, "lines beyond the cap earn nothing more");
	const c = speakCounts([
		{ role: "tutor", text: "a", at: "" },
		{ role: "learner", text: "b", at: "" },
		{ role: "tutor", text: "c", at: "", prompt: { yours: "b", hint: "h", kind: "case" } },
		{ role: "learner", text: "d", at: "" },
		{ role: "tutor", text: "e", at: "", repaired: true },
	]);
	assert.deepEqual(c, { learner: 2, prompts: 1, repaired: 1 });
});

test("wordMatch: diacritics and punctuation fold, order does not matter, missing and extra words are named", () => {
	assert.deepEqual(foldedWords("Dobrý deň, prosím kávu."), ["dobry", "den", "prosim", "kavu"]);
	const m = wordMatch("Prosím si jednu kávu.", "prosim si kavu jednu");
	assert.equal(m.score, 1);
	const partial = wordMatch("Prosím si jednu kávu.", "Prosím kávu a čaj");
	assert.equal(partial.score, 0.5);
	assert.deepEqual(partial.missing, ["si", "jednu"]);
	assert.deepEqual(partial.extra, ["a", "caj"]);
	assert.equal(wordMatch("", "čokoľvek").score, 1);
});

test("the strand balance counts a spoken scene as output and the speed rounds as fluency", () => {
	const b = strandBalance([{ speaks: 1, fasts: 1, rereads: 1, blitz: 0 }]);
	assert.equal(b.minutes.output, STRAND_MINUTES.speak);
	assert.equal(b.minutes.fluency, STRAND_MINUTES.fast + STRAND_MINUTES.reread);
});

test("a scene on a scripted engine: start, two turns with a prompt and a repair, the end summary; everything on disk", async () => {
	progressStore.write({ ...progressStore.read(), goal: { level: "B2", minutesPerDay: 30, purposes: ["daily"], onboardedAt: "2026-10-28T00:00:00.000Z" } });
	const engine = fauxEngine([
		reply({ sk: "Dobrý deň! Čo si dáte?", en: "Hello! What will you have?", prompt: null, repaired: false, end: false }),
		reply({ sk: "(jednu káv…? skús ešte raz)", en: "(one coff…? try again)", prompt: { yours: "prosím si jedna káva", hint: "(jednu káv…? skús ešte raz)", kind: "case" }, repaired: false, end: false }),
		reply({ sk: "Výborne, jednu kávu. Ešte niečo?", en: "Great, one coffee. Anything else?", prompt: null, repaired: true, end: false }),
		reply({ sk: "Ďakujem, dovidenia!", en: "Thank you, goodbye!", prompt: null, repaired: false, end: true }),
		reply({ corrections: [{ yours: "prosím si jedna káva", right: "prosím si jednu kávu", rule: "the thing you ask for takes the accusative", kind: "case", lemma: "káva" }], keep: ["Nech sa páči.", "Ešte niečo?"], note: "Polite and clear." }),
	]);
	const now = new Date("2026-10-28T10:00:00Z");
	const s = await speak.speakStart("cafe", { engine, model: "faux:speak", now });
	assert.match(s.id, /^sp-2026-10-28-cafe-/);
	assert.equal(s.turns.length, 1);
	assert.equal(s.turns[0]!.role, "tutor");
	assert.equal(s.turns[0]!.text, "Dobrý deň! Čo si dáte?");
	assert.ok(fs.existsSync(path.join(PATHS.speak, `${s.id}.json`)), "the scene is on disk from the first line");

	const t1 = await speak.speakTurn({ id: s.id, text: "prosím si jedna káva", via: "voice", ms: 1800, audio: { data: new Uint8Array([1, 2, 3, 4]), ext: "webm" } }, { engine, now });
	assert.equal(t1.reply.prompt?.kind, "case");
	assert.equal(t1.end, false);
	const learner = t1.session.turns.find((t) => t.role === "learner")!;
	assert.equal(learner.via, "voice");
	assert.equal(learner.audio, "01.webm");
	assert.ok(fs.existsSync(path.join(PATHS.speak, s.id, "01.webm")), "the learner's recording is kept with the scene");

	const t2 = await speak.speakTurn({ id: s.id, text: "prosím si jednu kávu", via: "typed" }, { engine, now });
	assert.equal(t2.reply.repaired, true);
	const t3 = await speak.speakTurn({ id: s.id, text: "nie, ďakujem", via: "typed" }, { engine, now });
	assert.equal(t3.end, true, "the tutor's goodbye ends the scene");

	const before = Object.keys(reviewStore.readCards()).length;
	const out = await speak.speakEnd({ id: s.id, ms: 150_000, tz: 0 }, { engine, now });
	assert.equal(out.session.summary?.corrections.length, 1);
	assert.equal(out.session.summary?.corrections[0]!.slug, "kava", "the slip's word is resolved to its lexicon slug");
	assert.deepEqual(out.queued, ["kava"]);
	assert.equal(Object.keys(reviewStore.readCards()).length, before + 1, "the word joins the deck");
	assert.equal(out.xp, speakXp(3, 1));
	assert.equal(out.session.usage.steps.length, 5, "every model call's tokens are on the record");

	const day = progressStore.read().days["2026-10-28"]!;
	assert.equal(day.speaks, 1);
	assert.equal(day.xp, out.xp);
	assert.ok((day.minutes ?? 0) > 2);
	const idx = speakStore.list();
	assert.equal(idx.length, 1);
	assert.deepEqual({ turns: idx[0]!.turns, prompts: idx[0]!.prompts, repaired: idx[0]!.repaired, corrections: idx[0]!.corrections, model: idx[0]!.model }, { turns: 3, prompts: 1, repaired: 1, corrections: 1, model: "faux:speak" });
	const log = readLessonLog().filter((e) => e.mode === "speak");
	assert.equal(log.length, 1);
	assert.equal(log[0]!.unit, "cafe");
	assert.equal(log[0]!.reps[0]!.given, "prosím si jedna káva");
	assert.ok(fs.existsSync(path.join(PATHS.speak, "README.md")), "the folder gets its README");

	// A second end is a no-op; a turn after the end refuses.
	const again = await speak.speakEnd({ id: s.id }, { engine, now });
	assert.equal(again.xp, out.xp);
	await assert.rejects(speak.speakTurn({ id: s.id, text: "ešte", via: "typed" }, { engine, now }), /over/);

	// The state: the café has been done once; nothing is unfinished.
	const state = speak.speakState();
	assert.equal(state.scenes.find((x) => x.id === "cafe")?.done, 1);
	assert.equal(state.unfinished, null);
	assert.equal(state.scenes[0]!.suggested, true, "the purposes' scenes come first");
});

test("a scene is forced closed after the turn cap, and an unfinished one is offered back", async () => {
	const steps: FauxResponseStep[] = [reply({ sk: "Ahoj!", en: "Hi!" })];
	for (let i = 0; i < SPEAK_TURNS; i++) steps.push(reply({ sk: `Línia ${i}`, en: "", end: false }));
	const engine = fauxEngine(steps);
	const now = new Date("2026-10-29T10:00:00Z");
	const s = await speak.speakStart("way", { engine, now });
	let end = false;
	for (let i = 0; i < SPEAK_TURNS; i++) end = (await speak.speakTurn({ id: s.id, text: `moja línia ${i}`, via: "typed" }, { engine, now })).end;
	assert.equal(end, true, "the cap closes the scene even when the model does not");
	assert.deepEqual(speak.speakState().unfinished, { id: s.id, scene: "way", sceneTitle: "Na ulici", turns: SPEAK_TURNS });
	speak.speakDrop(s.id);
	assert.equal(speak.speakState().unfinished, null);
});

test("transcribe refuses honestly without a key", async () => {
	delete process.env.ELEVENLABS_API_KEY;
	delete process.env.DEEPGRAM_API_KEY;
	assert.equal(speak.sttEngine(), null);
	await assert.rejects(speak.transcribe(new Uint8Array([1]), "audio/webm"), /No speech-to-text key/);
});
