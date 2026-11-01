"use client";

/**
 * Browser speech: the play button on each `say:` span, the review audio, and
 * the playback-speed preference. Audio comes from /api/tts (cached server-side).
 * A 204 means no server voice worked, so the browser speaks with speechSynthesis.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { LoaderCircleIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { soundOn, subscribeSound, volume } from "@/components/lesson/sound";
import { LANGUAGES, isLanguageId, type LanguageInfo } from "@/src/core";

// ─── The active language (fetched once per page load) ──────────────────────

let profilePromise: Promise<LanguageInfo> | null = null;
// Set once the language arrives, so later mounts render it on the first frame.
let knownLanguage: LanguageInfo | null = null;

export function activeLanguage(): Promise<LanguageInfo> {
	profilePromise ??= fetch("/api/profile")
		.then((r) => r.json() as Promise<{ active?: string }>)
		.then((p) => (isLanguageId(p.active) ? LANGUAGES[p.active] : LANGUAGES.slovak))
		.catch(() => LANGUAGES.slovak)
		.then((l) => {
			knownLanguage = l;
			return l;
		});
	return profilePromise;
}

export function useActiveLanguage(): LanguageInfo | null {
	const [lang, setLang] = useState<LanguageInfo | null>(() => knownLanguage);
	useEffect(() => {
		let live = true;
		void activeLanguage().then((l) => live && setLang(l));
		return () => {
			live = false;
		};
	}, []);
	return lang;
}

// ─── Playback speed (per-viewer preference) ────────────────────────────────

export const SPEEDS = [0.75, 1, 1.25] as const;
const SPEED_KEY = "lh-tts-speed";
const speedListeners = new Set<() => void>();

function readSpeed(): number {
	try {
		const v = Number(localStorage.getItem(SPEED_KEY));
		return (SPEEDS as readonly number[]).includes(v) ? v : 1;
	} catch {
		return 1;
	}
}

export function setSpeed(v: number): void {
	try {
		localStorage.setItem(SPEED_KEY, String(v));
	} catch {
		// storage blocked — the choice lasts for this page only
	}
	memorySpeed = v;
	for (const l of speedListeners) l();
}

let memorySpeed: number | null = null;
function currentSpeed(): number {
	return memorySpeed ?? (memorySpeed = readSpeed());
}

export function useSpeed(): number {
	return useSyncExternalStore(
		(cb) => {
			speedListeners.add(cb);
			return () => speedListeners.delete(cb);
		},
		currentSpeed,
		() => 1,
	);
}

export function SpeedToggle({ className }: { className?: string }) {
	const speed = useSpeed();
	const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length] ?? 1;
	return (
		<button
			type="button"
			onMouseDown={(e) => e.preventDefault()}
			onClick={() => setSpeed(next)}
			aria-label={`Playback speed ${speed}×, click for ${next}×`}
			title="Playback speed"
			className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
		>
			{speed}×
		</button>
	);
}

// ─── Playing ───────────────────────────────────────────────────────────────

/** The clip now playing and its loudness factor, so a volume change is heard at once. */
let playing: { audio: HTMLAudioElement; gain: number } | null = null;
subscribeSound(() => {
	if (playing) playing.audio.volume = Math.min(1, volume() * playing.gain);
});

/** The sound now playing, with a way to stop it that also settles the promise
 *  its caller awaits. */
let stopCurrent: (() => void) | null = null;
/** Bumped by every call and by stopSpeaking, so a clip still downloading when
 *  the learner moves on or mutes never starts. */
let generation = 0;

/** Silence everything now: the clip or voice playing, and a clip still loading. */
export function stopSpeaking(): void {
	generation++;
	const stop = stopCurrent;
	stopCurrent = null;
	stop?.();
	if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakWithBrowser(text: string, lang: LanguageInfo, rate: number): Promise<void> {
	return new Promise((resolve) => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
		window.speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = lang.tag;
		u.rate = rate;
		u.volume = volume();
		const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.code));
		if (voice) u.voice = voice;
		const finish = () => {
			if (stopCurrent === stop) stopCurrent = null;
			resolve();
		};
		const stop = () => {
			window.speechSynthesis.cancel();
			finish();
		};
		stopCurrent = stop;
		u.onend = finish;
		u.onerror = finish;
		window.speechSynthesis.speak(u);
	});
}

export interface SpeakOptions {
	/** A voice id (a story character) or "female" | "male". */
	voice?: string;
	gender?: "female" | "male";
	style?: "narration" | "dialogue";
	/** The snail button: this one play is slower, the speed setting stays as it is. */
	slow?: boolean;
}

/** Always slower than the learner's own speed, but not below 0.6×, where the
 *  browser's pitch-keeping time-stretch starts to smear the voice. */
export function slowRate(speed: number): number {
	return Math.max(0.6, Math.min(0.7, speed * 0.8));
}

// ─── Loudness ──────────────────────────────────────────────────────────────

/** The voices differ by up to 7 dB (measured on data/audio: -15 to -22 dBFS
 *  of speech). Louder clips are turned down to this level; the audio
 *  element cannot go above 1, so quieter ones play as they are. */
const TARGET_DB = -20;
const gains = new Map<string, Promise<number>>();

