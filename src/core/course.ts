/**
 * A generated course (2026-11-05): the lessons, the map's chapters, the
 * tutor sessions and the can-do goals of a language added from the app,
 * drafted by a model and checked here before it is kept. Slovak's course is
 * written by hand in src/core/lesson.ts and src/core/curriculum.ts; a
 * generated one is data in <data>/languages/<id>/course.json, in this shape.
 *
 * The model writes the rules and picks which forms a unit drills, by the
 * grammar tags Wiktionary gives each form ("genitive singular"). The
 * sentences are never the model's (E27): a unit's lessons are the
 * language's Tatoeba sentences whose blanked form carries those tags.
 *
 * Pure: the server reads and writes the file.
 */

import type { LexiconEntry, LexiconExample } from "./review.ts";

export type CourseStage = "a1" | "a2" | "b1" | "b2";
export const COURSE_STAGES: readonly CourseStage[] = ["a1", "a2", "b1", "b2"];

/** A lesson unit: a grammar point drilled on tagged forms, or a set of words. */
export interface CourseUnit {
	id: string;
	kind: "grammar" | "words";
	/** Short, in English ("Where? The locative"). */
	title: string;
	tagline: string;
	/** One line shown after a miss: the rule behind the right form. */
	rule: string;
	/** An icon name from UNIT_GLYPHS. */
	glyph: string;
	/** The grammar point in English ("Locative case") and in the language. */
	grammarTerm?: string;
	nativeTerm?: string;
	/** grammar: the part of speech of the blanked word (the lexicon's cat). */
	cat?: string;
	/** grammar: every tag must be in one of the form's cells. */
	tags?: string[];
	/** grammar: the blank must follow one of these words (a preposition, a
	 *  modal verb), lowercase. */
	after?: string[];
	/** words: the lemmas of one theme, from the lexicon. */
	lemmas?: string[];
}

export interface CourseTutor {
	id: string;
	title: string;
	tagline: string;
	glyph: string;
	/** The first message of the tutor session. */
	brief: string;
}

export interface CourseGoal {
	id: string;
	title: string;
	tagline: string;
	/** The Speak scene that proves it (src/core/speak.ts SPEAK_SCENES). */
	scene?: string;
}

export interface CourseChapter {
	id: string;
	stage: CourseStage;
	title: string;
	tagline: string;
	/** Unit, tutor and goal ids in order; the last is the chapter's goal. */
	units: string[];
}

export interface Course {
	language: string;
	/** ISO 639-1 and BCP-47: the lessons are in this language. */
	code: string;
	tag: string;
	version: 1;
	/** Drafted by a model: shown as such, and the owner may want to read it. */
	draft: true;
	units: CourseUnit[];
	tutors: CourseTutor[];
	goals: CourseGoal[];
	chapters: CourseChapter[];
}

// The running language's course: config.ts sets it on the server from
// course.json and changes it on a switch, the root layout sets it in the
// browser (app/layout.tsx), which reloads on a switch. Null runs the Slovak
// course. The key is spelled out in config.ts too, which may not import the core.
const ACTIVE_KEY = "__lhCourse";

export function activeCourse(): Course | null {
	return ((globalThis as Record<string, unknown>)[ACTIVE_KEY] as Course | undefined) ?? null;
}

/** A table built from the running course, rebuilt only when the course
 *  changes (a language switch). */
export function perCourse<T>(build: (course: Course | null) => T): () => T {
	let memo: { course: Course | null; value: T } | null = null;
	return () => {
		const course = activeCourse();
		if (!memo || memo.course !== course) memo = { course, value: build(course) };
		return memo.value;
	};
}

/** Tests and the browser bootstrap only. */
export function setActiveCourse(course: Course | null): void {
	(globalThis as Record<string, unknown>)[ACTIVE_KEY] = course ?? undefined;
}

