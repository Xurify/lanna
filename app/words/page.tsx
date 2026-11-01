import type { Metadata } from "next";
import { WordBankPage } from "@/components/words/word-bank-page";

export const metadata: Metadata = {
	title: "Slovník & Frázy · LangHarness",
	description: "Osobný slovník, zvládnuté slová a uložené frázy.",
};

export default function Page() {
	return <WordBankPage />;
}
