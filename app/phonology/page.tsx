import type { Metadata } from "next";
import { EarGym } from "@/components/phonology/ear-gym";
import { activeLanguage } from "@/src/server";

export const metadata: Metadata = {
	title: "Ear gym",
	description: "Hear one word of a pair and pick which one it was",
};

export const dynamic = "force-dynamic";

export default function PhonologyPage() {
	const lang = activeLanguage();
	return <EarGym key={lang.id} seed={Date.now()} languageId={lang.id} languageName={lang.english} languageCode={lang.code} />;
}