/** The icons the path can draw (components/lesson/unit-icon.tsx). */
export const UNIT_GLYPHS = [
	"book", "book-open", "users", "coffee", "map-pin", "user-round", "door-open", "handshake", "palette", "history", "gift", "key", "signpost", "briefcase", "pen",
	"copy", "hash", "wand", "star", "footprints", "move-horizontal", "paintbrush", "shuffle", "dices", "smile", "ear", "message-circle-question", "tag", "repeat",
	"calendar-clock", "git-compare", "megaphone", "heart", "ban", "clock", "arrow-right-left", "route", "link", "quote", "trending-up", "layers", "phone", "file-text",
	"shield", "rewind", "calculator", "sparkles", "mic", "git-merge", "newspaper", "film", "pen-line", "flag", "hand", "circle-help", "user", "activity",
	"stethoscope", "apple", "cup-soda", "utensils", "shopping-bag", "shirt", "house", "bus", "compass", "calendar-days", "sun", "cloud-sun", "tree-pine",
	"paw-print", "graduation-cap", "clipboard-check", "box", "alarm-clock", "message-square", "brain", "hourglass", "laptop", "globe",
] as const;

/** Sentences a grammar unit needs to be worth keeping: a lesson is 12 reps. */
export const MIN_UNIT_SENTENCES = 12;
/** Words a theme needs. */
export const MIN_THEME_WORDS = 6;
const MAX_WORDS_IN_SENTENCE = 12;

/** The grammar cells a blanked form fills, each a list of tags. */
export function cellsOf(entry: Pick<LexiconEntry, "formTags">, form: string, tag: string): string[][] {
	const want = form.toLocaleLowerCase(tag);
	for (const [f, cells] of Object.entries(entry.formTags ?? {})) {
		if (f.toLocaleLowerCase(tag) === want) return cells.map((c) => c.split(" "));
	}
	return [];
}

/** Tags of a dictionary form: a unit on them may blank the lemma itself. */
const LEMMA_TAGS = new Set(["infinitive", "nominative"]);

const GENDER_TAGS = new Set(["masculine", "feminine", "neuter", "animate", "inanimate"]);

function wordBeforeBlank(text: string, at: number, tag: string): string {
	const before = text.slice(0, at).trim().split(/\s+/);
	return (before[before.length - 1] ?? "").replace(/^[„“"'(«]+|[,.;:!?„“"')»]+$/g, "").toLocaleLowerCase(tag);
}

/** The grammar units one sentence drills: its blank's form fills a cell
 *  with every tag the unit names, after one of its trigger words if any. */
export function courseUnitsFor(units: readonly CourseUnit[], entry: LexiconEntry, example: Pick<LexiconExample, "text" | "sk" | "cloze">, tag: string): string[] {
	const c = example.cloze;
	const text = example.text ?? example.sk ?? "";
	if (!c || text.split(/\s+/).length > MAX_WORDS_IN_SENTENCE) return [];
	const cells = cellsOf(entry, c.answer, tag);
	if (cells.length === 0) return [];
	const prev = wordBeforeBlank(text, c.at, tag);
	const isLemma = c.answer.toLocaleLowerCase(tag) === (entry.lemma ?? entry.sk ?? "").toLocaleLowerCase(tag);
	const out: string[] = [];
	for (const u of units) {
		if (u.kind !== "grammar" || !u.tags?.length) continue;
		if (u.cat && u.cat !== entry.cat) continue;
		// The dictionary form says nothing about a case ("Dobrý den" is not an
		// accusative); only a unit about that form itself may take it.
		if (isLemma && !u.tags.some((t) => LEMMA_TAGS.has(t))) continue;
		// A noun's gender belongs to the word (tables rarely repeat it on each
		// form); an adjective's is on the form itself.
		const byWord = !!entry.gender;
		if (byWord && u.tags.some((t) => GENDER_TAGS.has(t) && !entry.gender!.split("-").includes(t))) continue;
		const grammar = byWord ? u.tags.filter((t) => !GENDER_TAGS.has(t)) : u.tags;
		const fits = (cell: string[]) => grammar.every((t) => cell.includes(t));
		if (u.after?.length) {
			// The trigger word decides between the cells a form could fill.
			if (u.after.includes(prev) && cells.some(fits)) out.push(u.id);
		} else if (cells.filter((cell) => !cell.includes("vocative")).every(fits) && cells.some(fits)) {
			// With nothing to decide by, the form must mean only this (a
			// vocative twin aside: it is rarely what a sentence holds).
			out.push(u.id);
		}
	}
	return out;
}

const ID = /^[a-z][a-z0-9-]{1,40}$/;

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A unit's title as a heading: the first letter capital, after a "Words:" label too. The course prompt's example used to read "Words: a theme", and the model copied the lowercase into every words unit ("Words: hello and thanks"). */
export function tidyTitle(title: string): string {
	const m = /^(Words|Grammar|Tutor|Goal):\s*(.*)$/s.exec(title);
	const capital = (s: string) => s.replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase());
	return m ? `${m[1]}: ${capital(m[2]!)}` : capital(title);
}
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : []);

