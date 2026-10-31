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

const cellKey = (row: AtlasCell["row"], col: AtlasCell["col"]) => `${row}-${col}`;

export function GrammarAtlas({ initial }: { initial: AtlasCell[] | null }) {
	const cells = initial ?? [];
	const byKey = new Map(cells.map((c) => [cellKey(c.row, c.col), c]));
	// The first mapped cell starts selected, so the rule panel is never empty.
	const first = cells.find((c) => c.unit) ?? null;
	const [selected, setSelected] = useState<AtlasCell | null>(first);
	const sel = selected?.unit ? unitInfo(selected.unit) : null;

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="relative flex items-center gap-2 px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16" data-testid="grammar">
				<Link href="/" className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<ArrowLeftIcon className="size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 font-ui text-3xl font-black tracking-tight text-foreground">Grammar</h1>
				<p className="mt-2 max-w-2xl font-prose text-base text-muted-foreground">
					Each cell is one drill, and the percentage is how often you were right on the first try, with no help. Point at a cell to read its rule and what went wrong, then click it to practise.{" "}
					<span className="text-foreground">Not yet</span> means you have not tried it, or there is no drill for it yet.
				</p>

				<table className="mt-8 w-full border-separate border-spacing-1.5 text-center" data-testid="grammar-atlas">
					<thead>
						<tr>
							<th scope="col" className="w-24 p-0">
								<span className="sr-only">Case</span>
							</th>
							{ATLAS_GENDERS.map((g) => (
								<th key={g.id} scope="col" className="p-1 pb-2 font-ui text-xs font-bold text-muted-foreground" title={g.english} lang="sk">
									{g.slovak}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{ATLAS_CASES.map((row) => (
							<tr key={row.case}>
								<th scope="row" className="p-1 text-left align-middle" title={row.english}>
									<span className="font-ui text-base font-black text-foreground">{row.case}</span>
									<span className="ml-1.5 font-ui text-xs text-muted-foreground" lang="sk">
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
				<div className="mt-6 min-h-24 rounded-2xl border-2 border-border bg-card p-5" data-testid="grammar-rule" aria-live="polite">
					{sel && selected ? (
						<>
							<p className="font-ui text-base font-bold text-foreground">{sel.title}</p>
							<p className="mt-1.5 font-prose text-base text-muted-foreground">{sel.rule}</p>
							<CellRecord cell={selected} />
						</>
					) : (
						<p className="font-prose text-base text-muted-foreground">No drill for this cell yet.</p>
					)}
				</div>
			</main>
		</div>
	);
}

/** The selected cell's first-try record: how many were right, what the wrong
 *  ones got wrong, and what was said wrong in Speak. */
function CellRecord({ cell }: { cell: AtlasCell }) {
	const wrong = slipLine(cell.slips);
	const spoken = slipLine(cell.spoken);
	if (cell.reps === 0 && !spoken) return <p className="mt-3 font-prose text-sm text-muted-foreground">No first tries here yet.</p>;
	return (
		<div className="mt-3 flex flex-col gap-1 font-prose text-sm text-muted-foreground">
			{cell.reps > 0 && (
				<p>
					First tries: {cell.right} of {cell.reps} right
					{cell.accents > 0 ? `, ${cell.accents} with only an accent missing` : ""}.
				</p>
			)}
			{wrong && <p>Wrong on the first try: {wrong}.</p>}
			{spoken && <p>Said wrong in Speak: {spoken}.</p>}
		</div>
	);
}

/** One cell: a link to its drill, showing the first-try accuracy — or "not
 *  yet", while no first try has been counted (or no drill exists). */
function Cell({ cell, selected, onSelect }: { cell: AtlasCell; selected: boolean; onSelect: (c: AtlasCell) => void }) {
	const inner = cell.unit ? (
		cell.accuracy === null ? (
			<span className="text-sm text-muted-foreground">not yet</span>
		) : (
			<span className={cn("text-sm font-bold tabular-nums", cell.accuracy >= 0.8 ? "text-go" : "text-foreground")}>{Math.round(cell.accuracy * 100)}%</span>
		)
	) : (
		<span className="text-sm text-muted-foreground/60">not yet</span>
	);
	const cls = cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 transition-colors", selected ? "border-foreground/40 bg-accent" : "bg-card hover:bg-accent");
	if (!cell.unit) {
		return (
			<td className="p-0 align-middle">
				<div className={cn(cls, "cursor-default")} data-testid={`cell-${cell.row}${cell.col}`}>
					{inner}
				</div>
			</td>
		);
	}
	return (
		<td className="p-0 align-middle">
			<Link
				href={`/lesson?unit=${cell.unit}`}
				className={cls}
				data-testid={`cell-${cell.row}${cell.col}`}
				onMouseEnter={() => onSelect(cell)}
				onFocus={() => onSelect(cell)}
				onTouchStart={() => onSelect(cell)}
				onClick={() => onSelect(cell)}
				title={cell.reps > 0 ? `${cell.right} of ${cell.reps} right on the first try` : "No first tries yet"}
			>
				{inner}
				{cell.accuracy === null ? null : <span className="text-xs text-muted-foreground tabular-nums">{cell.reps} first {cell.reps === 1 ? "try" : "tries"}</span>}
			</Link>
		</td>
	);
}
