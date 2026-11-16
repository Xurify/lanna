import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { processWide } from "../core/process-wide.ts";
import {
	referenceAspectPairs,
	referenceUnits,
	type AspectPair,
	type ReferenceUnit,
} from "../core/reference-contrast.ts";

interface ReferenceSource {
	folder: string;
	notAboutMeaning: readonly string[];
}

const REFERENCES: Partial<Record<string, ReferenceSource>> = {
	slovak: {
		folder: "slovak-language",
		notAboutMeaning: [
			"orthography-and-punctuation",
			"phonology-and-orthography",
			"pronunciation-and-usage",
			"practice-and-progression",
			"slovak-wiki-authoring",
			"slovakia-context-handbook",
			"adjectives-pronouns-numerals",
			"morphology-reference",
			"nouns",
			"verb-forms",
		],
	},
};

export interface LanguageReference {
	units: ReferenceUnit[];
	aspectPairs: Array<AspectPair & { chapter: string }>;
}

export function referenceDir(language: string): string | undefined {
	const source = REFERENCES[language];
	return source && path.join(PATHS.root, ".claude", "skills", source.folder, "references");
}

const cache = processWide("languageReference", () => new Map<string, LanguageReference | null>());

export function languageReference(language: string, tag: string): LanguageReference | null {
	if (cache.has(language)) return cache.get(language)!;
	const source = REFERENCES[language];
	const dir = referenceDir(language);
	let reference: LanguageReference | null = null;
	if (source && dir && fs.existsSync(dir)) {
		reference = { units: [], aspectPairs: [] };
		for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
			const id = file.replace(/\.md$/, "");
			if (source.notAboutMeaning.includes(id)) continue;
			const markdown = fs.readFileSync(path.join(dir, file), "utf-8");
			const chapter = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
			reference.units.push(...referenceUnits(markdown, chapter, tag));
			reference.aspectPairs.push(...referenceAspectPairs(markdown).map((p) => ({ ...p, chapter })));
		}
	}
	cache.set(language, reference);
	return reference;
}
