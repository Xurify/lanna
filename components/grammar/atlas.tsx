"use client";

/**
 * /grammar — the grammar atlas (LangHarness, phase 4). Six cases down the
 * side, three genders across the top; each cell is the drill that teaches
 * it, showing the learner's first-try accuracy (or "not yet"). Pointing at a
 * cell — hover, focus or press — shows the unit's rule under the table, and
 * what the learner got wrong there; the cell itself opens the drill. The
 * rule panel is always on the page, so pointing at cells never shifts the
 * layout.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { ATLAS_CASES, ATLAS_GENDERS, slipLine, unitInfo, type AtlasCell } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

const cellKey = (row: AtlasCell["row"], col: AtlasCell["col"]) => `${row}-${col}`;

export function GrammarAtlas({ initial }: { initial: AtlasCell[] | null }) {
	const lang = useActiveLanguage();
	const cells = initial ?? [];
	const byKey = new Map(cells.map((c) => [cellKey(c.row, c.col), c]));
	// The first mapped cell starts selected, so the rule panel is never empty.
	const first = cells.find((c) => c.unit) ?? null;
	const [selected, setSelected] = useState<AtlasCell | null>(first);
	const sel = selected?.unit ? unitInfo(selected.unit) : null;

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16" data-testid="grammar">
				<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Grammar</h1>
				{!first ? (
					<p className="q-line dim mt-2 max-w-2xl" data-testid="grammar-none">
						The case and gender table is built for Slovak only. For the language you are learning now, each grammar
						lesson in Curriculum carries its rule.
					</p>
				) : (
					<>
						<p className="q-line dim mt-2 max-w-2xl">
							Each cell is one drill, and the percentage is how often you were right on the first try, with no help.
							Point at a cell to read its rule and what went wrong, then click it to practice.{" "}
							<span className="font-semibold text-foreground">Not tried</span> means the drill is there and you have not
							done it. A grey cell with a reason in it, like{" "}
							<span className="font-semibold text-foreground">dictionary form</span>, has no drill because the word does
							not change.
						</p>

						<table className="mt-8 w-full border-separate border-spacing-1.5 text-center" data-testid="grammar-atlas">
							<thead>
								<tr>
									<th scope="col" className="w-28 p-0">
										<span className="sr-only">Case</span>
									</th>
									{ATLAS_GENDERS.map((g) => (
										<th key={g.id} scope="col" className="p-1 pb-2 text-xs font-semibold text-ink-2">
											<span className="block capitalize">{g.english}</span>
											<span className="block font-normal text-ink-3" lang={lang?.code}>
												{g.slovak}
											</span>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{ATLAS_CASES.map((row) => (
									<tr key={row.case}>
										<th scope="row" className="p-1 text-left align-middle">
											<span className="block text-sm font-semibold text-foreground capitalize">{row.english}</span>
											<span className="block text-xs text-ink-3" lang={lang?.code}>
												{row.slovak}
											</span>
										</th>
										{ATLAS_GENDERS.map((g) => {
											const cell = byKey.get(cellKey(row.case, g.id))!;
											return <Cell key={g.id} cell={cell} selected={selected === cell} onSelect={setSelected} />;
										})}
									</tr>
								))}
							</tbody>
						</table>

						{/* The selected cell's rule; a fixed region, so pointing around never shifts the page. */}
						<div className="q-card mt-6 min-h-24 p-5" data-testid="grammar-rule" aria-live="polite">
							{sel && selected ? (
								<>
									<p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">{sel.title}</p>
									<p className="mt-1.5 text-base text-ink-2">{sel.rule}</p>
									<CellRecord cell={selected} />
								</>
							) : selected?.noDrill ? (
								<>
									<p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">
										{selected.noDrill.short}
									</p>
									<p className="mt-1.5 text-base text-ink-2">{selected.noDrill.why}</p>
								</>
							) : (
								<p className="text-base text-ink-3">Point at a cell to read its rule.</p>
							)}
						</div>
					</>
				)}
			</main>
		</div>
	);
}

