/**
 * Mix-ups (LangHarness, 2026-11-01): two different words the learner
 * confuses, such as "Niekto" typed where the sentence wanted "Nikto". A form
 * slip (src/core/form-slip.ts) is the wrong ending of the right word; a
 * mix-up is the wrong word, and it is kept per pair of words so the app can
 * drill the contrast rather than one word alone.
 *
 * A mix-up is found when a first try gives another lexicon word. From it the
 * app predicts the pairs most likely to trip the learner next: the other
 * pairs of its family (curriculum/slovak/mixups.json, so nikto/niekto brings
 * nič/niečo) or, for a pair no family names, the same edit applied to other
 * words of the lexicon. A predicted pair is a probe: a two-way choice tests
 * it, a miss makes it a mix-up, and two right first tries clear it. A mix-up
 * is mended after three right first tries since its last miss; any miss
 * opens it again.
 *
 * The record lives in progress.json (`mixups`) and feeds the Mix-ups lesson
 * (buildMixupLesson), the Strengthen task, Today and the tutor's "This
 * learner" block. Research: docs/research/mixups.md.
 *
 * Pure and browser-safe: the family file is bundled, no fs.
 */

import mixupsJson from "../../curriculum/slovak/mixups.json";
import { foldDiacritics, normalizeAnswer } from "./language.ts";
import { matchCase, rng, shortGloss, shuffle, type ItemKind, type LessonItem, type LessonPlan, type RepVerdict } from "./lesson.ts";
import { formsOfEntry, MIN_PAIR_SENTENCES, PAIRS, twinSentences, type PairSentence } from "./pairs.ts";
import { entryLemma, exampleText, type LexiconEntry } from "./review.ts";

export interface MixupFamily {
	id: string;
	title: string;
	/** One English line, shown after a miss on any of its pairs. */
	rule: string;
	/** One bridge line, shown beside the rule. */
	bridge: string;
	/** The twins, by lexicon slug (a lemma such as domov has two entries). */
	pairs: Array<[string, string]>;
}

export const MIXUP_FAMILIES: MixupFamily[] = (mixupsJson as unknown as { families: MixupFamily[] }).families;

/** One miss kept as evidence: the sentence, what it wanted, what was given. */
export interface MixupSeen {
	at: string;
	sentence: string;
	answer: string;
	given: string;
}

export interface Mixup {
	/** The two entries by slug: the word first wanted, then the word given
	 *  (for a probe, the family's order). */
	a: string;
	b: string;
	/** Their lemmas, so the tutor block reads without the lexicon. */
	words: [string, string];
	family?: string;
	since: string;
	lastAt: string;
	misses: number;
	/** Right first tries on either word since the last miss (a probe: since it was predicted). */
	hits: number;
	/** The latest misses, newest last. */
	seen?: MixupSeen[];
	/** Predicted from this mix-up (its key) and not missed yet. */
	from?: string;
}

export type MixupRecord = Record<string, Mixup>;

/** Right first tries since the last miss before a mix-up is mended. */
export const MIXUP_MEND_HITS = 3;
/** Right first tries before a predicted pair is cleared. */
export const PROBE_CLEAR_HITS = 2;
/** Pairs kept at most; the mended and cleared ones go first. */
export const MIXUP_RECORD_CAP = 40;
/** Pairs a single mix-up may predict. */
export const PREDICT_CAP = 3;
const SEEN_CAP = 3;
/** Lesson reps whose answer is one word, typed, picked or heard. */
const WORD_KINDS = new Set(["choose", "type", "listen"]);

export function mixupKey(a: string, b: string): string {
	return [a, b].sort().join("~");
}

export type MixupStatus = "active" | "mended" | "probe" | "cleared";

export function mixupStatus(m: Pick<Mixup, "misses" | "hits">): MixupStatus {
	if (m.misses > 0) return m.hits >= MIXUP_MEND_HITS ? "mended" : "active";
	return m.hits >= PROBE_CLEAR_HITS ? "cleared" : "probe";
}

export function familyOf(a: string, b: string): MixupFamily | undefined {
	const key = mixupKey(a, b);
	return MIXUP_FAMILIES.find((f) => f.pairs.some(([x, y]) => mixupKey(x, y) === key));
}

