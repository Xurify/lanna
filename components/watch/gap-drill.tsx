"use client";
/**
 * A typed gap in a real caption line, one after another (E62, E68): the
 * line is spoken, the learner types the missing word or phrase. Retrieval
 * first: the first miss shows the first letter and the line's English, the
 * second the answer and its meaning. "I don't know" is a miss. Study
 * sections and Get ready both drill with it; each saves its own way.
 */

import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KBD, PRIMARY, QUIET, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { useActiveTime } from "@/components/use-active-time";
import { excerpt, gapCue, gradeGap, quotesFor, type GapResult, type SectionRep } from "@/src/core";

export interface GapOutcome {
	xp: number;
	right: number;
	total: number;
	queued: string[];
	lines: number;
}

type Stage = { kind: "ask"; misses: number } | { kind: "shown"; verdict: GapResult["verdict"]; assisted: boolean; gaveUp: boolean };

export function GapDrill({
	title,
	lang: langCode,
	reps,
	onSave,
	onBack,
	backLabel = "Back",
	testid = "watch-gap",
}: {
	title: string;
	/** The language of the lines (`lang` on the text). */
	lang: string;
	reps: SectionRep[];
	/** The gaps answered so far, when the learner finishes or stops with some
	 *  answered: the caller saves them and answers with the outcome. */
	onSave: (results: GapResult[], activeMs: number) => Promise<GapOutcome>;
	onBack: () => void;
	backLabel?: string;
	/** The prefix of every data-testid on the drill. */
	testid?: string;
}) {
	const lang = useActiveLanguage();
	const tag = lang?.tag ?? "sk-SK";
	const time = useActiveTime("watch", "interactive", { start: false });
	const [at, setAt] = useState(0);
	const [typed, setTyped] = useState("");
	const [stage, setStage] = useState<Stage>({ kind: "ask", misses: 0 });
	const [results, setResults] = useState<GapResult[]>([]);
	const [outcome, setOutcome] = useState<GapOutcome | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);
	const next = useRef<HTMLButtonElement>(null);
	const rep: SectionRep | undefined = reps[at];
	const done = at >= reps.length;

	useEffect(() => {
		time.restart();
	}, [time]);
	useEffect(() => {
		if (!rep) return;
		void speak(rep.line, lang ?? undefined).catch(() => {});
		input.current?.focus();
	}, [rep, lang]);
	useEffect(() => {
		if (stage.kind === "shown") next.current?.focus();
		else input.current?.focus();
	}, [stage]);

	const settle = (verdict: GapResult["verdict"], assisted: boolean, gaveUp = false) => {
		setStage({ kind: "shown", verdict, assisted, gaveUp });
		setResults((r) => [...r, { id: rep!.id, verdict, assisted }]);
		if (verdict !== "wrong" && !assisted) sfx.right();
		else sfx.wrong();
	};
	const check = () => {
		if (!rep || stage.kind !== "ask" || !typed.trim()) return;
		const verdict = gradeGap(rep.answer, typed, tag);
		if (verdict !== "wrong") return settle(verdict, stage.misses > 0);
		if (stage.misses === 0) {
			setStage({ kind: "ask", misses: 1 });
			setTyped("");
			sfx.wrong();
			return;
		}
		settle("wrong", true);
	};
	const advance = async () => {
		setTyped("");
		setStage({ kind: "ask", misses: 0 });
		if (at + 1 < reps.length) {
			setAt(at + 1);
			return;
		}
		await save(results);
	};
	/** Stop part way: the gaps answered so far count; with none, only the time does. */
	const stop = () => {
		if (results.length) return void save(results);
		const ms = time.finish();
		if (ms >= 1000) void fetch("/api/progress/time", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ activity: "watch", ms, tz: new Date().getTimezoneOffset() }) }).catch(() => {});
		onBack();
	};
	const save = async (answered: GapResult[]) => {
		setAt(reps.length);
		setSaving(true);
		try {
			setOutcome(await onSave(answered, time.finish()));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	if (done) {
		return (
			<div className="q-card mt-4 px-5 py-5" data-testid={`${testid}-end`}>
				<p className="font-ui text-[15px] font-[600] text-foreground">{title}</p>
				{saving ? (
					<p className="mt-2 flex items-center gap-2 font-prose text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-4 animate-spin" />
						Saving
					</p>
				) : outcome ? (
					<p className="mt-2 font-prose text-base text-foreground" data-testid={`${testid}-outcome`}>
						{outcome.right} of {outcome.total} on the first try · +{outcome.xp} XP
						{outcome.queued.length > 0 && ` · ${outcome.queued.length === 1 ? "1 word" : `${outcome.queued.length} words`} to Review`}
						{outcome.lines > 0 && ` · ${outcome.lines === 1 ? "1 line comes" : `${outcome.lines} lines come`} back in Listen`}
					</p>
				) : (
					error && <p className="mt-2 font-prose text-sm text-miss">{error}</p>
				)}
				<button type="button" onClick={onBack} className={cn(SECONDARY, "mt-4 h-10")} data-testid={`${testid}-back`}>
					{backLabel}
				</button>
			</div>
		);
	}
	if (!rep) return null;
	const shown = stage.kind === "shown";
	const cue = stage.kind === "ask" && stage.misses > 0;
	// The line is an excerpt of the captions: in the language's quotation marks, the cut's trailing comma dropped.
	const [qOpen, qClose] = quotesFor(langCode);
	const after = excerpt(rep.after);
	return (
		<div className="q-card mt-4 px-5 py-5" data-testid={`${testid}-drill`}>
			<div className="flex items-center gap-3">
				<p className="min-w-0 flex-1 truncate font-ui text-sm font-[600] text-muted-foreground">
					{title} · {at + 1} of {reps.length}
				</p>
				<button type="button" onClick={() => void speak(rep.line, lang ?? undefined).catch(() => {})} aria-label="Play the line" title="Play the line" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid={`${testid}-play`}>
					<Volume2Icon className="size-4" />
				</button>
				<button type="button" onClick={stop} className={cn(QUIET, SMALL)} data-testid={`${testid}-stop`}>
					Stop
				</button>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					check();
				}}
				className="mt-4 font-prose text-xl leading-relaxed text-foreground"
				lang={langCode}
			>
				<span className="text-ink-3">{qOpen}</span>
				<span>{rep.before}</span>
				{shown ? (
					<span className={cn("font-[600] underline decoration-2 underline-offset-[6px]", stage.verdict !== "wrong" && !stage.assisted ? "text-teal-2" : "text-miss")} data-testid={`${testid}-answer`}>
						{rep.answer}
					</span>
				) : (
					<input
						ref={input}
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						autoComplete="off"
						autoCapitalize="off"
						spellCheck={false}
						aria-label={rep.answer.includes(" ") ? "The missing words" : "The missing word"}
						style={{ width: `${Math.max(4, [...rep.answer].length + 2)}ch` }}
						className="q-field mx-1 h-10 rounded-md px-2 text-center font-prose text-xl"
						data-testid={`${testid}-input`}
					/>
				)}
				<span>{after}</span>
				<span className="text-ink-3">{qClose}</span>
			</form>
			{cue && (
				<p className="mt-3 font-prose text-sm text-ink-2" data-testid={`${testid}-cue`}>
					Starts with <span className="font-[600]" lang={langCode}>{gapCue(rep.answer)}</span>
					{rep.en && <> · {excerpt(rep.en)}</>}
				</p>
			)}
			{shown && (
				<p className="mt-3 font-prose text-sm text-ink-2" data-testid={`${testid}-feedback`}>
					{stage.verdict === "exact" && !stage.assisted ? "Right." : stage.verdict === "accents" && !stage.assisted ? "Right, but check the accents." : stage.gaveUp ? "The answer is above." : stage.verdict === "wrong" ? "Not this time." : "Right after the cue."}
					{rep.gloss && ` ${rep.lemma && rep.lemma !== rep.answer ? `${rep.lemma}: ` : ""}${rep.gloss}.`}
					{rep.en && <span className="block text-ink-3">{excerpt(rep.en)}</span>}
				</p>
			)}
			<div className="mt-5 flex flex-wrap items-center gap-2">
				{shown ? (
					<button ref={next} type="button" onClick={() => void advance()} className={cn(PRIMARY, "h-11 px-5")} data-testid={`${testid}-next`}>
						{at + 1 < reps.length ? "Next" : "Finish"}
						<kbd className={cn(KBD, "hidden pointer-fine:inline-flex")}>Enter</kbd>
					</button>
				) : (
					<>
						<button type="button" disabled={!typed.trim()} onClick={check} className={cn(PRIMARY, "h-11 px-5")} data-testid={`${testid}-check`}>
							Check
							<kbd className={cn(KBD, "hidden pointer-fine:inline-flex")}>Enter</kbd>
						</button>
						<button type="button" onClick={() => settle("wrong", true, true)} className={cn(QUIET, "h-11")} data-testid={`${testid}-dunno`}>
							I don&apos;t know
						</button>
					</>
				)}
			</div>
		</div>
	);
}
