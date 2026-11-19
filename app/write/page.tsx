import { HardWordsWriting } from "@/components/writing/hard-words-writing";
import { activeLanguage, writingReady, writingTargets } from "@/src/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Write with these words" };

export default function WritePage() {
	const language = activeLanguage();
	return (
		<HardWordsWriting
			targets={writingTargets()}
			ready={writingReady()}
			language={{ id: language.id, english: language.english, tag: language.tag }}
		/>
	);
}