// ─── The lexicon, as the rules read it ──────────────────────────────────────

export interface MixupLexicon {
	bySlug: Map<string, LexiconEntry>;
	/** Entries that attest a lowercase form (lemma, forms, cloze answers). */
	byForm: Map<string, LexiconEntry[]>;
	/** Entries by lowercase lemma, for the edit-rule neighbors. */
	byLemma: Map<string, LexiconEntry[]>;
	/** Pair sentences, by key, computed once. */
	twins: Map<string, PairSentence[]>;
}

const lexicons = new WeakMap<readonly LexiconEntry[], MixupLexicon>();

function push(map: Map<string, LexiconEntry[]>, key: string, entry: LexiconEntry) {
	const list = map.get(key);
	if (!list) map.set(key, [entry]);
	else if (!list.includes(entry)) list.push(entry);
}

export function mixupLexicon(entries: readonly LexiconEntry[]): MixupLexicon {
	const known = lexicons.get(entries);
	if (known) return known;
	const lex: MixupLexicon = { bySlug: new Map(), byForm: new Map(), byLemma: new Map(), twins: new Map() };
	for (const entry of entries) {
		lex.bySlug.set(entry.slug, entry);
		const lemma = entryLemma(entry).toLocaleLowerCase("sk-SK");
		if (lemma && !/\s/.test(lemma)) push(lex.byLemma, lemma, entry);
		for (const form of formsOfEntry(entry)) if (!/\s/.test(form)) push(lex.byForm, form, entry);
	}
	lexicons.set(entries, lex);
	return lex;
}

/** The verified sentences that hold only one of the two words, computed once per pair. */
export function twinsOf(lex: MixupLexicon, a: string, b: string): PairSentence[] {
	const key = mixupKey(a, b);
	const cached = lex.twins.get(key);
	if (cached) return cached;
	const ea = lex.bySlug.get(a);
	const eb = lex.bySlug.get(b);
	const out = ea && eb ? twinSentences(ea, eb) : [];
	lex.twins.set(key, out);
	return out;
}

/** A pair has enough sentences, each holding only one of the two words, to be drilled. */
export function drillable(lex: MixupLexicon, a: string, b: string): boolean {
	return twinsOf(lex, a, b).length >= MIN_PAIR_SENTENCES;
}

const commonness = (e: LexiconEntry) => e.rank ?? 100_000 - e.examples.length;

/** The word a wrong answer gave, when it is another lexicon word: null for a
 *  blank, a phrase, a non-word, or another form of the wanted word (that is
 *  a form slip, not a mix-up). */
export function wordGiven(lex: MixupLexicon, wanted: LexiconEntry, given: string): LexiconEntry | null {
	const form = normalizeAnswer(given);
	if (!form || /\s/.test(form)) return null;
	const owners = lex.byForm.get(form) ?? [];
	if (owners.length === 0 || owners.includes(wanted)) return null;
	const lemma = entryLemma(wanted).toLocaleLowerCase("sk-SK");
	const others = owners.filter((e) => entryLemma(e).toLocaleLowerCase("sk-SK") !== lemma);
	if (others.length === 0) return null;
	return others.find((e) => familyOf(wanted.slug, e.slug)) ?? [...others].sort((x, y) => commonness(x) - commonness(y))[0]!;
}

/**
 * The same edit, applied to other words: nikto → niekto is "ni" + "e" at the
 * start, so a word starting with "ni" whose "nie" twin is also a lemma is a
 * likely next mix-up. Only small edits (at most three letters changed) with
 * at least two shared letters at the anchored end; both twins must be
 * drillable. Commonest first.
 */
