"use client";

/**
 * Zvuk, the sound step (phase 7, src/core/sounds.ts): a listening check on
 * the two twins, then shadowing. Each line plays, the learner has the gap
 * the tutorial asks for (SHADOW_GAP_MS), then speaks the line; the recording
 * goes through the same speech-to-text and clarity score a Speak line uses,
 * so nothing here needs an Azure key. A line is clear at the Speak bar
 * (PRON_CLEAR); three tries, then it is left as not yet. A finished round
 * is saved to its path unit (POST /api/sound).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { speak, stopSpeaking } from "@/components/speech";
import { micSupported, Recorder, scoreClip, transcribeClip } from "@/components/speak/recorder";
import { PronChip } from "@/components/speak/pron";
import { useActiveTime } from "@/components/use-active-time";
import { SettingsLink } from "@/components/settings/settings-link";
import { COLUMN, Dock, OptionTile, PracticeCard, TaskFrame, TaskTop } from "@/components/task-frame";
import { PRIMARY, QUIET, SECONDARY } from "@/components/ui/learn-buttons";
import {
	LISTEN_ITEMS,
	listenOrder,
	SHADOW_GAP_MS,
	SHADOW_MAX_MS,
	SHADOW_TRIES,
	shadowVerdict,
	type PronScore,
	type SoundDef,
} from "@/src/core";

type Phase = "listen" | "shadow" | "done";
type Stage = "ready" | "playing" | "gap" | "saying" | "scoring" | "scored";
type LineResult = "clear" | "not-yet" | "unscored";

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export function SoundPlayer({ sound, chapterTitle }: { sound: SoundDef; chapterTitle: string }) {
	const [phase, setPhase] = useState<Phase>("listen");
	const [order, setOrder] = useState<string[] | null>(null);
	const [item, setItem] = useState(0);
	const [chosen, setChosen] = useState<string | null>(null);
	const [, setHeardRight] = useState(0);
	const [micOk, setMicOk] = useState(false);

	const [line, setLine] = useState(0);
	const [tries, setTries] = useState(0);
	const [stage, setStage] = useState<Stage>("ready");
	const [score, setScore] = useState<PronScore | null>(null);
	const [heard, setHeard] = useState("");
	const [note, setNote] = useState<string | null>(null);
	const [sttMissing, setSttMissing] = useState(false);
	const [aloudOnly, setAloudOnly] = useState(false);
	const [results, setResults] = useState<LineResult[]>([]);

	const activeTime = useActiveTime("speak", "interactive");
	const saved = useRef(false);
	useEffect(() => {
		if (phase !== "done" || saved.current) return;
		saved.current = true;
		void fetch("/api/sound", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				id: sound.id,
				clear: results.filter((r) => r === "clear").length,
				scored: results.filter((r) => r !== "unscored").length,
				ms: activeTime.finish(),
				tz: new Date().getTimezoneOffset(),
			}),
		}).catch(() => {});
	}, [phase, results, sound, activeTime]);

	const recorder = useRef<Recorder | null>(null);
	/** Bumped on every step, so a late timer or recording never writes into a later one. */
	const run = useRef(0);

	// The order is drawn after mount, so the server and the first paint agree.
	useEffect(() => {
		setOrder(listenOrder(sound));
		setMicOk(micSupported());
	}, [sound]);

	useEffect(() => {
		return () => {
			run.current++;
			stopSpeaking();
			recorder.current?.cancel();
		};
	}, []);

	const word = order?.[item] ?? "";
	const shadowLine = sound.lines[line] ?? "";

	// ── Listening check ────────────────────────────────────────────────

	function pick(sk: string) {
		if (chosen || !order) return;
		setChosen(sk);
		if (sk === word) setHeardRight((n) => n + 1);
	}

	function nextItem() {
		setChosen(null);
		if (item + 1 >= LISTEN_ITEMS) {
			setPhase("shadow");
			setLine(0);
			setTries(0);
			setResults([]);
			setStage("ready");
			return;
		}
		setItem(item + 1);
	}

	// ── Shadowing ──────────────────────────────────────────────────────

	async function listenLine(index: number) {
		const id = ++run.current;
		setStage("playing");
		setNote(null);
		setAloudOnly(false);
		setSttMissing(false);
		setScore(null);
		await speak(sound.lines[index] ?? "").catch(() => undefined);
		if (id !== run.current) return;
		setStage("gap");
		await delay(SHADOW_GAP_MS);
		if (id !== run.current) return;
		// Without a microphone there is nothing to score: the learner says it aloud and presses Next.
		if (!micOk) {
			setStage("ready");
			setAloudOnly(true);
			setSttMissing(false);
			setNote("Say it aloud, then press Next. Without a microphone the line is not scored.");
			return;
		}
		await startSaying();
	}

	async function startSaying() {
		const rec = new Recorder();
		recorder.current = rec;
		setStage("saying");
		try {
			await rec.start({ maxMs: SHADOW_MAX_MS, silenceMs: 900, onAutoStop: () => void finishSaying() });
		} catch {
			recorder.current = null;
			setStage("ready");
			setNote("The microphone is blocked. Allow it for this site, then press Listen, then say it.");
		}
	}

	async function finishSaying() {
		const rec = recorder.current;
		if (!rec) return;
		recorder.current = null;
		const id = run.current;
		setStage("scoring");
		try {
			const clip = await rec.stop();
			if (id !== run.current) return;
			if (clip.spokeAt === null) {
				setStage("ready");
				setNote("Nothing heard. Say it again.");
				return;
			}
			const text = await transcribeClip(clip.wav);
			if (id !== run.current) return;
			const s = await scoreClip(clip.wav, shadowLine, text);
			if (id !== run.current) return;
			if (!s) {
				setStage("ready");
				setNote("Nothing heard. Say it again.");
				return;
			}
			setHeard(text);
			setScore(s);
			setStage("scored");
			if (shadowVerdict(s.overall) === "clear") {
				setNote(null);
			} else {
				setTries((t) => t + 1);
			}
		} catch {
			if (id !== run.current) return;
			setSttMissing(true);
			setStage("ready");
		}
	}

	function scoreIsClear() {
		return score ? shadowVerdict(score.overall) === "clear" : false;
	}

	function advance(result: LineResult) {
		run.current++;
		setResults((r) => [...r, result]);
		setScore(null);
		setHeard("");
		setNote(null);
		setAloudOnly(false);
		setSttMissing(false);
		setTries(0);
		if (line + 1 >= sound.lines.length) {
			setPhase("done");
			return;
		}
		setLine(line + 1);
		setStage("ready");
	}

	function nextLine() {
		// Clear leaves the line clear; any other scored try leaves it not yet (the learner chose to move on, or had no tries left); nothing scored is unscored.
		if (scoreIsClear()) advance("clear");
		else if (score) advance("not-yet");
		else advance("unscored");
	}

	function retry() {
		run.current++;
		setScore(null);
		setHeard("");
		setStage("ready");
		void listenLine(line);
	}

	function restart() {
		run.current++;
		saved.current = false;
		activeTime.restart();
		setPhase("listen");
		setOrder(listenOrder(sound));
		setItem(0);
		setChosen(null);
		setHeardRight(0);
		setLine(0);
		setTries(0);
		setResults([]);
		setScore(null);
		setNote(null);
		setAloudOnly(false);
		setSttMissing(false);
		setStage("ready");
	}

	// ── Views ──────────────────────────────────────────────────────────

	const progress =
		phase === "listen"
			? item / (LISTEN_ITEMS + sound.lines.length)
			: phase === "shadow"
				? (LISTEN_ITEMS + line) / (LISTEN_ITEMS + sound.lines.length)
				: 1;
	const count =
		phase === "listen"
			? `Listen ${item + 1} of ${LISTEN_ITEMS}`
			: phase === "shadow"
				? `Line ${line + 1} of ${sound.lines.length}`
				: "Done";
	const rightIs = (sk: string) => chosen !== null && sk === word;
	const wrongPicked = (sk: string) => chosen === sk && sk !== word;

	return (
		<TaskFrame>
			<TaskTop progress={progress} label={`${sound.title} · ${chapterTitle}`} count={count} href="/curriculum" />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className={cn(COLUMN, "flex flex-col gap-5 py-8")}>
					<PracticeCard title={sound.title} sub={phase === "listen" ? "Which one did you hear?" : undefined}>
						<p className="text-sm leading-relaxed text-ink-2">{sound.rule}</p>
					</PracticeCard>

					{phase === "listen" && order && (
						<div className="flex flex-col gap-4">
							<button
								type="button"
								onClick={() => void speak(word).catch(() => undefined)}
								className={cn(SECONDARY, "self-start")}
							>
								Play the word
							</button>
							<div className="grid grid-cols-2 gap-3">
								{sound.twins.map((t, n) => (
									<OptionTile
										key={t.slug}
										n={n + 1}
										state={rightIs(t.sk) ? "right" : wrongPicked(t.sk) ? "wrong" : chosen ? "dim" : "idle"}
										disabled={chosen !== null}
										onClick={() => pick(t.sk)}
										testId={`sound-option-${n + 1}`}
										lang="sk"
									>
										<span className="font-prose text-[19px]">{t.sk}</span>
									</OptionTile>
								))}
							</div>
							{chosen !== null && (
								<div
									className={cn(
										"rounded-[10px] px-4 py-3 text-sm leading-relaxed",
										chosen === word ? "bg-teal-wash text-foreground" : "bg-miss-soft text-foreground",
									)}
								>
									<p className="font-[550]">{chosen === word ? "Yes, that one." : `No, it was ${word}.`}</p>
									{chosen !== word && <p className="mt-1 text-ink-2">{sound.bridge}</p>}
								</div>
							)}
						</div>
					)}

					{phase === "shadow" && (
						<div className="flex flex-col gap-4">
							<p className="font-prose text-[22px] leading-snug text-foreground" lang="sk" data-testid="shadow-line">
								{shadowLine}
							</p>
							<p className="text-sm text-ink-3">
								{stage === "playing" && "Listen."}
								{stage === "gap" && "Your turn in a moment."}
								{stage === "saying" && "Say the line after the model."}
								{stage === "scoring" && "Checking what you said."}
								{stage === "ready" && !note && `Try ${Math.min(tries + 1, SHADOW_TRIES)} of ${SHADOW_TRIES}.`}
							</p>
							{note && <p className="rounded-[10px] bg-well px-4 py-3 text-sm text-ink-2">{note}</p>}
							{sttMissing && (
								<p className="rounded-[10px] bg-well px-4 py-3 text-sm text-ink-2">
									Speech-to-text is not set up, so the line cannot be scored.{" "}
									<SettingsLink keys className="font-[550] text-teal-2 underline underline-offset-2">
										Add a key in Settings
									</SettingsLink>
									.
								</p>
							)}
							{score && (
								<div className="flex flex-col gap-2">
									<PronChip score={score} big />
									{heard && <p className="text-sm text-ink-2">Heard: {heard}</p>}
								</div>
							)}
						</div>
					)}

					{phase === "done" && (
						<div className="flex flex-col gap-3" data-testid="sound-done">
							<p className="text-base text-foreground">
								{results.filter((r) => r === "clear").length} of {sound.lines.length} lines said clearly.
							</p>
							<ul className="flex flex-col gap-1 text-sm text-ink-2">
								{sound.lines.map((l, i) => (
									<li key={l} className="font-prose" lang="sk">
										{l}{" "}
										<span className="text-ink-3">
											· {results[i] === "clear" ? "clear" : results[i] === "not-yet" ? "not yet" : "not scored"}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>

			<Dock>
				<div className={cn(COLUMN, "flex flex-wrap items-center justify-end gap-2 py-4")}>
					{phase === "listen" && chosen !== null && (
						<button type="button" onClick={nextItem} className={PRIMARY} data-testid="sound-next">
							{item + 1 >= LISTEN_ITEMS ? "Start shadowing" : "Next"}
						</button>
					)}
					{phase === "shadow" && stage === "ready" && !aloudOnly && (
						<button type="button" onClick={() => void listenLine(line)} className={PRIMARY} data-testid="sound-start">
							{score ? "Try again" : "Listen, then say it"}
						</button>
					)}
					{phase === "shadow" && stage === "ready" && aloudOnly && (
						<>
							<button type="button" onClick={() => void speak(shadowLine).catch(() => undefined)} className={SECONDARY}>
								Hear it again
							</button>
							<button type="button" onClick={nextLine} className={PRIMARY} data-testid="sound-next">
								Next
							</button>
						</>
					)}
					{phase === "shadow" && stage === "saying" && (
						<button type="button" onClick={() => void finishSaying()} className={PRIMARY}>
							Done
						</button>
					)}
					{phase === "shadow" && stage === "scored" && (
						<>
							{!scoreIsClear() && tries < SHADOW_TRIES && (
								<button type="button" onClick={retry} className={SECONDARY}>
									Try again
								</button>
							)}
							<button type="button" onClick={nextLine} className={PRIMARY} data-testid="sound-next">
								{scoreIsClear() || tries >= SHADOW_TRIES
									? line + 1 >= sound.lines.length
										? "Finish"
										: "Next line"
									: "Skip this line"}
							</button>
						</>
					)}
					{phase === "shadow" && stage === "ready" && !note && !score && (
						<button type="button" onClick={() => advance("unscored")} className={QUIET}>
							Skip this line
						</button>
					)}
					{phase === "done" && (
						<>
							<button type="button" onClick={restart} className={SECONDARY}>
								Start again
							</button>
							<Link href="/curriculum" className={PRIMARY}>
								Back to the path
							</Link>
						</>
					)}
				</div>
			</Dock>
		</TaskFrame>
	);
}
