"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { slipLine, unitInfo, type CaseTableCell, type CaseTableRow, type UnitId } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

const NUMBER_LABEL = { singular: "Singular", plural: "Plural" } as const;

export function CaseTable({ rows }: { rows: CaseTableRow[] }) {
	const lang = useActiveLanguage();
	const first = rows.flatMap((r) => r.cells).find((c) => c.unit) ?? rows[0]?.cells[0] ?? null;
	const [selected, setSelected] = useState<CaseTableCell | null>(first);
	const selectedRow = selected ? rows.find((r) => r.tag === selected.case) : undefined;
	const lesson = selected?.unit ? unitInfo(selected.unit as UnitId) : null;

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
				<p className="q-line dim mt-2 max-w-2xl">
					Every case of {lang?.english ?? "the language"}, in the singular and the plural. A cell with a percentage or <span className="font-semibold text-foreground">not tried</span> opens its lesson; the percentage is how often you were right on the first try, with no help. A grey cell says why it has no lesson. Point at a cell to read its rule.
				</p>

				{rows.length === 0 ? (
					<p className="q-line dim mt-6 max-w-2xl" data-testid="grammar-none">
						This course has no case lessons yet. Each grammar lesson in Curriculum carries its rule.
					</p>
				) : null}
				<table className="mt-8 w-full border-separate border-spacing-1.5 text-center" data-testid="grammar-cases">
					<thead>
						<tr>
							<th scope="col" className="p-0 text-left">
								<span className="sr-only">Case</span>
							</th>
							{(["singular", "plural"] as const).map((n) => (
								<th key={n} scope="col" className="w-[34%] p-1 pb-2 text-xs font-semibold text-ink-2">
									{NUMBER_LABEL[n]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.tag}>
								<th scope="row" className="p-1 text-left align-middle">
									<span className="block text-sm font-semibold text-foreground capitalize">{row.tag}</span>
									{row.native && (
										<span className="block text-xs text-ink-3" lang={lang?.code}>
											{row.native}
										</span>
									)}
								</th>
								{row.cells.map((cell) => (
									<Cell key={cell.number} cell={cell} selected={selected === cell} onSelect={setSelected} />
								))}
							</tr>
						))}
					</tbody>
				</table>

				<div className="q-card mt-6 min-h-24 p-5" data-testid="grammar-rule" aria-live="polite">
					{selected && selectedRow ? (
						<>
							<p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">
								<span className="capitalize">{selectedRow.tag}</span> {selected.number}
								{selectedRow.native && (
									<span className="font-normal text-ink-3" lang={lang?.code}>
										{" "}
										· {selectedRow.native}
									</span>
								)}
							</p>
							{selectedRow.means && <p className="mt-1 text-sm text-ink-3">{selectedRow.means}</p>}
							{lesson ? (
								<>
									<p className="mt-3 text-base font-semibold text-foreground">{lesson.title}</p>
									<p className="mt-1 text-base text-ink-2">{lesson.rule}</p>
									<CellRecord cell={selected} />
								</>
							) : (
								<>
									<p className="mt-3 text-base text-ink-2">{selected.noDrill?.why}</p>
									{selected.tutor && (
										<p className="mt-2 text-sm text-ink-3">
											Practiced with the tutor in{" "}
											<Link href="/curriculum" className="font-semibold text-teal-2 underline decoration-teal-line underline-offset-4 hover:text-teal">
												Curriculum
											</Link>
											: {selected.tutor.title}.
										</p>
									)}
								</>
							)}
						</>
					) : (
						<p className="text-base text-ink-3">Point at a cell to read its rule.</p>
					)}
				</div>
			</main>
		</div>
	);
}

function CellRecord({ cell }: { cell: CaseTableCell }) {
	const wrong = slipLine(cell.slips);
	return (
		<div className="mt-3 flex flex-col gap-1 text-sm text-ink-3">
			{cell.reps > 0 ? (
				<p>
					First tries: {cell.right} of {cell.reps} right
					{cell.accents > 0 ? `, ${cell.accents} with only an accent missing` : ""}.
				</p>
			) : (
				<p>No first tries here yet.</p>
			)}
			{wrong && <p>Wrong on the first try: {wrong}.</p>}
			{cell.unit && (
				<p className="mt-1">
					<Link href={`/lesson?unit=${cell.unit}`} className="text-sm font-semibold text-teal-2 underline decoration-teal-line underline-offset-4 hover:text-teal">
						Practice this lesson →
					</Link>
				</p>
			)}
		</div>
	);
}

function Cell({ cell, selected, onSelect }: { cell: CaseTableCell; selected: boolean; onSelect: (c: CaseTableCell) => void }) {
	const base = "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 transition-colors";
	const testId = `cell-${cell.case}-${cell.number}`;
	const select = {
		onMouseEnter: () => onSelect(cell),
		onFocus: () => onSelect(cell),
		onTouchStart: () => onSelect(cell),
		onClick: () => onSelect(cell),
	};
	if (!cell.unit) {
		return (
			<td className="p-0 align-middle">
				<div className={cn(base, "cursor-default", selected ? "shadow-[inset_0_0_0_1.5px_var(--q-line-2)]" : "shadow-[inset_0_0_0_1px_var(--q-line)]")} tabIndex={0} data-testid={testId} {...select}>
					<span className="text-sm text-ink-3">{cell.noDrill?.short}</span>
				</div>
			</td>
		);
	}
	return (
		<td className="p-0 align-middle">
			<Link
				href={`/lesson?unit=${cell.unit}`}
				className={cn(base, selected ? "bg-teal-wash shadow-[inset_0_0_0_1.5px_var(--q-teal)]" : "bg-card shadow-raise hover:bg-well")}
				data-testid={testId}
				title={cell.reps > 0 ? `${cell.right} of ${cell.reps} right on the first try` : "No first tries yet"}
				{...select}
			>
				{cell.accuracy === null ? (
					<span className="text-sm text-ink-3">not tried</span>
				) : (
					<>
						<span className={cn("text-sm font-bold tabular-nums", cell.accuracy >= 0.8 ? "text-teal-2" : "text-foreground")}>{Math.round(cell.accuracy * 100)}%</span>
						<span className="text-xs text-ink-3 tabular-nums">
							{cell.reps} first {cell.reps === 1 ? "try" : "tries"}
						</span>
					</>
				)}
			</Link>
		</td>
	);
}
