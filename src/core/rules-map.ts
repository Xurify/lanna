/**
 * The Map for a learner: the rules and facts the lessons teach, grouped by area, each with the ones
 * it builds on. It reads the knowledge graph (nodes, the areas they came from, the "follows" links)
 * and shows none of its machinery. Pure, so it is testable without a server.
 */
import { compareMatches, matchWord, type WordSearchMatch } from "./word-search.ts";

interface RuleItem {
	id: string;
	name: string;
	/** The rule itself, without the native-language bridge. */
	statement: string;
	/** "Like Estonian…": the bridge the lessons carry, shown apart. */
	bridge?: string;
	areaId: string;
	buildsOn: { id: string; name: string }[];
}

interface RuleArea {
	id: string;
	label: string;
	rules: RuleItem[];
}

export interface GraphLike {
	nodes: { id: string; name: string; statement: string }[];
	nodeSessions?: Record<string, string[]>;
	fileSources?: Record<string, string>;
	sessions?: Record<string, string>;
	impLinks?: { id: string; premises: string[]; conclusion: string }[];
}

const CURRICULUM_PREFIX = /^[A-Za-z]+ curriculum:\s*/i;
/** The curriculum's own order; areas the learner added come after. */
const AREA_ORDER = ["phonetics", "pronouns", "nouns", "cases", "verbs", "syntax", "vocabulary", "goal"];
const BRIDGE = /\s*(?:\p{L}+ )?bridge:\s*/iu;

export function areaLabel(source: string): string {
	const s = source.replace(CURRICULUM_PREFIX, "").trim();
	return s ? s[0]!.toLocaleUpperCase() + s.slice(1) : "Your notes";
}

export function splitBridge(statement: string): { statement: string; bridge?: string } {
	const m = BRIDGE.exec(statement);
	if (!m) return { statement: statement.trim() };
	return {
		statement: statement.slice(0, m.index).trim(),
		bridge: statement.slice(m.index + m[0].length).trim() || undefined,
	};
}

export function buildRulesMap(g: GraphLike): RuleArea[] {
	// The graph stores "A and B together give C" as a node of its own, named with an arrow. It is a link, not a rule to read.
	const linkIds = new Set((g.impLinks ?? []).map((l) => l.id));
	const isLink = (n: { id: string; name: string }) => linkIds.has(n.id) || /^[⇒⟹→]$/u.test(n.name.trim());
	const nodes = g.nodes.filter((n) => !isLink(n));
	const names = new Map(nodes.map((n) => [n.id, n.name]));
	const premises = new Map<string, Set<string>>();
	for (const l of g.impLinks ?? []) {
		const set = premises.get(l.conclusion) ?? new Set<string>();
		for (const p of l.premises) if (names.has(p)) set.add(p);
		premises.set(l.conclusion, set);
	}
	const sourceOf = (id: string) => g.nodeSessions?.[id]?.[0];
	const areas = new Map<string, RuleArea>();
	for (const n of nodes) {
		const src = sourceOf(n.id);
		const areaId = src ?? "notes";
		const label = areaLabel((src && (g.fileSources?.[src] ?? g.sessions?.[src])) || "");
		let area = areas.get(areaId);
		if (!area) areas.set(areaId, (area = { id: areaId, label, rules: [] }));
		const { statement, bridge } = splitBridge(n.statement);
		area.rules.push({
			id: n.id,
			name: n.name,
			statement,
			...(bridge ? { bridge } : {}),
			areaId,
			buildsOn: [...(premises.get(n.id) ?? [])].map((id) => ({ id, name: names.get(id)! })),
		});
	}
	const rank = (a: RuleArea) => {
		const i = AREA_ORDER.indexOf(a.label.toLowerCase());
		return i < 0 ? AREA_ORDER.length : i;
	};
	return [...areas.values()]
		.filter((a) => a.rules.length > 0)
		.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

interface RuleHit {
	rule: RuleItem;
	match: WordSearchMatch;
}

/** Name first (start, then contains), then the rule text at a word start. A one-letter search matches names only. */
export function searchRules(areas: readonly RuleArea[], query: string): { area: RuleArea; hits: RuleHit[] }[] {
	const q = query.trim();
	if (!q)
		return areas.map((area) => ({
			area,
			hits: area.rules.map((rule) => ({ rule, match: { rank: 1, kind: "start" } as WordSearchMatch })),
		}));
	return areas
		.map((area) => ({
			area,
			hits: area.rules
				.flatMap((rule) => {
					const match = matchWord(q, { lemma: rule.name, gloss: rule.statement });
					return match ? [{ rule, match }] : [];
				})
				.sort((a, b) => compareMatches({ match: a.match }, { match: b.match })),
		}))
		.filter((r) => r.hits.length > 0);
}
