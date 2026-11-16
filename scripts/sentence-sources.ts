/**
 * Where the app's sentences come from, and how each one gets its audio
 * (2026-10-30). Reads the lexicon, the slovak.wiki clip map and
 * manifest (for sizes), and the local data, prints the numbers and writes one
 * self-contained HTML report that opens offline.
 *
 *   npx tsx scripts/sentence-sources.ts [report.html] [path-to-slovak.wiki]
 *
 * LEXICON=<file> reads another lexicon.json (e.g. a fresh export) instead of
 * the one the app ships.
 */

import fs from "node:fs";
import path from "node:path";
import { foldDiacritics } from "../src/core/language.ts";

const REPO = path.resolve(import.meta.dirname, "..");
const BASE = process.env.LANNA_DATA_DIR ? path.resolve(process.env.LANNA_DATA_DIR) : path.join(REPO, "data");
const PROFILE = path.join(BASE, "profiles", "slovak");
const OUT = path.resolve(process.argv[2] ?? path.join(BASE, "reports", "sentence-sources.html"));
const WIKI = path.resolve(process.argv[3] ?? path.join(REPO, "..", "slovak.wiki"));

type Clip = { kind: string; hash: string };
type Example = { sk: string; en?: string; src?: string };
type Word = { sk: string; cat?: string; examples: Example[] };
type Row = { text: string; src: "curated" | "tatoeba"; how: "exact" | "accents" | "none"; clip?: Clip; cat: string };

const readJson = <T>(file: string, fallback: T): T => {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return fallback;
	}
};
function readJsonl(file: string): Array<Record<string, any>> {
	try {
		return fs
			.readFileSync(file, "utf-8")
			.split("\n")
			.filter(Boolean)
			.flatMap((line) => {
				try {
					return [JSON.parse(line) as Record<string, any>];
				} catch {
					return [];
				}
			});
	} catch {
		return [];
	}
}
/** Every string anywhere in a JSON value (chat messages nest their text). */
function strings(value: unknown, out: string[] = []): string[] {
	if (typeof value === "string") out.push(value);
	else if (Array.isArray(value)) for (const v of value) strings(v, out);
	else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
	return out;
}
const norm = (s: string) => s.normalize("NFC").trim();
const chars = (s: string) => [...s].length;
const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ── the library: slovak.wiki's curated examples and Tatoeba ───────────────
const lexiconSource = process.env.LEXICON ? path.resolve(process.env.LEXICON) : "curriculum/slovak/lexicon.json";
const lexicon = readJson<{ words: Word[] }>(
	process.env.LEXICON ? path.resolve(process.env.LEXICON) : path.join(REPO, "curriculum/slovak/lexicon.json"),
	{ words: [] },
);
const wikiMap = readJson<{ clips: Record<string, Clip> }>(path.join(REPO, "curriculum/slovak/wiki-audio.json"), {
	clips: {},
});
const manifest = readJson<Record<string, { bytes?: number; kind?: string; voiceId?: string }>>(
	path.join(WIKI, "content/audio/manifest.json"),
	{},
);
const dictVoice = readJson<{ voiceId?: string }>(path.join(WIKI, "content/audio/config.json"), {}).voiceId;

// The lookup the app makes at runtime (src/server/wiki-audio.ts): the exact
// text first, then the text ignoring accents.
const clips = new Map(Object.entries(wikiMap.clips).map(([t, c]) => [norm(t), c] as const));
const folded = new Map<string, Clip | null>();
for (const [t, c] of clips) {
	const k = foldDiacritics(t).toLowerCase();
	folded.set(k, folded.has(k) ? null : c);
}
function match(text: string): { how: Row["how"]; clip?: Clip } {
	const t = norm(text);
	const exact = clips.get(t);
	if (exact) return { how: "exact", clip: exact };
	const f = folded.get(foldDiacritics(t).toLowerCase());
	if (f) return { how: "accents", clip: f };
	return { how: "none" };
}

