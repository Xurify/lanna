import { notFound } from "next/navigation";
import { SoundPlayer } from "@/components/sound/sound-player";
import { allChapters, getSound } from "@/src/core";
import { activeLanguage } from "@/src/server";

export const metadata = { title: "Sound" };

export const dynamic = "force-dynamic";

/** Zvuk, the sound step (phase 7): ?id=<sound id> plays that sound in the
 *  active language. An unknown id, or a sound that belongs to another
 *  language, is a 404. */
export default async function SoundPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
	const { id } = await searchParams;
	const sound = getSound(activeLanguage().id, id ?? "");
	if (!sound) notFound();
	const chapter = allChapters().find((c) => c.id === sound.chapter);
	return <SoundPlayer sound={sound} chapterTitle={chapter?.title ?? ""} />;
}
