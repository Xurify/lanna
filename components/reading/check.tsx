"use client";

/**
 * The comprehension check (2026-10-28) — shared by the Read
 * and Watch tasks: one Slovak question at a time, its kind named over
 * it, three or four options (keys 1–4), the right one spoken and marked,
 * Continue (Enter) to the next.
 */

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { QUESTION_KIND_INFO, type StoryQuestion } from "@/src/core";

const COLUMN = "mx-auto w-full max-w-3xl px-6";
const BUTTON =
	"inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-[600] transition-[filter,transform,background-color] active:scale-[0.98]";

export function Check({
	questions,
	answers,
	onAnswer,
}: {
	questions: StoryQuestion[];
	answers: number[];
	onAnswer: (i: number) => void;
}) {
	const lang = useActiveLanguage();
	const i = answers.length;
	const q = questions[i];
	const [picked, setPicked] = useState<number | null>(null);
	useEffect(() => setPicked(null), [i]);

	const pick = useCallback(
		(n: number) => {
			if (!q || picked !== null) return;
			setPicked(n);
			if (n === q.answer) sfx.right();
			else sfx.wrong();
			void speak(q.options[q.answer]!).catch(() => {});
		},
		[q, picked],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!q) return;
			const n = Number(e.key);
			if (picked === null && n >= 1 && n <= q.options.length) {
				e.preventDefault();
				pick(n - 1);
			} else if (picked !== null && e.key === "Enter") {
				e.preventDefault();
				onAnswer(picked);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [q, picked, pick, onAnswer]);

	if (!q) return null;
	const right = picked === q.answer;
	return (
		<>
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[9vh]">
				<div
					key={i}
					className={cn(COLUMN, "lh-rise")}
					data-testid="read-question"
					data-word-lookup-enabled={picked !== null ? "true" : "false"}
				>
					<p className="font-ui text-sm font-[600] text-muted-foreground">
						{QUESTION_KIND_INFO[q.kind ?? "recall"].label}
					</p>
					<h2 className="mb-6 mt-1 font-prose text-2xl font-semibold text-foreground" lang={lang?.code}>
						{q.q}
					</h2>
					<div className="grid gap-3">
						{q.options.map((o, n) => {
							const tone =
								picked === null
									? ""
									: n === q.answer
										? "border-teal bg-teal-wash"
										: n === picked
											? "border-miss bg-miss-soft"
											: "opacity-60";
							return (
								<button
									key={n}
									type="button"
									disabled={picked !== null}
									onClick={() => pick(n)}
									className={cn(
										"flex items-center gap-4 rounded-lg border bg-card px-5 py-4 text-left font-prose text-xl text-foreground transition-colors hover:shadow-raise-hi disabled:cursor-default",
										tone,
									)}
									data-testid="read-option"
									lang={lang?.code}
								>
									<kbd className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card font-ui text-xs font-[600] text-muted-foreground">
										{n + 1}
									</kbd>
									<span className="flex-1">{o}</span>
									{picked !== null && n === q.answer && <CheckIcon className="size-5 text-teal-2" strokeWidth={3} />}
									{picked !== null && n === picked && n !== q.answer && (
										<XIcon className="size-5 text-miss" strokeWidth={3} />
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>
			<div className={cn("border-t border-border", picked !== null && (right ? "bg-teal-wash" : "bg-miss-soft"))}>
				<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
					<p
						className={cn(
							"font-ui text-lg font-[600]",
							picked === null
								? "text-muted-foreground font-prose text-sm font-normal"
								: right
									? "text-teal-2"
									: "text-miss",
						)}
					>
						{picked === null ? (
							<>
								Pick one<span className="hidden pointer-fine:inline">, or press its number</span>
							</>
						) : right ? (
							"Presne tak!"
						) : (
							"Not quite — the right one is marked"
						)}
					</p>
					{picked !== null && (
						<button
							type="button"
							autoFocus
							onClick={() => onAnswer(picked)}
							className={cn(
								BUTTON,
								right ? "bg-teal text-teal-2-ink" : "bg-miss text-background",
								"hover:brightness-110",
							)}
							data-testid="read-continue"
						>
							{i + 1 >= questions.length ? "Finish" : "Continue"}
						</button>
					)}
				</div>
			</div>
		</>
	);
}