/** The volume factor that brings a clip to TARGET_DB, from the mean power of
 *  its 50 ms windows within 30 dB of the loudest (pauses do not count). */
function clipGain(key: string, blob: Blob): Promise<number> {
	let gain = gains.get(key);
	if (!gain) {
		gain = measureGain(blob);
		gains.set(key, gain);
	}
	return gain;
}

async function measureGain(blob: Blob): Promise<number> {
	if (typeof OfflineAudioContext === "undefined") return 1;
	try {
		const buffer = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await blob.arrayBuffer());
		const data = buffer.getChannelData(0);
		const size = Math.round(buffer.sampleRate * 0.05);
		const powers: number[] = [];
		for (let i = 0; i + size <= data.length; i += size) {
			let p = 0;
			for (let j = i; j < i + size; j++) p += data[j]! * data[j]!;
			powers.push(p / size);
		}
		const floor = Math.max(...powers) / 1000;
		const speech = powers.filter((p) => p >= floor);
		if (speech.length === 0) return 1;
		const db = 10 * Math.log10(speech.reduce((a, b) => a + b, 0) / speech.length);
		return Math.min(1, 10 ** ((TARGET_DB - db) / 20));
	} catch {
		return 1;
	}
}

/** Speaks `text` in the active language (or `lang`). Resolves when playback ends; a new call stops whatever was playing. */
export async function speak(text: string, lang?: LanguageInfo, opts: SpeakOptions = {}): Promise<void> {
	stopSpeaking();
	// Muted: nothing plays, and no paid voice is fetched.
	if (!soundOn()) return;
	const mine = generation;
	const language = lang ?? (await activeLanguage());
	const rate = opts.slow ? slowRate(currentSpeed()) : currentSpeed();
	const q = new URLSearchParams({ lang: language.code, text });
	if (opts.voice) q.set("voice", opts.voice);
	if (opts.gender) q.set("gender", opts.gender);
	if (opts.style) q.set("style", opts.style);
	const url = `/api/tts?${q.toString()}`;
	const res = await fetch(url).catch(() => null);
	// A newer call or a mute arrived while this one was loading: drop it.
	if (mine !== generation || !soundOn()) return;
	if (!res || res.status === 204 || !res.ok) return speakWithBrowser(text, language, rate);
	const blob = await res.blob();
	if (mine !== generation || !soundOn()) return;
	const gain = await clipGain(url, blob);
	if (mine !== generation || !soundOn()) return;
	const src = URL.createObjectURL(blob);
	const audio = new Audio(src);
	audio.preload = "auto";
	audio.volume = Math.min(1, volume() * gain);
	audio.playbackRate = rate;
	await new Promise<void>((resolve) => {
		const finish = () => {
			if (stopCurrent === stop) stopCurrent = null;
			if (playing?.audio === audio) playing = null;
			URL.revokeObjectURL(src);
			resolve();
		};
		const stop = () => {
			audio.pause();
			audio.currentTime = 0;
			finish();
		};
		stopCurrent = stop;
		playing = { audio, gain };
		audio.onended = finish;
		audio.onerror = (err) => {
			console.warn("[Speech] audio element error:", err);
			finish();
		};
		audio.play().catch((err) => {
			console.warn("[Speech] audio play rejected:", err);
			finish();
		});
	});
}

/** Warms the browser cache with a sentence's audio, using the same request speak() makes. */
export function prefetchSpeech(text: string, code: string): void {
	if (!soundOn()) return;
	void fetch(`/api/tts?${new URLSearchParams({ lang: code, text }).toString()}`)
		.then((r) => r.blob())
		.catch(() => {});
}

/** A speaker button for a phrase. */
export function PlayButton({ text, className, label }: { text: string; className?: string; label?: string }) {
	const [busy, setBusy] = useState(false);
	const play = () => {
		if (busy) return;
		setBusy(true);
		void speak(text).finally(() => setBusy(false));
	};
	// A span with button role: a nested <button> is invalid inside a quiz option and breaks hydration.
	return (
		<span
			role="button"
			tabIndex={0}
			onMouseDown={(e) => e.preventDefault()}
			onClick={(e) => {
				e.stopPropagation();
				play();
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					play();
				}
			}}
			aria-label={label ?? `Play “${text}”`}
			title="Play"
			className={cn(
				"inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md align-middle text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
				className,
			)}
		>
			{busy ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <Volume2Icon className="size-3.5" />}
		</span>
	);
}

/** Renders a `say: …` span: the phrase in the target language, with its play button. */
export function SpokenPhrase({ text }: { text: string }) {
	const lang = useActiveLanguage();
	return (
		<span className="lh-spoken inline-flex items-baseline gap-0.5 rounded-md bg-primary/5 pl-1.5 pr-0.5 font-medium text-foreground" data-testid="spoken-phrase" lang={lang?.code ?? "sk"}>
			<span>{text}</span>
			<PlayButton text={text} className="size-5 self-center" />
		</span>
	);
}

/** `say: Dobrý deň` → "Dobrý deň"; anything else → null. */
export function spokenText(code: string): string | null {
	const m = /^\s*say:\s*([\s\S]+?)\s*$/i.exec(code);
	return m?.[1] ?? null;
}