export interface CourseCheck {
	course: Course;
	/** What was dropped and why, for the build log and the notice. */
	dropped: string[];
}

/**
 * Check a drafted course against the language's own words: a grammar unit
 * keeps only tags the lexicon has and needs MIN_UNIT_SENTENCES sentences; a
 * theme keeps only lemmas the lexicon has; chapters keep only ids that
 * survived and end on a goal. Null when too little is left to teach.
 */
export function checkCourse(raw: unknown, language: string, lexicon: readonly LexiconEntry[], tag: string, scenes: readonly string[], minSentences = MIN_UNIT_SENTENCES): CourseCheck | null {
	const code = tag.split("-")[0]!;
	const r = (raw ?? {}) as Record<string, unknown>;
	const dropped: string[] = [];
	const lemmas = new Map(lexicon.map((e) => [(e.lemma ?? e.sk ?? "").toLocaleLowerCase(tag), e.lemma ?? e.sk ?? ""]));
	const known = new Set<string>();
	for (const e of lexicon) for (const cells of Object.values(e.formTags ?? {})) for (const c of cells) for (const t of c.split(" ")) known.add(t);
	const glyph = (g: unknown) => ((UNIT_GLYPHS as readonly string[]).includes(g as string) ? (g as string) : "book");
	const seen = new Set<string>();
	const fresh = (id: string, what: string) => {
		if (!ID.test(id) || seen.has(id)) {
			dropped.push(`${what} "${id}": bad or repeated id`);
			return false;
		}
		seen.add(id);
		return true;
	};

	const units: CourseUnit[] = [];
	const renamed = new Map<string, string>();
	for (const u of Array.isArray(r.units) ? r.units : []) {
		const x = u as Record<string, unknown>;
		const id = str(x.id, 41);
		const title = tidyTitle(str(x.title, 60));
		if (!title || !fresh(id, "unit")) continue;
		const base = { id, title, tagline: str(x.tagline, 80), rule: str(x.rule, 300), glyph: glyph(x.glyph), ...(str(x.grammarTerm, 60) ? { grammarTerm: str(x.grammarTerm, 60) } : {}), ...(str(x.nativeTerm, 60) ? { nativeTerm: str(x.nativeTerm, 60) } : {}) };
		if (x.kind === "words") {
			const ls = strs(x.lemmas).map((l) => lemmas.get(l.toLocaleLowerCase(tag))).filter((l): l is string => !!l);
			if (ls.length < MIN_THEME_WORDS) {
				dropped.push(`words "${id}": ${ls.length} of its words are in the dictionary`);
				seen.delete(id);
				continue;
			}
			const lx = id.startsWith("lx-") ? id : `lx-${id}`.slice(0, 41);
			if (lx !== id) {
				seen.delete(id);
				if (!fresh(lx, "unit")) continue;
				renamed.set(id, lx);
			}
			units.push({ ...base, id: lx, kind: "words", lemmas: [...new Set(ls)] });
			continue;
		}
		if (/^(lx|pairs)-/.test(id) || id === "words") {
			dropped.push(`grammar "${id}": a reserved id`);
			seen.delete(id);
			continue;
		}
		const tags = strs(x.tags).map((t) => t.toLowerCase());
		const unknown = tags.filter((t) => !known.has(t));
		if (tags.length === 0 || unknown.length) {
			dropped.push(`grammar "${id}": ${tags.length ? `tags the dictionary does not use (${unknown.join(", ")})` : "no tags"}`);
			seen.delete(id);
			continue;
		}
		const unit: CourseUnit = { ...base, kind: "grammar", tags, ...(str(x.cat, 20) ? { cat: str(x.cat, 20) } : {}), ...(strs(x.after).length ? { after: strs(x.after).map((w) => w.toLocaleLowerCase(tag)) } : {}) };
		let n = 0;
		for (const e of lexicon) for (const ex of e.examples) if (!ex.rejected && courseUnitsFor([unit], e, ex, tag).length) n++;
		if (n < minSentences) {
			dropped.push(`grammar "${id}": ${n} sentences`);
			seen.delete(id);
			continue;
		}
		units.push(unit);
	}

	const tutors: CourseTutor[] = [];
	for (const t of Array.isArray(r.tutors) ? r.tutors : []) {
		const x = t as Record<string, unknown>;
		const id = str(x.id, 41);
		if (!str(x.title) || !str(x.brief) || !fresh(id, "tutor")) continue;
		tutors.push({ id, title: str(x.title, 60), tagline: str(x.tagline, 80), glyph: glyph(x.glyph), brief: str(x.brief, 800) });
	}
	const goals: CourseGoal[] = [];
	for (const g of Array.isArray(r.goals) ? r.goals : []) {
		const x = g as Record<string, unknown>;
		const id = str(x.id, 41);
		if (!str(x.title) || !fresh(id, "goal")) continue;
		const scene = str(x.scene, 30);
		goals.push({ id, title: str(x.title, 60), tagline: str(x.tagline, 80), ...(scenes.includes(scene) ? { scene } : {}) });
	}

	const goalIds = new Set(goals.map((g) => g.id));
	const placed = new Set<string>();
	const chapters: CourseChapter[] = [];
	for (const c of Array.isArray(r.chapters) ? r.chapters : []) {
		const x = c as Record<string, unknown>;
		const id = str(x.id, 41);
		const stage = COURSE_STAGES.includes(x.stage as CourseStage) ? (x.stage as CourseStage) : null;
		if (!ID.test(id) || !stage || chapters.some((k) => k.id === id)) continue;
		const ids = strs(x.units).map((u) => renamed.get(u) ?? u).filter((u) => seen.has(u) && !placed.has(u));
		const last = ids[ids.length - 1];
		if (ids.length < 2 || !last || !goalIds.has(last)) {
			dropped.push(`chapter "${id}": ${ids.length < 2 ? "too few units left" : "does not end on a goal"}`);
			continue;
		}
		for (const u of ids) placed.add(u);
		chapters.push({ id, stage, title: str(x.title, 60), tagline: str(x.tagline, 100), units: ids });
	}
	// A stage's chapters stay together and in order.
	chapters.sort((a, b) => COURSE_STAGES.indexOf(a.stage) - COURSE_STAGES.indexOf(b.stage));
	const used = (id: string) => placed.has(id);
	const course: Course = {
		language,
		code,
		tag,
		version: 1,
		draft: true,
		units: units.filter((u) => used(u.id)),
		tutors: tutors.filter((t) => used(t.id)),
		goals: goals.filter((g) => used(g.id)),
		chapters,
	};
	if (course.chapters.length < 3 || course.units.filter((u) => u.kind === "grammar").length < 3) return null;
	return { course, dropped };
}

