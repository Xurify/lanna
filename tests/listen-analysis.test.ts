import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignWords, analyzeListening, causeOfSub, LISTEN_MIN_TYPED, readTyped, type LoggedListen } from "../src/core/listen-analysis.ts";

const causes = (sentence: string, given: string, stretch: string[] = []) => readTyped(sentence, given, stretch).map((e) => e.cause);

describe("reading one typed sentence", () => {
	it("calls a missing mark by the sound it stands for", () => {
		assert.deepEqual(causes("Teplý úsmev ju privítal.", "Teply usmev ju privital."), ["length", "length", "length"]);
		assert.deepEqual(causes("Videl ľudí.", "Videl ludi."), ["palatal"]);
		assert.deepEqual(causes("Nečakal som.", "Necakal som."), ["hushing"]);
	});
	it("tells a sound heard wrong from a spelling choice and a slip", () => {
		assert.equal(causeOfSub("dom", "tom", new Set()), "voicing");
		assert.equal(causeOfSub("mysli", "misli", new Set()), "spelling");
		assert.equal(causeOfSub("stanica", "stavba", new Set()), "mishear");
		assert.equal(causeOfSub("kniha", "knihe", new Set()), "ending");
		assert.equal(causeOfSub("tom", "tomm", new Set()), "slip");
	});
	it("finds a dropped short word and a dropped content word apart", () => {
		assert.deepEqual(causes("Žila som v Ríme.", "Žila som Ríme."), ["small-word"]);
		assert.deepEqual(causes("Peter varil večeru.", "Peter večeru."), ["word-missed"]);
		assert.deepEqual(causes("Peter varil.", "Peter varil dobre."), ["extra-word"]);
	});
	it("puts every difference on the word the learner had not met as vocabulary", () => {
		assert.deepEqual(causes("Teplý úsmev ju privítal.", "Teply usmev ju privital.", ["úsmev"]), ["length", "new-word", "length"]);
		assert.deepEqual(causes("Teplý úsmev ju privítal.", "Teplý ju privítal.", ["úsmev"]), ["new-word"]);
	});
	it("aligns a similar word as one substitution, not a drop and an add", () => {
		const ops = alignWords(["peter", "varil", "veceru"], ["peter", "varel", "veceru"]);
		assert.deepEqual(ops.map((o) => o.op), ["match", "sub", "match"]);
	});
	it("reads a right sentence as no differences", () => {
		assert.deepEqual(readTyped("Žila som v Ríme.", "žila som v ríme", []), []);
	});
});

const rep = (sentence: string, given: string, extra: Partial<LoggedListen["reps"][number]> = {}): LoggedListen["reps"][number] => ({
	kind: "dictation",
	sentence,
	given,
	verdict: given.trim().toLowerCase().replace(/[.!?,]/g, "") === sentence.toLowerCase().replace(/[.!?,]/g, "") ? "exact" : "wrong",
	stretch: [],
	...extra,
});
const session = (at: string, reps: LoggedListen["reps"]): LoggedListen => ({ at, mode: "listen", reps });
const NOW = new Date("2026-11-20T12:00:00Z");

describe("listening trends", () => {
	it("has nothing to say about a day with no Listen sessions", () => {
		const a = analyzeListening([{ at: "2026-11-19T10:00:00Z", mode: "lesson", reps: [] }], NOW);
		assert.equal(a.sentences, 0);
		assert.equal(a.ready, false);
		assert.deepEqual(a.causes, []);
	});

	it("counts causes per hundred typed sentences in each window and calls a clear drop better", () => {
		const earlier = Array.from({ length: 30 }, (_, i) => (i < 18 ? rep("Žila som v Ríme.", "Žila som Ríme.") : rep("Žila som v Ríme.", "Žila som v Ríme.")));
		const recent = Array.from({ length: 30 }, (_, i) => (i < 3 ? rep("Žila som v Ríme.", "Žila som Ríme.") : rep("Žila som v Ríme.", "Žila som v Ríme.")));
		const a = analyzeListening([session("2026-10-20T10:00:00Z", earlier), session("2026-11-18T10:00:00Z", recent)], NOW);
		assert.equal(a.typed, 60);
		assert.equal(a.ready, true);
		const small = a.causes.find((c) => c.cause === "small-word")!;
		assert.equal(small.count, 21);
		assert.equal(small.earlier, 60);
		assert.equal(small.recent, 10);
		assert.equal(small.trend, "better");
		assert.equal(a.kinds[0]!.kind, "hearing");
	});

	it("keeps an older typed miss without its stretch words out of the causes", () => {
		const old = Array.from({ length: LISTEN_MIN_TYPED }, () => rep("Žila som v Ríme.", "Žila som Ríme.", { stretch: undefined }));
		const a = analyzeListening([session("2026-11-10T10:00:00Z", old)], NOW);
		assert.equal(a.typed, LISTEN_MIN_TYPED);
		assert.deepEqual(a.causes, []);
		assert.equal(a.ready, false);
	});

	it("reads a picked meaning for accuracy but not for causes", () => {
		const picked = [{ kind: "meaning", sentence: "Žila som v Ríme.", given: "I lived in Rome.", verdict: "exact" as const }, { kind: "meaning", sentence: "Peter varil.", given: "x", verdict: "wrong" as const }];
		const a = analyzeListening([session("2026-11-10T10:00:00Z", picked)], NOW);
		assert.equal(a.sentences, 2);
		assert.equal(a.typed, 0);
		assert.equal(a.right, 0.5);
		assert.deepEqual(a.causes, []);
	});

	it("compares accuracy on fast and slow clips only with enough of each", () => {
		const fast = Array.from({ length: 10 }, (_, i) => rep("Peter varil večeru a pritom telefonoval s mamou.", i < 4 ? "Peter varil večeru." : "Peter varil večeru a pritom telefonoval s mamou.", { heardMs: 3000 }));
		const slow = Array.from({ length: 10 }, () => rep("Čím skôr začneš, tým skôr skončíš.", "Čím skôr začneš, tým skôr skončíš.", { heardMs: 3400 }));
		const a = analyzeListening([session("2026-11-10T10:00:00Z", [...fast, ...slow])], NOW);
		assert.ok(a.pace);
		assert.equal(a.pace!.fast!.reps, 10);
		assert.equal(a.pace!.fast!.right, 6);
		assert.equal(a.pace!.slow!.right, 10);
		assert.equal(analyzeListening([session("2026-11-10T10:00:00Z", fast)], NOW).pace, null);
	});
});
