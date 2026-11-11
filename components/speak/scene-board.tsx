"use client";

/**
 * The Speak scene board (2026-11-07): the scenes as one list grouped by why
 * they are offered, and beside it the sheet of the scene in hand: who you
 * meet, what you are there to do, how it opens (when a script has the
 * line), the last time you said it, and the ways in. Below the sheet's
 * breakpoint the sheet opens inside the list, under its row.
 *
 * Keys: ↑ ↓ pick a scene, Enter starts it, Escape leaves (the player's).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, KeyboardIcon, ListChecksIcon, LoaderCircleIcon, MicIcon, RepeatIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, AddKeyButton } from "@/components/quiet/empty-state";
import { TaskFrame } from "@/components/task-frame";
import { KBD, PRIMARY, QUIET, SECONDARY } from "@/components/ui/learn-buttons";
import { SourcesNote } from "@/components/sources/sources-note";
import { sceneCounterpart, scriptFor, tutorLineText, type SpeakSceneEntry } from "@/src/core";
import type { SpeakState } from "@/components/speak/speak-player";

const GROUPS: Array<{ why: SpeakSceneEntry["why"]; label: string }> = [
	{ why: "chapter", label: "This chapter" },
	{ why: "goal", label: "For your goals" },
	{ why: null, label: "More scenes" },
];

function shortDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

interface SceneBoardProps {
	state: SpeakState | null;
	/** The language id (scripts) and its BCP-47 tag (the lang attribute). */
	lang: { id: string; tag: string };
	error: string | null;
	sceneId: string | null;
	typed: boolean;
	onPick: (id: string, typed: boolean) => void;
	onResume: (id: string) => void;
	onRetry: () => void;
}