/** The selected cell's first-try record: how many were right, what the wrong
 *  ones got wrong, and what was said wrong in Speak. */
function CellRecord({ cell }: { cell: AtlasCell }) {
	const wrong = slipLine(cell.slips);
	const spoken = slipLine(cell.spoken);
	if (cell.reps === 0 && !spoken) return <p className="mt-3 text-sm text-ink-3">No first tries here yet.</p>;
	return (
		<div className="mt-3 flex flex-col gap-1 text-sm text-ink-3">
			{cell.reps > 0 && (
				<p>
					First tries: {cell.right} of {cell.reps} right
					{cell.accents > 0 ? `, ${cell.accents} with only an accent missing` : ""}.
				</p>
			)}
			{wrong && <p>Wrong on the first try: {wrong}.</p>}
			{spoken && <p>Said wrong in Speak: {spoken}.</p>}
			{cell.unit && (
				<p className="mt-1">
					<Link
						href={`/lesson?unit=${cell.unit}&gender=${cell.col}`}
						className="text-sm font-semibold text-teal-2 underline decoration-teal-line underline-offset-4 hover:text-teal"
					>
						Drill this form ({ATLAS_GENDERS.find((g) => g.id === cell.col)?.english ?? cell.col}) →
					</Link>
				</p>
			)}
		</div>
	);
}

/** One cell: a link to its drill showing the first-try accuracy (or "not
 *  tried"), or a quiet cell that says why there is no drill. */
function Cell({ cell, selected, onSelect }: { cell: AtlasCell; selected: boolean; onSelect: (c: AtlasCell) => void }) {
	const base = "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 transition-colors";
	if (!cell.unit) {
		const reason = cell.noDrill!;
		return (
			<td className="p-0 align-middle">
				<div
					className={cn(
						base,
						"cursor-default",
						selected ? "shadow-[inset_0_0_0_1.5px_var(--q-line-2)]" : "shadow-[inset_0_0_0_1px_var(--q-line)]",
					)}
					tabIndex={0}
					data-testid={`cell-${cell.row}${cell.col}`}
					onMouseEnter={() => onSelect(cell)}
					onFocus={() => onSelect(cell)}
					onTouchStart={() => onSelect(cell)}
					onClick={() => onSelect(cell)}
				>
					<span className="text-sm text-ink-3">{reason.short}</span>
					{reason.sub && <span className="text-xs text-ink-4">{reason.sub}</span>}
				</div>
			</td>
		);
	}
	const cls = cn(
		base,
		selected ? "bg-teal-wash shadow-[inset_0_0_0_1.5px_var(--q-teal)]" : "bg-card shadow-raise hover:bg-well",
	);
	const inner =
		cell.accuracy === null ? (
			<span className="text-sm text-ink-3">not tried</span>
		) : (
			<span className={cn("text-sm font-bold tabular-nums", cell.accuracy >= 0.8 ? "text-teal-2" : "text-foreground")}>
				{Math.round(cell.accuracy * 100)}%
			</span>
		);
	return (
		<td className="p-0 align-middle">
			<Link
				href={`/lesson?unit=${cell.unit}&gender=${cell.col}`}
				className={cls}
				data-testid={`cell-${cell.row}${cell.col}`}
				onMouseEnter={() => onSelect(cell)}
				onFocus={() => onSelect(cell)}
				onTouchStart={() => onSelect(cell)}
				onClick={() => onSelect(cell)}
				title={cell.reps > 0 ? `${cell.right} of ${cell.reps} right on the first try` : "No first tries yet"}
			>
				{inner}
				{cell.accuracy === null ? null : (
					<span className="text-xs text-ink-3 tabular-nums">
						{cell.reps} first {cell.reps === 1 ? "try" : "tries"}
					</span>
				)}
			</Link>
		</td>
	);
}
