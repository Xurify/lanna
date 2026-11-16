"use client";
/**
 * Get ready (E70, docs/research/pre-listening.md): what a learner studies
 * before a video they cannot yet follow, on the preview. One cheap request
 * writes it (src/core/watch-prep.ts); the preview then shows three steps:
 * what the video is about (in English, part by part), a short version in the
 * language at the learner's level (spoken, every word tappable), and the
 * words to listen for, typed into their lines with the shared GapDrill. For
 * foreign captions (Czech) the lines are the briefing's own rendering in the
 * language. Offered first when the video is under 88% known; a quiet offer
 * otherwise.
 */

import { useEffect, useMemo, useState } from "react";
import { LoaderCircleIcon, RepeatIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY, QUIET, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { Word } from "@/components/reading/word";
import { groupTokens } from "@/components/reading/reader";
import { GapDrill, type GapOutcome } from "@/components/watch/gap-drill";
import {
	captionLanguageName,
	coverageBand,
	coverageKind,
	excerpt,
	formatClock,
	prepReps,
	quotesFor,
	type GapResult,
	type PrepRecord,
	type VideoRecord,
} from "@/src/core";

export function GetReady({ video, canFind }: { video: VideoRecord; canFind: boolean }) {
	const lang = useActiveLanguage();
	const [rec, setRec] = useState<PrepRecord | null | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drilling, setDrilling] = useState(false);
	const kind = coverageKind({
		lang: video.lang,
		trackLang: video.source.trackLang,
		estimated: video.coverageEstimated,
	});
	const band = coverageBand(video.coverage).band;
	const lead = kind !== "none" && (band === "hard" || band === "too-hard");
	const foreign = video.source.trackLang !== video.lang;
	const name = lang?.english ?? "the language";
	const captions = captionLanguageName(video.source.trackLang);

	useEffect(() => {
		let live = true;
		void fetch(`/api/watch/prep?id=${video.id}`)
			.then((r) => (r.ok ? r.json() : { prep: null }))
			.then((b: { prep: PrepRecord | null }) => live && setRec(b.prep))
			.catch(() => live && setRec(null));
		return () => {
			live = false;
		};
	}, [video.id]);

	const make = async (force: boolean) => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/watch/prep", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "make", videoId: video.id, force }),
			});
			const body = (await res.json()) as { prep?: PrepRecord; message?: string };
			if (!res.ok || !body.prep) throw new Error(body.message ?? `HTTP ${res.status}`);
			setRec(body.prep);
			setDrilling(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	if (rec === undefined) return null;
	const needsModel = !canFind && (
		<span className="font-prose text-sm text-muted-foreground">
			Needs an AI model. Pick one in Settings → AI models.
		</span>
	);
	if (!rec) {
		return (
			<section className="mt-6" data-testid="watch-prep">
				<div
					className={cn("rounded-lg border px-5 py-4", lead ? "border-teal bg-teal-wash" : "bg-card")}
					data-testid="watch-prep-offer"
				>
					<p className="font-ui text-lg font-[600] text-foreground">Before you watch</p>
					<p
						className={cn(
							"mt-1 font-prose text-[15px] leading-snug",
							lead ? "text-foreground/85" : "text-muted-foreground",
						)}
					>
						{lead
							? `You would catch little of this by ear yet. Get ready first: read what it is about, hear a short version in ${name} you can follow, and learn the words to listen for. Then watch it line by line.`
							: `Want the gist first? Read what it is about, hear a short version in ${name}, and learn the words to listen for.`}
						{foreign &&
							` The captions are ${captions}, so the short version and the words come from a ${name} rendering of them.`}
					</p>
					<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
						<button
							type="button"
							disabled={busy || !canFind}
							onClick={() => void make(false)}
							className={cn(lead ? PRIMARY : SECONDARY, "h-10")}
							data-testid="watch-prep-make"
						>
							{busy && <LoaderCircleIcon className="size-4 animate-spin" />}
							{busy ? "Getting ready…" : "Get ready"}
						</button>
						{needsModel}
						{canFind && !busy && (
							<span className="font-prose text-[13px] text-ink-3">One AI request, kept with the video.</span>
						)}
					</div>
					{error && (
						<p className="mt-2 font-prose text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</div>
			</section>
		);
	}
	const lines = rec.lines ?? video.segments;
	const [q1, q2] = quotesFor(video.lang);
	const known = Math.round(rec.summaryKnown * 100);
	const expected = Math.round(rec.summaryExpected * 100);
	return (
		<section className="mt-6" data-testid="watch-prep">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 className="font-ui text-lg font-[600] text-foreground">Before you watch</h2>
				{rec.done && (
					<p className="font-prose text-sm text-ink-3" data-testid="watch-prep-done">
						Typed {rec.done.right} of {rec.done.total} right first time ·{" "}
						{new Date(rec.done.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
					</p>
				)}
			</div>
			<ol className="mt-3 flex flex-col gap-3">
				<Step n={1} title="What it's about" testid="watch-prep-about">
					{rec.about && <p className="font-prose text-base leading-snug text-foreground">{rec.about}</p>}
					{rec.parts.length > 0 && (
						<ol className={cn("flex flex-col gap-1.5", rec.about && "mt-3")} data-testid="watch-prep-parts">
							{rec.parts.map((p) => (
								<li
									key={p.from}
									className="grid grid-cols-[auto_1fr] gap-x-3 font-prose text-[15px] leading-snug text-foreground"
								>
									<span className="pt-px font-ui text-[13px] font-[600] tabular-nums text-ink-3">
										{span(lines, p.from, p.to)}
									</span>
									<span>{p.what}</span>
								</li>
							))}
						</ol>
					)}
					{!rec.about && !rec.parts.length && (
						<p className="font-prose text-sm text-muted-foreground">
							The AI model gave no outline that fits the lines. Try Get ready again.
						</p>
					)}
				</Step>
				<Step n={2} title="The short version" testid="watch-prep-summary">
					{rec.summary.length ? (
						<Summary
							video={video}
							rec={rec}
							intro={`What the video says, in short ${name} sentences for level ${rec.level}, written by the AI model. You know ${known} of every 100 words in it; a learner at ${rec.level} is expected to know ${expected}. Hear each sentence before you read it. Tap a word for its meaning.`}
						/>
					) : (
						<p className="font-prose text-sm text-muted-foreground">
							The AI model wrote no short version. Try Get ready again.
						</p>
					)}
				</Step>
				<Step n={3} title="Words to listen for" testid="watch-prep-keys">
					{drilling ? (
						<KeysDrill
							video={video}
							rec={rec}
							onBack={() => setDrilling(false)}
							onDone={(done) => setRec((r) => (r ? { ...r, done } : r))}
						/>
					) : rec.keys.length ? (
						<>
							<p className="font-prose text-sm text-muted-foreground">
								Each word in the line it comes from. Hear the line, then type the word into it.
								{rec.lines &&
									` The lines are the ${name} rendering of the ${captions} captions; the speaker says the ${captions}.`}
							</p>
							<ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="watch-prep-key-list">
								{rec.keys.map((k) => {
									const line = lines.find((s) => s.i === k.at);
									return (
										<li
											key={`${k.at}-${k.token}`}
											className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
											data-testid="watch-prep-key"
										>
											<button
												type="button"
												onClick={() => void speak(line?.sk ?? k.text, lang ?? undefined).catch(() => {})}
												aria-label={`Play the line with ${k.text}`}
												title="Play the line"
												className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
											>
												<Volume2Icon className="size-4" />
											</button>
											<span className="min-w-0 flex-1">
												<span className="flex flex-wrap items-baseline gap-x-2">
													<span className="font-ui text-lg font-[600] text-foreground" lang={video.lang}>
														{k.text}
													</span>
													<span className="font-prose text-base text-foreground">{k.gloss ?? k.why}</span>
												</span>
												{k.gloss && k.why && k.why.toLocaleLowerCase() !== k.gloss.toLocaleLowerCase() && (
													<span className="mt-0.5 block font-prose text-[13px] text-ink-2">
														{k.lemma && k.lemma !== k.text ? `${k.lemma} · ` : ""}
														{k.why}
													</span>
												)}
												{line && (
													<span
														className="mt-1 block truncate font-prose text-xs text-muted-foreground"
														lang={video.lang}
														title={line.sk}
													>
														{q1}
														{excerpt(line.sk)}
														{q2}
													</span>
												)}
											</span>
										</li>
									);
								})}
							</ul>
							<button
								type="button"
								onClick={() => setDrilling(true)}
								className={cn(PRIMARY, "mt-4 h-11 px-5")}
								data-testid="watch-prep-type"
							>
								{rec.done ? "Type them again" : "Type them"}
							</button>
						</>
					) : (
						<p className="font-prose text-sm text-muted-foreground">
							None of the words it picked are in the lines. Try Get ready again.
						</p>
					)}
				</Step>
			</ol>
			<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
				<button
					type="button"
					disabled={busy || !canFind}
					onClick={() => void make(true)}
					className={cn(QUIET, SMALL)}
					data-testid="watch-prep-again"
				>
					{busy ? (
						<LoaderCircleIcon className="size-4 animate-spin" />
					) : (
						<RepeatIcon className="size-4" strokeWidth={1.6} />
					)}
					{busy ? "Getting ready…" : "Get ready again"}
				</button>
				{needsModel}
				{rec.linesShown < lines.length && (
					<span className="font-prose text-sm text-muted-foreground">
						The AI model read the first {rec.linesShown} of {lines.length} lines.
					</span>
				)}
			</div>
			{error && (
				<p className="mt-2 font-prose text-sm text-miss" role="alert">
					{error}
				</p>
			)}
		</section>
	);
}

function Step({ n, title, testid, children }: { n: number; title: string; testid: string; children: React.ReactNode }) {
	return (
		<li className="q-card px-5 py-4" data-testid={testid}>
			<p className="flex items-baseline gap-2.5 font-ui text-[15px] font-[600] text-foreground">
				<span
					className="flex size-6 shrink-0 translate-y-0.5 items-center justify-center rounded-full bg-well-2 font-ui text-[12px] font-[600] tabular-nums text-ink-2"
					aria-hidden="true"
				>
					{n}
				</span>
				{title}
			</p>
			<div className="mt-2.5">{children}</div>
		</li>
	);
}

function span(lines: readonly { i: number; start: number; end: number }[], from: number, to: number): string {
	const at = (i: number) => lines.find((x) => x.i === i);
	const a = at(from);
	const b = at(to);
	return a && b ? `${formatClock(a.start)}–${formatClock(b.end)}` : "";
}

/** The short version: every sentence spoken and every word tappable, the
 *  English behind one switch, and the honest shares of its words. */
function Summary({ video, rec, intro }: { video: VideoRecord; rec: PrepRecord; intro: string }) {
	const lang = useActiveLanguage();
	const [english, setEnglish] = useState(false);
	const [popover, setPopover] = useState<{ sentence: number; token: number } | null>(null);
	const [looked, setLooked] = useState<string[]>([]);
	const [playing, setPlaying] = useState<number | null>(null);

	useEffect(() => {
		if (popover === null) return;
		const close = (e: MouseEvent) => {
			const t = e.target as HTMLElement | null;
			if (!t?.closest("[data-word-popover]") && !t?.closest("[data-word]")) setPopover(null);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPopover(null);
		window.addEventListener("mousedown", close);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousedown", close);
			window.removeEventListener("keydown", onKey);
		};
	}, [popover]);

	const play = async (i: number) => {
		setPlaying(i);
		try {
			await speak(rec.summary[i]!.sk, lang ?? undefined);
		} catch {
			// no voice: the text is still there
		} finally {
			setPlaying((p) => (p === i ? null : p));
		}
	};
	return (
		<>
			<p className="font-prose text-sm text-muted-foreground">{intro}</p>
			<ol
				className="mt-3 flex flex-col gap-2"
				data-word-column
				data-word-lookup-enabled="true"
				data-testid="watch-prep-sentences"
			>
				{rec.summary.map((s, i) => (
					<li key={i} className="flex items-start gap-3" data-testid="watch-prep-sentence">
						<button
							type="button"
							onClick={() => void play(i)}
							aria-label="Play the sentence"
							title="Play the sentence"
							className={cn(
								"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-foreground",
								playing === i ? "text-teal-2" : "text-muted-foreground",
							)}
						>
							<Volume2Icon className="size-4" />
						</button>
						<span className="min-w-0 flex-1">
							<span
								className={cn(
									"block font-prose text-[19px] leading-[1.5] text-foreground [&_[data-word]]:!py-0",
									playing === i && "text-teal-2",
								)}
								lang={video.lang}
							>
								{groupTokens(s.tokens).map((g, gi) =>
									g.space ? (
										<span key={gi}>{s.tokens[g.indexes[0]!]!.text}</span>
									) : (
										<span key={gi} className="whitespace-nowrap">
											{g.indexes.map((j) => {
												const t = s.tokens[j]!;
												const key = t.slug ?? t.text.toLocaleLowerCase("sk-SK");
												return t.word ? (
													<Word
														key={j}
														token={t}
														looked={looked.includes(key)}
														open={popover?.sentence === i && popover.token === j}
														onOpen={() => {
															setPopover({ sentence: i, token: j });
															setLooked((l) => (l.includes(key) ? l : [...l, key]));
															sfx.tap();
														}}
														onClose={() => setPopover(null)}
													/>
												) : (
													<span key={j}>{t.text}</span>
												);
											})}
										</span>
									),
								)}
							</span>
							{english && s.en && (
								<span
									className="mt-0.5 block font-prose text-[14px] leading-snug text-ink-3"
									data-testid="watch-prep-en"
								>
									{s.en}
								</span>
							)}
						</span>
					</li>
				))}
			</ol>
			<button
				type="button"
				onClick={() => setEnglish((e) => !e)}
				className={cn(QUIET, SMALL, "mt-3")}
				aria-pressed={english}
				data-testid="watch-prep-english"
			>
				{english ? "Hide the English" : "Show the English"}
			</button>
		</>
	);
}

function KeysDrill({
	video,
	rec,
	onBack,
	onDone,
}: {
	video: VideoRecord;
	rec: PrepRecord;
	onBack: () => void;
	onDone: (done: NonNullable<PrepRecord["done"]>) => void;
}) {
	const reps = useMemo(() => prepReps(video, rec.keys, rec.lines ?? video.segments), [video, rec.keys, rec.lines]);
	const save = async (results: GapResult[], activeMs: number): Promise<GapOutcome> => {
		const res = await fetch("/api/watch/prep", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: "finish",
				videoId: video.id,
				results,
				activeMs,
				tz: new Date().getTimezoneOffset(),
			}),
		});
		const body = (await res.json()) as GapOutcome & { message?: string };
		if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
		onDone({ at: new Date().toISOString(), right: body.right, total: body.total, xp: body.xp });
		return body;
	};
	return (
		<GapDrill
			title="Words"
			lang={video.lang}
			reps={reps}
			onSave={save}
			onBack={onBack}
			backLabel="Back to the words"
			testid="watch-prep-gap"
		/>
	);
}
