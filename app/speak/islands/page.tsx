import { VariantPicker } from "@/components/variant-picker";
import { LAYOUTS, chosen, harnessGroups } from "@/components/speak/variants/harness";
import { IslandsPage } from "@/components/speak/islands/islands-page";
import type { IslandPageData } from "@/src/core";
import { islandPage, liveAvailabilityNow } from "@/src/server";

export const metadata = { title: "Language islands" };

export const dynamic = "force-dynamic";

export default async function IslandsRoute({
	searchParams,
}: {
	searchParams: Promise<{ id?: string; __variant?: string; __motion?: string }>;
}) {
	const { id, __variant, __motion } = await searchParams;
	let page: IslandPageData | null = null;
	try {
		page = islandPage();
	} catch {
		page = null;
	}
	if (!page) {
		return (
			<div className="mx-auto max-w-3xl px-5 pt-8 pb-24">
				<h1 className="font-ui text-[32px] font-[600] tracking-[-0.33px] text-foreground">Language islands</h1>
				<p className="mt-2 font-prose text-[15px] text-ink-2">The islands could not be read from disk.</p>
			</div>
		);
	}
	return (
		<>
			<IslandsPage
				initial={page}
				initialId={id ?? null}
				live={liveAvailabilityNow()}
				layout={chosen(LAYOUTS.islands, __variant)}
			/>
			<VariantPicker groups={harnessGroups("islands", __variant, __motion)} />
		</>
	);
}
