export interface AskedAbout {
	sentence: string;
	part: string | null;
	given: string;
	translation: string;
	entry: { lemma: string; pos?: string; gloss: string; formNote?: string } | null;
}
