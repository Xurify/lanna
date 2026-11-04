"use client";

import type { LessonTask } from "@/src/core";

type GridTask = Extract<LessonTask, { kind: "grid" }>;

/** The aspect grid of a form-reading task (src/core/aspect-tasks.ts). Until the
 *  rep is answered the cells are empty and only their labels show, so the
 *  learner places the form by choosing a cell label among the options. Once
 *  answered the cells fill with their forms and notes, and the asked cell is
 *  marked. Nothing about a cell's form reaches the page before the answer. */
export function TaskGrid({ task, revealed }: { task: GridTask; revealed: boolean }) {
	return (
		<div className="mt-5 overflow-x-auto">
			<table className="w-full border-separate border-spacing-1.5 text-left" data-testid="task-grid" data-revealed={revealed ? "true" : "false"}>
				<thead>
					<tr>
						<th scope="col" className="sr-only">
							Aspect
						</th>
						{task.cols.map((col) => (
							<th key={col} scope="col" className="px-2 pb-1 font-ui text-[13px] font-[550] capitalize text-ink-3">
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{task.rows.map((row, r) => (
						<tr key={row}>
							<th scope="row" className="px-2 py-2.5 align-top font-ui text-[13px] font-[550] capitalize text-ink-3">
								{row}
							</th>
							{task.cols.map((_, c) => {
								const cell = task.cells.find((x) => x.row === r && x.col === c);
								const asked = revealed && task.target.row === r && task.target.col === c;
								return (
									<td key={c} className="rounded-[10px] bg-well px-3 py-2.5 align-top" data-asked={asked ? "true" : undefined}>
										{revealed ? (
											<>
												{cell?.form ? (
													<span className={asked ? "font-prose text-[18px] font-bold text-foreground" : "font-prose text-[18px] font-semibold text-foreground"} lang="sk">
														{cell.form}
													</span>
												) : (
													<span className="text-ink-4">—</span>
												)}
												{cell?.note && <span className="mt-1 block font-ui text-[12px] leading-snug text-ink-3">{cell.note}</span>}
											</>
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
		</div>
	);
}
