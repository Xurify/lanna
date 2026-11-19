"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { SENTENCE_MAX_CHARS, SENTENCE_XP, type PracticeSentenceTarget } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

interface SentenceReply {
	ok: boolean;
	corrected: string;
	why: string;
	cached: boolean;
	xp: number;
}

export function SentenceStep({
	targets,
	onBusyChange,
}: {
	targets: readonly PracticeSentenceTarget[];
	onBusyChange?: (busy: boolean) => void;
}) {
	const lang = useActiveLanguage();
	const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
	const [done, setDone] = useState<Record<string, boolean>>({});
	const [busyCount, setBusyCount] = useState(0);

	useEffect(() => {
		onBusyChange?.(busyCount > 0);
		return () => onBusyChange?.(false);
	}, [busyCount, onBusyChange]);

	if (targets.length === 0) return null;

	const markBusy = (delta: number) => {
		setBusyCount((prev) => Math.max(0, prev + delta));
	};

	const onAccepted = (index: number, key: string) => {
		const nextDone = { ...done, [key]: true };
		setDone(nextDone);
		const nextIndex = targets.findIndex((t, i) => i > index && !nextDone[t.slug ?? t.lemma]);
		const fallbackIndex =
			nextIndex >= 0 ? nextIndex : targets.findIndex((t, i) => i !== index && !nextDone[t.slug ?? t.lemma]);
		if (fallbackIndex >= 0) {
			requestAnimationFrame(() => inputRefs.current[fallbackIndex]?.focus());
		}
	};

	const acceptedCount = Object.values(done).filter(Boolean).length;

	return (
		<section
			className="mt-10 text-left"
			aria-labelledby="lesson-sentences-heading"
			data-testid="lesson-sentences"
			data-busy={busyCount > 0 ? "true" : "false"}
		>
			<h2 id="lesson-sentences-heading" className="q-sh">
				Use them in a sentence
				{acceptedCount > 0 && (
					<small>
						{acceptedCount}/{targets.length}
					</small>
				)}
			</h2>
			<p className="mt-1 font-prose text-[14px] text-ink-3">
				Optional — one short sentence of your own in {lang?.english ?? "your target language"} for any word below, in
				any form. +{SENTENCE_XP} XP each.
			</p>
			<ol className="mt-4 flex flex-col gap-3">
				{targets.map((target, index) => {
					const key = target.slug ?? target.lemma;
					return (
						<SentenceRow
							key={key}
							target={target}
							langCode={lang?.code}
							langName={lang?.english ?? "target language"}
							inputRef={(el) => {
								inputRefs.current[index] = el;
							}}
							onBusyChange={markBusy}
							onAccepted={() => onAccepted(index, key)}
						/>
					);
				})}
			</ol>
		</section>
	);
}

function SentenceRow({
	target,
	langCode,
	langName,
	inputRef,
	onBusyChange,
	onAccepted,
}: {
	target: PracticeSentenceTarget;
	langCode?: string;
	langName: string;
	inputRef: (el: HTMLInputElement | null) => void;
	onBusyChange: (delta: number) => void;
	onAccepted: () => void;
}) {
	const [text, setText] = useState("");
	const [checking, setChecking] = useState(false);
	const [reply, setReply] = useState<SentenceReply | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [tried, setTried] = useState(false);

	const submit = async () => {
		const sentence = text.trim();
		if (!sentence || checking || reply?.ok) return;
		setChecking(true);
		setError(null);
		onBusyChange(1);
		try {
			const res = await fetch("/api/lesson/sentence", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					lemma: target.lemma,
					slug: target.slug,
					gloss: target.gloss,
					sentence,
					source: "slipping",
					tz: new Date().getTimezoneOffset(),
				}),
			});
			const data = (await res.json()) as SentenceReply & { message?: string };
			if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
			setReply(data);
			setTried(true);
			if (data.ok) onAccepted();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setChecking(false);
			onBusyChange(-1);
		}
	};

	const accepted = reply?.ok === true;
	const testKey = target.slug ?? target.lemma;

	return (
		<li className="q-card px-4 py-3.5" data-testid={`lesson-sentence-${testKey}`}>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">
					<span lang={langCode}>{target.lemma}</span>
					{tried && target.gloss && <span className="ml-2 text-xs font-normal text-ink-3">{target.gloss}</span>}
				</p>
				{accepted && (
					<span
						className="inline-flex items-center gap-1 text-xs font-semibold text-teal"
						data-testid="lesson-sentence-ok"
					>
						<CheckIcon className="size-3.5" />
						{reply.xp > 0 ? `+${reply.xp} XP` : "Good"}
					</span>
				)}
			</div>
			<form
				className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center"
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
			>
				<input
					ref={inputRef}
					type="text"
					value={text}
					onChange={(e) => {
						setText(e.target.value);
						if (reply && !reply.ok) setReply(null);
						if (error) setError(null);
					}}
					maxLength={SENTENCE_MAX_CHARS}
					disabled={checking || accepted}
					placeholder={`Write a ${langName} sentence with "${target.lemma}"…`}
					aria-label={`Sentence using ${target.lemma}`}
					className="q-field min-w-0 flex-1"
					data-testid="lesson-sentence-input"
				/>
				{!accepted && (
					<button
						type="submit"
						disabled={checking || !text.trim()}
						className="q-btn primary shrink-0 pointer-coarse:min-h-11"
						data-testid="lesson-sentence-check"
					>
						{checking && <LoaderCircleIcon className="q-ico animate-spin" />}
						Check
					</button>
				)}
			</form>
			{reply && (
				<div className="mt-2.5 space-y-1 text-sm" data-testid="lesson-sentence-reply">
					{!reply.ok && reply.corrected !== text.trim() && (
						<p className="font-medium text-foreground" lang={langCode}>
							{reply.corrected}
						</p>
					)}
					<p className={reply.ok ? "text-ink-2" : "text-miss"}>{reply.why}</p>
				</div>
			)}
			{error && (
				<p role="alert" className="mt-2 text-xs text-miss">
					{error}
				</p>
			)}
		</li>
	);
}
