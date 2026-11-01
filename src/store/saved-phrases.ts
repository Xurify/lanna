/**
 * Saved Phrases and Word Favorites Persistence (LangHarness) — the active profile's
 * data/profiles/<language>/saved/:
 *
 *   phrases.json    saved / bookmarked phrases and sentences with translations
 *   favorites.json  list of favorited lexicon word slugs
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PATHS } from "../../config.ts";
import type { SavedPhrase } from "../core/saved-phrases.ts";

const PHRASES_FILE = () => path.join(PATHS.saved, "phrases.json");
const FAVORITES_FILE = () => path.join(PATHS.saved, "favorites.json");

function readJson<T>(file: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return fallback;
	}
}

function writeJsonAtomic(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value, null, "\t"), "utf-8");
	fs.renameSync(tmp, file);
}

const DEFAULT_SEEDS: Omit<SavedPhrase, "id" | "savedAt">[] = [
	{
		text: "Kúp, prosím, mlieko a chlieb.",
		translation: "Please buy milk and bread.",
		source: "lesson",
		context: "Potraviny (Groceries)",
		tags: ["daily", "food"],
	},
	{
		text: "Dobrý deň, jeden spiatočný lístok do Popradu, prosím.",
		translation: "Hello, one return ticket to Poprad, please.",
		source: "speak",
		context: "Na stanici (At the station)",
		tags: ["travel", "train"],
	},
	{
		text: "Dáme si bryndzové halušky a pohár žinčice.",
		translation: "We will have bryndza gnocchi and a glass of sheep whey.",
		source: "speak",
		context: "V kolibe (Mountain restaurant)",
		tags: ["culture", "traditional"],
	},
	{
		text: "Popradské pleso je nádherné horské jazero vo Vysokých Tatrách.",
		translation: "Popradské pleso is a beautiful mountain lake in the High Tatras.",
		source: "story",
		context: "Príbeh: Popradské pleso",
		tags: ["nature", "tatras"],
	},
	{
		text: "Máte voľnú izbu na dve noci?",
		translation: "Do you have a free room for two nights?",
		source: "speak",
		context: "V hoteli (At the hotel)",
		tags: ["travel", "hotel"],
	},
];

export const savedPhraseStore = {
	readPhrases(): SavedPhrase[] {
		const file = PHRASES_FILE();
		if (!fs.existsSync(file)) {
			// Seed starter phrases on first access
			const now = new Date().toISOString();
			const seeded: SavedPhrase[] = DEFAULT_SEEDS.map((s, idx) => ({
				id: `sp_${Date.now() - (DEFAULT_SEEDS.length - idx) * 3600000}_${idx}`,
				...s,
				savedAt: now,
			}));
			writeJsonAtomic(file, seeded);
			return seeded;
		}
		return readJson<SavedPhrase[]>(file, []);
	},

	savePhrase(input: {
		text: string;
		translation: string;
		source: SavedPhrase["source"];
		context?: string;
		tags?: string[];
		notes?: string;
	}): SavedPhrase {
		const phrases = this.readPhrases();
		const norm = input.text.trim();
		const existing = phrases.find((p) => p.text.trim().toLowerCase() === norm.toLowerCase());
		if (existing) {
			return existing;
		}

		const id = `sp_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
		const entry: SavedPhrase = {
			id,
			text: norm,
			translation: input.translation.trim(),
			source: input.source,
			context: input.context?.trim(),
			savedAt: new Date().toISOString(),
			tags: input.tags,
			notes: input.notes,
		};

		phrases.unshift(entry);
		writeJsonAtomic(PHRASES_FILE(), phrases);
		return entry;
	},

	removePhrase(id: string): boolean {
		const phrases = this.readPhrases();
		const next = phrases.filter((p) => p.id !== id);
		if (next.length === phrases.length) return false;
		writeJsonAtomic(PHRASES_FILE(), next);
		return true;
	},

	removeByText(text: string): boolean {
		const phrases = this.readPhrases();
		const norm = text.trim().toLowerCase();
		const next = phrases.filter((p) => p.text.trim().toLowerCase() !== norm);
		if (next.length === phrases.length) return false;
		writeJsonAtomic(PHRASES_FILE(), next);
		return true;
	},

	isSaved(text: string): boolean {
		const phrases = this.readPhrases();
		const norm = text.trim().toLowerCase();
		return phrases.some((p) => p.text.trim().toLowerCase() === norm);
	},

	// ─── Word Favorites ──────────────────────────────────────────────────────────

	readFavorites(): string[] {
		return readJson<string[]>(FAVORITES_FILE(), []);
	},

	isFavorite(slug: string): boolean {
		const favs = this.readFavorites();
		return favs.includes(slug.trim());
	},

	toggleFavorite(slug: string): boolean {
		const s = slug.trim();
		const favs = this.readFavorites();
		const idx = favs.indexOf(s);
		let next: string[];
		let isFav: boolean;
		if (idx >= 0) {
			next = favs.filter((item) => item !== s);
			isFav = false;
		} else {
			next = [s, ...favs];
			isFav = true;
		}
		writeJsonAtomic(FAVORITES_FILE(), next);
		return isFav;
	},

	setFavorite(slug: string, favorite: boolean): void {
		const s = slug.trim();
		const favs = this.readFavorites();
		const exists = favs.includes(s);
		if (favorite && !exists) {
			writeJsonAtomic(FAVORITES_FILE(), [s, ...favs]);
		} else if (!favorite && exists) {
			writeJsonAtomic(
				FAVORITES_FILE(),
				favs.filter((item) => item !== s),
			);
		}
	},
};
