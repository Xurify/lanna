import type { Metadata } from "next";
import { WordBankPage } from "@/components/words/word-bank-page";

export const metadata: Metadata = {
	title: "Words & Phrases · LangHarness",
	description: "Your word bank, known words and saved phrases.",
};

export default function Page() {
	return <WordBankPage />;
}
