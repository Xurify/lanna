/**
 * Language profiles (LangHarness, spec D7 / WF-01) — which language the
 * server runs, switching it, and seeding a fresh profile's graph with the
 * language's curriculum (spec D2 / WF-02).
 *
 * The active profile is fixed at boot (config.ts ACTIVE_PROFILE); a switch
 * writes data/profile.json and needs a restart — the desktop shell
 * relaunches itself, `next dev` must be restarted by hand.
 */

import fs from "node:fs";
import path from "node:path";
import { ACTIVE_PROFILE, PROFILE_FILE, curriculumFile, isLanguageProfile, languageProfiles, type LanguageProfile } from "../../config.ts";
import type { GraphChain, GraphNode } from "../core/contracts.ts";
import { settleGraphLayout } from "../core/layout-settle.ts";
import type { LanguageInfo } from "../core/language.ts";
import { graphStore } from "../store/graph.ts";
import { activeLanguage, profileLanguage } from "./active-language.ts";
import { languageRemovable } from "./language-add.ts";

export interface ProfileStatus {
	active: LanguageProfile;
	/** What profile.json asks for — differs from `active` until restart. */
	selected: LanguageProfile;
	restartRequired: boolean;
	/** The running language in full: the browser reads its tag, voices and letters here. */
	language: LanguageInfo;
	profiles: Array<{ id: LanguageProfile; tag: string; endonym: string; english: string; lexicon: boolean; seed: boolean; /** Its downloaded words can be removed now. */ removable: boolean }>;
	seeded: { nodes: number; chains: number } | null;
}

function readSelected(): LanguageProfile {
	try {
		const parsed = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8")) as { active?: unknown };
		if (isLanguageProfile(parsed.active)) return parsed.active;
	} catch {
		// absent — the active one
	}
	return ACTIVE_PROFILE;
}

function seedFile(profile: LanguageProfile): string {
	return curriculumFile(profile, "seed.json");
}

export function profileStatus(): ProfileStatus {
	const selected = readSelected();
	return {
		active: ACTIVE_PROFILE,
		selected,
		restartRequired: selected !== ACTIVE_PROFILE,
		language: activeLanguage(),
		profiles: languageProfiles().flatMap((id) => {
			const info = profileLanguage(id);
			if (!info) return [];
			return [{
				id,
				tag: info.tag,
				endonym: info.endonym,
				english: info.english,
				lexicon: fs.existsSync(curriculumFile(id, "lexicon.json")),
				seed: fs.existsSync(seedFile(id)),
				removable: languageRemovable(id),
			}];
		}),
		seeded: lastSeed,
	};
}

export function selectProfile(profile: LanguageProfile): ProfileStatus {
	fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true });
	fs.writeFileSync(PROFILE_FILE, JSON.stringify({ active: profile }), "utf-8");
	return profileStatus();
}

interface SeedFile {
	language: string;
	version: number;
	nodes: Array<{ key: string; name: string; statement: string; kind: string; strand?: string }>;
	chains: Array<{ premises: string[]; conclusion: string }>;
	/** Drafted by a model when the language was added, not written by hand. */
	draft?: boolean;
}

let lastSeed: { nodes: number; chains: number } | null = null;

const seedSourceId = (profile: string, group: string) => `src_seed_${profileLanguage(profile)?.code ?? profile}_${group}`;

/**
 * Seed the active profile's graph from curriculum/<language>/seed.json —
 * once: a profile counts as seeded when any src_seed_* source exists, so
 * deleting seed nodes in the app is respected. Each strand (phonetics,
 * cases, verbs, vocabulary…) is its own source, which makes the graph's
 * birth-session clusters fall along strands.
 */
export function ensureSeeded(): { nodes: number; chains: number } | null {
	const file = seedFile(ACTIVE_PROFILE);
	if (!fs.existsSync(file)) return null;
	const prefix = `src_seed_`;
	if (graphStore.readSources().some((s) => s.id.startsWith(prefix))) return null;
	const seed = JSON.parse(fs.readFileSync(file, "utf-8")) as SeedFile;
	const now = new Date().toISOString();
	const idOf = (key: string) => `n_seed_${key.replace(/[^a-z0-9]+/gi, "_")}`;
	const groupOf = new Map<string, string>();
	for (const n of seed.nodes) groupOf.set(n.key, n.kind === "grammar" ? (n.strand ?? "grammar") : n.kind);
	const groups = new Set(groupOf.values());
	for (const group of groups) {
		graphStore.upsertSource({
			id: seedSourceId(ACTIVE_PROFILE, group),
			filePath: `${activeLanguage().english} curriculum${seed.draft ? " (model draft)" : ""}: ${group}`,
			importedAt: now,
		});
	}
	for (const n of seed.nodes) {
		const node: GraphNode = {
			id: idOf(n.key),
			name: n.name,
			statement: n.statement,
			aliases: [],
			createdAt: now,
			provenance: [{ chatId: seedSourceId(ACTIVE_PROFILE, groupOf.get(n.key)!), messageId: "" }],
		};
		graphStore.appendNode(node);
	}
	seed.chains.forEach((c, i) => {
		const chain: GraphChain = {
			id: `arg_seed_${i}`,
			premises: c.premises.map(idOf),
			conclusion: idOf(c.conclusion),
			provenance: [{ chatId: seedSourceId(ACTIVE_PROFILE, groupOf.get(c.conclusion)!), messageId: "" }],
			createdAt: now,
		};
		graphStore.appendChain(chain);
	});
	try {
		settleGraphLayout(graphStore);
	} catch (err) {
		console.warn("[seed] layout settle failed (positions rebuild on the next merge):", err);
	}
	lastSeed = { nodes: seed.nodes.length, chains: seed.chains.length };
	console.log(`[seed] ${ACTIVE_PROFILE}: seeded ${lastSeed.nodes} nodes, ${lastSeed.chains} chains`);
	return lastSeed;
}
