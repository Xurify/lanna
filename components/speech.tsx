"use client";

/**
 * Browser speech: the play button on each `say:` span, the review audio, and
 * the playback-speed preference. Audio comes from /api/tts (cached server-side).
 * A 204 means no server voice worked, so the browser speaks with speechSynthesis.
 */

import { useState, useSyncExternalStore } from "react";
import { LoaderCircleIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sharedJson } from "@/lib/shared-fetch";
import { soundOn, subscribeSound, volume } from "@/components/lesson/sound";
import { LANGUAGES, isLanguageId, voiceLanguage, type LanguageInfo } from "@/src/core";

// ─── The active language (fetched once per page load) ──────────────────────────

let profilePromise: Promise<LanguageInfo> | null = null;
let knownLanguage: LanguageInfo | null = null;
const languageListeners = new Set<() => void>();

function activeLanguage(): Promise<LanguageInfo> {
	profilePromise ??= sharedJson<{ active?: string; language?: LanguageInfo }>("/api/profile")
		.then((p) => p.language ?? (isLanguageId(p.active) ? LANGUAGES[p.active] : undefined) ?? LANGUAGES.slovak)
		.catch(() => LANGUAGES.slovak)
		.then((l) => {
			knownLanguage = l;
			languageListeners.forEach((notify) => notify());
			return l;
		});
	return profilePromise;
}

function subscribeLanguage(onChange: () => void): () => void {
	languageListeners.add(onChange);
	void activeLanguage();
	return () => {
		languageListeners.delete(onChange);
	};
}

// React hydrates with the server snapshot (no language) and only then reads the client one. With useState(knownLanguage), a component that hydrated after the fetch had landed started with a language the server HTML did not have, and React threw the tree away ("Hydration failed").
export function useActiveLanguage(): LanguageInfo | null {
	return useSyncExternalStore(
		subscribeLanguage,
		() => knownLanguage,
		() => null,
	);
}

// ─── Playback speed (per-viewer preference) ────────────────────────────────

export const SPEEDS = [0.75, 1, 1.25] as const;
const SPEED_KEY = "lanna-tts-speed";
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
			className={cn(
				"rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
				className,
			)}
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

let voicing: string | null = null;
const voicingListeners = new Set<() => void>();
function setVoicing(text: string | null): void {
	if (voicing === text) return;
	voicing = text;
	for (const listener of voicingListeners) listener();
}

export function useVoicing(): string | null {
	return useSyncExternalStore(
		(listener) => {
			voicingListeners.add(listener);
			return () => voicingListeners.delete(listener);
		},
		() => voicing,
		() => null,
	);
}

/** Silence everything now: the clip or voice playing, and a clip still loading. */
export function stopSpeaking(): void {
	generation++;
	const stop = stopCurrent;
	stopCurrent = null;
	stop?.();
	setVoicing(null);
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
		else
			console.warn(
				`[Speech] this ${navigator.userAgent.includes("Electron") ? "desktop app" : "browser"} has no system voice for ${lang.tag}; nothing may play`,
			);
		const finish = () => {
			if (stopCurrent === stop) stopCurrent = null;
			setVoicing(null);
			resolve();
		};
		const stop = () => {
			window.speechSynthesis.cancel();
			finish();
		};
		stopCurrent = stop;
		u.onend = finish;
		u.onerror = finish;
		setVoicing(text);
		window.speechSynthesis.speak(u);
	});
}

