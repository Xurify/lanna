import { SelfTalkPlayer } from "@/components/speak/self-talk-player";

export const metadata = { title: "Guided Self-Talk" };

export const dynamic = "force-dynamic";

export default async function SelfTalkPage({
	searchParams,
}: {
	searchParams: Promise<{ prompt?: string }>;
}) {
	const { prompt } = await searchParams;
	return <SelfTalkPlayer initialPromptId={prompt ?? null} />;
}
