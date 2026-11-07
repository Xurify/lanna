"use client";

/**
 * Watch → fragments (LangHarness, 2026-11-06): pick a stretch of a video
 * instead of all of it. The strip shows how much of each moment the learner
 * knows; the best stretches are marked and listed (found on the server with
 * no model call, src/core/fragments.ts); a stretch can also be dragged out by
 * hand. Preparing it translates only its lines.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircleIcon, ScissorsIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fragmentAnalyses } from "@/components/watch/caches";
import { coverageBand, formatClock, videoUrl, FRAGMENT_PICK_MAX_SEC, FRAGMENT_PICK_MIN_SEC, heatStrip, IN_REACH, linesTouching, LISTEN_FLOOR, MAX_VIDEO_SEC, rangeStats, type Fragment, type FragmentAnalysis, type FragmentRange } from "@/src/core";

const BUCKETS = 72;
/** Where a plain click on the strip puts a stretch: about this long, around the click. */
const CLICK_SEC = 100;

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; a: FragmentAnalysis };
type Pick = { from: number; to: number };

/** The colour of a slice of the strip by how much of it is known. */
function heatClass(share: number | null): string {
	if (share === null) return "h-0.5 bg-well-2";
	const band = coverageBand(share).band;
	return cn("h-full", band === "comfortable" ? "bg-teal-2" : band === "stretch" ? "bg-teal-2/55" : band === "hard" ? "bg-ink-3/45" : "bg-well-2");
}

export function FragmentsPanel({ videoId, canPrepare, onPrepare, onClose, bare, plain, title }: { videoId: string; canPrepare: boolean; onPrepare: (range?: FragmentRange) => void; onClose: () => void; bare?: boolean; /** No card or rule of its own: the dialog around it is the card. */ plain?: boolean; /** The video's name, under the heading. */ title?: string }) {
	const [load, setLoad] = useState<Load>({ state: "loading" });
	const [sel, setSel] = useState<Pick | null>(null);
	useEffect(() => {
		const abort = new AbortController();
		const kept = fragmentAnalyses.peek(videoId);
		if (kept) {
			setLoad({ state: "ready", a: kept });
			const best = kept.picks[0];
			setSel(best ? { from: best.from, to: best.to } : null);
			return;
		}
		setLoad({ state: "loading" });
		// The request is shared and kept (not tied to this panel), so closing the panel does not waste it.
		fragmentAnalyses
			.run(videoId, async () => {
				const res = await fetch(`/api/watch/fragments?id=${encodeURIComponent(videoId)}`);
				const body = (await res.json().catch(() => ({}))) as FragmentAnalysis & { message?: string };
				if (!res.ok) throw new Error(body.message ?? "The captions could not be read.");
				return body;
			})
			.then((body) => {
				if (abort.signal.aborted) return;
				setLoad({ state: "ready", a: body });
				const best = body.picks[0];
				setSel(best ? { from: best.from, to: best.to } : null);
			})
			.catch((err: unknown) => {
				if (abort.signal.aborted) return;
				setLoad({ state: "error", message: err instanceof Error ? err.message : String(err) });
			});
		return () => abort.abort();
	}, [videoId]);
	return (
		<div className={cn("px-4 pb-4 pt-3", !plain && (bare ? "border-t border-border" : "mt-3 q-card"))} data-testid="watch-fragments">
			<div className="flex items-center gap-2">
				<ScissorsIcon className="size-4 text-ink-3" strokeWidth={1.6} />
				<div className="min-w-0 flex-1">
					<p className="font-ui text-sm font-[600] text-ink-2">Pick a stretch of this video</p>
					{title && (
						<p className="truncate font-prose text-[13px] text-ink-3">
							<a href={videoUrl(videoId)} target="_blank" rel="noreferrer" title={`${title} (opens on YouTube)`} className="hover:text-ink-2 hover:underline">
								{title}
							</a>
						</p>
					)}
				</div>
				<button type="button" onClick={onClose} aria-label="Close" title="Close" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<XIcon className="size-4" strokeWidth={1.6} />
				</button>
			</div>
			{load.state === "loading" && (
				<p className="flex min-h-24 items-center gap-2 font-prose text-[13px] text-ink-3" role="status">
					<LoaderCircleIcon className="size-4 animate-spin" />
					Reading the captions and measuring every line against your words…
				</p>
			)}
			{load.state === "error" && (
				<p className="mt-2 font-prose text-[13px] text-miss" role="alert" data-testid="watch-fragments-error">
					{load.message}
				</p>
			)}
			{load.state === "ready" && <Ready a={load.a} sel={sel} setSel={setSel} canPrepare={canPrepare} onPrepare={onPrepare} />}
		</div>
	);
}