export function ruleNeighbours(lex: MixupLexicon, a: string, b: string, cap = PREDICT_CAP): Array<[string, string]> {
	const ea = lex.bySlug.get(a);
	const eb = lex.bySlug.get(b);
	if (!ea || !eb) return [];
	const la = entryLemma(ea).toLocaleLowerCase("sk-SK");
	const lb = entryLemma(eb).toLocaleLowerCase("sk-SK");
	let p = 0;
	while (p < la.length && p < lb.length && la[p] === lb[p]) p++;
	let s = 0;
	while (s < la.length - p && s < lb.length - p && la[la.length - 1 - s] === lb[lb.length - 1 - s]) s++;
	const from = la.slice(p, la.length - s);
	const to = lb.slice(p, lb.length - s);
	if (from.length + to.length === 0 || from.length + to.length > 3 || (p < 2 && s < 2)) return [];
	const atStart = p >= 2;
	const x = atStart ? la.slice(0, p) + from : from + la.slice(la.length - s);
	const y = atStart ? la.slice(0, p) + to : to + la.slice(la.length - s);
	const swap = (w: string, f: string, t: string): string | null => {
		if (atStart) return w.startsWith(f) ? t + w.slice(f.length) : null;
		return w.endsWith(f) ? w.slice(0, w.length - f.length) + t : null;
	};
	const own = mixupKey(a, b);
	const found = new Map<string, { pair: [string, string]; score: number }>();
	for (const [w, list] of lex.byLemma) {
		for (const [f, t] of [
			[x, y],
			[y, x],
		] as const) {
			const twin = swap(w, f, t);
			if (!twin || twin === w) continue;
			const other = lex.byLemma.get(twin);
			if (!other) continue;
			const e1 = [...list].sort((m, n) => commonness(m) - commonness(n))[0]!;
			const e2 = [...other].sort((m, n) => commonness(m) - commonness(n))[0]!;
			const key = mixupKey(e1.slug, e2.slug);
			if (key === own || found.has(key) || !drillable(lex, e1.slug, e2.slug)) continue;
			found.set(key, { pair: [e1.slug, e2.slug], score: Math.min(commonness(e1), commonness(e2)) });
		}
	}
	return [...found.values()]
		.sort((m, n) => m.score - n.score)
		.slice(0, cap)
		.map((f) => f.pair);
}

// ─── The record ─────────────────────────────────────────────────────────────

/** One answered rep, as the mix-up rules read it: the first try at a
 *  sentence that wanted one word. */
export interface MixupEvent {
	/** The entry the sentence asked for. */
	slug: string;
	answer: string;
	given: string;
	verdict: RepVerdict;
	sentence: string;
	at: string;
}

/** Whether a lesson rep is read as a mix-up event: one word was asked and
 *  this is the first, unaided try at it (the first-try rule, E18). */
export function mixupEventOf(rep: { kind: string; again?: boolean; first?: { given: string; verdict: RepVerdict; peeked?: boolean } }): boolean {
	return WORD_KINDS.has(rep.kind) && rep.again !== true && !!rep.first && rep.first.peeked !== true;
}

function lemmaPair(lex: MixupLexicon, a: string, b: string): [string, string] {
	return [entryLemma(lex.bySlug.get(a)!), entryLemma(lex.bySlug.get(b)!)];
}

/** Add the pairs a mix-up predicts: its family's other pairs, else the edit-rule neighbors. */
export function predictMixups(record: MixupRecord, key: string, lex: MixupLexicon, at: string): MixupRecord {
	const m = record[key];
	if (!m) return record;
	const family = m.family ? MIXUP_FAMILIES.find((f) => f.id === m.family) : undefined;
	const candidates = family ? family.pairs.filter(([x, y]) => mixupKey(x, y) !== key) : ruleNeighbours(lex, m.a, m.b, PREDICT_CAP * 2);
	const out = { ...record };
	let added = 0;
	for (const [x, y] of candidates) {
		if (added >= PREDICT_CAP) break;
		const k = mixupKey(x, y);
		if (out[k] || !lex.bySlug.has(x) || !lex.bySlug.has(y) || !drillable(lex, x, y)) continue;
		out[k] = { a: x, b: y, words: lemmaPair(lex, x, y), ...(family ? { family: family.id } : {}), since: at, lastAt: at, misses: 0, hits: 0, from: key };
		added++;
	}
	return out;
}

/** The `from` of a probe the guide suggested rather than a mix-up predicted. */
export const GUIDE_SOURCE = "guide";

