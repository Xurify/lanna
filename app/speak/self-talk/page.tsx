import { SelfTalkPlayer } from "@/components/speak/self-talk-player";
import { LAYOUTS, chosen, harnessGroups } from "@/components/speak/variants/harness";
import { VariantPicker } from "@/components/variant-picker";

export const metadata = { title: "Guided Self-Talk" };

export const dynamic = "force-dynamic";

export default async function SelfTalkPage({
	searchParams,
}: {
	searchParams: Promise<{ prompt?: string; __variant?: string; __motion?: string }>;
}) {
	const { prompt, __variant, __motion } = await searchParams;
	return (
		<>
			<SelfTalkPlayer initialPromptId={prompt ?? null} layout={chosen(LAYOUTS.solo, __variant)} />
			<VariantPicker groups={harnessGroups("solo", __variant, __motion)} />
		</>
	);
}
