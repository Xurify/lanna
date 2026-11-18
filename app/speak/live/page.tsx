import { VariantPicker } from "@/components/variant-picker";
import { LAYOUTS, chosen, harnessGroups } from "@/components/speak/variants/harness";
import { LivePage } from "@/components/speak/live-page";
import type { LivePageData } from "@/src/core";
import { islandPage, livePage } from "@/src/server";

export const metadata = { title: "Live talk" };

export const dynamic = "force-dynamic";

export default async function LiveRoute({
	searchParams,
}: {
	searchParams: Promise<{ scene?: string; island?: string; __variant?: string; __motion?: string }>;
}) {
	const { scene, island, __variant, __motion } = await searchParams;
	const picker = <VariantPicker groups={harnessGroups("live", __variant, __motion)} />;
	let page: LivePageData | null = null;
	try {
		page = livePage();
	} catch {
		page = null;
	}
	if (!page) {
		return (
			<div className="mx-auto max-w-3xl px-5 pt-8 pb-24">
				<h1 className="font-ui text-[32px] font-[600] tracking-[-0.33px] text-foreground">Live talk</h1>
				<p className="mt-2 font-prose text-[15px] text-ink-2">The live page could not be read.</p>
			</div>
		);
	}
	let target: { kind: "scene" | "island"; ref: string; title: string } | null = null;
	if (island) {
		const found = islandPage().islands.find((s) => s.island.id === island);
		if (found) target = { kind: "island", ref: found.island.id, title: found.island.topic };
	} else if (scene) {
		const found = page.scenes.find((s) => s.id === scene);
		if (found) target = { kind: "scene", ref: found.id, title: found.title };
	}
	return (
		<>
			<LivePage initial={page} target={target} layout={chosen(LAYOUTS.live, __variant)} />
			{picker}
		</>
	);
}