/** Pairs the guide named become probes, like a family's (tested before they
 *  are taught). A pair already on record is left as it is. */
export function addGuideProbes(record: MixupRecord, pairs: ReadonlyArray<[string, string]>, lex: MixupLexicon, at: string): MixupRecord {
	const out = { ...record };
	for (const [a, b] of pairs) {
		const k = mixupKey(a, b);
		if (out[k] || !lex.bySlug.has(a) || !lex.bySlug.has(b) || !drillable(lex, a, b)) continue;
		const family = familyOf(a, b);
		out[k] = { a, b, words: lemmaPair(lex, a, b), ...(family ? { family: family.id } : {}), since: at, lastAt: at, misses: 0, hits: 0, from: GUIDE_SOURCE };
	}
	return capRecord(out);
}

/** Drop the oldest settled pairs (mended, cleared) and then the oldest
 *  probes until the record fits. A mix-up still open is never dropped. */
function capRecord(record: MixupRecord): MixupRecord {
	const keys = Object.keys(record);
	if (keys.length <= MIXUP_RECORD_CAP) return record;
	const rank: Record<MixupStatus, number> = { cleared: 0, mended: 1, probe: 2, active: 3 };
	const drop = keys
		.filter((k) => mixupStatus(record[k]!) !== "active")
		.sort((x, y) => rank[mixupStatus(record[x]!)] - rank[mixupStatus(record[y]!)] || record[x]!.lastAt.localeCompare(record[y]!.lastAt))
		.slice(0, keys.length - MIXUP_RECORD_CAP);
	const out = { ...record };
	for (const k of drop) delete out[k];
	return out;
}

/**
 * Count answers against the record. A wrong first try that gave another
 * word opens (or reopens) the pair and predicts its neighbors; a right one
 * counts toward every pair the wanted word is in. Returns the record and
 * the keys of the mix-ups found in these events.
 */
export function tallyMixups(record: MixupRecord, events: readonly MixupEvent[], lex: MixupLexicon): { record: MixupRecord; found: string[] } {
	let out = { ...record };
	const found: string[] = [];
	for (const e of events) {
		const wanted = lex.bySlug.get(e.slug);
		if (!wanted) continue;
		if (e.verdict === "wrong") {
			const other = wordGiven(lex, wanted, e.given);
			if (!other) continue;
			const key = mixupKey(wanted.slug, other.slug);
			const prev = out[key];
			const seen = [...(prev?.seen ?? []), { at: e.at, sentence: e.sentence, answer: e.answer, given: e.given.trim() }].slice(-SEEN_CAP);
			if (prev) {
				const { from: _from, ...rest } = prev;
				out[key] = { ...rest, misses: prev.misses + 1, hits: 0, lastAt: e.at, seen };
			} else {
				const family = familyOf(wanted.slug, other.slug);
				out[key] = { a: wanted.slug, b: other.slug, words: lemmaPair(lex, wanted.slug, other.slug), ...(family ? { family: family.id } : {}), since: e.at, lastAt: e.at, misses: 1, hits: 0, seen };
			}
			if (!found.includes(key)) found.push(key);
			out = predictMixups(out, key, lex, e.at);
		} else {
			for (const [k, m] of Object.entries(out)) {
				if (m.a === e.slug || m.b === e.slug) out[k] = { ...m, hits: m.hits + 1, lastAt: e.at };
			}
		}
	}
	return { record: capRecord(out), found };
}

// ─── Reading it ─────────────────────────────────────────────────────────────

export interface MixupSummary {
	key: string;
	words: [string, string];
	status: MixupStatus;
	family?: { id: string; title: string };
	misses: number;
	hits: number;
	since: string;
	lastAt: string;
	/** The latest miss: the word wanted and the word given. */
	last?: MixupSeen;
	/** The pair a probe was predicted from. */
	from?: [string, string];
	/** One line for the UI. */
	line: string;
}