function Ready({ a, sel, setSel, canPrepare, onPrepare }: { a: FragmentAnalysis; sel: Pick | null; setSel: (p: Pick | null) => void; canPrepare: boolean; onPrepare: (range?: FragmentRange) => void }) {
	const total = Math.max(a.durationSec, a.lines[a.lines.length - 1]?.end ?? 0, 1);
	const heat = useMemo(() => heatStrip(a.lines, total, BUCKETS), [a.lines, total]);
	const stats = useMemo(() => (sel ? rangeStats(a.lines, a.lex, sel.from, sel.to) : null), [a, sel]);
	const strip = useRef<HTMLDivElement>(null);
	const drag = useRef<{ at: number; x: number; moved: boolean } | null>(null);
	const timeAt = (clientX: number) => {
		const r = strip.current!.getBoundingClientRect();
		return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
	};
	const choose = (t0: number, t1: number) => {
		const hit = linesTouching(a.lines, Math.min(t0, t1), Math.max(t0, t1));
		if (hit) setSel(hit);
	};
	const sec = stats?.sec ?? 0;
	const problem = !stats ? null : sec < FRAGMENT_PICK_MIN_SEC ? `Take at least ${FRAGMENT_PICK_MIN_SEC} seconds.` : sec > FRAGMENT_PICK_MAX_SEC ? `Take at most ${FRAGMENT_PICK_MAX_SEC / 60} minutes; a session is short.` : null;
	const range = stats ? { startSec: stats.start, endSec: stats.end } : undefined;
	const band = stats && a.measurable ? coverageBand(stats.coverage) : null;
	const inPick = (f: Fragment) => !!sel && sel.from === f.from && sel.to === f.to;
	const whole = a.durationSec <= MAX_VIDEO_SEC;
	const nothingInReach = a.measurable && a.picks.length > 0 && a.picks[0]!.coverage < IN_REACH;
	return (
		<div className="mt-3">
			{!a.measurable && a.message && <p className="mb-3 font-prose text-[13px] text-ink-3">{a.message}</p>}
			<div
				ref={strip}
				role="group"
				aria-label="The video from start to end; the darker the colour, the more of the speech you know. Drag to pick a stretch."
				className="relative h-12 cursor-pointer touch-none select-none"
				data-testid="watch-fragments-strip"
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					drag.current = { at: timeAt(e.clientX), x: e.clientX, moved: false };
				}}
				onPointerMove={(e) => {
					const d = drag.current;
					if (!d) return;
					if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
					if (d.moved) choose(d.at, timeAt(e.clientX));
				}}
				onPointerUp={(e) => {
					const d = drag.current;
					drag.current = null;
					if (d && !d.moved) {
						const t = timeAt(e.clientX);
						choose(Math.max(0, t - CLICK_SEC / 2), t + CLICK_SEC / 2);
					}
				}}
				onPointerCancel={() => {
					drag.current = null;
				}}
			>
				<div className="flex h-full items-end gap-px overflow-hidden rounded-md bg-well">
					{heat.map((share, i) => (
						<span key={i} className={cn("min-w-0 flex-1 rounded-[1px]", a.measurable ? heatClass(share) : share === null ? "h-0.5 bg-well-2" : "h-full bg-ink-3/30")} />
					))}
				</div>
				{a.picks.map((f) => (
					<span key={f.from} aria-hidden="true" className="absolute -bottom-2 h-[3px] rounded-full bg-foreground/60" style={{ left: `${(f.start / total) * 100}%`, width: `max(4px, ${((f.end - f.start) / total) * 100}%)` }} />
				))}
				{stats && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-md bg-foreground/10 outline outline-2 -outline-offset-1 outline-foreground" style={{ left: `${(stats.start / total) * 100}%`, width: `max(6px, ${((stats.end - stats.start) / total) * 100}%)` }} />}
			</div>
			<p className="mt-3 flex justify-between font-ui text-[11px] text-ink-3" aria-hidden="true">
				<span>0:00</span>
				<span>{formatClock(total)}</span>
			</p>
			{a.measurable && (
				<p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[11px] text-ink-3" aria-hidden="true">
					<span className="flex items-center gap-1">
						<i className="size-2 rounded-[2px] bg-teal-2" />
						{Math.round(LISTEN_FLOOR * 100)}% known or more
					</span>
					<span className="flex items-center gap-1">
						<i className="size-2 rounded-[2px] bg-teal-2/55" />
						88 to {Math.round(LISTEN_FLOOR * 100)}%
					</span>
					<span className="flex items-center gap-1">
						<i className="size-2 rounded-[2px] bg-ink-3/45" />
						less
					</span>
					<span className="flex items-center gap-1">
						<i className="h-0.5 w-2 bg-well-2" />
						no speech
					</span>
				</p>
			)}

			<div className="mt-1 min-h-28" data-testid="watch-fragments-selection">
				{stats ? (
					<>
						<p className="font-ui text-[15px] font-[600] text-foreground">
							{formatClock(stats.start)} to {formatClock(stats.end)} · {formatClock(stats.sec)}
							{a.measurable ? ` · you know ${Math.round(stats.coverage * 100)}%${band ? ` (${band.title.toLowerCase()})` : ""}` : ""}
						</p>
						{a.measurable && (
							<p className="mt-0.5 font-prose text-[13px] text-ink-3" data-testid="watch-fragments-expected">
								{Math.round(stats.expected * 100)}% is expected at {a.level}, counting the words the level is assumed to know.
							</p>
						)}
						<p className="mt-0.5 font-prose text-[13px] text-ink-3">
							{stats.to - stats.from + 1} lines
							{a.measurable ? ` · ${stats.newWords.length === 0 ? "no new words" : `${stats.newWords.length} new ${stats.newWords.length === 1 ? "word" : "words"}${stats.recurring ? `, ${stats.recurring} of them said more than once` : ""}`}` : ""}
						</p>
						{stats.newWords.length > 0 && (
							<ul className="mt-2 flex flex-wrap gap-1.5" data-testid="watch-fragments-words">
								{stats.newWords.slice(0, 8).map((w) => (
									<li key={w.slug} className="rounded-md bg-well px-2 py-1 font-prose text-[13px] text-foreground">
										<span lang={a.trackLang} className="font-[600]">
											{w.lemma}
										</span>{" "}
										<span className="text-ink-3">{w.gloss}</span>
										{w.count > 1 && <span className="text-ink-3"> ×{w.count}</span>}
									</li>
								))}
							</ul>
						)}
						<div className="mt-3 flex flex-wrap items-center gap-3">
							<button type="button" disabled={!canPrepare || !!problem} onClick={() => onPrepare(range)} className="q-btn sec t h-9" title={canPrepare ? "Translate only this stretch and add it to My videos" : "Preparing needs an AI key"} data-testid="watch-fragments-prepare">
								Prepare this stretch
							</button>
							{problem && (
								<span className="font-prose text-[13px] text-miss" role="status">
									{problem}
								</span>
							)}
						</div>
					</>
				) : (
					<p className="font-prose text-[13px] text-ink-3">{a.picks.length === 0 && a.measurable ? "No stretch has enough speech to suggest. Drag on the strip to pick one by hand." : "Drag on the strip, or click it, to pick a stretch."}</p>
				)}
			</div>

			{a.picks.length > 0 && (
				<>
					<p className="mt-4 font-ui text-[13px] font-[600] text-ink-2">{nothingInReach ? "The nearest stretches" : "The best stretches for you"}</p>
					{nothingInReach && (
						<p className="mt-1 font-prose text-[13px] text-ink-3" data-testid="watch-fragments-too-hard">
							Nothing in this video is within reach of your words yet. Even the nearest stretch below is mostly new. Graded stories and Listen will get you here faster; come back when more of these words are yours.
						</p>
					)}
					<ol className="mt-2 flex flex-col gap-1.5" data-testid="watch-fragments-picks">
						{a.picks.map((f, i) => (
							<li key={f.from}>
								<button type="button" aria-pressed={inPick(f)} onClick={() => setSel({ from: f.from, to: f.to })} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-well", inPick(f) ? "bg-well" : "bg-transparent")} data-testid="watch-fragments-pick">
									<span className="w-5 shrink-0 font-ui text-[13px] font-[600] text-ink-3">{i + 1}</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-ui text-[14px] font-[600] text-foreground">
											{formatClock(f.start)} to {formatClock(f.end)}
										</span>
										<span className="line-clamp-2 font-prose text-[13px] text-ink-3 sm:block sm:truncate">
											you know {Math.round(f.coverage * 100)}% · {Math.round(f.expected * 100)}% expected at {a.level} · {f.newWords.length} new {f.newWords.length === 1 ? "word" : "words"}
											{f.recurring ? `, ${f.recurring} said again` : ""} · {formatClock(f.sec)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ol>
				</>
			)}
			<p className="mt-4 font-prose text-[12px] leading-relaxed text-ink-3">
				"You know" counts the words you have studied, plus grammar words, names and numbers. "Expected" adds the words a learner at {a.level} is assumed to know, about {a.expectedWords.toLocaleString("en-US")} words in all at your point in the course, whether or not you have met them. Stretches are ranked on what you know: the share where listening works (about 93 to 97%), new words worth learning that come back, and speech all the way through. Measured on the captions with no AI request.
				{a.prepared ? " This video is already in My videos; preparing a stretch replaces it (your watching history stays)." : ""}
			</p>
			{whole && (
				<button type="button" disabled={!canPrepare} onClick={() => onPrepare(undefined)} className="q-btn ghost mt-2 h-auto min-h-8 whitespace-normal py-1.5 text-left" data-testid="watch-fragments-whole">
					Prepare the whole video instead (you know {Math.round(a.coverage * 100)}%, {formatClock(a.durationSec)})
				</button>
			)}
		</div>
	);
}
