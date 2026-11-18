"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, LoaderCircleIcon, MicIcon, PlayIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { micSupported, Recorder, transcribeClip } from "@/components/speak/recorder";
import {
	HOLDING_MAX_REPLY_MS,
	HOLDING_MIN_SHARE,
	ISLAND_STEPS,
	ISLAND_STEP_LABELS,
	LONGEST_REHEARSAL_MS,
	REHEARSE_TARGET_SEC,
	type Cefr,
	type IslandPageData,
	type LiveAvailability,
	type IslandStep,
	type IslandSummary,
	type VaultChunk,
} from "@/src/core";

type PageResponse = Partial<IslandPageData> & { message?: string; used?: string[]; xp?: number };

const QUIET_LEVEL = 0.3;
const ORDER: IslandStep[] = ["started", ...ISLAND_STEPS];

function clock(sec: number): string {
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function stopTimer(timer: { current: ReturnType<typeof setInterval> | null }): void {
	if (timer.current) clearInterval(timer.current);
	timer.current = null;
}

function ChunkRow({
	chunk,
	lang,
	onReview,
	onRemove,
}: {
	chunk: VaultChunk;
	lang?: string;
	onReview: () => void;
	onRemove: () => void;
}) {
	const reviewed = !!chunk.reviewedAt;
	return (
		<li className="flex items-baseline gap-2.5 py-2.5" data-testid="vault-chunk">
			<button
				type="button"
				onClick={() => void speak(chunk.sk).catch(() => {})}
				aria-label={`Play ${chunk.sk}`}
				className="mt-0.5 shrink-0 rounded-full p-1 text-ink-3 transition-colors hover:bg-well hover:text-teal-2"
			>
				<PlayIcon className="size-3.5 fill-current" strokeWidth={0} />
			</button>
			<span className="min-w-0 flex-1">
				<span className="block font-prose text-[15px] text-foreground" lang={lang}>
					{chunk.sk}
				</span>
				<span className="block font-prose text-[13px] text-ink-3">{chunk.en}</span>
			</span>
			<span className="flex shrink-0 items-baseline gap-1.5">
				{chunk.kind === "phrase" && !reviewed && (
					<button
						type="button"
						onClick={onReview}
						className={cn(SECONDARY, SMALL, "text-ink-2")}
						data-testid="vault-got-it"
					>
						Got it
					</button>
				)}
				{reviewed && <span className="font-ui text-[11px] font-[550] text-teal-2">Reviewed</span>}
				{chunk.saidAt && !reviewed && (
					<span className="font-ui text-[11px] text-ink-3" title="Said out loud in a rehearsal">
						Used
					</span>
				)}
				<button
					type="button"
					onClick={onRemove}
					aria-label={`Remove ${chunk.sk}`}
					className="rounded-md p-1 text-ink-3 transition-colors hover:bg-well hover:text-foreground"
				>
					<Trash2Icon className="size-3.5" />
				</button>
			</span>
		</li>
	);
}

export function IslandDetail({
	summary,
	level,
	live,
	onBack,
	onPage,
}: {
	summary: IslandSummary;
	level: Cefr;
	live: LiveAvailability;
	onBack: () => void;
	onPage: (page: IslandPageData) => void;
}) {
	const lang = useActiveLanguage();
	const { island, readiness, bridges } = summary;
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [sk, setSk] = useState("");
	const [en, setEn] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const [phase, setPhase] = useState<"idle" | "recording" | "saving">("idle");
	const [elapsed, setElapsed] = useState(0);
	const [result, setResult] = useState<{ used: number; xp: number } | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const recorder = useRef<Recorder | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const elapsedRef = useRef(0);
	const pauses = useRef({ quietSince: 0, longest: 0 });
	const finishRef = useRef<() => Promise<void>>(async () => {});

	useEffect(
		() => () => {
			stopTimer(timer);
			recorder.current?.cancel();
		},
		[],
	);

	const at = ORDER.indexOf(readiness.step);

	async function send(method: "PATCH" | "DELETE", body: Record<string, unknown>): Promise<void> {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/islands", {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			const out = (await res.json().catch(() => ({}))) as PageResponse;
			if (!res.ok || !out.islands) throw new Error(out.message ?? `HTTP ${res.status}`);
			onPage(out as IslandPageData);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	async function addChunk(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		if (!sk.trim() || !en.trim()) return;
		const before = island.chunks.length;
		await send("PATCH", { id: island.id, action: "add", sk: sk.trim(), en: en.trim() });
		setSk("");
		setEn("");
		if (island.chunks.length !== before) setNotice(null);
	}

	const start = async () => {
		setError(null);
		setResult(null);
		setNotice(null);
		if (!micSupported()) {
			setError("This browser gives no microphone access, so a rehearsal cannot be measured here.");
			return;
		}
		elapsedRef.current = 0;
		setElapsed(0);
		pauses.current = { quietSince: 0, longest: 0 };
		const rec = new Recorder();
		try {
			await rec.start({
				onLevel: (level) => {
					const now = performance.now();
					if (level >= QUIET_LEVEL) {
						if (pauses.current.quietSince) {
							pauses.current.longest = Math.max(pauses.current.longest, now - pauses.current.quietSince);
							pauses.current.quietSince = 0;
						}
					} else if (!pauses.current.quietSince) pauses.current.quietSince = now;
				},
				maxMs: LONGEST_REHEARSAL_MS,
				onAutoStop: () => void finishRef.current(),
			});
		} catch {
			setError("The microphone was not allowed, so nothing was recorded.");
			return;
		}
		recorder.current = rec;
		setPhase("recording");
		stopTimer(timer);
		timer.current = setInterval(() => {
			elapsedRef.current += 1;
			setElapsed(elapsedRef.current);
		}, 1000);
	};

	const finish = async () => {
		stopTimer(timer);
		const seconds = elapsedRef.current;
		const rec = recorder.current;
		recorder.current = null;
		setPhase("saving");
		const longestPause = pauses.current.quietSince
			? Math.max(pauses.current.longest, performance.now() - pauses.current.quietSince)
			: pauses.current.longest;
		let transcript = "";
		if (rec) {
			try {
				transcript = await transcribeClip((await rec.stop()).wav);
			} catch {
				transcript = "";
			}
		}
		try {
			const res = await fetch("/api/islands/rehearsal", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					id: island.id,
					activeSec: seconds,
					transcript,
					longestPauseMs: Math.round(longestPause),
					tz: new Date().getTimezoneOffset(),
				}),
			});
			const out = (await res.json().catch(() => ({}))) as PageResponse;
			if (!res.ok || !out.islands) throw new Error(out.message ?? `HTTP ${res.status}`);
			onPage(out as IslandPageData);
			setResult({ used: out.used?.length ?? 0, xp: out.xp ?? 0 });
			if (!transcript)
				setNotice(
					"Nothing was transcribed, so the vault words and the pauses were not counted. A speech-to-text key in Settings lets the app listen.",
				);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setPhase("idle");
		}
	};
	finishRef.current = finish;

	return (
		<div data-testid="island-detail">
			<button
				type="button"
				onClick={onBack}
				className="flex items-center gap-1.5 font-ui text-[13px] text-ink-3 hover:text-ink-2"
			>
				<ArrowLeftIcon className="size-3.5" />
				All islands
			</button>

			<div className="mt-4 flex items-baseline justify-between gap-4">
				<h1 className="font-ui text-[30px] font-[600] tracking-[-0.028em] text-foreground">{island.topic}</h1>
				<span className="shrink-0 font-ui text-[13px] text-ink-3">{island.level}</span>
			</div>
			<p className="mt-1 font-prose text-[13px] text-ink-3">
				{readiness.stats.chunks} chunks · {readiness.stats.reviewed} reviewed · {readiness.stats.said} said out loud
				{bridges.length > 0 &&
					` · linked to ${bridges.map((b) => `${b.topic ?? "another island"} (${b.shared})`).join(", ")}`}
			</p>

			<ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Steps to Fluent">
				{ISLAND_STEPS.map((step) => {
					const on = readiness.step === step;
					const done = at > ORDER.indexOf(step) || readiness.step === "fluent";
					return (
						<li
							key={step}
							aria-current={on ? "step" : undefined}
							className={cn(
								"rounded-[7px] px-2 py-1 font-ui text-[13px]",
								on ? "bg-well font-[600] text-foreground" : done ? "text-teal-2" : "text-ink-3",
							)}
						>
							{ISLAND_STEP_LABELS[step]}
						</li>
					);
				})}
			</ol>
			{readiness.needs.length > 0 && (
				<ul className="mt-3 list-disc space-y-1 pl-4 font-prose text-[14px] text-ink-2">
					{readiness.needs.map((need) => (
						<li key={need}>{need}</li>
					))}
				</ul>
			)}
			{readiness.faded && (
				<p className="mt-3 font-prose text-[14px] text-ink-2">
					This one faded back to Holding. A 5-minute talk brings it straight back.
				</p>
			)}

			<section className="mt-9" aria-labelledby="rehearse-heading">
				<h2 id="rehearse-heading" className="q-sh">
					Rehearse out loud
				</h2>
				<p className="font-prose text-[14px] text-ink-2">
					{clock(REHEARSE_TARGET_SEC)} without stopping, using the vault words. The app counts the chunks it hears and
					the longest pause.
				</p>
				<div className="mt-3 flex items-center gap-3">
					<button
						type="button"
						onClick={() => (phase === "recording" ? void finish() : void start())}
						disabled={phase === "saving"}
						className={phase === "recording" ? SECONDARY : PRIMARY}
						data-testid="island-rehearse"
					>
						{phase === "saving" ? (
							<LoaderCircleIcon className="size-4 animate-spin" />
						) : phase === "recording" ? (
							<SquareIcon className="size-3.5 fill-current" />
						) : (
							<MicIcon className="size-4" />
						)}
						{phase === "recording"
							? `Stop · ${clock(elapsed)}`
							: phase === "saving"
								? "Listening back…"
								: "Start talking"}
					</button>
					{phase === "recording" && (
						<span className="font-ui text-[13px] tabular-nums text-ink-3">{clock(elapsed)}</span>
					)}
				</div>
				{result && (
					<p className="mt-3 font-prose text-[14px] text-ink-2" data-testid="island-rehearsal-result">
						{result.used} of {readiness.stats.chunks} vault chunks heard · +{result.xp} XP
					</p>
				)}
				{notice && <p className="mt-2 max-w-prose font-prose text-[13px] text-ink-3">{notice}</p>}
			</section>

			<section className="mt-9" aria-labelledby="vault-heading">
				<h2 id="vault-heading" className="q-sh">
					The vault
				</h2>
				<p className="font-prose text-[14px] text-ink-2">
					The words and phrases this island runs on. Words go into spaced review when they are added; a phrase you know
					gets "Got it".
				</p>
				<ul className="mt-2 divide-y divide-[var(--q-line)]">
					{island.chunks.map((chunk) => (
						<ChunkRow
							key={chunk.id}
							chunk={chunk}
							{...(lang?.code ? { lang: lang.code } : {})}
							onReview={() => void send("PATCH", { id: island.id, action: "review", chunkId: chunk.id })}
							onRemove={() => void send("PATCH", { id: island.id, action: "remove", chunkId: chunk.id })}
						/>
					))}
				</ul>
				<form onSubmit={(e) => void addChunk(e)} className="mt-4 flex flex-col gap-2 @md:flex-row">
					<input
						value={sk}
						onChange={(e) => setSk(e.target.value)}
						placeholder="A word or phrase"
						aria-label="A word or phrase"
						className="h-9 min-w-0 flex-1 rounded-md bg-well px-3 font-prose text-[15px] text-foreground outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
					/>
					<input
						value={en}
						onChange={(e) => setEn(e.target.value)}
						placeholder="What it means"
						aria-label="What it means"
						className="h-9 min-w-0 flex-1 rounded-md bg-well px-3 font-prose text-[15px] text-foreground outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
					/>
					<button type="submit" disabled={busy || !sk.trim() || !en.trim()} className={SECONDARY}>
						Add
					</button>
				</form>
			</section>

			<section className="mt-9" aria-labelledby="converse-heading">
				<h2 id="converse-heading" className="q-sh">
					Converse
				</h2>
				<p className="font-prose text-[14px] text-ink-2">
					A live talk on this topic, where the tutor asks follow-up questions and works the vault in.
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-3">
					{live.enabled ? (
						<Link href={`/speak/live?island=${island.id}`} className={SECONDARY} data-testid="island-converse">
							<MicIcon className="size-4" />
							Converse live
						</Link>
					) : (
						<button type="button" disabled aria-describedby="converse-reason" className={cn(SECONDARY, "opacity-60")}>
							Converse live
						</button>
					)}
					<p id="converse-reason" className="max-w-prose font-prose text-[13px] text-ink-3">
						{live.enabled
							? "A live talk on this topic, where the tutor asks follow-up questions and works the vault in."
							: live.reason}
					</p>
				</div>
			</section>

			{error && (
				<p className="mt-6 font-prose text-[14px] text-destructive" role="alert">
					{error}
				</p>
			)}

			<div className="mt-10 border-t border-[var(--q-line)] pt-5">
				{confirmDelete ? (
					<div className="flex flex-wrap items-center gap-3">
						<span className="font-prose text-[14px] text-ink-2">Drop this island and its vault?</span>
						<button
							type="button"
							onClick={() => void send("DELETE", { id: island.id })}
							className={cn(SECONDARY, "text-destructive")}
						>
							Drop it
						</button>
						<button type="button" onClick={() => setConfirmDelete(false)} className={SECONDARY}>
							Keep it
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setConfirmDelete(true)}
						className="font-ui text-[13px] text-ink-3 hover:text-foreground"
					>
						Drop this island
					</button>
				)}
			</div>
			<p className="mt-6 font-ui text-[12px] text-ink-3">
				Your level: {level} · holding needs you to speak {Math.round(HOLDING_MIN_SHARE * 100)}% of a talk and reply
				within {HOLDING_MAX_REPLY_MS / 1000} seconds.
			</p>
		</div>
	);
}