/** Open mix-ups (latest first), then probes (oldest first), then mended; cleared probes are left out. */
export function mixupList(record: MixupRecord | undefined): MixupSummary[] {
	if (!record) return [];
	const out: MixupSummary[] = [];
	for (const [key, m] of Object.entries(record)) {
		const status = mixupStatus(m);
		if (status === "cleared") continue;
		const family = m.family ? MIXUP_FAMILIES.find((f) => f.id === m.family) : undefined;
		const source = m.from ? record[m.from] : undefined;
		const last = m.seen?.[m.seen.length - 1];
		const line =
			status === "active"
				? `${m.misses} ${m.misses === 1 ? "miss" : "misses"}${last ? ` · last: “${last.given}” for “${last.answer}”` : ""}${m.hits > 0 ? ` · ${m.hits} of ${MIXUP_MEND_HITS} right since` : ""}`
				: status === "probe"
					? `Not tested yet${source ? ` · same pattern as ${source.words.join(" / ")}` : m.from === GUIDE_SOURCE ? " · suggested by your guide" : ""}`
					: `Mended · ${m.hits} right since the last miss`;
		out.push({
			key,
			words: m.words,
			status,
			...(family ? { family: { id: family.id, title: family.title } } : {}),
			misses: m.misses,
			hits: m.hits,
			since: m.since,
			lastAt: m.lastAt,
			...(last ? { last } : {}),
			...(source ? { from: source.words } : {}),
			line,
		});
	}
	const order: Record<MixupStatus, number> = { active: 0, probe: 1, mended: 2, cleared: 3 };
	return out.sort((x, y) => order[x.status] - order[y.status] || (x.status === "probe" ? x.since.localeCompare(y.since) : y.lastAt.localeCompare(x.lastAt)));
}

/** The line in the tutor's "This learner" block, or null with nothing open. */
export function mixupsLine(list: readonly MixupSummary[]): string | null {
	const active = list.filter((m) => m.status === "active").slice(0, 5);
	if (!active.length) return null;
	const probes = list.filter((m) => m.status === "probe").slice(0, 5);
	const parts = active.map((m) => `${m.words.join(" / ")} (${m.misses} ${m.misses === 1 ? "miss" : "misses"}${m.last ? `; last wrote "${m.last.given}" in "${m.last.sentence}"` : ""})`);
	const next = probes.length ? ` Not tested yet, but the same pattern: ${probes.map((m) => m.words.join(" / ")).join(", ")}.` : "";
	return `- Words they mix up (gave one where the other was wanted): ${parts.join("; ")}.${next} Contrast each pair in examples, and when they use one, check it is the one the sentence needs.`;
}

/** The rule and bridge shown after a miss on a pair: its family's, else a
 *  Dvojičky pair's, else the two meanings side by side. */
export function mixupRule(m: Pick<Mixup, "a" | "b" | "family">, lex: MixupLexicon): { rule: string; bridge: string } {
	const family = m.family ? MIXUP_FAMILIES.find((f) => f.id === m.family) : undefined;
	if (family) return { rule: family.rule, bridge: family.bridge };
	const ea = lex.bySlug.get(m.a);
	const eb = lex.bySlug.get(m.b);
	const la = ea ? entryLemma(ea) : m.a;
	const lb = eb ? entryLemma(eb) : m.b;
	const pair = PAIRS.find((p) => mixupKey(p.a, p.b) === mixupKey(la, lb));
	if (pair) return { rule: pair.rule, bridge: pair.bridge };
	return { rule: `${la} = ${ea ? shortGloss(ea.en) : "?"} · ${lb} = ${eb ? shortGloss(eb.en) : "?"}`, bridge: "" };
}

/** The rule for a regular lesson rep whose word is in an open mix-up, so
 *  the contrast shows right where the confusion happens. */
export function openMixupFor(record: MixupRecord | undefined, slug: string): (Mixup & { key: string }) | undefined {
	if (!record) return undefined;
	for (const [key, m] of Object.entries(record)) {
		if ((m.a === slug || m.b === slug) && mixupStatus(m) === "active") return { ...m, key };
	}
	return undefined;
}

// ─── The Mix-ups lesson ─────────────────────────────────────────────────────

/** Open mix-ups and probes a lesson takes at most. */
export const MIXUP_LESSON_PAIRS = 4;

const fold = (s: string) => foldDiacritics(s.toLowerCase());

