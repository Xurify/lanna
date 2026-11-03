import type { Metadata } from "next";
import { WordBankPage } from "@/components/words/word-bank-page";

export const metadata: Metadata = {
	title: "Words",
	description: "Your words, the ones you know, and your saved phrases.",
};

export default function Page() {
	return <WordBankPage />;
}
