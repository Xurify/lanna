/**
 * The deep read of the learner's listening (LangHarness, 2026-11-03): one model
 * call over the facts src/core/listen-analysis.ts has already worked out, to
 * find what several of them share and say what to practice. The figures stay
 * the analysis's: the model is handed them, with every trend already called or
 * not called by the same test the page uses, and may explain and connect but not
 * add. Pure and browser-safe.
 */

import { LISTEN_CAUSES, LISTEN_KIND_LABEL, type ListenAnalysis } from "./listen-analysis.ts";
import type { StoryUsage } from "./reading.ts";

export interface ListenGuideData {
	/** Two or three sentences: how the listening is going. */
	summary: string;
	/** What several misses share, with the evidence and a fix. */
	patterns: Array<{ title: string; evidence: string; why: string; fix: string }>;
	/** What the learner would not have seen from the figures one at a time: a link between two, a finding, a contrast. A link the facts do not state is marked a guess. */
	noticed: Array<{ what: string; why: string }>;
	/** Things to try, each tied to a pattern, a cause or a finding. */
	tips: Array<{ tip: string; why: string }>;
	/** Changes over time, only those the figures call or the weekly series shows. */
	trends: Array<{ what: string; read: string }>;
	/** What to do this week. */
	next: string[];
	/** What the figures cannot say yet. */
	limits: string;
}

