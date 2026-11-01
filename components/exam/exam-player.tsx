"use client";

/**
 * The chapter exam (E14, on the path from E15): eight choose items drawn
 * from the chapter's own units, one at a time. Keys 1–4 pick and Enter
 * moves on. The options and the feedback band are the lesson's own parts:
 * the band sits in the same place for every item, and the blank in the
 * sentence stays a blank, so nothing above the options moves when an answer
 * comes in. The result shows the score, what was missed, and a try again
 * with a fresh draw. The client sends only its picks; the server grades
 * from the seed and keeps the attempt on the record. Record only: nothing
 * is gated yet.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/components/lesson/sound";
import { COLUMN, Stat, TaskFrame, TaskTop } from "@/components/task-frame";
import { BUTTON, KBD, PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { EXAM_PASS_MARK, scoreExam, type ExamDraw, type ExamScore } from "@/src/core";

type Phase = { state: "playing" } | { state: "saving"; score: ExamScore } | { state: "result"; score: ExamScore; recorded: boolean };

export function ExamPlayer({ chapterId, title, initial }: { chapterId: string; title: string; initial: ExamDraw | null }) {
	const [draw, setDraw] = useState<ExamDraw | null>(initial);
	const [index, setIndex] = useState(0);
	const [picked, setPicked] = useState<number | null>(null);
	// The chosen option's index per item, sent to the server at the end.
	const [answers, setAnswers] = useState<number[]>([]);
	const [phase, setPhase] = useState<Phase>({ state: "playing" });
	const [drawing, setDrawing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const items = draw?.items ?? [];
	const item = items[Math.min(index, items.length - 1)];
	const empty = draw !== null && items.length === 0;
	const right = picked !== null && item?.options?.[picked] === item?.answer;

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
		if (phase.state !== "playing" || picked === null || !draw) return;
		if (index + 1 < items.length) {
			setIndex(index + 1);
			setPicked(null);
			return;
		}
		// The exam is over: grade locally for the screen, and send the picks
		// for the server's own grade from the seed — the record.
		const score = scoreExam(items, answers);
		setPhase({ state: "saving", score });
		fetch("/api/exam", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chapter: chapterId, seed: draw.seed, answers }) })
			.then((res) => setPhase({ state: "result", score, recorded: res.ok }))
			.catch(() => setPhase({ state: "result", score, recorded: false }));
	}, [phase, picked, index, items, answers, chapterId, draw]);

	// A fresh draw: for a retry, or for a first draw that did not load.
	const retry = useCallback(() => {
		setDrawing(true);
		setError(null);
		fetch(`/api/exam?chapter=${chapterId}&seed=${Date.now()}`)
			.then((res) => {
				if (!res.ok) throw new Error(`exam draw ${res.status}`);
				return res.json() as Promise<ExamDraw>;
			})
			.then((fresh) => {
				setDraw(fresh);
				setIndex(0);
				setPicked(null);
				setAnswers([]);
				setPhase({ state: "playing" });
			})
			.catch(() => setError("Could not load a new exam. Check the connection, then try again."))
			.finally(() => setDrawing(false));
	}, [chapterId]);

	// Keys 1–4 pick; Enter or Space moves on once the band is up.
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
					<p className="font-ui text-sm font-bold text-muted-foreground">Chapter exam · {title}</p>
					<h1 className="mt-1 font-ui text-3xl font-black text-foreground">{draw ? "No exam for this chapter yet" : "The exam did not load"}</h1>
					<p className="mt-3 max-w-md font-prose text-base text-muted-foreground">
						{draw ? "This chapter has no words or drills to draw from. The rest of the path still works." : "Check the connection, then try again."}
					</p>
					{error && (
						<p className="mt-3 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
					<div className="mt-8 flex flex-wrap gap-3">
						{!draw && (
							<button type="button" onClick={retry} disabled={drawing} className={PRIMARY}>
								Try again
							</button>
						)}
						<Link href="/curriculum" className={draw ? PRIMARY : SECONDARY}>
							Back to the path
						</Link>
					</div>
				</div>
			</TaskFrame>
		);
	}

	if (phase.state !== "playing") {
		const { score } = phase;
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto overflow-y-auto py-10")} data-testid="exam-result">
					<p className="font-ui text-sm font-bold text-muted-foreground">Chapter exam · {title}</p>
					<h1 className={cn("mt-1 font-ui text-3xl font-black", score.passed ? "text-go" : "text-foreground")}>{score.passed ? "Passed" : "Not passed"}</h1>
					<div className="mt-6 flex flex-wrap gap-8">
						<Stat label="Score" value={`${score.correct} of ${score.total}`} ink={score.passed ? "text-go" : "text-foreground"} />
						<Stat label="Pass mark" value={`${Math.round(EXAM_PASS_MARK * 100)}%`} ink="text-muted-foreground" />
					</div>
					<p className="mt-4 font-prose text-sm text-muted-foreground" data-testid="exam-saved">
						{phase.state === "saving" ? "Saving…" : phase.recorded ? "Saved on your path." : "This attempt was not saved, so the path will not show it."}
					</p>
					{score.misses.length > 0 && (
						<div className="mt-8" data-testid="exam-misses" data-word-lookup-enabled="true">
							<p className="font-ui text-sm font-bold text-muted-foreground">Missed</p>
							<ul className="mt-3 flex flex-col gap-2">
								{score.misses.map((id) => {
									const missed = items.find((i) => i.id === id);
									if (!missed) return null;
									return (
										<li key={id} className="rounded-xl border-2 border-border bg-card px-4 py-3">
											<p className="font-prose text-base text-foreground" lang="sk">
												{missed.sentence}
											</p>
											<p className="mt-0.5 font-prose text-sm text-muted-foreground">
												The answer is <span className="font-bold text-foreground" lang="sk">{missed.answer}</span>. {missed.translation}
											</p>
										</li>
									);
								})}
							</ul>
						</div>
					)}
					{error && (
						<p className="mt-6 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
					<div className="mt-8 flex flex-wrap gap-3">
						<button type="button" onClick={retry} disabled={drawing} className={PRIMARY} data-testid="exam-retry">
							<RotateCcwIcon className="size-4" />
							Try again
						</button>
						<Link href="/curriculum" className={SECONDARY}>
							Back to the path
						</Link>
					</div>
				</div>
			</TaskFrame>
		);
	}

	// ── playing ──
	return (
		<TaskFrame>
			<TaskTop progress={(index + (picked !== null ? 1 : 0)) / items.length} label={`Question ${index + 1} of ${items.length}`} count={`${index + 1}/${items.length}`} ink="bg-xp" href="/curriculum" />
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[9vh]">
				<div className={cn(COLUMN, "flex flex-col gap-8")}>
					<div className="flex flex-col gap-2">
						<p className="font-ui text-sm font-bold text-muted-foreground">Chapter exam · {title}</p>
						<p className="font-prose text-xl text-foreground" lang="sk" data-testid="exam-sentence" data-word-lookup-enabled={picked !== null ? "true" : "false"}>
							{item!.before}
							<span className="rounded-md bg-accent px-1 text-muted-foreground">____</span>
							{item!.after}
						</p>
						<p className="font-ui text-sm text-muted-foreground">{item!.hint}</p>
					</div>
					<div className="grid grid-cols-2 gap-3" data-testid="exam-options">
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
										"flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3.5 text-left font-prose text-xl text-foreground transition-colors",
										picked === null && "hover:border-foreground/40 hover:bg-accent",
										picked !== null && isAnswer && "border-go bg-go-soft",
										chosen && !isAnswer && "border-miss bg-miss-soft",
										picked !== null && !isAnswer && !chosen && "opacity-50",
									)}
									data-testid={`exam-option-${i}`}
								>
									<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
									<span lang="sk">{o}</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>
			{/* One bar at the bottom, in the same place for every item: the keys
			    before an answer, the verdict and Next after it (the lesson's
			    layout). The sentence is shown whole here, so the question above
			    never has to change. */}
			<div className={cn("shrink-0 border-t border-border", picked !== null && (right ? "bg-go-soft" : "bg-miss-soft"))} aria-live="polite" data-testid="exam-footer">
				<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
					{picked === null ? (
						<p className="hidden items-center gap-1.5 font-ui text-sm text-muted-foreground sm:flex">
							<kbd className={KBD}>1</kbd>–<kbd className={KBD}>{item!.options?.length ?? 1}</kbd> to pick
						</p>
					) : (
						<div className="flex min-w-0 items-start gap-3" data-testid="exam-feedback">
							<span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", right ? "bg-go text-go-ink" : "bg-miss text-background")} aria-hidden="true">
								{right ? <CheckIcon className="size-5" strokeWidth={3} /> : <XIcon className="size-5" strokeWidth={3} />}
							</span>
							<div className="min-w-0">
								<p className={cn("font-ui text-2xl font-bold leading-tight", right ? "text-go" : "text-miss")}>{right ? "Right" : "Not quite"}</p>
								{!right && (
									<p className="mt-1 font-prose text-base text-foreground">
										The answer is <span className="font-bold" lang="sk">{item!.answer}</span>.
									</p>
								)}
								<p className="mt-1 font-prose text-base text-foreground" lang="sk">
									{item!.sentence}
								</p>
								<p className="font-prose text-sm text-muted-foreground">{item!.translation}</p>
							</div>
						</div>
					)}
					{picked !== null && (
						<button type="button" onClick={next} className={cn(BUTTON, "shrink-0 hover:brightness-110", right ? "bg-go text-go-ink" : "bg-miss text-background")} data-testid="exam-next">
							{index + 1 < items.length ? "Next" : "Finish"}
						</button>
					)}
				</div>
			</div>
		</TaskFrame>
	);
}
