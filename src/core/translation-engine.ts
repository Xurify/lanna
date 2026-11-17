/** The service that machine-translated a word lookup. */
export type TranslationEngine = "deepl" | "google" | "mymemory";

/** The name shown beside a machine translation; cache entries from before engines were recorded have none. */
export function translationEngineLabel(engine: TranslationEngine | undefined): string {
	switch (engine) {
		case "deepl":
			return "DeepL";
		case "google":
			return "Google";
		case "mymemory":
			return "MyMemory";
		default:
			return "Translator";
	}
}
