"use client";
/**
 * Study sections on a prepared video's preview (E62): a model picks up to
 * three parts worth studying and the words in them; each word becomes a typed
 * gap in its real line (src/core/watch-sections.ts). Retrieval first: the
 * first miss shows the first letter and the line's English, the second the
 * answer and its meaning. "I don't know" is a miss.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircleIcon, RepeatIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KBD, PRIMARY, QUIET, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { useActiveTime, type ActiveTime } from "@/components/use-active-time";
import { formatClock, gapCue, gradeGap, sectionReps, type GapResult, type SectionRep, type SectionsRecord, type StudySection, type VideoRecord } from "@/src/core";

interface Outcome {
	xp: number;
	right: number;
	total: number;
	queued: string[];
	lines: number;
}

export function StudySections({ video, canFind }: { video: VideoRecord; canFind: boolean }) {
	const [rec, setRec] = useState<SectionsRecord | null | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drilling, setDrilling] = useState<number | null>(null);
	const time = useActiveTime("watch", "interactive", { start: false });

	useEffect(() => {
		let live = true;
		void fetch(`/api/watch/sections?id=${video.id}`)
			.then((r) => (r.ok ? r.json() : { sections: null }))
			.then((b: { sections: SectionsRecord | null }) => live && setRec(b.sections))
			.catch(() => live && setRec(null));
		return () => {
			live = false;
		};
	}, [video.id]);

	const find = async (force: boolean) => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/watch/sections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "find", videoId: video.id, force }) });
			const body = (await res.json()) as { sections?: SectionsRecord; message?: string };
			if (!res.ok || !body.sections) throw new Error(body.message ?? `HTTP ${res.status}`);
			setRec(body.sections);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	if (rec === undefined) return null;
	const section = drilling !== null ? rec?.sections[drilling] : undefined;
	return (
		<section className="mt-10" data-testid="watch-sections">
			<h2 className="font-ui text-lg font-[600] text-foreground">Study sections</h2>
			{section && drilling !== null ? (
				<Drill
					key={drilling}
					video={video}
					section={section}
					index={drilling}
					time={time}
					onBack={() => setDrilling(null)}
				/>
			) : (
				<>
					<p className="mt-1 font-prose text-sm text-muted-foreground">
						{rec
							? "The parts worth studying, picked by a model. Each word is a gap in the line you heard: type it."
							: "A model reads the lines and picks up to three parts worth studying, and the words in them. You then fill those words into the real lines. One cheap request, kept for this video."}
					</p>
					{rec && (
						<ol className="mt-4 flex flex-col gap-2" data-testid="watch-sections-list">
							{rec.sections.map((s, i) => (
								<li key={`${s.from}-${s.to}`} className="q-card flex items-center gap-4 px-4 py-3.5" data-testid="watch-section">
									<span className="min-w-0 flex-1">
										<span className="block font-ui text-[15px] font-[600] text-foreground">{s.title}</span>
										{s.why && <span className="mt-0.5 block font-prose text-sm text-ink-2">{s.why}</span>}
										<span className="mt-1 block font-prose text-[13px] text-ink-3">
											{span(video, s)} · lines {s.from + 1} to {s.to + 1} · {s.focus.length === 1 ? "1 word" : `${s.focus.length} words`}
										</span>
									</span>
									<button type="button" onClick={() => setDrilling(i)} className={cn(SECONDARY, "h-9 shrink-0")} data-testid="watch-section-practice">
										Practice
									</button>
								</li>
							))}
						</ol>
					)}
					<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
						{rec ? (
							<button type="button" disabled={busy || !canFind} onClick={() => void find(true)} className={cn(QUIET, SMALL)} data-testid="watch-sections-again">
								{busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <RepeatIcon className="size-4" strokeWidth={1.6} />}
								Find new sections
							</button>
						) : (
							<button type="button" disabled={busy || !canFind} onClick={() => void find(false)} className={cn(SECONDARY, "h-10")} data-testid="watch-sections-find">
								{busy && <LoaderCircleIcon className="size-4 animate-spin" />}
								{busy ? "Reading the lines…" : "Find sections"}
							</button>
						)}
						{!canFind && <span className="font-prose text-sm text-muted-foreground">Needs an AI key: set the cheap slot in Settings → AI models.</span>}
						{rec && rec.linesShown < video.segments.length && <span className="font-prose text-sm text-muted-foreground">The model saw the first {rec.linesShown} of {video.segments.length} lines.</span>}
					</div>
					{error && (
						<p className="mt-2 font-prose text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</>
			)}
		</section>
	);
}

function span(video: VideoRecord, s: StudySection): string {
	const at = (i: number) => video.segments.find((x) => x.i === i);
	const a = at(s.from);
	const b = at(s.to);
	return a && b ? `${formatClock(a.start)} to ${formatClock(b.end)}` : "";
}

type Stage = { kind: "ask"; misses: number } | { kind: "shown"; verdict: GapResult["verdict"]; assisted: boolean; gaveUp: boolean };

function Drill({ video, section, index, time, onBack }: { video: VideoRecord; section: StudySection; index: number; time: ActiveTime; onBack: () => void }) {
	const lang = useActiveLanguage();
	const tag = lang?.tag ?? "sk-SK";
	const reps = useMemo(() => sectionReps(video, section), [video, section]);
	const [at, setAt] = useState(0);
	const [typed, setTyped] = useState("");
	const [stage, setStage] = useState<Stage>({ kind: "ask", misses: 0 });
	const [results, setResults] = useState<GapResult[]>([]);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
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
			const res = await fetch("/api/watch/sections", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "finish", videoId: video.id, section: index, results: answered, activeMs: time.finish(), tz: new Date().getTimezoneOffset() }),
			});
			const body = (await res.json()) as Outcome & { message?: string };
			if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
			setOutcome(body);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	if (done) {
		return (
			<div className="q-card mt-4 px-5 py-5" data-testid="watch-section-end">
				<p className="font-ui text-[15px] font-[600] text-foreground">{section.title}</p>
				{saving ? (
					<p className="mt-2 flex items-center gap-2 font-prose text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-4 animate-spin" />
						Saving
					</p>
				) : outcome ? (
					<p className="mt-2 font-prose text-base text-foreground" data-testid="watch-section-outcome">
						{outcome.right} of {outcome.total} on the first try · +{outcome.xp} XP
						{outcome.queued.length > 0 && ` · ${outcome.queued.length === 1 ? "1 word" : `${outcome.queued.length} words`} to Review`}
						{outcome.lines > 0 && ` · ${outcome.lines === 1 ? "1 line comes" : `${outcome.lines} lines come`} back in Listen`}
					</p>
				) : (
					error && <p className="mt-2 font-prose text-sm text-miss">{error}</p>
				)}
				<button type="button" onClick={onBack} className={cn(SECONDARY, "mt-4 h-10")} data-testid="watch-section-back">
					Back to sections
				</button>
			</div>
		);
	}
	if (!rep) return null;
	const shown = stage.kind === "shown";
	const cue = stage.kind === "ask" && stage.misses > 0;
	return (
		<div className="q-card mt-4 px-5 py-5" data-testid="watch-section-drill">
			<div className="flex items-center gap-3">
				<p className="min-w-0 flex-1 truncate font-ui text-sm font-[600] text-muted-foreground">
					{section.title} · {at + 1} of {reps.length}
				</p>
				<button type="button" onClick={() => void speak(rep.line, lang ?? undefined).catch(() => {})} aria-label="Play the line" title="Play the line" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-section-play">
					<Volume2Icon className="size-4" />
				</button>
				<button type="button" onClick={stop} className={cn(QUIET, SMALL)} data-testid="watch-section-stop">
					Stop
				</button>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					check();
				}}
				className="mt-4 font-prose text-xl leading-relaxed text-foreground"
				lang={video.lang}
			>
				<span>{rep.before}</span>
				{shown ? (
					<span className={cn("font-[600] underline decoration-2 underline-offset-[6px]", stage.verdict !== "wrong" && !stage.assisted ? "text-teal-2" : "text-miss")} data-testid="watch-section-answer">
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
						aria-label="The missing word"
						style={{ width: `${Math.max(4, [...rep.answer].length + 2)}ch` }}
						className="q-field mx-1 h-10 rounded-md px-2 text-center font-prose text-xl"
						data-testid="watch-section-input"
					/>
				)}
				<span>{rep.after}</span>
			</form>
			{cue && (
				<p className="mt-3 font-prose text-sm text-ink-2" data-testid="watch-section-cue">
					Starts with <span className="font-[600]" lang={video.lang}>{gapCue(rep.answer)}</span>
					{rep.en && <> · {rep.en}</>}
				</p>
			)}
			{shown && (
				<p className="mt-3 font-prose text-sm text-ink-2" data-testid="watch-section-feedback">
					{stage.verdict === "exact" && !stage.assisted ? "Right." : stage.verdict === "accents" && !stage.assisted ? "Right, but check the accents." : stage.gaveUp ? "The word is above." : stage.verdict === "wrong" ? "Not this time." : "Right after the cue."}
					{rep.gloss && ` ${rep.lemma && rep.lemma !== rep.answer ? `${rep.lemma}: ` : ""}${rep.gloss}.`}
					{rep.en && <span className="block text-ink-3">{rep.en}</span>}
				</p>
			)}
			<div className="mt-5 flex flex-wrap items-center gap-2">
				{shown ? (
					<button ref={next} type="button" onClick={() => void advance()} className={cn(PRIMARY, "h-11 px-5")} data-testid="watch-section-next">
						{at + 1 < reps.length ? "Next" : "Finish"}
						<kbd className={cn(KBD, "hidden pointer-fine:inline-flex")}>Enter</kbd>
					</button>
				) : (
					<>
						<button type="button" disabled={!typed.trim()} onClick={check} className={cn(PRIMARY, "h-11 px-5")} data-testid="watch-section-check">
							Check
							<kbd className={cn(KBD, "hidden pointer-fine:inline-flex")}>Enter</kbd>
						</button>
						<button type="button" onClick={() => settle("wrong", true, true)} className={cn(QUIET, "h-11")} data-testid="watch-section-dunno">
							I don&apos;t know
						</button>
					</>
				)}
			</div>
		</div>
	);
}
