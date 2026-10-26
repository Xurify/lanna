/**
 * Build a language's seed graph (LangHarness, spec D2 / WF-02):
 *
 *   npx tsx scripts/build-seed.ts [slovak]
 *
 * Reads curriculum/<language>/seed-source.json (hand-authored grammar
 * nodes, prerequisite chains, vocabulary clusters with Estonian glosses,
 * can-do goals) plus the lexicon for English glosses, and writes
 * curriculum/<language>/seed.json — the node/chain list the server seeds
 * into a fresh profile's graph (src/server/seed.ts). Fails loudly on a
 * chain that names an unknown key; warns on a cluster word the lexicon
 * lacks (an inline English gloss is then required).
 */
import fs from "node:fs";
import path from "node:path";

interface Source {
	grammar: Array<{ key: string; strand: string; name: string; statement: string; et: string }>;
	chains: Array<{ premises: string[]; conclusion: string }>;
	clusters: Array<{ key: string; name: string; et: string; words: Array<[string, string, string?]> }>;
	cluster_chains: Array<{ premises: string[]; conclusion: string }>;
	can_do: Array<{ key: string; name: string; statement: string }>;
}

const language = process.argv[2] ?? "slovak";
const dir = path.join(process.cwd(), "curriculum", language);
const src = JSON.parse(fs.readFileSync(path.join(dir, "seed-source.json"), "utf-8")) as Source;
const lexicon = JSON.parse(fs.readFileSync(path.join(dir, "lexicon.json"), "utf-8")) as { words: Array<{ sk: string; en: string; rank?: number }> };
const gloss = new Map<string, string>();
for (const w of [...lexicon.words].sort((a, b) => (b.rank ?? 1e9) - (a.rank ?? 1e9))) gloss.set(w.sk, (w.en.split(";")[0] ?? w.en).trim());

const nodes: Array<{ key: string; name: string; statement: string; kind: "grammar" | "vocabulary" | "goal"; strand?: string }> = [];
for (const g of src.grammar) {
	nodes.push({ key: g.key, kind: "grammar", strand: g.strand, name: g.name, statement: g.et ? `${g.statement} Estonian bridge: ${g.et}` : g.statement });
}
let missing = 0;
for (const c of src.clusters) {
	const words = c.words.map(([sk, et, en]) => {
		const english = en ?? gloss.get(sk);
		if (!english) {
			missing++;
			console.error(`[build-seed] ${c.key}: "${sk}" is not in the lexicon and has no inline English gloss`);
		}
		return `${sk} '${english ?? "?"}' (et: ${et})`;
	});
	nodes.push({ key: c.key, kind: "vocabulary", name: `Words: ${c.name}`, statement: `Core Slovak words for ${c.name.toLowerCase()} (et: ${c.et}): ${words.join(", ")}.` });
}
for (const g of src.can_do) nodes.push({ key: g.key, kind: "goal", name: g.name, statement: g.statement });

const keys = new Set(nodes.map((n) => n.key));
if (keys.size !== nodes.length) throw new Error("duplicate seed keys");
const chains = [...src.chains, ...src.cluster_chains];
for (const ch of chains) {
	for (const k of [...ch.premises, ch.conclusion]) if (!keys.has(k)) throw new Error(`chain names unknown key "${k}"`);
}
if (missing) process.exitCode = 1;
fs.writeFileSync(path.join(dir, "seed.json"), `${JSON.stringify({ language, version: 1, nodes, chains }, null, "\t")}\n`);
console.log(`[build-seed] ${language}: ${nodes.length} nodes (${src.grammar.length} grammar, ${src.clusters.length} vocabulary, ${src.can_do.length} goals), ${chains.length} chains`);
