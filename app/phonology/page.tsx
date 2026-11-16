import type { Metadata } from "next";
import { EarGym, type PhonologyView } from "@/components/phonology/ear-gym";
import { activeLanguage } from "@/src/server";

export const metadata: Metadata = {
	title: "Ear gym",
	description: "Hear one word of a pair and pick which one it was",
};

export const dynamic = "force-dynamic";

const VIEWS: readonly PhonologyView[] = ["pairs", "sounds", "rhythm"];

export default async function PhonologyPage({
	searchParams,
}: {
	searchParams: Promise<{ view?: string; sound?: string }>;
}) {
	const { view, sound } = await searchParams;
	const lang = activeLanguage();
	return (
		<EarGym
			key={`${lang.id}:${view ?? ""}:${sound ?? ""}`}
			seed={Date.now()}
			languageId={lang.id}
			languageName={lang.english}
			languageCode={lang.code}
			initialView={VIEWS.find((v) => v === view)}
			initialSound={sound}
		/>
	);
}
