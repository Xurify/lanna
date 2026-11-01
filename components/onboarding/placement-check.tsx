"use client";

/**
 * The placement check (LangHarness onboarding, 2026-10-28), three stages
 * driven by src/server/placement.ts:
 *
 *   1. The ladder — one typed item at a time; the server picks every next
 *      unit from the answers so far and may ask the model whether a typed
 *      miss is a valid alternative (so "sam" for "samotný" counts).
 *   2. The edge — the tutor's Socratic questions on the units at the edge,
 *      typed answers, a verdict per unit (held / slip / gap).
 *   3. Words — forty words and eight that only look Slovak: tick the ones
 *      you know; the estimate corrects for over-claiming.
 *
 * No hints and no retries: a measurement. A miss shows the right form
 * for a moment and moves on. Every stage after the first can be skipped.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { DiacriticBar } from "@/components/diacritic-bar";
import { useActiveLanguage } from "@/components/speech";
import { compareAnswer, missVerdict, PROBE_TURNS, unitInfo, type LessonItem, type ProbeReply, type ProbeVerdict, type RepVerdict, type VocabEstimate, type VocabItem } from "@/src/core";

const INPUT = "w-full min-w-0 rounded-xl border-2 border-border bg-card px-4 py-3 font-prose text-xl text-foreground caret-go outline-none focus:border-go";

export interface Progress {
	asked: number;
	max: number;
	unit: string | null;
	tier: { id: string; level: string; title: string } | null;
	floor: string | null;
	ceiling: string | null;
	phase: "bracket" | "confirm" | "done";
}

export interface CheckStart {
	id: string;
	from: number;
	item: LessonItem;
	progress: Progress;
	judges: boolean;
}

export interface AnswerOut {
	verdict: RepVerdict;
	judged?: { accepted: boolean; note: string };
	item: LessonItem | null;
	progress: Progress;
}

async function post<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
	if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? String(res.status));
	return (await res.json()) as T;
}

// ─── Stage 1: the ladder ────────────────────────────────────────────────────

export function LadderStage({ start, onDone, onError }: { start: CheckStart; onDone: (ms: number) => void; onError: (msg: string) => void }) {
	const lang = useActiveLanguage();
	const tag = lang?.tag ?? "sk-SK";
	const [item, setItem] = useState<LessonItem>(start.item);
	const [progress, setProgress] = useState<Progress>(start.progress);
	const [given, setGiven] = useState("");
	const [result, setResult] = useState<{ given: string; verdict: RepVerdict; judged?: AnswerOut["judged"]; next: LessonItem | null } | null>(null);
	const [checking, setChecking] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const startedAt = useRef(Date.now());
	const itemAt = useRef(Date.now());
	const finished = useRef(false);

	useEffect(() => {
		inputRef.current?.focus();
		itemAt.current = Date.now();
	}, [item]);

	const advance = useCallback(() => {
		if (!result) return;
		if (result.next) {
			setItem(result.next);
			setGiven("");
			setResult(null);
		} else if (!finished.current) {
			finished.current = true;
			onDone(Date.now() - startedAt.current);
		}
	}, [result, onDone]);

	const submit = async () => {
		if (checking || result || !given.trim()) return;
		const verdict = compareAnswer(item.answer, given, tag);
		setChecking(true);
		try {
			const out = await post<AnswerOut>("/api/placement/answer", { id: start.id, itemId: item.id, given, verdict, ms: Date.now() - itemAt.current });
			setProgress(out.progress);
			const r = { given, verdict: out.verdict, judged: out.judged, next: out.item };
			setResult(r);
			// A hit moves on by itself; a miss waits so the right form is seen.
			if (out.verdict !== "wrong") {
				window.setTimeout(() => {
					if (r.next) {
						setItem(r.next);
						setGiven("");
						setResult(null);
					} else if (!finished.current) {
						finished.current = true;
						onDone(Date.now() - startedAt.current);
					}
				}, out.judged?.accepted ? 1400 : 650);
			}
		} catch (err) {
			onError(err instanceof Error ? err.message : "Couldn't check that answer. Try again.");
		} finally {
			setChecking(false);
		}
	};

	// Enter after a miss continues.
	useEffect(() => {
		if (!result || result.verdict !== "wrong") return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				advance();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [result, advance]);

	const ink = result ? (result.verdict === "wrong" ? "text-miss bg-miss-soft" : result.verdict === "accents" ? "text-warn bg-warn-soft" : "text-go bg-go-soft") : "";
	const words = unitInfo(item.unit).kind === "words";
	const share = Math.min(1, progress.asked / Math.max(10, Math.min(progress.max, 14)));

	return (
		<div data-testid="placement-ladder">
			<div className="flex items-center justify-between gap-4">
				<p className="font-ui text-sm font-bold text-muted-foreground">
					{progress.tier && <span className="rounded-md bg-accent px-2 py-0.5 text-foreground">{progress.tier.level}</span>} {progress.tier?.title}
					<span className="text-muted-foreground"> · {unitInfo(item.unit).title}</span>
				</p>
				<p className="font-ui text-xs tabular-nums text-muted-foreground" data-testid="placement-progress">
					{progress.asked} answered{progress.floor ? ` · holds ${unitInfo(progress.floor as LessonItem["unit"]).title}` : ""}{progress.ceiling ? ` · edge at ${unitInfo(progress.ceiling as LessonItem["unit"]).title}` : ""}
				</p>
			</div>
			<p className="mt-2 font-ui text-xs text-muted-foreground" data-testid="ladder-note">
				You get the word; type the form this sentence needs. This stage measures grammar only: words are checked on their own after.
			</p>
			<div className="mt-3 h-2 overflow-hidden rounded-full bg-accent" aria-hidden="true">
				<div className="h-full rounded-full bg-go transition-[width] duration-300" style={{ width: `${Math.round(share * 100)}%` }} />
			</div>

			<form
				key={item.id}
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
				className="lh-rise mt-8"
				data-word-lookup-enabled={result !== null ? "true" : "false"}
			>
				<h2 className="font-prose text-2xl font-semibold text-foreground">{words ? "Type the word" : "Type the missing word"}</h2>
				<p className="mt-5 font-prose text-[28px] leading-[1.6] text-foreground" lang="sk">
					<span>{item.before}</span>
					{result ? (
						<span className={cn("lh-pop inline-block rounded-lg px-1.5 font-bold", ink)}>{result.verdict === "wrong" ? result.given || "—" : result.judged?.accepted ? result.given : item.answer}</span>
					) : (
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
								disabled={checking}
								className="col-start-1 row-start-1 w-full min-w-0 rounded-xl border-2 border-border bg-card px-3 py-0 font-bold text-foreground caret-go outline-none focus:border-go"
							/>
						</span>
					)}
					<span>{item.after}</span>
				</p>
				<p className="mt-2 font-prose text-lg text-muted-foreground">
					<span className="mr-2 rounded-md bg-accent px-2 py-0.5 font-medium text-foreground">{item.hint ?? item.lemma}</span>
					{item.translation}
				</p>
				{!result && (
					<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
						<DiacriticBar variant="keys" />
						<button type="submit" disabled={!given.trim() || checking} className={PRIMARY} data-testid="placement-check">
							{checking ? <LoaderCircleIcon className="size-5 animate-spin" /> : null}
							{checking ? (start.judges ? "Judging…" : "Checking…") : "Check"}
						</button>
					</div>
				)}
			</form>

			{result && result.judged?.accepted && (
				<p className="lh-rise mt-6 font-prose text-base text-muted-foreground" role="status" aria-live="polite" data-testid="placement-accepted">
					Also right: the dictionary had <b lang="sk">{item.answer}</b>, and the tutor accepts <b lang="sk">{result.given}</b>{result.judged.note ? ` (${result.judged.note})` : ""}.
				</p>
			)}
			{result && result.verdict === "wrong" && (
				<div className="lh-rise mt-8 rounded-2xl border border-miss/40 bg-miss-soft px-5 py-4" role="status" aria-live="polite" data-testid="placement-miss">
					{(() => {
						const v = missVerdict(item, result.judged && !result.judged.accepted ? result.judged.note : null);
						return (
							<>
								<p className="font-prose text-base text-foreground">
									The form here is <b lang="sk">{v.form}</b>
									{item.trigger && (
										<>
											{" "}
											— decided by <span lang="sk" className="font-bold">{item.trigger}</span>
										</>
									)}
									.{v.reason ? ` ${v.reason}` : ""}
								</p>
								{v.pattern && (
									<p className="mt-1.5 font-prose text-sm text-muted-foreground" data-testid="placement-pattern">
										The pattern: {v.pattern}
									</p>
								)}
							</>
						);
					})()}
					<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
						<span className="font-ui text-xs text-muted-foreground">A check gives no hint before the answer; the lessons explain it.</span>
						<button type="button" onClick={advance} className={PRIMARY} data-testid="placement-continue">
							Continue
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Stage 2: the edge ──────────────────────────────────────────────────────

export interface ProbeOut {
	reply: ProbeReply;
	turn: number;
	max: number;
	verdicts: ProbeVerdict[];
	done: boolean;
	skipped?: boolean;
}

const RESULT_INK: Record<ProbeVerdict["result"], string> = { held: "bg-go-soft text-go", slip: "bg-warn-soft text-warn", gap: "bg-miss-soft text-miss" };
const RESULT_WORD: Record<ProbeVerdict["result"], string> = { held: "held", slip: "slip", gap: "gap" };

export function EdgeStage({ id, onDone, onError }: { id: string; onDone: (summary: string, verdicts: ProbeVerdict[], skipped: boolean) => void; onError: (msg: string) => void }) {
	const [turn, setTurn] = useState<ProbeOut | null>(null);
	const [answer, setAnswer] = useState("");
	const [busy, setBusy] = useState(true);
	const [log, setLog] = useState<Array<{ say: string; verdict?: ProbeVerdict }>>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const opened = useRef(false);

	const step = useCallback(
		async (body: { answer?: string }) => {
			setBusy(true);
			try {
				const out = await post<ProbeOut>("/api/placement/probe", { id, ...body });
				setTurn(out);
				if (out.reply.say || out.reply.verdict) setLog((l) => [...l, { say: out.reply.say, verdict: out.reply.verdict }]);
				setAnswer("");
				if (out.done) onDone(out.reply.done ?? out.reply.say, out.verdicts, !!out.skipped);
			} catch (err) {
				onError(err instanceof Error ? err.message : "The tutor could not answer.");
			} finally {
				setBusy(false);
			}
		},
		[id, onDone, onError],
	);

	useEffect(() => {
		if (opened.current) return;
		opened.current = true;
		void step({});
	}, [step]);

	useEffect(() => {
		if (!busy) inputRef.current?.focus();
	}, [busy, turn]);

	const skip = async () => {
		try {
			await post("/api/placement/probe", { id, skip: true });
		} catch {
			// leaving is always allowed
		}
		onDone("", turn?.verdicts ?? [], true);
	};

	const ask = turn?.reply.ask;
	return (
		<div data-testid="placement-edge">
			<div className="flex items-center justify-between gap-4">
				<p className="font-ui text-sm font-bold text-muted-foreground">
					<span className="rounded-md bg-accent px-2 py-0.5 text-foreground">The edge</span> the tutor's questions
					{ask && <span className="text-muted-foreground"> · {unitInfo(ask.unit).title}</span>}
				</p>
				<p className="font-ui text-xs tabular-nums text-muted-foreground">
					{turn ? `${Math.min(turn.turn, PROBE_TURNS)} of up to ${PROBE_TURNS}` : ""}
				</p>
			</div>
			<p className="mt-2 font-ui text-xs text-muted-foreground" data-testid="edge-note">
				The tutor asks you to produce the forms at your edge and to say why: a slip and a gap look the same in a drill, not here.
			</p>

			{log.length > 0 && (
				<ol className="mt-5 flex flex-col gap-2" aria-label="So far">
					{log.slice(-3).map((l, i) => (
						<li key={i} className="font-prose text-base text-muted-foreground">
							{l.verdict && <span className={cn("mr-2 rounded-md px-1.5 py-0.5 font-ui text-xs font-bold", RESULT_INK[l.verdict.result])}>{unitInfo(l.verdict.unit).title}: {RESULT_WORD[l.verdict.result]}</span>}
							{l.say}
						</li>
					))}
				</ol>
			)}

			{busy && !ask && (
				<p className="mt-8 flex items-center gap-2 font-prose text-lg text-muted-foreground" role="status">
					<LoaderCircleIcon className="size-5 animate-spin" /> The tutor is reading your answers…
				</p>
			)}

			{ask && !turn?.done && (
				<form
					key={turn?.turn}
					onSubmit={(e) => {
						e.preventDefault();
						if (!busy && answer.trim()) void step({ answer });
					}}
					className="lh-rise mt-8"
					data-word-lookup-enabled="false"
				>
					<h2 className="font-prose text-2xl font-semibold text-foreground">{ask.prompt || (ask.kind === "why" ? "What decided that?" : "Give the form")}</h2>
					<p className="mt-4 font-prose text-[28px] leading-[1.5] text-foreground" lang="sk">
						{ask.sk}
					</p>
					<input ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer" data-testid="edge-input" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={busy} className={cn(INPUT, "mt-5")} lang={ask.kind === "why" ? undefined : "sk"} />
					<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
						{ask.kind === "why" ? <span /> : <DiacriticBar variant="keys" />}
						<div className="flex gap-2">
							<button type="button" onClick={() => void skip()} className={SECONDARY} disabled={busy}>
								Stop here
							</button>
							<button type="submit" disabled={!answer.trim() || busy} className={PRIMARY} data-testid="edge-send">
								{busy ? <LoaderCircleIcon className="size-5 animate-spin" /> : null}
								Answer
							</button>
						</div>
					</div>
				</form>
			)}
		</div>
	);
}

// ─── Stage 3: words ─────────────────────────────────────────────────────────

export function WordsStage({ id, onDone, onError }: { id: string; onDone: (estimate: VocabEstimate | null) => void; onError: (msg: string) => void }) {
	const [items, setItems] = useState<VocabItem[] | null>(null);
	const [yes, setYes] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let gone = false;
		fetch(`/api/placement/words?id=${encodeURIComponent(id)}`)
			.then(async (r) => {
				if (!r.ok) throw new Error(String(r.status));
				const d = (await r.json()) as { items: VocabItem[] };
				if (!gone) setItems(d.items);
			})
			.catch(() => onError("Couldn't build the word check."));
		return () => {
			gone = true;
		};
	}, [id, onError]);

	const toggle = (wid: string) =>
		setYes((s) => {
			const n = new Set(s);
			if (n.has(wid)) n.delete(wid);
			else n.add(wid);
			return n;
		});

	const finish = async () => {
		if (!items || busy) return;
		setBusy(true);
		try {
			onDone(await post<VocabEstimate>("/api/placement/words", { id, answers: items.map((i) => ({ id: i.id, yes: yes.has(i.id) })) }));
		} catch (err) {
			onError(err instanceof Error ? err.message : "Couldn't save the word check.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div data-testid="placement-words">
			<div className="flex items-center justify-between gap-4">
				<p className="font-ui text-sm font-bold text-muted-foreground">
					<span className="rounded-md bg-accent px-2 py-0.5 text-foreground">Words</span> how many do you know?
				</p>
				<p className="font-ui text-xs tabular-nums text-muted-foreground">{yes.size} ticked</p>
			</div>
			<p className="mt-2 font-ui text-xs text-muted-foreground" data-testid="words-note">
				Vocabulary, on its own: forty words from five frequency bands estimate how many you recognise.
			</p>
			<h2 className="mt-8 font-prose text-2xl font-semibold text-foreground">Tick every word whose meaning you know</h2>
			<p className="mt-2 font-prose text-base text-muted-foreground">Be honest: some of these are not Slovak words at all, and ticking them lowers the estimate. Two minutes.</p>
			{!items ? (
				<p className="mt-8 flex items-center gap-2 font-prose text-lg text-muted-foreground" role="status">
					<LoaderCircleIcon className="size-5 animate-spin" /> Picking words…
				</p>
			) : (
				<ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label="Words">
					{items.map((w) => {
						const on = yes.has(w.id);
						return (
							<li key={w.id}>
								<button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(w.id)} data-testid="word-chip" className={cn("flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left font-prose text-lg transition-colors", on ? "border-go bg-go-soft text-foreground" : "border-border bg-card text-foreground hover:border-foreground/40")}>
									<span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", on ? "border-go bg-go text-go-ink" : "border-border")}>{on && <CheckIcon className="size-3.5" strokeWidth={3} />}</span>
									<span lang="sk">{w.word}</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
			<div className="mt-8 flex flex-wrap gap-3">
				<button type="button" onClick={() => void finish()} disabled={!items || busy} className={PRIMARY} data-testid="words-done">
					{busy ? <LoaderCircleIcon className="size-5 animate-spin" /> : null}
					Done
				</button>
				<button type="button" onClick={() => onDone(null)} className={SECONDARY} disabled={busy}>
					Skip the words
				</button>
			</div>
		</div>
	);
}