/** The skill map's seed for a generated course: one node per grammar
 *  unit (its rule is the statement), chained in teaching order inside each
 *  chapter. Same shape as curriculum/<language>/seed.json. */
export function courseSeed(course: Course): { language: string; version: number; draft: true; nodes: Array<{ key: string; kind: "grammar"; strand: string; name: string; statement: string }>; chains: Array<{ premises: string[]; conclusion: string }> } {
	const grammar = new Map(course.units.filter((u) => u.kind === "grammar").map((u) => [u.id, u]));
	const nodes: Array<{ key: string; kind: "grammar"; strand: string; name: string; statement: string }> = [];
	const chains: Array<{ premises: string[]; conclusion: string }> = [];
	for (const ch of course.chapters) {
		let prev: string | null = null;
		for (const id of ch.units) {
			const u = grammar.get(id);
			if (!u) continue;
			nodes.push({ key: u.id, kind: "grammar", strand: u.cat === "Verbs" ? "verbs" : u.cat === "Pronouns" ? "pronouns" : u.cat === "Nouns" || u.cat === "Adjectives" ? "nouns" : "syntax", name: u.grammarTerm ?? u.title, statement: u.rule });
			if (prev) chains.push({ premises: [prev], conclusion: u.id });
			prev = u.id;
		}
	}
	return { language: course.language, version: 1, draft: true, nodes, chains };
}

