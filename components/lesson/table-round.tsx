"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { COLUMN, Dock, PracticeCard } from "@/components/task-frame";
import { KBD, PRIMARY, QUIET } from "@/components/ui/learn-buttons";
import { Input } from "@/components/ui/input";
import { useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { compareAnswer, tableBlanks, unitInfo, type AnswerVerdict, type UnitId, type VerbPattern } from "@/src/core";

export function TableRound({ unit, pattern, onDone }: { unit: UnitId; pattern: VerbPattern; onDone: () => void }) {
	const lang = useActiveLanguage();
	const tag = lang?.tag ?? "sk-SK";
	const blanks = tableBlanks(pattern, unit === "past");
	const [given, setGiven] = useState<string[]>(() => blanks.map(() => ""));
	const [verdicts, setVerdicts] = useState<AnswerVerdict[] | null>(null);
	const first = useRef<HTMLInputElement>(null);
	const finish = useRef<HTMLButtonElement>(null);
	const right = verdicts?.filter((v) => v !== "wrong").length ?? 0;
	const exact = verdicts?.filter((v) => v === "exact").length ?? 0;

	useEffect(() => first.current?.focus({ preventScroll: true }), []);

	const check = () => {
		if (verdicts) return onDone();
		const out = blanks.map((b, i) => compareAnswer(b.answer, given[i] ?? "", tag));
		setVerdicts(out);
		if (out.every((v) => v === "exact")) sfx.right(3);
		else if (out.some((v) => v === "wrong")) sfx.wrong();
		else sfx.almost();
		requestAnimationFrame(() => finish.current?.focus({ preventScroll: true }));
	};

	const blankAt = (row: number, form: number) => blanks.findIndex((b) => b.row === row && b.form === form);

	return (
		<form
			className="flex flex-1 flex-col"
			onSubmit={(e) => {
				e.preventDefault();
				check();
			}}
		>
			<div className={cn(COLUMN, "lanna-rise flex flex-1 flex-col")} data-testid="table-round">
				<PracticeCard
					icon="rule"
					title={unitInfo(unit).title}
					sub="Fill in the table"
					right={verdicts ? `${right} of ${blanks.length}` : undefined}
				>
					<h2 className="flex items-baseline gap-2.5">
						<span className="font-prose text-[24px] font-semibold tracking-[-0.02em] text-foreground" lang={lang?.code}>
							{pattern.verb}
						</span>
						<span className="font-ui text-[13px] text-ink-3">{pattern.gloss}</span>
					</h2>
					<ul className="mt-2 max-w-md divide-y divide-[var(--q-line)]">
						{pattern.rows.map((row, r) => (
							<li
								key={row.who}
								className="grid grid-cols-[7.5rem_1fr] items-center gap-3 py-1.5 sm:grid-cols-[9rem_1fr]"
							>
								<span className="font-ui text-[13px] text-ink-3">
									<span lang={lang?.code}>{row.who}</span>
									<span className="block text-[12px] text-ink-4">{row.en}</span>
								</span>
								<span
									className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-prose text-[19px] text-foreground"
									lang={lang?.code}
								>
									{row.forms.map((f, i) => {
										const at = blankAt(r, i);
										const sep = i < row.forms.length - 1 && <span className="text-ink-4">·</span>;
										if (at < 0)
											return (
												<span key={i} className="inline-flex items-center gap-1.5">
													<span className="whitespace-nowrap">
														{f.stem}
														<span className="font-semibold text-teal-2">{f.ending}</span>
														{f.tail && <span className="text-ink-2"> {f.tail}</span>}
													</span>
													{sep}
												</span>
											);
										const verdict = verdicts?.[at];
										return (
											<span key={i} className="inline-flex items-center gap-1.5">
												{verdict && verdict !== "exact" ? (
													<span className="whitespace-nowrap" data-testid="table-correction">
														<s className={verdict === "wrong" ? "text-miss" : "text-ink-3"}>{given[at] || "–"}</s>{" "}
														<b className="font-semibold text-teal-2">{blanks[at]!.answer}</b>
													</span>
												) : (
													<Input
														ref={at === 0 ? first : undefined}
														value={given[at]}
														readOnly={!!verdicts}
														aria-label={`${pattern.verb}, ${row.en}`}
														autoComplete="off"
														autoCapitalize="off"
														spellCheck={false}
														lang={lang?.code}
														data-testid="table-input"
														onChange={(e) => setGiven((g) => g.map((v, j) => (j === at ? e.target.value : v)))}
														className={cn(
															"h-11 w-28 px-3 font-prose text-[18px] sm:w-36 md:text-[18px]",
															verdict === "exact" && "bg-teal-wash text-teal-2 ring-teal",
														)}
													/>
												)}
												{f.tail && <span className="text-ink-2">{f.tail}</span>}
												{sep}
											</span>
										);
									})}
								</span>
							</li>
						))}
					</ul>
					<p role="status" className="mt-4 min-h-5 font-ui text-[13px] text-ink-3">
						{!verdicts
							? "Type the missing forms."
							: exact === blanks.length
								? "All right."
								: right === blanks.length
									? "All right, but check the accents: the correct forms are marked."
									: `${right} of ${blanks.length} right. The correct forms are marked.`}
					</p>
				</PracticeCard>
			</div>
			<Dock>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 pointer-fine:flex">
						<kbd className={KBD}>Enter</kbd> {verdicts ? "to finish" : "to check"}
					</p>
					<div className="flex flex-1 justify-end gap-3">
						{!verdicts && (
							<button type="button" onClick={onDone} className={QUIET} data-testid="table-skip">
								Skip
							</button>
						)}
						<button ref={finish} type="submit" className={PRIMARY} data-testid="table-check">
							{verdicts ? "Finish" : "Check"}
						</button>
					</div>
				</div>
			</Dock>
		</form>
	);
}