interface SpeakOptions {
	/** A voice id (a story character) or "female" | "male". */
	voice?: string;
	gender?: "female" | "male";
	style?: "narration" | "dialogue";
	/** The snail button: this one play is slower, the speed setting stays as it is. */
	slow?: boolean;
	/** The two words of a sound contrast: ElevenLabs reads both when it can. */
	prefer?: "elevenlabs";
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
const GAIN_WAIT_MS = 1500;

/** The volume factor that brings a clip to TARGET_DB, from the mean power of
 *  its 50 ms windows within 30 dB of the loudest (pauses do not count). */
function clipGain(key: string, blob: Blob): Promise<number> {
	let gain = gains.get(key);
	if (!gain) {
		// The measure only adjusts loudness: if decoding stalls, the clip plays at full volume rather than not at all.
		gain = Promise.race([
			measureGain(blob),
			new Promise<number>((resolve) => setTimeout(() => resolve(1), GAIN_WAIT_MS)),
		]);
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
		let peak = 0;
		for (let i = 0; i + size <= data.length; i += size) {
			let sum = 0;
			for (let j = i; j < i + size; j++) sum += data[j]! * data[j]!;
			const power = sum / size;
			powers.push(power);
			if (power > peak) peak = power;
		}
		if (peak <= 0) return 1;
		const floor = peak / 1000;
		const speech = powers.filter((power) => power >= floor);
		if (speech.length === 0) return 1;
		const db = 10 * Math.log10(speech.reduce((total, power) => total + power, 0) / speech.length);
		return Math.min(1, 10 ** ((TARGET_DB - db) / 20));
	} catch {
		return 1;
	}
}

function ttsUrl(code: string, text: string, options: SpeakOptions = {}): string {
	const query = new URLSearchParams({ lang: code, text });
	if (options.voice) query.set("voice", options.voice);
	if (options.gender) query.set("gender", options.gender);
	if (options.style) query.set("style", options.style);
	if (options.prefer) query.set("prefer", options.prefer);
	return `/api/tts?${query.toString()}`;
}

export async function speak(text: string, lang?: LanguageInfo, opts: SpeakOptions = {}): Promise<void> {
	stopSpeaking();
	if (!soundOn()) return;
	const mine = generation;
	const language = lang ?? (await activeLanguage());
	const rate = opts.slow ? slowRate(currentSpeed()) : currentSpeed();
	const url = ttsUrl(language.code, text, opts);
	const res = await fetch(url).catch(() => null);
	if (mine !== generation || !soundOn()) return;
	if (!res || res.status === 204 || !res.ok) {
		console.warn(
			`[Speech] no server voice (${res ? `HTTP ${res.status}` : "no answer"}${res?.headers.get("x-tts-fallback") ? ", every voice service failed" : ""}); trying the system voice for ${language.tag}`,
		);
		return speakWithBrowser(text, language, rate);
	}
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
			setVoicing(null);
			URL.revokeObjectURL(src);
			resolve();
		};
		let stopped = false;
		const stop = () => {
			stopped = true;
			audio.onerror = null;
			audio.pause();
			// Chromium logs ERR_FILE_NOT_FOUND for a blob URL revoked while the element is still fetching it; dropping the source first aborts that fetch.
			audio.removeAttribute("src");
			audio.load();
			finish();
		};
		stopCurrent = stop;
		playing = { audio, gain };
		setVoicing(text);
		audio.onended = finish;
		audio.onerror = (error) => {
			console.warn("[Speech] audio element error:", error);
			finish();
		};
		audio.play().catch((error) => {
			if (!stopped) console.warn("[Speech] audio play rejected:", error);
			finish();
		});
	});
}

export function prefetchSpeech(text: string, code: string, options: SpeakOptions = {}): void {
	if (!soundOn()) return;
	const url = ttsUrl(code, text, options);
	void fetch(url)
		.then(async (response) => {
			const blob = await response.blob();
			if (response.ok && response.status !== 204) void clipGain(url, blob);
		})
		.catch(() => {});
}

export function PlayButton({
	text,
	className,
	label,
	lang,
}: {
	text: string;
	className?: string;
	label?: string;
	lang?: LanguageInfo;
}) {
	const [loading, setLoading] = useState(false);
	const active = useVoicing() === text;
	const play = () => {
		if (active) {
			stopSpeaking();
			setLoading(false);
			return;
		}
		if (loading) return;
		setLoading(true);
		void speak(text, lang).finally(() => setLoading(false));
	};
	// A span with button role: a nested <button> is invalid inside a quiz option and breaks hydration.
	return (
		<span
			role="button"
			tabIndex={0}
			aria-pressed={active}
			onMouseDown={(event) => event.preventDefault()}
			onClick={(event) => {
				event.stopPropagation();
				play();
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					event.stopPropagation();
					play();
				}
			}}
			aria-label={label ?? (active ? `Stop “${text}”` : `Play “${text}”`)}
			title={active ? "Stop" : "Play"}
			className={cn(
				"inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md align-middle transition-colors hover:bg-accent hover:text-foreground",
				active ? "text-teal-2" : "text-muted-foreground",
				className,
			)}
		>
			{loading && !active ? (
				<LoaderCircleIcon className="size-3.5 animate-spin" />
			) : (
				<Volume2Icon className="size-3.5" />
			)}
		</span>
	);
}

/** Renders a `say: …` span: the phrase in the target language, with its play button.
 *  `lang` reads it in another language's voice (a Czech word in a Slovak chat). */
export function SpokenPhrase({ text, lang: other }: { text: string; lang?: LanguageInfo }) {
	const active = useActiveLanguage();
	const lang = other ?? active;
	return (
		<span
			className="lanna-spoken inline-flex items-baseline gap-0.5 rounded-md bg-primary/5 pl-1.5 pr-0.5 font-medium text-foreground"
			data-testid="spoken-phrase"
			lang={lang?.code}
		>
			<span>{text}</span>
			<PlayButton text={text} lang={other} className="size-5 self-center" />
		</span>
	);
}

/** `say: Dobrý deň` → "Dobrý deň"; anything else → null. */
export function spokenText(code: string): string | null {
	const m = /^\s*say:\s*([\s\S]+?)\s*$/i.exec(code);
	return m?.[1] ?? null;
}

/** `say-cs: Děkuji` → "Děkuji" in the Czech voice; null for anything else,
 *  including a code no voice reads. */
export function spokenInOther(code: string): { text: string; lang: LanguageInfo } | null {
	const m = /^\s*say-([a-z]{2,3}):\s*([\s\S]+?)\s*$/i.exec(code);
	const lang = m ? voiceLanguage(m[1]!.toLowerCase()) : undefined;
	return m && lang ? { text: m[2]!, lang } : null;
}