const rows: Row[] = lexicon.words.flatMap((w) =>
	w.examples.map((e) => {
		const m = match(e.sk);
		return {
			text: norm(e.sk),
			src: e.src === "tatoeba" ? "tatoeba" : "curated",
			how: m.how,
			clip: m.clip,
			cat: w.cat ?? "other",
		};
	}),
);
const uniq = new Map<string, Row>();
for (const r of rows) if (!uniq.has(r.text)) uniq.set(r.text, r);
const uniqRows = [...uniq.values()];

const byExample = (src: Row["src"]) => {
	const rs = rows.filter((r) => r.src === src);
	return {
		total: rs.length,
		exact: rs.filter((r) => r.how === "exact").length,
		accents: rs.filter((r) => r.how === "accents").length,
		none: rs.filter((r) => r.how === "none").length,
	};
};
const curated = byExample("curated");
const tatoeba = byExample("tatoeba");
const withClip = uniqRows.filter((r) => r.how !== "none");
const noClip = uniqRows.filter((r) => r.how === "none");
const clipHashes = new Set(withClip.map((r) => r.clip!.hash));
const wikiBytes = [...clipHashes].reduce((s, h) => s + (manifest[h]?.bytes ?? 0), 0);
const dictionaryClips = Object.values(manifest).filter(
	(m) => (m.kind === "lemma" || m.kind === "example") && (!dictVoice || m.voiceId === dictVoice),
);
const dictionaryBytes = dictionaryClips.reduce((s, m) => s + (m.bytes ?? 0), 0);

const words = lexicon.words.length;
const wordsWithClip = lexicon.words.filter((w) => match(w.sk).clip?.kind === "lemma").length;
const cats = new Map<string, { words: number; withClip: number }>();
for (const w of lexicon.words) {
	const c = cats.get(w.cat ?? "other") ?? { words: 0, withClip: 0 };
	c.words++;
	if (match(w.sk).clip?.kind === "lemma") c.withClip++;
	cats.set(w.cat ?? "other", c);
}

// ── what the app has already paid for: the local audio library ───────────
const audio = readJsonl(path.join(BASE, "audio", "index.jsonl"));
const tiers = new Map<string, { clips: number; chars: number }>();
for (const a of audio) {
	const tier = String(a.tier ?? "unknown");
	const t = tiers.get(tier) ?? { clips: 0, chars: 0 };
	t.clips++;
	t.chars += chars(String(a.text ?? ""));
	tiers.set(tier, t);
}