export function SceneBoard({ state, lang, error, sceneId, typed, onPick, onResume, onRetry }: SceneBoardProps) {
	const scenes = useMemo(() => state?.scenes ?? [], [state]);
	const initial = state?.unfinished?.scene ?? (sceneId && scenes.some((s) => s.id === sceneId) ? sceneId : scenes[0]?.id) ?? null;
	const [selected, setSelected] = useState<string | null>(initial);
	const current = scenes.find((s) => s.id === selected) ?? scenes[0] ?? null;
	const groups = GROUPS.map((g) => ({ ...g, scenes: scenes.filter((s) => s.why === g.why) })).filter((g) => g.scenes.length > 0);
	const grouped = groups.length > 1;

	useEffect(() => {
		if (!selected && scenes[0]) setSelected(scenes[0].id);
	}, [selected, scenes]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (e.metaKey || e.ctrlKey || e.altKey || !current) return;
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				const i = scenes.findIndex((s) => s.id === current.id);
				const next = scenes[(i + (e.key === "ArrowDown" ? 1 : scenes.length - 1)) % scenes.length];
				if (next) {
					setSelected(next.id);
					document.querySelector(`[data-scene-row="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
				}
			} else if (e.key === "Enter") {
				// A focused action keeps its own Enter; a focused row starts its scene.
				const t = e.target instanceof HTMLElement ? e.target : null;
				if (t && (t instanceof HTMLAnchorElement || (t instanceof HTMLButtonElement && !t.dataset.sceneRow))) return;
				e.preventDefault();
				if (state?.unfinished?.scene === current.id) onResume(state.unfinished.id);
				else if (state?.canSpeak) onPick(current.id, typed || !state.stt);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [current, scenes, state, typed, onPick, onResume]);

	const sheet = (inline: boolean) => current && <SceneSheet key={`${current.id}-${inline}`} scene={current} lang={lang} state={state} typed={typed} inline={inline} onPick={onPick} onResume={onResume} />;

	return (
		<TaskFrame>
			<div className="@container flex flex-1 flex-col overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl px-5 pt-[5vh] pb-12 @md:px-6">
					<Link href="/" className="lh-wco-gutter inline-flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
						<ArrowLeftIcon className="size-3.5" />
						Today
					</Link>
					<h1 className="mt-5 font-ui text-[28px] font-[600] tracking-[-0.028em] text-foreground">Speak</h1>
					<p className="mt-1 font-prose text-[15px] text-ink-3">{typed || !state?.stt ? "The tutor plays the other person and answers out loud. You write your part." : "The tutor plays the other person and answers out loud. You say your part."}</p>

					{error && (
						<p className="mt-5 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert" data-testid="speak-error">
							{error}{" "}
							<button type="button" onClick={onRetry} className="underline">
								Try again
							</button>
						</p>
					)}
					{state && !state.canSpeak && (
						<EmptyState className="mt-6 max-w-none" testid="speak-nomodel" title="Say a scene out loud with a tutor" action={<AddKeyButton />}>
							<p>In a scene the tutor plays the other person and answers what you say. That needs an AI key.</p>
							<p>Step by step works without one: pick a scene and walk through it line by line.{state.stt ? "" : " Speaking by voice also takes a speech-to-text key, which is optional."}</p>
						</EmptyState>
					)}

					{!state && !error && (
						<p className="mt-8 flex items-center gap-2 font-ui text-sm text-muted-foreground">
							<LoaderCircleIcon className="size-4 animate-spin" /> Loading the scenes…
						</p>
					)}

					{state && (
						<div className="mt-7 grid items-start gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] @5xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
							<div className="flex flex-col gap-6" data-testid="speak-scenes">
								{groups.map((g) => (
									<section key={g.label} aria-label={grouped ? g.label : "Scenes"}>
										{grouped && <h2 className="q-sh !mb-1.5 px-3">{g.label}</h2>}
										<ul className="flex flex-col gap-1">
											{g.scenes.map((s) => {
												const on = s.id === current?.id;
												const open = state.unfinished?.scene === s.id;
												return (
													<li key={s.id}>
														<button
															type="button"
															onClick={() => setSelected(s.id)}
															aria-current={on ? "true" : undefined}
															data-scene-row={s.id}
															data-testid={`scene-${s.id}`}
															className={cn("lh-press flex w-full min-w-0 items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors", on ? "bg-well" : "hover:bg-well")}
														>
															<span className="min-w-0 flex-1">
																<span className={cn("block truncate font-ui text-[15px] font-[600] tracking-[-0.01em]", on ? "text-foreground" : "text-ink-2")} lang={lang.tag}>
																	{s.title}
																</span>
																<span className="block truncate font-prose text-[13px] text-ink-3">{s.blurb}</span>
															</span>
															{open ? (
																<span className="shrink-0 font-ui text-xs font-[550] text-teal-2">unfinished</span>
															) : s.done > 0 ? (
																<span className="shrink-0 font-ui text-xs tabular-nums text-ink-4" title={`Said ${s.done === 1 ? "once" : `${s.done} times`}`}>
																	{s.done}×
																</span>
															) : null}
														</button>
														{on && <div className="mt-2 mb-4 @3xl:hidden">{sheet(true)}</div>}
													</li>
												);
											})}
										</ul>
									</section>
								))}
								<p className="hidden px-3 font-ui text-xs text-ink-3 pointer-fine:@3xl:block">
									<kbd className={KBD}>↑</kbd> <kbd className={KBD}>↓</kbd> pick · <kbd className={KBD}>Enter</kbd> starts · <kbd className={KBD}>Esc</kbd> leaves
								</p>
							</div>
							<div className="sticky top-6 hidden @3xl:block">{sheet(false)}</div>
						</div>
					)}

					{state && (
						<p className="mt-10 font-ui text-xs text-muted-foreground">
							{state.stt ? `Voice: ${state.stt === "elevenlabs" ? "ElevenLabs" : state.stt === "groq" ? "Groq" : "Deepgram"} speech-to-text, your recordings kept with the scene.` : "No speech-to-text key yet (ElevenLabs, Groq or Deepgram in Settings → API keys): lines are typed until then."}
						</p>
					)}
					<SourcesNote feature="speak" className="mt-6" />
				</div>
			</div>
		</TaskFrame>
	);
}

function SceneSheet({ scene, lang, state, typed, inline, onPick, onResume }: { scene: SpeakSceneEntry; lang: { id: string; tag: string }; state: SpeakState | null; typed: boolean; inline: boolean; onPick: (id: string, typed: boolean) => void; onResume: (id: string) => void }) {
	const canSpeak = !!state?.canSpeak;
	// Without speech-to-text a line can only be typed, so the mic is not offered.
	const byVoice = !!state?.stt;
	const keyboardFirst = typed || !byVoice;
	const unfinished = state?.unfinished?.scene === scene.id ? state.unfinished : null;
	const opening = scene.scripted ? scriptFor(scene.id, lang.id)?.turns[0]?.tutor : undefined;
	const tid = (id: string) => (inline ? undefined : id);
	const script = `/speak?scene=${scene.id}&mode=script`;
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

	let actions: React.ReactNode;
	if (unfinished) {
		actions = (
			<>
				<button type="button" onClick={() => onResume(unfinished.id)} className={PRIMARY} data-testid={tid("speak-resume")}>
					<RepeatIcon className="size-4" />
					Carry on
					<kbd className={cn(KBD, "hidden bg-white/15 text-current shadow-none pointer-fine:inline-flex")}>Enter</kbd>
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
				<button type="button" onClick={() => onPick(scene.id, keyboardFirst)} className={PRIMARY} data-testid={tid("speak-start")}>
					{keyboardFirst ? keyboard : voice}
					<kbd className={cn(KBD, "hidden bg-white/15 text-current shadow-none pointer-fine:inline-flex")}>Enter</kbd>
				</button>
				{byVoice && (
					<button type="button" onClick={() => onPick(scene.id, !keyboardFirst)} className={SECONDARY} data-testid={tid("speak-start-other")}>
						{keyboardFirst ? voice : keyboard}
					</button>
				)}
				{scene.scripted && (
					<Link href={script} className={QUIET} data-testid={tid(`scene-script-${scene.id}`)}>
						<ListChecksIcon className="size-4" />
						Step by step
					</Link>
				)}
			</>
		);
	} else if (scene.scripted) {
		actions = (
			<Link href={script} className={PRIMARY} data-testid={tid(`scene-script-${scene.id}`)}>
				<ListChecksIcon className="size-4" />
				Step by step
			</Link>
		);
	} else {
		actions = <p className="font-prose text-sm text-ink-3">This scene needs an AI key; it has no step-by-step script in this language yet.</p>;
	}

	return (
		<article className={cn(inline ? "ml-3 border-l border-[var(--q-line-2)] pl-3" : "lh-rise border-l border-[var(--q-line)] pl-8")} data-testid={tid("speak-sheet")} aria-label={scene.title}>
			<div className={cn(inline ? "py-2" : "pt-1 pb-2")}>
				{/* Opened under its row, the row already names the scene. */}
				{!inline && (
					<>
						{scene.why && <p className="font-ui text-[13px] font-[550] text-teal-2">{scene.why === "chapter" ? "Your chapter's scene" : "One of your goals"}</p>}
						<h2 className={cn("font-ui text-[30px] font-[600] tracking-[-0.028em] text-foreground @4xl:text-[34px]", scene.why && "mt-1")} lang={lang.tag}>
							{scene.title}
						</h2>
						<p className="mt-1 font-prose text-base text-ink-2">{scene.blurb}</p>
					</>
				)}

				<dl className={cn("grid gap-x-6 gap-y-3 font-prose text-[15px] @md:grid-cols-[7rem_minmax(0,1fr)]", !inline && "mt-5 border-t border-border pt-5")}>
					<dt className="font-ui text-[13px] font-[550] text-ink-3 @md:pt-px">You meet</dt>
					<dd className="-mt-2 text-foreground @md:mt-0">{sceneCounterpart(scene.brief)}</dd>
					<dt className="font-ui text-[13px] font-[550] text-ink-3 @md:pt-px">Your part</dt>
					<dd className="-mt-2 text-foreground @md:mt-0">{scene.task}</dd>
				</dl>

				{opening && (
					<figure className="mt-6 rounded-xl bg-well p-4" aria-label="How it opens">
						<figcaption className="font-ui text-xs font-[550] text-ink-3">It opens like this</figcaption>
						<blockquote className="mt-2 max-w-[85%]">
							<p className="font-prose text-lg font-[550] text-foreground" lang={lang.tag}>
								{tutorLineText(opening)}
							</p>
							<p className="mt-0.5 font-prose text-[13px] text-ink-3">{opening.en}</p>
						</blockquote>
						{/* The learner's line is still empty: the answer line with its cursor (E59). */}
						<div className="mt-3 flex items-center justify-end gap-2" aria-hidden="true">
							<span className="font-ui text-xs text-ink-3">{keyboardFirst ? "you write" : "you say"}</span>
							<span className="relative h-6 w-28 border-b-2 border-ink-4">
								<span className="absolute bottom-1 left-1 h-4 w-0.5 rounded-full bg-teal" />
							</span>
						</div>
					</figure>
				)}

				<div className="mt-6 flex flex-wrap items-center gap-2">{actions}</div>

				<p className="mt-4 font-ui text-xs text-ink-3" data-testid={tid("speak-history")}>
					{unfinished
						? `Started and not finished: ${unfinished.turns} ${unfinished.turns === 1 ? "line" : "lines"} said so far.`
						: scene.last
							? `Said ${scene.done === 1 ? "once" : `${scene.done} times`} · last on ${shortDate(scene.last.at)}: ${scene.last.turns} ${scene.last.turns === 1 ? "line" : "lines"}, ${scene.last.corrections === 0 ? "nothing to fix" : `${scene.last.corrections} to fix`}`
							: "Not said yet."}
				</p>
			</div>
			{canSpeak && (
				<p className="mt-5 border-t border-border pt-4 pb-1 font-prose text-[13px] text-ink-3">
					{keyboardFirst ? "Type each line and press Enter." : "Press the mic, speak, press again."} A slip in an ending comes back for you to fix; the rest waits for the end.
				</p>
			)}
		</article>
	);
}
