import type { Metadata } from "next";
import { WordCheck } from "@/components/words/word-check";

export const metadata: Metadata = {
	title: "Word check",
	description: "A short check that measures how many words you know.",
};

export const dynamic = "force-dynamic";

export default function Page() {
	return <WordCheck />;
}
