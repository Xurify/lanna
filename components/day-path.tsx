"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { QCheck } from "@/components/quiet/icon";
import { taskLabel, words } from "@/components/quiet/day-rail";
import { CountryFlag } from "@/components/ui/country-flag";
import type { DayLanguage, PlanTask } from "@/src/core";

export interface PlanStep {
	key: string;
	/** The language it is in, when the day spans several. */
	lang: DayLanguage | null;
	/** Null: the language is not set up yet, and this step is its setup. */
	task: PlanTask | null;
	minutes: number;
	done: boolean;
}

export interface PlanGroup {
	lang: DayLanguage;
	steps: PlanStep[];
}

function stepTitle(x: PlanStep): string {
	return x.task ? words(x.task).primary : `Set up ${x.lang?.english ?? ""}`;
}

function stepLabel(x: PlanStep): string {
	return x.task ? taskLabel(x.task) : "Setup";
}

export function DayPath({
	groups,
	steps,
	up,
	busy,
	onStart,
	renderNext,
}: {
	groups: PlanGroup[] | null;
	steps: PlanStep[];
	up: PlanStep | null;
	busy: boolean;
	onStart: (x: PlanStep) => void;
	renderNext: (x: PlanStep) => React.ReactNode;
}) {
	const stops: Array<{ lang: DayLanguage | null; steps: PlanStep[] }> = groups ?? [{ lang: null, steps }];
	const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});
	const [doneShown, setDoneShown] = useState<Record<string, boolean>>({});

	return (
		<div data-testid="plan-tasks">
			{stops.map((stop, i) => {
				const id = stop.lang?.id ?? "plan";
				const holdsNext = up !== null && stop.steps.includes(up);
				const foldable = stop.lang !== null && !holdsNext && !(stop.lang.running && !up);
				const open = !foldable || Boolean(unfolded[id]);
				const last = i === stops.length - 1;
				const doneCount = stop.steps.filter((x) => x.done).length;
				const minutesLeft = stop.steps.filter((x) => !x.done).reduce((n, x) => n + x.minutes, 0);
				const listId = `plan-path-${id}`;
				return (
					<section
						key={id}
						className="relative pl-9"
						data-testid={stop.lang ? `plan-lang-${stop.lang.id}` : undefined}
						aria-label={stop.lang?.english}
					>
						<span
							aria-hidden="true"
							className={cn(
								"absolute top-0 left-[11px] w-0.5 bg-[var(--q-line-2)]",
								last && !open ? "h-4" : last ? "bottom-5" : "bottom-0",
							)}
						/>
						{stop.lang && (
							<div className="relative mb-2 flex min-h-11 items-center gap-2.5">
								<span className="absolute top-2.5 -left-9 grid size-6 place-items-center rounded-full bg-background shadow-[0_0_0_2px_var(--q-line-2)]">
									<CountryFlag lang={stop.lang.id} className="size-4 rounded-full" />
								</span>
								<h3 className="cap-center text-[15px] font-semibold tracking-[-0.01em]">{stop.lang.english}</h3>
								<span className="q-num cap-center min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap text-[12.5px] text-ink-3">
									{doneCount} of {stop.steps.length} done · {minutesLeft} min left
								</span>
								{foldable && (
									<button
										type="button"
										aria-expanded={open}
										aria-controls={listId}
										onClick={() => setUnfolded((u) => ({ ...u, [id]: !u[id] }))}
										className="lanna-press ml-auto inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[12.5px] font-[550] text-ink-2 hover:bg-well hover:text-foreground pointer-coarse:h-11"
									>
										{open ? "Hide tasks" : "Show tasks"}
									</button>
								)}
							</div>
						)}
						{open && (
							<ol id={listId} className={cn(!last && "pb-5")}>
								{doneCount > 0 && (
									<li className="relative">
										<span
											aria-hidden="true"
											className="absolute top-[11px] -left-[31px] grid size-3.5 place-items-center rounded-full bg-teal"
										>
											<QCheck className="size-2.5 [fill:none] [stroke:var(--q-on-teal)] [stroke-width:3]" />
										</span>
										<button
											type="button"
											aria-expanded={Boolean(doneShown[id])}
											onClick={() => setDoneShown((d) => ({ ...d, [id]: !d[id] }))}
											className="lanna-press -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-[550] text-teal-2 hover:bg-well pointer-coarse:py-3"
										>
											{doneCount} done
											<span className="font-[450] text-ink-3">· {doneShown[id] ? "hide" : "show"}</span>
										</button>
									</li>
								)}
								{stop.steps
									.filter((x) => !x.done || doneShown[id])
									.map((x) =>
										x === up ? (
											<li key={x.key} className="relative my-2" data-testid={`plan-${x.key}`} data-next="true">
												<span
													aria-hidden="true"
													className="absolute top-5 -left-[30px] size-3.5 rounded-full bg-teal shadow-[0_0_0_4px_var(--q-teal-wash)]"
												/>
												{renderNext(x)}
											</li>
										) : (
											<li key={x.key} className="relative" data-testid={`plan-${x.key}`}>
												<span
													aria-hidden="true"
													className={cn(
														"absolute top-[15px] -left-[29px] size-2.5 rounded-full",
														x.done ? "bg-teal" : "bg-background shadow-[inset_0_0_0_2px_var(--q-box)]",
													)}
												/>
												<button
													type="button"
													disabled={busy}
													onClick={() => onStart(x)}
													className="-ml-2 flex w-[calc(100%+8px)] items-baseline gap-3 rounded-lg px-2 py-2 text-left hover:bg-well pointer-coarse:py-3"
												>
													<span
														className={cn(
															"min-w-0 flex-1 truncate text-[14.5px]",
															x.done ? "text-ink-3 line-through decoration-[var(--q-dash)]" : "text-foreground",
														)}
														title={stepTitle(x)}
													>
														{stepTitle(x)}
													</span>
													<span className="shrink-0 text-[12px] text-ink-3 @max-sm:hidden">{stepLabel(x)}</span>
													<span className="q-num w-11 shrink-0 text-right text-[12px] text-ink-3">{x.minutes} min</span>
													<span className="sr-only">{x.done ? "Done" : "To do"}</span>
												</button>
											</li>
										),
									)}
							</ol>
						)}
					</section>
				);
			})}
		</div>
	);
}
