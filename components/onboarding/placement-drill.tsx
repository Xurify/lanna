"use client";

/**
 * The placement drill (LangHarness onboarding, 2026-10-28): the staircase
 * from src/core/onboarding.ts, run in the browser. Every tier's reps are
 * already in the plan (one GET), so climbing never waits. Two reps per
 * unit — choose, then type — graded locally; a tier is passed at 75%, and
 * the drill stops at the first tier not passed. No hints and no retries:
 * this is a measurement, and a miss shows the right form for a moment
 * and moves on. The finished drill is posted once.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DiacriticBar } from "@/components/diacritic-bar";
import { useActiveLanguage } from "@/components/speech";
import { compareAnswer, PASS_SHARE, tierPassed, unitInfo, type LessonItem, type PlacementRep, type PlacementTier, type RepVerdict } from "@/src/core";

export interface DrillTier extends PlacementTier {
	items: LessonItem[];
}

export interface DrillRep {
	tier: string;
	item: LessonItem;
	given: string;
	verdict: RepVerdict;
}

const BUTTON = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-extrabold transition-[filter,transform,background-color] active:scale-[0.98]";
const PRIMARY = cn(BUTTON, "bg-go text-go-ink hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent disabled:text-muted-foreground");

export function PlacementDrill({ tiers, from, onDone }: { tiers: DrillTier[]; from: number; onDone: (reps: DrillRep[], ms: number) => void }) {
	const lang = useActiveLanguage();
	const tag = lang?.tag ?? "sk-SK";
	const [tierIdx, setTierIdx] = useState(from);
	const [index, setIndex] = useState(0);
	const [reps, setReps] = useState<DrillRep[]>([]);
	const [result, setResult] = useState<DrillRep | null>(null);
	const startedAt = useRef(Date.now());
	const finished = useRef(false);
	const tier = tiers[tierIdx];
	const item = tier?.items[index];
	const total = useMemo(() => tiers.slice(from).reduce((n, t) => n + t.items.length, 0), [tiers, from]);
	const doneCount = reps.length;

	const finish = useCallback(
		(all: DrillRep[]) => {
			if (finished.current) return;
			finished.current = true;
			onDone(all, Date.now() - startedAt.current);
		},
		[onDone],
	);

	const advance = useCallback(
		(all: DrillRep[]) => {
			setResult(null);
			if (!tier) return finish(all);
			if (index + 1 < tier.items.length) {
				setIndex(index + 1);
				return;
			}
			// The tier is over: climb while it is passed, else stop here.
			const asReps: PlacementRep[] = all.map((r) => ({ tier: r.tier, unit: r.item.unit, verdict: r.verdict }));
			if (tierPassed(tier, asReps) && tierIdx + 1 < tiers.length) {
				setTierIdx(tierIdx + 1);
				setIndex(0);
			} else finish(all);
		},
		[tier, index, tierIdx, tiers.length, finish],
	);

	const grade = useCallback(
		(given: string, verdict: RepVerdict) => {
			if (!tier || !item || result) return;
			const rep: DrillRep = { tier: tier.id, item, given, verdict };
			const all = [...reps, rep];
			setReps(all);
			setResult(rep);
			// A hit moves on by itself; a miss waits so the right form is seen.
			if (verdict !== "wrong") window.setTimeout(() => advance(all), 650);
		},
		[tier, item, result, reps, advance],
	);

	// Enter after a miss continues.
	useEffect(() => {
		if (!result || result.verdict !== "wrong") return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				advance(reps);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [result, reps, advance]);

	if (!tier || !item) return null;
	const tierReps = reps.filter((r) => r.tier === tier.id);
	const tierHits = tierReps.filter((r) => r.verdict !== "wrong").length;

	return (
		<div data-testid="placement-drill">
			<div className="flex items-center justify-between gap-4">
				<p className="font-ui text-sm font-bold text-muted-foreground">
					<span className="rounded-md bg-accent px-2 py-0.5 text-foreground">{tier.level}</span> {tier.title}
					<span className="text-muted-foreground/70"> · {unitInfo(item.unit).title}</span>
				</p>
				<p className="font-ui text-xs tabular-nums text-muted-foreground">
					{tierHits}/{tierReps.length} this tier · need {Math.ceil(tier.items.length * PASS_SHARE)} of {tier.items.length} to climb
				</p>
			</div>
			<div className="mt-3 h-2 overflow-hidden rounded-full bg-accent" aria-hidden="true">
				<div className="h-full rounded-full bg-go transition-[width] duration-300" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
			</div>

			<div key={`${tier.id}-${index}`} className="lh-rise mt-8">
				<h2 className="font-prose text-2xl font-semibold text-foreground">{item.kind === "choose" ? (unitInfo(item.unit).kind === "words" ? "Choose the word" : "Choose the right form") : unitInfo(item.unit).kind === "words" ? "Type the word" : "Type the missing word"}</h2>
				<Rep item={item} tag={tag} result={result} onGrade={grade} />
			</div>

			{result && result.verdict === "wrong" && (
				<div className="lh-rise mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-miss/40 bg-miss-soft px-5 py-4" role="status" aria-live="polite">
					<p className="font-prose text-base text-foreground">
						The form here is <b lang="sk">{item.answer}</b>
						{item.trigger && (
							<>
								{" "}
								— decided by <span lang="sk" className="font-bold">{item.trigger}</span>
							</>
						)}
						. No hint in a check; the lessons explain it.
					</p>
					<button type="button" onClick={() => advance(reps)} className={PRIMARY} data-testid="placement-continue">
						Continue
					</button>
				</div>
			)}
		</div>
	);
}

function Rep({ item, tag, result, onGrade }: { item: LessonItem; tag: string; result: DrillRep | null; onGrade: (given: string, verdict: RepVerdict) => void }) {
	const [given, setGiven] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const locked = result !== null;
	const typed = item.kind === "type";

	useEffect(() => {
		if (typed) inputRef.current?.focus();
	}, [item, typed]);

	useEffect(() => {
		if (item.kind !== "choose" || locked) return;
		const onKey = (e: KeyboardEvent) => {
			const n = Number(e.key);
			const opt = item.options?.[n - 1];
			if (opt) {
				e.preventDefault();
				onGrade(opt, compareAnswer(item.answer, opt, tag));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [item, locked, onGrade, tag]);

	const submit = () => {
		if (locked || !given.trim()) return;
		onGrade(given, compareAnswer(item.answer, given, tag));
	};
	const ink = result ? (result.verdict === "wrong" ? "text-miss bg-miss-soft" : result.verdict === "accents" ? "text-warn bg-warn-soft" : "text-go bg-go-soft") : "";

	return (
		<form onSubmit={(e) => (e.preventDefault(), submit())} className="mt-5">
			<p className="font-prose text-[28px] leading-[1.6] text-foreground" lang="sk">
				<span>{item.before}</span>
				{locked ? (
					<span className={cn("lh-pop inline-block rounded-lg px-1.5 font-bold", ink)}>{result?.verdict === "wrong" ? result.given || "—" : item.answer}</span>
				) : typed ? (
					<span className="mx-1 inline-grid max-w-full align-baseline" style={{ minWidth: `${Math.max(4, item.answer.length + 2)}ch` }}>
						<span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre border-2 px-3 font-bold">
							{given || " "}
						</span>
						<input
							ref={inputRef}
							value={given}
							onChange={(e) => setGiven(e.target.value)}
							aria-label="Missing word"
							data-testid="placement-input"
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							spellCheck={false}
							className="col-start-1 row-start-1 w-full min-w-0 rounded-xl border-2 border-border bg-card px-3 py-0 font-bold text-foreground caret-go outline-none focus:border-go"
						/>
					</span>
				) : (
					<span className="mx-1 inline-block h-[1.1em] w-[5ch] translate-y-[0.2em] rounded-lg border-2 border-dashed border-muted-foreground/50" aria-label="blank" />
				)}
				<span>{item.after}</span>
			</p>
			<p className="mt-2 font-prose text-lg text-muted-foreground">
				<span className="mr-2 rounded-md bg-accent px-2 py-0.5 font-medium text-foreground">{item.hint ?? item.lemma}</span>
				{item.translation}
			</p>
			{typed && !locked && (
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
					<DiacriticBar variant="keys" />
					<button type="submit" disabled={!given.trim()} className={PRIMARY} data-testid="placement-check">
						Check
					</button>
				</div>
			)}
			{item.kind === "choose" && (
				<div className="mt-6 grid grid-cols-2 gap-3" data-testid="placement-options">
					{item.options!.map((o, i) => {
						const picked = result?.given === o;
						const right = locked && compareAnswer(item.answer, o, tag) === "exact";
						return (
							<button
								key={o}
								type="button"
								disabled={locked}
								onClick={() => onGrade(o, compareAnswer(item.answer, o, tag))}
								className={cn(
									"flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 text-left font-prose text-xl text-foreground transition-colors",
									!locked && "hover:border-foreground/40 hover:bg-accent",
									right && "border-go bg-go-soft",
									picked && !right && "border-miss bg-miss-soft",
									locked && !right && !picked && "opacity-50",
								)}
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
								<span lang="sk">{o}</span>
							</button>
						);
					})}
				</div>
			)}
		</form>
	);
}