/** A language's story bible for Read and Speak (src/server/world.ts). */
export interface DraftWorld {
	series: string;
	language: string;
	version: 1;
	city: string;
	logline: string;
	settings: Record<string, string[]>;
	scenes: Record<string, { title: string; blurb: string; brief: string; task: string }>;
	cast: Array<{ id: string; name: string; gender: "f" | "m"; age: "child" | "young" | "adult" | "old"; role: string }>;
	places: Array<{ id: string; name: string; note: string }>;
	beats: Record<string, string>;
}

export function worldDraftPrompt(language: string, country: string, chapters: readonly CourseChapter[], purposes: readonly string[], scenes: readonly string[]): { system: string; prompt: string } {
	return {
		system: `You write the story bible for a ${language} course's reading series and speaking scenes. You reply with ONE JSON object and nothing else: no prose, no code fence. Everything is in English except names, places and the scene titles, which are in ${language}.`,
		prompt: `A learner reads one short episode of a running series per day, set in a real city in ${country}, and practices short spoken scenes there. Write:
{"series": "The series title, in English, naming the lead and the city",
 "city": "the city",
 "logline": "The lead in one line, e.g. 'Name, a young man who has recently moved to City'",
 "cast": [{"id": "kebab-id", "name": "a ${language} name", "gender": "m" or "f", "age": "child" | "young" | "adult" | "old", "role": "who they are in one line"}],
 "places": [{"id": "kebab-id", "name": "a real place in the city", "note": "why the series goes there"}],
 "beats": {"<chapter id>": "One English sentence: what happens in that chapter's episodes, built on the chapter's topic"},
 "settings": {"<purpose>": ["three to five short English settings for an episode, in real places of the city or the country"]},
 "scenes": {"<scene id>": {"title": "the scene's name in ${language}", "blurb": "one English line for the screen", "brief": "who the tutor plays, as words that follow \"you are\" (\"a waiter in a small café on <a real street>\", \"<a name>, who runs a bakery on <a real square>\"), then a semicolon and the situation from the learner's side (\"I want to order breakfast\"); in English, never starting with You are", "task": "what the learner is there to do, one English sentence"}}}

The first cast member is the lead. Six cast members, six places. One beat for each chapter: ${chapters.map((c) => `${c.id} (${c.title}: ${c.tagline})`).join("; ")}. Settings for each purpose: ${purposes.join(", ")}. A scene for each of: ${scenes.join(", ")}. Plain, warm, everyday life; nothing violent or sad.`,
	};
}

/** The drafted bible, checked: a beat for every chapter, a scene for every
 *  scene id, a lead and places. Null when the shape is not there. */
