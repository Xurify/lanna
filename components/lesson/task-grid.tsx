"use client";

import type { LessonTask } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

type GridTask = Extract<LessonTask, { kind: "grid" }>;

/** Every cell and label is the same height, and the notes sit in one caption
 *  line of reserved height, so revealing the grid does not move anything (E4).
 *  The classes are the same in both states; only the content changes.
 *
 *  The tenses are the rows and the two aspects the columns. At 16 px a form
 *  such as pripravujem is 92 px wide, which three cell columns on a 390 px
 *  screen cannot hold; two columns of about 110 px hold every form. */
const HEAD = "px-2 pb-1 font-ui text-[13px] font-[550] capitalize text-ink-3";
const LABEL = "h-14 px-2 align-middle text-left font-ui text-[13px] font-[550] capitalize text-ink-3";
const CELL = "h-14 rounded-[10px] bg-well px-2 align-middle";
const FORM = "font-prose text-[16px] font-semibold text-foreground sm:text-[18px]";
/** The asked cell: weight and the teal token, with the straight underline E33 asks for. */
const ASKED =
	"font-prose text-[16px] font-bold text-teal-2 underline decoration-2 underline-offset-[7px] sm:text-[18px]";
const CAPTION = "mt-2 min-h-10 font-ui text-[12px] leading-snug text-ink-3";

/** The aspect grid of a form-reading task (src/core/aspect-tasks.ts). Until the
 *  rep is answered the cells are empty and only their labels show, so the
 *  learner places the form by choosing a cell label among the options. Once
 *  answered the cells fill with their forms, the asked cell is marked, and the
 *  notes appear in the caption. Nothing about a cell's form reaches the page
 *  before the answer. */
export function TaskGrid({ task, revealed }: { task: GridTask; revealed: boolean }) {
	const lang = useActiveLanguage();
	const notes = revealed ? [...new Set(task.cells.flatMap((c) => (c.note ? [c.note] : [])))] : [];
	return (
		<div className="mt-5">
			<table
				className="w-full table-fixed border-separate border-spacing-1.5 text-left"
				data-testid="task-grid"
				data-revealed={revealed ? "true" : "false"}
			>
				<colgroup>
					<col className="w-[24%]" />
					{task.rows.map((row) => (
						<col key={row} className="w-[38%]" />
					))}
				</colgroup>
				<thead>
					<tr>
						<th scope="col" className="sr-only">
							Tense
						</th>
						{task.rows.map((row) => (
							<th key={row} scope="col" className={HEAD}>
								{row}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{task.cols.map((col, c) => (
						<tr key={col}>
							<th scope="row" className={LABEL}>
								{col}
							</th>
							{task.rows.map((_, r) => {
								const cell = task.cells.find((x) => x.row === r && x.col === c);
								const asked = revealed && task.target.row === r && task.target.col === c;
								return (
									<td key={r} className={CELL} data-asked={asked ? "true" : undefined}>
										{revealed ? (
											cell?.form ? (
												<span className={asked ? ASKED : FORM} lang={lang?.code}>
													{cell.form}
												</span>
											) : (
												<span className="text-ink-4">—</span>
											)
										) : (
											<span className="sr-only">empty cell</span>
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
			<p className={CAPTION} data-testid="task-grid-caption">
				{notes.join(" · ")}
			</p>
		</div>
	);
}
