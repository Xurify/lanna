import type { Metadata } from "next";
import { WordBankPage, type WordsTab } from "@/components/words/word-bank-page";
import { WORDS_PAGE_SIZE } from "@/components/words/page-size";
import { getWordBank } from "@/src/server";

export const metadata: Metadata = {
	title: "Words",
	description: "Your words, the ones you know, your saved phrases and your cheatsheets.",
};

const TABS: readonly WordsTab[] = ["words", "phrases", "cheatsheets"];

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; sheet?: string; search?: string }> }) {
	const { tab, sheet, search } = await searchParams;
	const initialTab = TABS.find((t) => t === tab) ?? (sheet ? "cheatsheets" : "words");
	const firstSearch = initialTab === "words" ? search : undefined;
	let firstWords = null;
	try {
		firstWords = getWordBank({ search: firstSearch?.trim() || undefined, limit: WORDS_PAGE_SIZE, offset: 0 });
	} catch {
		firstWords = null;
	}
	return <WordBankPage initialWords={firstWords} initialTab={initialTab} initialSheet={initialTab === "cheatsheets" ? sheet : undefined} initialSearch={initialTab === "words" ? search : undefined} />;
}