export function checkWorld(raw: unknown, language: string, chapters: readonly CourseChapter[], scenes: readonly string[]): DraftWorld | null {
	const r = (raw ?? {}) as Record<string, unknown>;
	const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
	const cast = (Array.isArray(r.cast) ? r.cast : []).flatMap((c) => {
		const x = obj(c);
		const name = str(x.name, 40);
		const gender: "f" | "m" | null = x.gender === "f" ? "f" : x.gender === "m" ? "m" : null;
		const age = ["child", "young", "adult", "old"].includes(x.age as string) ? (x.age as DraftWorld["cast"][number]["age"]) : "adult";
		return name && gender ? [{ id: str(x.id, 40) || name.toLowerCase(), name, gender, age, role: str(x.role, 200) }] : [];
	});
	const places = (Array.isArray(r.places) ? r.places : []).flatMap((p) => {
		const x = obj(p);
		const name = str(x.name, 80);
		return name ? [{ id: str(x.id, 40) || name.toLowerCase(), name, note: str(x.note, 200) }] : [];
	});
	const beatsRaw = obj(r.beats);
	const beats: Record<string, string> = {};
	for (const c of chapters) {
		const b = str(beatsRaw[c.id], 300);
		if (b) beats[c.id] = /[.!?]$/.test(b) ? b : `${b}.`;
	}
	const settingsRaw = obj(r.settings);
	const settings: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(settingsRaw)) {
		const list = strs(v).map((s) => s.slice(0, 120));
		if (list.length) settings[k] = list.slice(0, 6);
	}
	const scenesRaw = obj(r.scenes);
	const sceneOut: DraftWorld["scenes"] = {};
	for (const id of scenes) {
		const x = obj(scenesRaw[id]);
		if (str(x.title) && str(x.brief) && str(x.task)) sceneOut[id] = { title: str(x.title, 60), blurb: str(x.blurb, 120), brief: str(x.brief, 300), task: str(x.task, 200) };
	}
	const city = str(r.city, 60);
	const series = str(r.series, 80);
	if (cast.length < 3 || places.length < 3 || !city || !series || Object.keys(beats).length < chapters.length) return null;
	return { series, language, version: 1, city, logline: str(r.logline, 200) || `${cast[0]!.name}, who has recently moved to ${city}`, settings, scenes: sceneOut, cast, places, beats };
}

/** The prompt that drafts a course: the language's own tag inventory and
 *  commonest words, so the model can only name what the dictionary has. */
export function courseDraftPrompt(language: string, inventory: { tags: Array<[string, number]>; cats: Array<[string, number]>; words: string[]; scenes: readonly string[] }): { system: string; prompt: string } {
	return {
		system: `You design a ${language} course for English-speaking adults inside a language app, from A1 to B2. You reply with ONE JSON object and nothing else: no prose, no code fence. You state only rules you are sure of.`,
		prompt: `The app drills grammar with fill-the-blank sentences from a dictionary. Each sentence's blank is one inflected form, and the dictionary labels that form with grammar tags. A grammar unit selects its sentences by:
- "cat": the part of speech of the blanked word, one of: ${inventory.cats.map(([c]) => c).join(", ")};
- "tags": tags that must ALL be on the blanked form (pick from the list below, spelled exactly);
- "after" (optional): the blank must come right after one of these ${language} words, lowercase (a preposition, a modal verb), when the rule depends on them.

The dictionary's tags, with how many forms carry each: ${inventory.tags.map(([t, n]) => `${t} (${n})`).join(", ")}.

The commonest ${language} words, for word themes: ${inventory.words.join(", ")}.

Write the course as:
{"units": [{"id": "kebab-id", "kind": "grammar", "title": "A short English title", "tagline": "a few words", "rule": "One plain English line a learner reads after a miss, with one short ${language} example", "glyph": "an icon from the list", "grammarTerm": "the English term", "nativeTerm": "the term in ${language}", "cat": "Nouns", "tags": ["genitive", "singular"], "after": []},
  {"id": "kebab-id", "kind": "words", "title": "Words: A theme", "tagline": "...", "rule": "Learn the word with its sentence.", "glyph": "...", "lemmas": ["eight to twelve words from the list above"]}],
 "tutors": [{"id": "kebab-id", "title": "...", "tagline": "...", "glyph": "...", "brief": "The first message to the tutor: what to explain and how to practice it, in two or three sentences, in English"}],
 "goals": [{"id": "can-something", "title": "Can do something", "tagline": "...", "scene": "one of: ${inventory.scenes.join(", ")}, or leave it out"}],
 "chapters": [{"id": "kebab-id", "stage": "a1", "title": "...", "tagline": "the grammar it covers", "units": ["unit, tutor and goal ids in teaching order, the LAST one a goal"]}]}

Plan 12 to 16 chapters (about 6 at a1, 5 at a2, 3 at b1, 2 at b2), each with 3 to 6 units or tutor sessions and one goal at the end. Use each unit in one chapter only. About 20 grammar units in the order a learner meets them, 8 to 12 word themes, 10 to 20 tutor sessions for what a drill cannot teach (sounds and spelling, politeness, word order, register), one goal per chapter. Icons: ${UNIT_GLYPHS.join(", ")}.`,
	};
}
