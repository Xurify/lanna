import type { Metadata } from "next";
import { WordBankPage, type WordsTab } from "@/components/words/word-bank-page";

export const metadata: Metadata = {
	title: "Words",
	description: "Your words, the ones you know, your saved phrases and your cheatsheets.",
};

const TABS: readonly WordsTab[] = ["words", "phrases", "cheatsheets"];

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; sheet?: string; search?: string }> }) {
	const { tab, sheet, search } = await searchParams;
	const initialTab = TABS.find((t) => t === tab) ?? (sheet ? "cheatsheets" : "words");
	return <WordBankPage initialTab={initialTab} initialSheet={initialTab === "cheatsheets" ? sheet : undefined} initialSearch={initialTab === "words" ? search : undefined} />;
}
