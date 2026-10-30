"use client";

/**
 * The chapter exam (Skúška, phase 6a, E14): eight choose items drawn from
 * the chapter's own units, one at a time, keys 1–4 to answer, feedback on
 * each, then the result — score, what was missed, and a retry with a fresh
 * draw. The client sends only its picks; the server grades from the seed
 * and keeps the attempt on the record. Record only: nothing is gated yet.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/components/lesson/sound";
import { COLUMN, PRIMARY, SECONDARY, Stat, TaskFrame, TaskTop } from "@/components/task-frame";
import { EXAM_PASS_MARK, scoreExam, type ExamDraw } from "@/src/core";

type Phase = { state: "playing" } | { state: "saving" } | { state: "result"; correct: number; total: number; passed: boolean; misses: string[]; recorded: boolean };

export function ExamPlayer({ chapterId, title, initial }: { chapterId: string; title: string; initial: ExamDraw | null }) {
	const [draw, setDraw] = useState<ExamDraw | null>(initial);
	const [index, setIndex] = useState(0);
	const [picked, setPicked] = useState<number | null>(null);
	// The chosen option's index per item, sent to the server at the end.
	const [answers, setAnswers] = useState<number[]>([]);
	const [phase, setPhase] = useState<Phase>({ state: "playing" });

	const items = draw?.items ?? [];
	const item = items[Math.min(index, items.length - 1)];
	const empty = draw !== null && items.length === 0;

	const pick = useCallback(
		(choice: number) => {
			if (phase.state !== "playing" || picked !== null || !item) return;
			setPicked(choice);
			setAnswers((prev) => {
				const next = [...prev];
				next[index] = choice;
				return next;
			});
			if (item.options?.[choice] === item.answer) sfx.right(2);
			else sfx.wrong();
		},
		[phase, picked, item, index],
	);

	const next = useCallback(() => {
		if (phase.state !== "playing" || picked === null) return;
		if (index + 1 < items.length) {
			setIndex(index + 1);
			setPicked(null);
			return;
		}
		// The exam is over: grade locally for the screen, and send the picks
		// for the server's own grade from the seed — the record.
		const score = scoreExam(items, answers);
		setPhase({ state: "saving" });
		fetch("/api/exam", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chapter: chapterId, seed: draw!.seed, answers }) })
			.then((res) => (res.ok ? setPhase({ state: "result", ...score, recorded: true }) : setPhase({ state: "result", ...score, recorded: false })))
			.catch(() => setPhase({ state: "result", ...score, recorded: false }));
	}, [phase, picked, index, items, answers, chapterId, draw]);

	// A fresh draw for a retry.
	const retry = useCallback(() => {
		setPhase({ state: "saving" });
		fetch(`/api/exam?chapter=${chapterId}&seed=${Date.now()}`)
			.then((res) => res.json())
			.then((fresh: ExamDraw) => {
				setDraw(fresh);
				setIndex(0);
				setPicked(null);
				setAnswers([]);
				setPhase({ state: "playing" });
			})
			.catch(() => setPhase({ state: "playing" }));
	}, [chapterId]);

	// Keys 1–4 answer; Enter moves on after the feedback.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (phase.state !== "playing") return;
			const n = Number(e.key);
			if (n >= 1 && n <= (item?.options?.length ?? 0)) pick(n - 1);
			if ((e.key === "Enter" || e.key === " ") && picked !== null) {
				e.preventDefault();
				next();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pick, next, item, picked, phase]);

	if (!draw || empty) {
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto py-10")}>
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Skúška · {title}</p>
					<h1 className="mt-1 font-ui text-3xl font-black text-foreground">No exam yet</h1>
					<p className="mt-3 max-w-md font-prose text-base text-muted-foreground">
						This chapter has no word or drill units to draw an exam from. Everything else on the arc still works.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link href="/passport" className={PRIMARY}>
							<span className="font-ui">Passport</span>
						</Link>
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
					</div>
				</div>
			</TaskFrame>
		);
	}

	if (phase.state !== "playing") {
		const saving = phase.state === "saving";
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto overflow-y-auto py-10")} data-testid="exam-result">
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Skúška · {title}</p>
					<h1 className="mt-1 font-ui text-3xl font-black text-foreground">
						{"correct" in phase ? (phase.passed ? "Passed" : "Not passed") : "…"}
					</h1>
					{"correct" in phase && (
						<>
							<div className="mt-6 flex gap-8">
								<Stat label="Score" value={`${phase.correct}/${phase.total}`} ink={phase.passed ? "text-go" : "text-foreground"} />
								<Stat label="Pass mark" value={`${Math.round(EXAM_PASS_MARK * 100)}%`} ink="text-muted-foreground" />
								<Stat label="Recorded" value={saving ? "…" : phase.recorded ? "Yes" : "Not saved"} ink="text-muted-foreground" />
							</div>
							{phase.misses.length > 0 && (
								<div className="mt-8" data-testid="exam-misses">
									<p className="font-ui text-sm font-bold text-muted-foreground">Missed</p>
									<ul className="mt-3 flex flex-col gap-2">
										{phase.misses.map((id) => {
											const missed = items.find((i) => i.id === id);
											if (!missed) return null;
											return (
												<li key={id} className="rounded-xl border bg-card px-4 py-3">
													<p className="font-prose text-base text-foreground" lang="sk">
														{missed.before}
														<span className="font-bold text-go">{missed.answer}</span>
														{missed.after}
													</p>
													<p className="mt-0.5 font-prose text-sm text-muted-foreground">{missed.translation}</p>
												</li>
											);
										})}
									</ul>
								</div>
							)}
						</>
					)}
					<div className="mt-8 flex flex-wrap gap-3">
						<button type="button" onClick={retry} disabled={saving} className={PRIMARY} data-testid="exam-retry">
							<RotateCcwIcon className="size-4" />
							Retry — a fresh draw
						</button>
						<Link href="/passport" className={SECONDARY}>
							<span className="font-ui">Passport</span>
						</Link>
					</div>
				</div>
			</TaskFrame>
		);
	}

	// ── playing ──
	const right = picked !== null && item!.options?.[picked] === item!.answer;
	return (
		<TaskFrame>
			<TaskTop progress={(index + (picked !== null ? 1 : 0)) / items.length} label={`item ${index + 1} of ${items.length}`} count={`${index + 1}/${items.length}`} ink="bg-xp" href="/passport" />
			<div className={cn(COLUMN, "flex flex-1 flex-col overflow-y-auto pb-6 pt-4")}>
				<div className={cn(COLUMN, "flex flex-col gap-4")}>
					<p className="font-ui text-sm font-bold text-muted-foreground">Skúška · {title}</p>
					<p className="font-prose text-xl text-foreground" lang="sk" data-testid="exam-sentence">
						{item!.before}
						<span className={cn("rounded-md px-1", picked === null ? "bg-accent text-accent-foreground/40" : right ? "bg-go-soft font-bold text-go" : "bg-miss-soft font-bold text-miss")}>
							{picked === null ? "____" : item!.options?.[picked]}
						</span>
						{item!.after}
					</p>
					{picked !== null && !right && (
						<p className="font-prose text-sm text-muted-foreground" data-testid="exam-answer">
							The answer is <span className="font-bold text-foreground">{item!.answer}</span> — {item!.translation}
						</p>
					)}
					{picked !== null && right && <p className="font-prose text-sm text-muted-foreground">{item!.translation}</p>}
					<p className="font-ui text-xs text-muted-foreground">{item!.hint}</p>

					<div className="flex flex-col gap-2" data-testid="exam-options">
						{item!.options?.map((o, i) => {
							const chosen = picked === i;
							const isAnswer = o === item!.answer;
							return (
								<button
									key={i}
									type="button"
									onClick={() => pick(i)}
									disabled={picked !== null}
									className={cn(
										"flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left font-prose text-lg transition-all",
										picked === null && "border-border hover:border-xp/60",
										picked !== null && isAnswer && "border-go/60",
										chosen && !isAnswer && "border-miss/50 opacity-70",
										picked !== null && !isAnswer && !chosen && "border-border opacity-50",
									)}
									data-testid={`exam-option-${i}`}
								>
									<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-ui text-xs font-bold text-muted-foreground">{i + 1}</span>
									<span lang="sk" className="text-foreground">
										{o}
									</span>
									{picked !== null && isAnswer && <CheckIcon className="ml-auto size-4 shrink-0 text-go" />}
									{chosen && !isAnswer && <XIcon className="ml-auto size-4 shrink-0 text-miss" />}
								</button>
							);
						})}
					</div>

					{picked !== null && (
						<button type="button" onClick={next} className={cn(PRIMARY, "self-start")} data-testid="exam-next">
							{index + 1 < items.length ? "Next" : "Finish"}
							<span className="ml-2 font-ui text-xs opacity-60">Enter</span>
						</button>
					)}
				</div>
			</div>
		</TaskFrame>
	);
}
