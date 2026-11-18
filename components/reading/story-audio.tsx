"use client";

import { CheckIcon, LoaderCircleIcon, Volume2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { StoryAudioStatus } from "@/src/core";

const POLL_MS = 2000;

const number = (n: number) => n.toLocaleString("en");
const dollars = (n: number) => `$${n.toFixed(2)}`;

/** The Library's one button for ElevenLabs audio on every story: what is
 *  missing and what it costs, a confirm before anything is spent, then the
 *  batch's progress. Hidden with no ElevenLabs key. */
export function StoryAudioControl() {
	const [status, setStatus] = useState<StoryAudioStatus | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const res = await fetch("/api/read/audio").catch(() => null);
		if (res?.ok) setStatus((await res.json()) as StoryAudioStatus);
	}, []);

	const running = !!status?.job && !status.job.finishedAt;

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => void load(), POLL_MS);
		return () => clearInterval(timer);
	}, [running, load]);

	const start = async () => {
		setConfirming(false);
		setError(null);
		const res = await fetch("/api/read/audio", { method: "POST" }).catch(() => null);
		if (!res) return setError("The app did not answer.");
		const body = (await res.json().catch(() => null)) as (StoryAudioStatus & { message?: string }) | null;
		if (!res.ok) return setError(body?.message ?? `Could not start (${res.status}).`);
		if (body) setStatus(body);
	};

	if (!status || !status.hasKey || status.stories === 0) return null;
	const job = status.job;

	if (running && job) {
		return (
			<p className="flex items-center gap-2 text-[14px] text-ink-2" role="status" data-testid="read-audio-progress">
				<LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
				<span className="cap-center">
					Making audio · {number(job.done)} of {number(job.total)} sentences
				</span>
			</p>
		);
	}

	const lastError = error ?? (job?.failed ? `${job.failed} sentences failed: ${job.error ?? "unknown error"}` : null);

	if (status.sentences === 0) {
		return (
			<p className="flex items-center gap-2 text-[14px] text-ink-3" data-testid="read-audio-ready">
				<CheckIcon className="size-4" />
				<span className="cap-center">Audio ready for all {number(status.stories)} stories</span>
			</p>
		);
	}

	return (
		<div className="flex max-w-sm flex-col items-end gap-1.5 text-right" data-testid="read-audio">
			{confirming ? (
				<>
					<p className="text-[14px] text-ink-2">
						{number(status.chars)} ElevenLabs credits, or {dollars(status.cost.usdLow)} to{" "}
						{dollars(status.cost.usdHigh)} on the API.
					</p>
					<div className="flex gap-2">
						<button type="button" className="q-btn ghost" onClick={() => setConfirming(false)}>
							Cancel
						</button>
						<button type="button" className="q-btn primary" onClick={() => void start()} data-testid="read-audio-go">
							Make audio
						</button>
					</div>
				</>
			) : (
				<>
					<button
						type="button"
						className="q-btn ghost inline-flex items-center gap-2"
						onClick={() => setConfirming(true)}
						data-testid="read-audio-make"
					>
						<Volume2Icon className="size-4" />
						<span className="cap-center">Make audio for every story</span>
					</button>
					<p className="text-[13px] text-ink-3">
						{number(status.storiesReady)} of {number(status.stories)} stories have it · {number(status.sentences)}{" "}
						sentences to go
					</p>
				</>
			)}
			{lastError && (
				<p className="text-[13px] text-ink-2" role="alert">
					{lastError}
				</p>
			)}
		</div>
	);
}
