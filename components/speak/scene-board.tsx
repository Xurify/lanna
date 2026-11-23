"use client";

/**
 * The tutor's scene board: the scene in hand on a stage (its drawing, who you
 * meet, your part, how it opens, the ways in) and every scene beneath it as a
 * postcard. Picking a postcard redraws the stage.
 *
 * Keys: arrows pick a scene, Enter starts it, Escape leaves (the player's).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KeyboardIcon, ListChecksIcon, LoaderCircleIcon, MicIcon, RepeatIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CapLabel } from "@/components/ui/cap-label";
import { SettingsLink } from "@/components/settings/settings-link";
import { TaskFrame } from "@/components/task-frame";
import { KBD, PRIMARY, QUIET, SECONDARY } from "@/components/ui/learn-buttons";
import { SourcesNote } from "@/components/sources/sources-note";
import { speak } from "@/components/speech";
import { sceneCounterpart, scriptFor, tutorLineText, type SpeakSceneEntry } from "@/src/core";
import type { SpeakState } from "@/components/speak/speak-player";
import { SpeakHeader } from "@/components/speak/speak-header";
import { SceneArt } from "@/components/speak/scene-art";

const WHY_RANK = { chapter: 0, goal: 1 } as const;

function shortDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function whyLabel(why: SpeakSceneEntry["why"]): string | null {
	return why === "chapter" ? "Your chapter's scene" : why === "goal" ? "One of your goals" : null;
}

interface SceneBoardProps {
	state: SpeakState | null;
	lang: { id: string; tag: string };
	error: string | null;
	sceneId: string | null;
	typed: boolean;
	onPick: (id: string, typed: boolean) => void;
	onResume: (id: string) => void;
	onRetry: () => void;
}

export function SceneBoard({ state, lang, error, sceneId, typed, onPick, onResume, onRetry }: SceneBoardProps) {
	const scenes = useMemo(
		() => [...(state?.scenes ?? [])].sort((a, b) => (a.why ? WHY_RANK[a.why] : 2) - (b.why ? WHY_RANK[b.why] : 2)),
		[state],
	);
	const initial =
		state?.unfinished?.scene ?? (sceneId && scenes.some((s) => s.id === sceneId) ? sceneId : scenes[0]?.id) ?? null;
	const [selected, setSelected] = useState<string | null>(initial);
	const current = scenes.find((s) => s.id === selected) ?? scenes[0] ?? null;
	const stageRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (!selected && scenes[0]) setSelected(scenes[0].id);
	}, [selected, scenes]);

	const choose = (id: string, reveal: boolean) => {
		setSelected(id);
		if (!reveal) return;
		const stage = stageRef.current;
		if (stage && stage.getBoundingClientRect().top < 0) {
			const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			stage.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
		}
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (e.metaKey || e.ctrlKey || e.altKey || !current) return;
			const step =
				e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
			if (step) {
				e.preventDefault();
				const i = scenes.findIndex((s) => s.id === current.id);
				const next = scenes[(i + step + scenes.length) % scenes.length];
				if (next) {
					setSelected(next.id);
					document.querySelector(`[data-scene-card="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
				}
			} else if (e.key === "Enter") {
				const t = e.target instanceof HTMLElement ? e.target : null;
				if (t && (t instanceof HTMLAnchorElement || (t instanceof HTMLButtonElement && !t.dataset.sceneCard))) return;
				e.preventDefault();
				if (state?.unfinished?.scene === current.id) onResume(state.unfinished.id);
				else if (state?.canSpeak) onPick(current.id, typed || !state.stt);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [current, scenes, state, typed, onPick, onResume]);

	return (
		<TaskFrame>
			<div className="@container flex flex-1 flex-col overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl px-5 pt-[5vh] pb-12 @md:px-6">
					<SpeakHeader title="With a tutor" lead="Pick a scene. The tutor plays the other person and answers you." />

					{error && (
						<p
							className="mt-5 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss"
							role="alert"
							data-testid="speak-error"
						>
							{error}{" "}
							<button type="button" onClick={onRetry} className="underline">
								Try again
							</button>
						</p>
					)}

					{!state && !error && (
						<p className="mt-8 flex items-center gap-2 font-ui text-sm text-muted-foreground">
							<LoaderCircleIcon className="size-4 animate-spin" /> Loading the scenes…
						</p>
					)}

					{state && current && (
						<Stage
							ref={stageRef}
							key={current.id}
							scene={current}
							lang={lang}
							state={state}
							typed={typed}
							onPick={onPick}
							onResume={onResume}
						/>
					)}

					{state && scenes.length > 0 && (
						<section className="mt-10" aria-labelledby="scene-shelf" data-testid="speak-scenes">
							<div className="mb-3 flex items-baseline justify-between gap-4">
								<h2 id="scene-shelf" className="font-ui text-[15px] font-[600] text-foreground">
									{scenes.length} scenes
								</h2>
								<p className="hidden font-ui text-xs text-ink-3 pointer-fine:block">
									<kbd className={KBD}>←</kbd> <kbd className={KBD}>→</kbd> pick · <kbd className={KBD}>Enter</kbd>{" "}
									starts
								</p>
							</div>
							<ul className="speak-in grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4">
								{scenes.map((s, i) => (
									<li key={s.id} style={{ "--i": i } as React.CSSProperties}>
										<Postcard
											scene={s}
											lang={lang}
											on={s.id === current?.id}
											open={state.unfinished?.scene === s.id}
											onChoose={() => choose(s.id, true)}
										/>
									</li>
								))}
							</ul>
						</section>
					)}

					{state && (
						<p className="mt-12 max-w-2xl font-ui text-xs text-ink-3" data-testid="speak-setup">
							{!state.canSpeak ? (
								<span data-testid="speak-nomodel">
									Without an AI key, scenes run step by step.{" "}
									<SettingsLink keys className="underline hover:text-ink-2">
										Add a key
									</SettingsLink>{" "}
									to have the tutor answer you out loud.{" "}
								</span>
							) : null}
							{state.stt
								? `Speech-to-text: ${state.stt === "elevenlabs" ? "ElevenLabs" : state.stt === "groq" ? "Groq" : "Deepgram"}.`
								: "No speech-to-text key yet, so lines are typed."}
						</p>
					)}
					<SourcesNote feature="speak" className="mt-3" />
				</div>
			</div>
		</TaskFrame>
	);
}

export function Postcard({
	scene,
	lang,
	on,
	open,
	onChoose,
}: {
	scene: SpeakSceneEntry;
	lang: { id: string; tag: string };
	on: boolean;
	open: boolean;
	onChoose: () => void;
}) {
	const tag = open
		? "Unfinished"
		: scene.why === "chapter"
			? "This chapter"
			: scene.why === "goal"
				? "Your goal"
				: null;
	return (
		<button
			type="button"
			onClick={onChoose}
			aria-pressed={on}
			data-scene-card={scene.id}
			data-testid={`scene-${scene.id}`}
			className={cn(
				"group lanna-press relative flex h-full w-full flex-col rounded-xl p-2 pb-3 text-left transition-[background-color,box-shadow]",
				"outline-none focus-visible:ring-2 focus-visible:ring-ring",
				on
					? "bg-well shadow-[0_0_0_1.5px_var(--color-teal-2)]"
					: "bg-card shadow-[0_0_0_1px_var(--q-line)] hover:bg-well/60",
			)}
		>
			<span
				className={cn(
					"block rounded-lg px-1 pt-1 transition-colors",
					on ? "text-foreground" : "text-ink-3 group-hover:text-ink-2",
				)}
			>
				<SceneArt id={scene.id} text={`${scene.title} ${scene.blurb}`} />
			</span>
			<span className="mt-1.5 flex items-center gap-2 px-1.5">
				<span
					className="min-w-0 flex-1 overflow-x-clip font-ui text-[15px] font-[600] tracking-[-0.01em] text-ellipsis whitespace-nowrap text-foreground"
					lang={lang.tag}
				>
					{scene.title}
				</span>
				{scene.done > 0 && !open && (
					<span
						className="shrink-0 font-ui text-xs tabular-nums text-ink-3"
						title={`Said ${scene.done === 1 ? "once" : `${scene.done} times`}`}
					>
						{scene.done}×
					</span>
				)}
			</span>
			<span className="mt-0.5 line-clamp-2 px-1.5 font-prose text-[13px] leading-snug text-ink-3">{scene.blurb}</span>
			{(tag || on) && (
				<span className="mt-2 flex flex-wrap gap-x-2 px-1.5 font-ui text-[11px] font-[600] tracking-[0.01em]">
					{on && <span className="text-teal-2">On stage</span>}
					{tag && <span className="text-ink-3">{tag}</span>}
				</span>
			)}
		</button>
	);
}

export function Stage({
	ref,
	scene,
	lang,
	state,
	typed,
	onPick,
	onResume,
}: {
	ref: React.Ref<HTMLElement>;
	scene: SpeakSceneEntry;
	lang: { id: string; tag: string };
	state: SpeakState;
	typed: boolean;
	onPick: (id: string, typed: boolean) => void;
	onResume: (id: string) => void;
}) {
	const canSpeak = state.canSpeak;
	const byVoice = !!state.stt;
	const keyboardFirst = typed || !byVoice;
	const unfinished = state.unfinished?.scene === scene.id ? state.unfinished : null;
	const opening = scene.scripted ? scriptFor(scene.id, lang.id)?.turns[0]?.tutor : undefined;
	const script = `/speak/tutor?scene=${scene.id}&mode=script`;
	const why = whyLabel(scene.why);

	const voice = (
		<>
			<MicIcon className="size-4" />
			Speak it
		</>
	);
	const keyboard = (
		<>
			<KeyboardIcon className="size-4" />
			Type it
		</>
	);
	const enter = (
		<kbd className={cn(KBD, "hidden bg-white/15 text-current shadow-none pointer-fine:inline-flex")}>Enter</kbd>
	);

	let actions: React.ReactNode;
	if (unfinished) {
		actions = (
			<>
				<button type="button" onClick={() => onResume(unfinished.id)} className={PRIMARY} data-testid="speak-resume">
					<RepeatIcon className="size-4" />
					Carry on
					{enter}
				</button>
				{canSpeak && (
					<button type="button" onClick={() => onPick(scene.id, keyboardFirst)} className={SECONDARY}>
						Start over
					</button>
				)}
			</>
		);
	} else if (canSpeak) {
		actions = (
			<>
				<button
					type="button"
					onClick={() => onPick(scene.id, keyboardFirst)}
					className={PRIMARY}
					data-testid="speak-start"
				>
					{keyboardFirst ? keyboard : voice}
					{enter}
				</button>
				{byVoice && (
					<button
						type="button"
						onClick={() => onPick(scene.id, !keyboardFirst)}
						className={SECONDARY}
						data-testid="speak-start-other"
					>
						{keyboardFirst ? voice : keyboard}
					</button>
				)}
				{scene.scripted && (
					<Link href={script} className={QUIET} data-testid={`scene-script-${scene.id}`}>
						<ListChecksIcon className="size-4" />
						<CapLabel>Step by step</CapLabel>
					</Link>
				)}
			</>
		);
	} else if (scene.scripted) {
		actions = (
			<Link href={script} className={PRIMARY} data-testid={`scene-script-${scene.id}`}>
				<ListChecksIcon className="size-4" />
				<CapLabel>Step by step</CapLabel>
			</Link>
		);
	} else {
		actions = (
			<p className="font-prose text-sm text-ink-3">
				This scene needs an AI key; it has no step-by-step script in this language yet.
			</p>
		);
	}

	return (
		<article
			ref={ref}
			className="mt-7 grid scroll-mt-6 grid-cols-1 overflow-hidden rounded-2xl bg-well/50 shadow-[0_0_0_1px_var(--q-line)] @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
			aria-label={scene.title}
			data-testid="speak-sheet"
			data-word-lookup-enabled="true"
		>
			<div className="flex items-center justify-center px-6 pt-6 text-foreground @3xl:m-3 @3xl:mr-0 @3xl:rounded-xl @3xl:bg-card/60 @3xl:p-8 @3xl:shadow-[0_0_0_1px_var(--q-line)]">
				<SceneArt id={scene.id} text={`${scene.title} ${scene.blurb}`} className="max-w-lg scale-110" />
			</div>
			<div className="lanna-rise flex flex-col px-6 pt-4 pb-6 @3xl:px-8 @3xl:pt-9 @3xl:pb-8">
				{why && <p className="font-ui text-[13px] font-[550] text-teal-2">{why}</p>}
				<h2
					className={cn(
						"font-ui text-[32px] leading-tight font-[600] tracking-[-0.028em] text-foreground",
						why && "mt-1",
					)}
					lang={lang.tag}
				>
					{scene.title}
				</h2>
				<p className="mt-1 font-prose text-base text-ink-2">{scene.blurb}</p>

				<dl className="mt-5 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 border-t border-[var(--q-line)] pt-5 font-prose text-[15px]">
					<dt className="pt-px font-ui text-[13px] font-[550] text-ink-3">You meet</dt>
					<dd className="text-foreground">{sceneCounterpart(scene.brief)}</dd>
					<dt className="pt-px font-ui text-[13px] font-[550] text-ink-3">Your part</dt>
					<dd className="text-foreground">{scene.task}</dd>
				</dl>

				{opening && <Opening line={tutorLineText(opening)} en={opening.en} lang={lang.tag} typed={keyboardFirst} />}

				<div className="mt-6 flex flex-wrap items-center gap-2">{actions}</div>

				<p className="mt-4 font-ui text-xs text-ink-3" data-testid="speak-history">
					{unfinished
						? `Started and not finished: ${unfinished.turns} ${unfinished.turns === 1 ? "line" : "lines"} said so far.`
						: scene.last
							? `Said ${scene.done === 1 ? "once" : `${scene.done} times`} · last on ${shortDate(scene.last.at)}: ${scene.last.turns} ${scene.last.turns === 1 ? "line" : "lines"}, ${scene.last.corrections === 0 ? "nothing to fix" : `${scene.last.corrections} to fix`}`
							: "Not said yet."}
				</p>
			</div>
		</article>
	);
}

function Opening({ line, en, lang, typed }: { line: string; en: string; lang: string; typed: boolean }) {
	const [playing, setPlaying] = useState(false);
	const [shown, setShown] = useState(false);
	const listen = async () => {
		setPlaying(true);
		try {
			await speak(line);
		} finally {
			setPlaying(false);
		}
	};
	return (
		<figure className="mt-6 rounded-xl bg-card p-4 shadow-[0_0_0_1px_var(--q-line)]" aria-label="How it opens">
			<figcaption className="flex items-center justify-between gap-3 font-ui text-xs font-[550] text-ink-3">
				<span>It opens like this</span>
				<button
					type="button"
					onClick={() => void listen()}
					className={cn(
						"lanna-press -my-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-ui text-xs font-[550] transition-colors",
						"text-teal-2 hover:bg-well focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
					)}
					aria-label="Listen to the first line"
					data-testid="speak-listen"
				>
					<Volume2Icon className={cn("size-3.5", playing && "animate-pulse")} />
					<CapLabel>{playing ? "Playing" : "Listen"}</CapLabel>
				</button>
			</figcaption>
			<blockquote className="mt-2">
				<p className="font-prose text-lg font-[550] text-foreground" lang={lang}>
					{line}
				</p>
				{shown ? (
					<p className="mt-0.5 font-prose text-[13px] text-ink-3">{en}</p>
				) : (
					<button
						type="button"
						onClick={() => setShown(true)}
						className="mt-0.5 font-prose text-[13px] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink-2"
					>
						Show the English
					</button>
				)}
			</blockquote>
			<div className="mt-3 flex items-center justify-end gap-2" aria-hidden="true">
				<span className="font-ui text-xs text-ink-3">{typed ? "you write" : "you say"}</span>
				<span className="relative h-6 w-28 border-b-2 border-ink-4">
					<span className="lanna-caret absolute bottom-1 left-1 h-4 w-0.5 rounded-full bg-teal" />
				</span>
			</div>
		</figure>
	);
}
