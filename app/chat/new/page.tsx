import { NewSession } from "@/components/new-session";
import { activeLanguage, listChats, readSettingsRecord, weakestTopics } from "@/src/server";
import { slotsConfigured } from "@/src/core";

export const dynamic = "force-dynamic";

/**
 * The draft view behind "+ New session" (owner, 2026-09-13): NO session is
 * created until the first message is sent — the view is a sessionless empty
 * chat; on send it creates the chat (title = that message) and redirects to
 * the real page, whose initialPrompt path delivers the message as turn 1.
 * Static segment beats the dynamic [id] route — "new" is never a chat id.
 *
 * The draft's model control binds the STRONG SLOT (the new-session
 * default); the session the first send creates is stamped from it
 * server-side (per-session models, owner 2026-09-28).
 */
export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
	const { mode } = await searchParams;
	return (
		<NewSession
			initialConfigured={slotsConfigured(readSettingsRecord()?.models)}
			mode={mode === "practice" || mode === "teach" ? mode : "chat"}
			language={activeLanguage().english}
			weakTopics={weakestTopics(3)}
			recent={listChats()
				.filter((c) => c.kind === "chat")
				.slice(0, 3)
				.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))}
		/>
	);
}