/** The deep read as saved: the model's reply, its structured read, and what it was written from. */
export interface ListenGuideRecord {
	text: string;
	data: ListenGuideData | null;
	/** When it was written (ISO). */
	at: string;
	/** Digest of the facts it was written from (listenGuideFacts). */
	digest: string;
	/** "provider:id" of the model that wrote it. */
	model: string;
	usage: StoryUsage;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const share = (g: { reps: number; right: number }) => `${pct(g.right / g.reps)} of ${g.reps}`;

/** The facts the deep read is written from, and what decides whether a saved one is still current. The same facts give the same digest, so a read is never paid for twice for the same evidence. */
export function listenGuideFacts(l: ListenAnalysis): string {
	const lines: string[] = [];
	lines.push(`Listen sentences: ${l.sentences} over ${l.sessions} sessions${l.from ? ` (${l.from} to ${l.to})` : ""}; ${l.typed} typed, ${l.readable} typed and read for causes, ${l.read} of those with a miss.`);
	lines.push(`Understood (exactly right, text not shown first): ${pct(l.right)}${l.range ? `, likely ${pct(l.range.low)} to ${pct(l.range.high)}` : ""}.`);
	if (l.weeks.length) lines.push(`Understood by week: ${l.weeks.map((w) => `${w.week} ${w.few ? `too few (${w.reps})` : `${pct(w.right / w.reps)} of ${w.reps}`}`).join("; ")}.`);
	lines.push(`Causes, in sentences per 100 typed ones, the last 14 days against before. A trend is called only when it passes the test across all causes; otherwise it reads "no clear change", which is not "the same":`);
	for (const c of l.causes) {
		const info = LISTEN_CAUSES[c.cause];
		lines.push(`- ${info.label} [${LISTEN_KIND_LABEL[info.kind]}]: ${c.count} words${c.recent !== null && c.earlier !== null ? `; ${c.earlier} before, ${c.recent} lately; ${c.trend === "better" ? "less often (called)" : c.trend === "worse" ? "more often (called)" : "no clear change"}` : "; too few sentences to compare"}.`);
	}
	if (l.rare > 0) lines.push(`${l.rare} more differences had a cause seen in too few sentences to list.`);
	if (l.kinds.length) lines.push(`Share of all differences: ${l.kinds.map((k) => `${pct(k.share)} ${k.label.toLowerCase()}`).join(", ")}.`);
	// A snapshot saved before the weekly series existed has none.
	const weeks = l.causeWeeks ?? [];
	if (weeks.length > 1) {
		lines.push("Sentences with each cause, by week (counts, small: describe them, do not call a trend from them):");
		for (const w of weeks) {
			const parts = Object.entries(w.causes)
				.sort((a, b) => b[1] - a[1])
				.map(([c, n]) => `${LISTEN_CAUSES[c as keyof typeof LISTEN_CAUSES].label} ${n}`);
			lines.push(`- ${w.week} (${w.read} read): ${parts.join(", ") || "no differences"}.`);
		}
	}
	const insights = l.insights ?? [];
	if (insights.length) {
		lines.push("Findings the app made by a test stricter than the trends' (each past chance, and none is made from a handful of sentences):");
		for (const i of insights) lines.push(`- ${i.title}: ${i.line}`);
	}
	for (const w of l.repeats ?? []) lines.push(`Keeps going wrong: "${w.word}", wrong in ${w.missed} of ${w.appeared} sentences it was in, over ${w.sessions} sessions${w.typedAs.length ? `, typed as ${w.typedAs.map((t) => `"${t}"`).join(", ")}` : ""}.`);
	if (l.pace) lines.push(`By speed of the clip: slow ${share(l.pace.slow)} understood, fast ${share(l.pace.fast)}; fast is harder past chance: ${l.pace.fastHarder ? "yes" : "no"}.`);
	if (l.session) lines.push(`By place in the session: first half ${share(l.session.first)}, second half ${share(l.session.second)}; second half worse past chance: ${l.session.tiring ? "yes" : "no"}.`);
	if (l.length) lines.push(`By sentence length: short ${share(l.length.short)}, long ${share(l.length.long)}; long is harder past chance: ${l.length.longHarder ? "yes" : "no"}.`);
	if (l.replays.recent !== null) lines.push(`Plays after the first: ${l.replays.recent.toFixed(1)} a sentence lately${l.replays.earlier !== null ? `, ${l.replays.earlier.toFixed(1)} before` : ""}.`);
	if (l.peeked.recent !== null) lines.push(`Text shown before answering: ${pct(l.peeked.recent)} of sentences lately${l.peeked.earlier !== null ? `, ${pct(l.peeked.earlier)} before` : ""}.`);
	for (const m of l.misses) {
		const diffs = m.errors.map((e) => (e.target && e.given ? `${e.target} written ${e.given}` : e.target ? `${e.target} missed` : `${e.given} added`) + ` (${LISTEN_CAUSES[e.cause].label.toLowerCase()})`);
		lines.push(`Miss: "${m.sentence}" typed "${m.given || "nothing"}": ${diffs.join("; ")}.`);
	}
	return lines.join("\n");
}

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The deep read's JSON from the model's text, or null when it is not one: a reply wrapped in prose or fences is cut to its outermost braces; every field is a bounded string and every list is capped, so a bad reply cannot fill the page. */
export function parseListenGuide(text: string): ListenGuideData | null {
	const from = text.indexOf("{");
	const to = text.lastIndexOf("}");
	if (from < 0 || to <= from) return null;
	let raw: Record<string, unknown>;
	try {
		raw = JSON.parse(text.slice(from, to + 1)) as Record<string, unknown>;
	} catch {
		return null;
	}
	const list = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
	const patterns = list(raw.patterns)
		.slice(0, 4)
		.map((p) => ({ title: clip(p.title, 90), evidence: clip(p.evidence, 260), why: clip(p.why, 300), fix: clip(p.fix, 300) }))
		.filter((p) => p.title && p.why);
	const summary = clip(raw.summary, 420);
	if (!patterns.length && !summary) return null;
	const noticed = list(raw.noticed)
		.slice(0, 3)
		.map((n) => ({ what: clip(n.what, 120), why: clip(n.why, 300) }))
		.filter((n) => n.what && n.why);
	const tips = list(raw.tips)
		.slice(0, 4)
		.map((t) => ({ tip: clip(t.tip, 200), why: clip(t.why, 240) }))
		.filter((t) => t.tip);
	const trends = list(raw.trends)
		.slice(0, 4)
		.map((t) => ({ what: clip(t.what, 90), read: clip(t.read, 260) }))
		.filter((t) => t.what && t.read);
	const next = (Array.isArray(raw.next) ? raw.next : [])
		.map((n) => clip(n, 200))
		.filter(Boolean)
		.slice(0, 4);
	return { summary, patterns, noticed, tips, trends, next, limits: clip(raw.limits, 260) };
}
