import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignWords, analyzeListening, CAUSE_MIN_SENTENCES, causeOfSub, holm, LISTEN_MIN_TYPED, readTyped, twoProportionZ, type LoggedListen } from "../src/core/listen-analysis.ts";

const causes = (sentence: string, given: string, stretch: string[] = []) => readTyped(sentence, given, stretch).map((e) => e.cause);

describe("reading one typed sentence", () => {
	it("calls a missing mark by the sound it stands for when the learner types marks", () => {
		assert.deepEqual(causes("Teplý úsmev ju privítal.", "Teplý usmev ju privital."), ["length", "length"]);
		assert.deepEqual(causes("Videl ľudí.", "Videl ludí."), ["palatal"]);
		assert.deepEqual(causes("Nečakal na ňu.", "Necakal na ňu."), ["hushing"]);
	});
	it("does not read missing marks as hearing when the sentence was typed with none", () => {
		assert.deepEqual(causes("Teplý úsmev ju privítal.", "Teply usmev ju privital."), []);
		assert.deepEqual(causes("Nečakal na ňu.", "Necakal na neho."), ["mishear"]);
	});
	it("tells a sound heard wrong from a spelling choice and a slip", () => {
		assert.equal(causeOfSub("dom", "tom", new Set()), "voicing");
		assert.equal(causeOfSub("mysli", "misli", new Set()), "spelling");
		assert.equal(causeOfSub("stanica", "stavba", new Set()), "mishear");
		assert.equal(causeOfSub("kniha", "knihe", new Set()), "ending");
		assert.equal(causeOfSub("tom", "tomm", new Set()), "slip");
	});
	it("calls a consonant written as it is said spelling, not hearing", () => {
		assert.equal(causeOfSub("had", "hat", new Set()), "assimilation");
		assert.equal(causeOfSub("vták", "fták", new Set()), "assimilation");
		assert.equal(causeOfSub("kde", "gde", new Set()), "assimilation");
		assert.deepEqual(causes("Bol v škole.", "Bol f škole."), ["assimilation"]);
	});
	it("does not read ô or ä as a long o or a", () => {
		assert.equal(causeOfSub("kôň", "koň", new Set()), "diphthong");
		assert.equal(causeOfSub("mäso", "maso", new Set()), "spelling");
		assert.equal(causeOfSub("mäso", "meso", new Set()), "spelling");
		assert.equal(causeOfSub("mesto", "mästo", new Set()), "spelling");
		assert.equal(causeOfSub("sála", "sala", new Set()), "length");
	});
	it("reads h and ch as a voicing pair", () => {
		assert.equal(causeOfSub("chata", "hata", new Set()), "voicing");
		assert.equal(causeOfSub("boh", "boch", new Set()), "assimilation");
		assert.equal(causeOfSub("stach", "stah", new Set()), "assimilation");
		assert.equal(causeOfSub("chata", "kata", new Set()), "mishear");
	});
	it("finds a dropped short word and a dropped content word apart", () => {
		assert.deepEqual(causes("Žila som v Ríme.", "Žila som Ríme."), ["small-word"]);
		assert.deepEqual(causes("Peter varil večeru.", "Peter večeru."), ["word-missed"]);
		assert.deepEqual(causes("Peter varil.", "Peter varil dobre."), ["extra-word"]);
	});
	it("puts every difference on the word the learner had not met as vocabulary", () => {
		assert.deepEqual(causes("Teplý úsmev ju privítal.", "Teplý usmev ju privital.", ["úsmev"]), ["new-word", "length"]);
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

describe("the statistics", () => {
	it("holds the error across every cause tested (Holm)", () => {
		assert.deepEqual(holm([0.01, 0.04, 0.03]), [true, false, false]);
		assert.deepEqual(holm([0.01, 0.02, 0.04]), [true, true, true]);
		assert.deepEqual(holm([0.04]), [true]);
	});
	it("refuses a z-test the windows are too small for", () => {
		assert.equal(twoProportionZ(1, 10, 3, 10), null);
		assert.ok(twoProportionZ(3, 60, 18, 60)! < -3);
	});
});

type Rep = LoggedListen["reps"][number];
const rep = (sentence: string, given: string, extra: Partial<Rep> = {}): Rep => ({
	kind: "dictation",
	sentence,
	given,
	verdict: given.trim().toLowerCase().replace(/[.!?,]/g, "") === sentence.toLowerCase().replace(/[.!?,]/g, "") ? "exact" : "wrong",
	stretch: [],
	...extra,
});
const session = (at: string, reps: Rep[]): LoggedListen => ({ at, mode: "listen", reps });
const NOW = new Date("2026-11-20T12:00:00Z");
const SAID = "Žila som v Ríme.";
const DROPPED = "Žila som Ríme.";
/** Sessions of `size` sentences on the given days, `missed` of them in all with the short word dropped. */
const sessions = (days: string[], size: number, missed: number) => {
	let left = missed;
	return days.map((d) => session(`${d}T10:00:00Z`, Array.from({ length: size }, () => (left-- > 0 ? rep(SAID, DROPPED) : rep(SAID, SAID)))));
};

describe("listening trends", () => {
	it("has nothing to say about a day with no Listen sessions", () => {
		const a = analyzeListening([{ at: "2026-11-19T10:00:00Z", mode: "lesson", reps: [] }], NOW);
		assert.equal(a.sentences, 0);
		assert.equal(a.ready, false);
		assert.deepEqual(a.causes, []);
	});

	it("calls a clear drop better once both windows have enough sentences and sessions", () => {
		const a = analyzeListening([...sessions(["2026-10-20", "2026-10-22", "2026-10-25"], 20, 18), ...sessions(["2026-11-10", "2026-11-14", "2026-11-18"], 20, 3)], NOW);
		assert.equal(a.typed, 120);
		assert.equal(a.ready, true);
		const small = a.causes.find((c) => c.cause === "small-word")!;
		assert.equal(small.count, 21);
		assert.equal(small.earlier, 30);
		assert.equal(small.recent, 5);
		assert.equal(small.trend, "better");
		assert.equal(a.kinds[0]!.kind, "hearing");
	});

	it("does not compare windows that come from too few sessions", () => {
		const a = analyzeListening([...sessions(["2026-10-20"], 60, 18), ...sessions(["2026-11-18"], 60, 3)], NOW);
		const small = a.causes.find((c) => c.cause === "small-word")!;
		assert.equal(small.trend, "new");
		assert.equal(small.recent, null);
		assert.equal(a.ready, false);
	});

	it("waits for enough typed sentences, misses and sessions before reading causes", () => {
		assert.equal(analyzeListening(sessions(["2026-11-10", "2026-11-12", "2026-11-14"], 10, 20), NOW).ready, false);
		assert.equal(analyzeListening(sessions(["2026-11-10", "2026-11-12", "2026-11-14"], 20, 10), NOW).ready, false);
		assert.equal(analyzeListening(sessions(["2026-11-10", "2026-11-12", "2026-11-14"], 20, 20), NOW).ready, true);
	});

	it("lists a cause only once it has turned up often enough, and counts the rest", () => {
		const few = Array.from({ length: CAUSE_MIN_SENTENCES - 1 }, () => rep("Peter varil večeru.", "Peter večeru."));
		const a = analyzeListening([session("2026-11-10T10:00:00Z", few), session("2026-11-12T10:00:00Z", few)], NOW);
		assert.equal(a.causes.find((c) => c.cause === "word-missed")?.cause, "word-missed");
		const b = analyzeListening([session("2026-11-10T10:00:00Z", few)], NOW);
		assert.deepEqual(b.causes, []);
		assert.equal(b.rare, CAUSE_MIN_SENTENCES - 1);
	});

	it("keeps an older typed miss without its stretch words out of the causes", () => {
		const old = Array.from({ length: LISTEN_MIN_TYPED }, () => rep(SAID, DROPPED, { stretch: undefined }));
		const a = analyzeListening([session("2026-11-10T10:00:00Z", old)], NOW);
		assert.equal(a.typed, LISTEN_MIN_TYPED);
		assert.deepEqual(a.causes, []);
		assert.equal(a.ready, false);
	});

	it("counts a sentence with only its marks off as understood, and a peeked one as neither understood nor read", () => {
		const a = analyzeListening([session("2026-11-10T10:00:00Z", [rep("Videl ľudí.", "Videl ludi", { verdict: "accents" }), rep(SAID, DROPPED, { peeked: true })])], NOW);
		assert.equal(a.right, 0.5);
		assert.equal(a.readable, 1);
		assert.equal(a.read, 0);
	});

	it("reads a picked meaning from before typing-only for accuracy but not for causes", () => {
		const picked = [{ kind: "meaning", sentence: SAID, given: "I lived in Rome.", verdict: "exact" as const }, { kind: "meaning", sentence: "Peter varil.", given: "x", verdict: "wrong" as const }];
		const a = analyzeListening([session("2026-11-10T10:00:00Z", picked)], NOW);
		assert.equal(a.sentences, 2);
		assert.equal(a.typed, 0);
		assert.equal(a.right, 0.5);
		assert.deepEqual(a.causes, []);
	});

	it("says fast clips are harder only when the gap is past chance", () => {
		const fast = Array.from({ length: 25 }, (_, i) => rep("Peter varil večeru a pritom telefonoval s mamou.", i < 10 ? "Peter varil večeru." : "Peter varil večeru a pritom telefonoval s mamou.", { heardMs: 3000 }));
		const slow = Array.from({ length: 25 }, () => rep("Čím skôr začneš, tým skôr skončíš.", "Čím skôr začneš, tým skôr skončíš.", { heardMs: 3400 }));
		const a = analyzeListening([session("2026-11-10T10:00:00Z", [...fast, ...slow])], NOW);
		assert.equal(a.pace!.fast.reps, 25);
		assert.equal(a.pace!.fast.right, 15);
		assert.equal(a.pace!.fastHarder, true);
		assert.equal(analyzeListening([session("2026-11-10T10:00:00Z", fast)], NOW).pace, null);
		const close = Array.from({ length: 25 }, (_, i) => rep("Peter varil večeru a pritom telefonoval s mamou.", i < 2 ? "Peter varil večeru." : "Peter varil večeru a pritom telefonoval s mamou.", { heardMs: 3000 }));
		assert.equal(analyzeListening([session("2026-11-10T10:00:00Z", [...close, ...slow])], NOW).pace!.fastHarder, false);
	});
});