/**
 * A Mix-ups lesson: the open mix-ups first (two reps per turn, typed: the
 * learner must produce the word the sentence needs, both sides of the pair
 * in turn), then the probes (one rep per turn, a choice between the two
 * words, so an untaught twin is met before it is asked for). Every rep is a
 * verified sentence that holds only one of the two words (twinSentences).
 * `recent` sentence ids go to the back while fresher ones remain.
 */
export function buildMixupLesson(entries: readonly LexiconEntry[], record: MixupRecord | undefined, opts: { seed: number; length?: number; recent?: ReadonlySet<string> }): LessonPlan {
	const rand = rng(opts.seed);
	const length = opts.length ?? 12;
	const lex = mixupLexicon(entries);
	const list = mixupList(record);
	const active = list.filter((m) => m.status === "active").slice(0, MIXUP_LESSON_PAIRS - 1);
	const probes = list.filter((m) => m.status === "probe").slice(0, Math.max(1, MIXUP_LESSON_PAIRS - active.length));
	const targets = [...active, ...probes].flatMap((s) => {
		const m = record![s.key]!;
		const sentences = shuffle(twinsOf(lex, m.a, m.b), rand);
		const fresh = (x: PairSentence) => !opts.recent?.has(`${x.entry.slug}#${x.index}`);
		const side = (member: "a" | "b") => {
			const own = sentences.filter((x) => x.member === member);
			return [...own.filter(fresh), ...own.filter((x) => !fresh(x))];
		};
		const sides = { a: side("a"), b: side("b") };
		if (sides.a.length + sides.b.length === 0) return [];
		return [{ key: s.key, m, probe: s.status === "probe", weight: s.status === "active" ? 2 : 1, sides, turn: (rand() < 0.5 ? "a" : "b") as "a" | "b", ...mixupRule(m, lex) }];
	});
	const items: LessonItem[] = [];
	const used = new Set<string>();
	while (items.length < length) {
		let took = false;
		for (const t of targets) {
			for (let w = 0; w < t.weight && items.length < length; w++) {
				const order: Array<"a" | "b"> = t.turn === "a" ? ["a", "b"] : ["b", "a"];
				const pick = order.map((side) => t.sides[side].find((x) => !used.has(`${x.entry.slug}#${x.index}`))).find(Boolean);
				if (!pick) continue;
				used.add(`${pick.entry.slug}#${pick.index}`);
				t.turn = pick.member === "a" ? "b" : "a";
				items.push(mixupItem(pick, t, lex, rand));
				took = true;
			}
		}
		if (!took) break;
	}
	return { unit: "words", items, focus: "mixups" };
}

/** One rep of a pair: typed when the pair is an open mix-up, a choice between the two words when it is a probe. */
export function mixupItem(s: PairSentence, t: { key: string; m: Pick<Mixup, "a" | "b">; probe: boolean; rule: string; bridge: string }, lex: MixupLexicon, rand: () => number): LessonItem {
	const ex = s.entry.examples[s.index]!;
	const text = exampleText(ex);
	const other = lex.bySlug.get(s.member === "a" ? t.m.b : t.m.a)!;
	// A choice needs the other word in the same shape; that is only sure
	// when the sentence uses the dictionary form (nikto, not nikoho).
	const plain = fold(s.form) === fold(entryLemma(s.entry));
	const kind: ItemKind = t.probe && plain ? "choose" : "type";
	const item: LessonItem = {
		id: `${s.entry.slug}#${s.index}`,
		kind,
		unit: "words",
		slug: s.entry.slug,
		lemma: entryLemma(s.entry),
		gloss: s.entry.en,
		sentence: text,
		translation: ex.en,
		answer: s.form,
		before: text.slice(0, s.at),
		after: text.slice(s.at + s.form.length),
		hint: shortGloss(s.entry.en),
		pair: { id: t.key, rule: t.rule, bridge: t.bridge },
	};
	if (s.entry.rank !== undefined) item.rank = s.entry.rank;
	if (s.entry.cat) item.cat = s.entry.cat;
	if (kind === "choose") item.options = shuffle([s.form, matchCase(entryLemma(other), s.form)], rand);
	return item;
}