// ── sentences the model writes at runtime (not in the library) ──────────
const chatsDir = path.join(PROFILE, "chats");
const spoken = new Set<string>();
for (const f of fs.existsSync(chatsDir) ? fs.readdirSync(chatsDir).filter((x) => x.endsWith(".json")) : []) {
	for (const s of strings(readJson<unknown>(path.join(chatsDir, f), null))) {
		for (const m of s.matchAll(/`say:\s*([^`]+)`/g)) spoken.add(norm(m[1]!));
	}
}
const lessonSentences = new Set<string>();
let lessonReps = 0;
const lessonsDir = path.join(PROFILE, "lessons");
for (const f of fs.existsSync(lessonsDir)
	? fs.readdirSync(lessonsDir).filter((x) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(x))
	: []) {
	for (const day of readJsonl(path.join(lessonsDir, f))) {
		for (const rep of Array.isArray(day.reps) ? day.reps : []) {
			lessonReps++;
			const s = rep.sentence ?? rep.detail?.sentence;
			if (typeof s === "string") lessonSentences.add(norm(s));
		}
	}
}
const cards = Object.keys(readJson<Record<string, unknown>>(path.join(PROFILE, "review", "cards.json"), {})).length;
const stories = readJsonl(path.join(PROFILE, "stories", "index.jsonl")).length;
const videos = readJsonl(path.join(PROFILE, "videos", "index.jsonl")).length;
const scenes = readJsonl(path.join(PROFILE, "speak", "index.jsonl")).length;

const numbers = {
	library: {
		examples: rows.length,
		unique: uniqRows.length,
		words,
		curated: curated.total,
		tatoeba: tatoeba.total,
		withEnglish: rows.filter((r) => r.text).length,
	},
	wikiClips: {
		examples: {
			exact: curated.exact + tatoeba.exact,
			accents: curated.accents + tatoeba.accents,
			none: curated.none + tatoeba.none,
		},
		uniqueWithClip: withClip.length,
		uniqueWithoutClip: noClip.length,
		lemmaWithClip: wordsWithClip,
		bytesForLibrary: wikiBytes,
		dictionaryLibraryClips: dictionaryClips.length,
		dictionaryLibraryBytes: dictionaryBytes,
	},
	synthesis: {
		charsForNoClip: noClip.reduce((s, r) => s + chars(r.text), 0),
		charsForWholeLibrary: uniqRows.reduce((s, r) => s + chars(r.text), 0),
	},
	localAudio: { clips: audio.length, tiers: Object.fromEntries([...tiers].map(([k, v]) => [k, v])) },
	runtime: {
		tutorSpokenPhrases: spoken.size,
		lessonReps,
		lessonSentences: lessonSentences.size,
		reviewCards: cards,
		stories,
		videos,
		scenes,
	},
};

console.log(JSON.stringify(numbers, null, 2));

// ── the report ───────────────────────────────────────────────────────────
type Node = { label: string; value: number; color: string };
function sankey(
	left: Node[],
	right: Node[],
	links: Array<{ from: number; to: number; value: number; color: string; title: string }>,
): string {
	const W = 880;
	const H = 340;
	const nodeW = 14;
	const gap = 16;
	const labelW = 250;
	const total = left.reduce((s, n) => s + n.value, 0);
	const scale = (H - gap * (left.length - 1)) / total;
	const place = (ns: Node[]) => {
		let y = 0;
		return ns.map((n) => {
			const top = y;
			y += n.value * scale + gap;
			return top;
		});
	};
	const lTop = place(left);
	const rTop = place(right);
	const lCur = [...lTop];
	const rCur = [...rTop];
	const x0 = labelW;
	const x1 = W - labelW;
	const xm = (x0 + x1) / 2;
	const ribbons = links
		.map((l) => {
			const h = l.value * scale;
			const y0 = lCur[l.from]!;
			lCur[l.from] = y0 + h;
			const y1 = rCur[l.to]!;
			rCur[l.to] = y1 + h;
			return `<path d="M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h} C${xm},${y1 + h} ${xm},${y0 + h} ${x0},${y0 + h} Z" fill="${l.color}" fill-opacity="0.42"><title>${esc(l.title)}</title></path>`;
		})
		.join("");
	const nodeMarks = (ns: Node[], tops: number[], side: "left" | "right") =>
		ns
			.map((n, i) => {
				const y = tops[i]!;
				const h = n.value * scale;
				const x = side === "left" ? x0 - nodeW : x1;
				const tx = side === "left" ? x0 - nodeW - 10 : x1 + nodeW + 10;
				const anchor = side === "left" ? "end" : "start";
				return `<rect x="${x}" y="${y}" width="${nodeW}" height="${Math.max(h, 2)}" rx="3" fill="${n.color}"/>
<text x="${tx}" y="${y + Math.min(h, 40) / 2 - 2}" text-anchor="${anchor}" class="lbl">${esc(n.label)}</text>
<text x="${tx}" y="${y + Math.min(h, 40) / 2 + 16}" text-anchor="${anchor}" class="sub">${fmt(n.value)} · ${pct(n.value, total)}%</text>`;
			})
			.join("");
	return `<svg viewBox="0 0 ${W} ${H + 10}" role="img" aria-label="Examples by source, then by audio">${ribbons}${nodeMarks(left, lTop, "left")}${nodeMarks(right, rTop, "right")}</svg>`;
}

const audioSankey = sankey(
	[
		{ label: "slovak.wiki curated", value: curated.total, color: "#7aa2f7" },
		{ label: "Tatoeba", value: tatoeba.total, color: "#e0af68" },
	],
	[
		{
			label: "slovak.wiki clip (free, kept)",
			value: curated.exact + curated.accents + tatoeba.exact + tatoeba.accents,
			color: "#9ece6a",
		},
		{ label: "no clip (needs a voice)", value: curated.none + tatoeba.none, color: "#f7768e" },
	],
	[
		{
			from: 0,
			to: 0,
			value: curated.exact + curated.accents,
			color: "#9ece6a",
			title: `curated with a wiki clip: ${fmt(curated.exact + curated.accents)}`,
		},
		{ from: 0, to: 1, value: curated.none, color: "#f7768e", title: `curated with no clip: ${fmt(curated.none)}` },
		{
			from: 1,
			to: 0,
			value: tatoeba.exact + tatoeba.accents,
			color: "#9ece6a",
			title: `Tatoeba with a wiki clip: ${fmt(tatoeba.exact + tatoeba.accents)}`,
		},
		{ from: 1, to: 1, value: tatoeba.none, color: "#f7768e", title: `Tatoeba with no clip: ${fmt(tatoeba.none)}` },
	],
);

const bar = (p: number, color: string) =>
	`<div class="bar"><span style="width:${p}%;background:${color}"></span></div>`;
const catRows = [...cats]
	.sort((a, b) => b[1].words - a[1].words)
	.map(
		([name, c]) =>
			`<tr><td>${esc(name)}</td><td class="n">${fmt(c.words)}</td><td class="n">${fmt(c.withClip)}</td><td>${bar(pct(c.withClip, c.words), "#9ece6a")}</td></tr>`,
	)
	.join("");
const tierRows = [...tiers]
	.sort((a, b) => b[1].clips - a[1].clips)
	.map(
		([name, t]) => `<tr><td>${esc(name)}</td><td class="n">${fmt(t.clips)}</td><td class="n">${fmt(t.chars)}</td></tr>`,
	)
	.join("");

const kpi = (value: string, label: string, sub: string) =>
	`<div class="kpi"><div class="v">${value}</div><div class="l">${esc(label)}</div><div class="s">${esc(sub)}</div></div>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Where our sentences come from</title>
<style>
body{margin:0;background:#101217;color:#e4e6eb;font:15px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:36px 0 10px;color:#c9ccd4}
.lede,.note{color:#9aa0ac}.note{font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:20px}
.kpi{background:#181b22;border:1px solid #262a33;border-radius:12px;padding:14px 16px}
.kpi .v{font-size:26px;font-weight:700}.kpi .l{color:#c9ccd4;font-weight:600;margin-top:2px}.kpi .s{color:#8a909c;font-size:12.5px}
.card{background:#181b22;border:1px solid #262a33;border-radius:12px;padding:16px}
svg{width:100%;height:auto;display:block}
.lbl{fill:#e4e6eb;font-size:13px;font-weight:600}.sub{fill:#9aa0ac;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:8px 10px;border-bottom:1px solid #262a33;text-align:left;vertical-align:top}
th{color:#9aa0ac;font-weight:600;font-size:12.5px;text-transform:uppercase;letter-spacing:.04em}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.bar{background:#262a33;border-radius:6px;height:12px;min-width:140px;overflow:hidden}.bar span{display:block;height:100%}
code{background:#20242c;border-radius:4px;padding:1px 5px;font-size:13px}
</style></head>
<body><main>
<h1>Where our sentences come from</h1>
<p class="lede">Built ${new Date().toISOString().slice(0, 10)} from <code>${esc(lexiconSource)}</code>, the slovak.wiki clip map, the slovak.wiki manifest and your local data folder. Nothing here calls the network.</p>

<div class="kpis">
${kpi(fmt(rows.length), "example sentences", `${fmt(uniqRows.length)} unique Slovak texts`)}
${kpi(fmt(words), "dictionary words", `${fmt(lexicon.words.filter((w) => w.cat === "Nouns").length)} nouns, ${fmt(lexicon.words.filter((w) => w.cat === "Verbs").length)} verbs`)}
${kpi(`${pct(withClip.length, uniqRows.length)}%`, "have a slovak.wiki clip", `${fmt(withClip.length)} of ${fmt(uniqRows.length)} unique sentences`)}
${kpi(fmt(noClip.length), "need a voice", `${fmt(numbers.synthesis.charsForNoClip)} characters to synthesize`)}
${kpi(fmt(audio.length), "clips on your disk", `${fmt([...tiers.values()].reduce((s, t) => s + t.chars, 0))} characters spoken so far`)}
</div>

<h2>Source → audio, one line per example</h2>
<div class="card">${audioSankey}</div>
<p class="note">Left: where the example comes from. Right: whether slovak.wiki already has a recording for that exact text (or the same text ignoring accents). Green is free and already recorded; red needs a synthesized voice.</p>

<h2>Where each screen gets its sentences</h2>
<div class="card"><table>
<tr><th>Screen</th><th>Sentence source</th><th>Audio</th><th class="n">Here (your data)</th></tr>
<tr><td>Lesson (meaning, choose, type, build)</td><td>Library: slovak.wiki curated and Tatoeba</td><td>Wiki clip, else the voice cascade</td><td class="n">${fmt(lessonReps)} reps · ${fmt(lessonSentences.size)} sentences</td></tr>
<tr><td>Listen</td><td>Library (the same pool)</td><td>Wiki clip, else the voice cascade</td><td class="n">pool: ${fmt(rows.length)}</td></tr>
<tr><td>Review (cloze cards)</td><td>Library: one card per word, one sentence per card</td><td>Wiki clip, else the voice cascade</td><td class="n">${fmt(cards)} cards</td></tr>
<tr><td>Tutor replies</td><td>Written by the model at runtime (<code>say:</code> spans)</td><td>Voice cascade (ElevenLabs, Edge, Piper, browser). Not in the wiki</td><td class="n">${fmt(spoken.size)} spoken phrases</td></tr>
<tr><td>Read (stories)</td><td>Written by the model, graded to your level</td><td>Voice cascade. Not in the wiki</td><td class="n">${fmt(stories)} episodes</td></tr>
<tr><td>Speak (scenes)</td><td>Written by the model as scenes with a partner</td><td>Voice cascade. Not in the wiki</td><td class="n">${fmt(scenes)} scenes</td></tr>
<tr><td>Watch (YouTube)</td><td>The video's own Slovak captions, translated by the model</td><td>The video's own audio</td><td class="n">${fmt(videos)} videos</td></tr>
</table></div>

<h2>Dictionary words: which have a recording</h2>
<div class="card"><table>
<tr><th>Category</th><th class="n">Words</th><th class="n">With a clip</th><th>Coverage</th></tr>
${catRows}
</table></div>

<h2>Cost and size</h2>
<div class="card"><table>
<tr><th>What</th><th class="n">Amount</th></tr>
<tr><td>Wiki clips the library uses (unique texts, no re-download)</td><td class="n">${fmt(clipHashes.size)} clips · ${(wikiBytes / 1e6).toFixed(0)} MB</td></tr>
<tr><td>Whole slovak.wiki dictionary voice (lemma + example)</td><td class="n">${fmt(dictionaryClips.length)} clips · ${(dictionaryBytes / 1e6).toFixed(0)} MB</td></tr>
<tr><td>Characters to synthesize the library texts with no clip</td><td class="n">${fmt(numbers.synthesis.charsForNoClip)}</td></tr>
<tr><td>Characters to synthesize every unique library text</td><td class="n">${fmt(numbers.synthesis.charsForWholeLibrary)}</td></tr>
</table></div>

<h2>Your audio library so far</h2>
<div class="card"><table>
<tr><th>Engine that spoke it</th><th class="n">Clips</th><th class="n">Characters</th></tr>
${tierRows || `<tr><td colspan="3">No clips yet.</td></tr>`}
</table></div>

<p class="note">Library counts: <code>lexicon.json</code> exported 2026-10-26; wiki clips: <code>wiki-audio.json</code> (34,306 texts at export). Runtime counts are from your local <code>data/</code> folder and grow with use. "Accents" matches are texts that equal a clip's text once accents are removed.</p>
</main></body></html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, "utf-8");
console.log(`report: ${OUT}`);
