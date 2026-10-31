"use client";

/**
 * The scripted scene (LangHarness, 2026-10-30, E13): the scene walked
 * through on its rails before saying it live. The tutor's line is shown
 * (and read out), the learner picks the next line from three — one right,
 * two plausible slips. A slip is explained once and may be retried once;
 * after a second miss the right line shows and the scene moves on. No
 * model, no /api/speak — the grading is local (src/core/speak-script.ts).
 * "Say it live" at the end hands over to the real scene.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MicIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { COLUMN, PRIMARY, SECONDARY, TaskFrame, TaskTop } from "@/components/task-frame";
import { scriptFor, grade, type SceneOption } from "@/src/core";

export function ScriptPlayer({ sceneId }: { sceneId: string }) {
	const script = scriptFor(sceneId);
	const [turnIndex, setTurnIndex] = useState(0);
	const [miss, setMiss] = useState<{ choice: number; explanation: string } | null>(null);
	// The lines said so far, tutor and learner alternating.
	const [said, setSaid] = useState<Array<{ role: "tutor" | "learner"; sk: string; shown?: boolean }>>([]);
	const [done, setDone] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);

	// The script ends where the live scene begins.
	if (!script) {
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto py-10")}>
					<p className="font-prose text-base text-foreground">This scene has no script yet.</p>
					<Link href="/speak" className={cn(PRIMARY, "mt-6 self-start")}>
						Other scenes
					</Link>
				</div>
			</TaskFrame>
		);
	}

	const scene = script.scene;
	const total = script.turns.length;
	const turn = script.turns[Math.min(turnIndex, total - 1)]!;

	const advance = useCallback(
		(sk: string, shown: boolean) => {
			setSaid((prev) => [...prev, { role: "learner", sk, shown }]);
			setMiss(null);
			if (turnIndex + 1 >= total) {
				setDone(true);
			} else {
				const next = script.turns[turnIndex + 1]!;
				setSaid((prev) => [...prev, { role: "tutor", sk: next.tutor.sk }]);
				setTurnIndex(turnIndex + 1);
				void speak(next.tutor.sk).catch(() => {});
			}
		},
		[script, turnIndex, total],
	);

	const pick = useCallback(
		(option: SceneOption, choice: number) => {
			if (miss && miss.choice === choice) return;
			const result = grade(script, turnIndex, choice);
			if (!result) return;
			if (result.correct) {
				sfx.right(2);
				advance(option.sk, false);
				return;
			}
			if (miss) {
				// Second miss on the same turn: the right line shows, the scene moves on.
				sfx.wrong();
				advance(result.right, true);
			} else {
				sfx.wrong();
				setMiss({ choice, explanation: result.explanation ?? "" });
			}
		},
		[script, turnIndex, miss, advance],
	);

	// The first tutor line is read out.
	const greeted = useRef(false);
	useEffect(() => {
		if (!greeted.current) {
			greeted.current = true;
			void speak(script.turns[0]?.tutor.sk ?? "").catch(() => {});
		}
	}, [script]);

	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
	}, [said.length, miss, done]);

	// Keys 1 to 3 pick an option.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (done) return;
			const n = Number(e.key);
			if (n >= 1 && n <= 3) pick(turn.options[n - 1]!, n - 1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pick, turn, done]);

	if (done) {
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto overflow-y-auto py-10")} data-testid="script-done">
					<p className="font-ui text-sm font-bold text-muted-foreground">Speak · step by step · done</p>
					<h1 className="mt-1 font-ui text-3xl font-black text-foreground">Now say it yourself</h1>
					<p className="mt-3 max-w-md font-prose text-base text-muted-foreground">
						You walked through all {total} lines. Now say the same scene out loud. The tutor will follow what you say, not the script.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link href={`/speak?scene=${scene}`} className={PRIMARY} data-testid="script-live">
							<MicIcon className="size-4" />
							Say it live
						</Link>
						<Link href="/speak" className={SECONDARY}>
							Other scenes
						</Link>
					</div>
				</div>
			</TaskFrame>
		);
	}

	return (
		<TaskFrame>
			<TaskTop progress={turnIndex / total} label={`line ${turnIndex + 1} of ${total}`} count={`${turnIndex + 1}/${total}`} ink="bg-xp" href="/speak" />

			<div ref={listRef} className="flex flex-1 flex-col overflow-y-auto pb-6 pt-4">
				<div className={cn(COLUMN, "flex flex-col gap-4")}>
					<p className="font-ui text-sm font-bold text-muted-foreground">Speak · step by step</p>
					<ol className="flex flex-col gap-3" data-testid="script-turns" aria-live="polite">
						{said.map((line, i) => (
							<li key={i} className={cn("flex", line.role === "learner" ? "justify-end" : "justify-start")}>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-4 py-3",
										line.role === "learner" ? "rounded-br-md bg-xp/15" : "rounded-bl-md bg-card",
									)}
								>
									<p className="font-prose text-lg text-foreground" lang="sk">
										{line.sk}
									</p>
									{line.shown && <p className="mt-0.5 font-ui text-xs text-muted-foreground">the right line, shown</p>}
								</div>
							</li>
						))}
					</ol>

					<p className="font-prose text-xl text-foreground" lang="sk" data-testid="script-tutor">
						{turn.tutor.sk}
					</p>
					<p className="-mt-2 font-prose text-sm text-muted-foreground">{turn.tutor.en}</p>

					<div className="flex flex-col gap-2" data-testid="script-options">
						{turn.options.map((o, i) => {
							const failed = miss?.choice === i;
							return (
								<button
									key={i}
									type="button"
									onClick={() => pick(o, i)}
									disabled={failed}
									className={cn(
										"flex items-center gap-3 rounded-xl border-2 bg-card px-4 py-3.5 text-left font-prose text-lg transition-colors",
										failed ? "border-miss/50 opacity-60" : "border-border hover:border-foreground/40 hover:bg-accent",
									)}
									data-testid={`script-option-${i}`}
								>
									<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
									<span lang="sk" className="text-foreground">
										{o.sk}
									</span>
									{failed && <XIcon className="ml-auto size-4 shrink-0 text-miss" />}
								</button>
							);
						})}
					</div>

					{miss && (
						<p className="rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" data-testid="script-why" role="alert">
							{miss.explanation} Try once more.
						</p>
					)}
				</div>
			</div>
		</TaskFrame>
	);
}
