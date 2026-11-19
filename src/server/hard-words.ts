import { hardWords } from "../core/hard-words.ts";
import { reviewStore } from "../store/review.ts";
import { activeLanguage } from "./active-language.ts";

export function activeHardWords(opts: { tz?: number } = {}) {
	return hardWords(Object.values(reviewStore.readCards()), reviewStore.readLog(), {
		langTag: activeLanguage().tag,
		tz: opts.tz,
	});
}
