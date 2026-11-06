/**
 * Today's line on Today (LangHarness, 2026-11-06; docs/research/creator-hooks.md,
 * proposal 1). A row, not a card: the plan's next step keeps the one Start on
 * the page (E4a), and the row only says where the day's line stands and opens
 * it. Same anatomy as a plan row, so the page stays one kind of thing.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import { lineRow, type LineState } from "@/src/core";

const ROW = "flex w-full items-center gap-3 rounded-[10px] bg-well px-3.5 py-2.5 text-left";

export function TodayLineRow({ line }: { line: LineState }) {
	const row = lineRow({
		hasLine: line.item !== null,
		morning: line.morning ? { caught: line.morning.caught, words: line.morning.words } : null,
		evening: line.evening ? { caught: line.evening.caught, words: line.evening.words } : null,
		eveningOpen: line.eveningOpen,
	});
	const inner = (
		<>
			<QIcon name="ear" className={cn("shrink-0", row.tone === "open" ? "text-teal" : "text-ink-3")} />
			<span className="min-w-0 flex-1">
				<span className="block text-[15px] font-[550] tracking-[-0.006em] text-foreground">Today&apos;s line</span>
				<span className="block truncate text-[13px] text-ink-3">{row.line}</span>
			</span>
			<span className={cn("q-pill shrink-0", row.tone !== "open" && "grey")}>{row.pill}</span>
			{row.tone !== "none" && <QIcon name="chev" className="shrink-0 text-ink-4" />}
		</>
	);
	if (row.tone === "none") {
		return (
			<div className={ROW} data-testid="today-line-row">
				{inner}
			</div>
		);
	}
	return (
		<Link href="/line" className={cn(ROW, "hover:bg-well-2")} data-testid="today-line-row" aria-label={`Today's line: ${row.pill}`}>
			{inner}
		</Link>
	);
}
