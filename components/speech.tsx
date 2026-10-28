"use client";

/**
 * Speech in the browser (LangHarness, spec D4 / Phase 6): the play button
 * on every `say:` span, the review page's audio, and the playback-speed
 * preference. Audio comes from /api/tts (ElevenLabs → Edge → Piper,
 * cached server-side); a 204 means no server voice worked and the browser
 * speaks with window.speechSynthesis instead.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { LoaderCircleIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, isLanguageId, type LanguageInfo } from "@/src/core";

// ─── The active language (fetched once per page load) ──────────────────────

let profilePromise: Promise<LanguageInfo> | null = null;

export function activeLanguage(): Promise<LanguageInfo> {
	profilePromise ??= fetch("/api/profile")
		.then((r) => r.json() as Promise<{ active?: string }>)
		.then((p) => (isLanguageId(p.active) ? LANGUAGES[p.active] : LANGUAGES.slovak))
		.catch(() => LANGUAGES.slovak);
	return profilePromise;
}

export function useActiveLanguage(): LanguageInfo | null {
	const [lang, setLang] = useState<LanguageInfo | null>(null);
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

let current: HTMLAudioElement | null = null;

function speakWithBrowser(text: string, lang: LanguageInfo, rate: number): Promise<void> {
	return new Promise((resolve) => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
		window.speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = lang.tag;
		u.rate = rate;
		const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.code));
		if (voice) u.voice = voice;
		u.onend = () => resolve();
		u.onerror = () => resolve();
		window.speechSynthesis.speak(u);
	});
}

/** Speak `text` in the active language (or `lang`). Resolves when playback
 *  ends; a new call stops whatever was playing. */
export async function speak(text: string, lang?: LanguageInfo): Promise<void> {
	const language = lang ?? (await activeLanguage());
	const rate = currentSpeed();
	current?.pause();
	const url = `/api/tts?lang=${language.code}&text=${encodeURIComponent(text)}`;
	const res = await fetch(url).catch(() => null);
	if (!res || res.status === 204 || !res.ok) return speakWithBrowser(text, language, rate);
	const blob = await res.blob();
	const src = URL.createObjectURL(blob);
	const audio = new Audio(src);
	audio.playbackRate = rate;
	current = audio;
	await new Promise<void>((resolve) => {
		audio.onended = () => resolve();
		audio.onerror = () => resolve();
		audio.play().catch(() => resolve());
	});
	URL.revokeObjectURL(src);
}

/** A speaker button for a phrase. */
export function PlayButton({ text, className, label }: { text: string; className?: string; label?: string }) {
	const [busy, setBusy] = useState(false);
	const play = () => {
		if (busy) return;
		setBusy(true);
		void speak(text).finally(() => setBusy(false));
	};
	// A span with the button role, not a <button>: the phrase can sit inside
	// a quiz option or any other button, where a nested <button> is invalid
	// HTML and broke hydration of the chat view.
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

/** The rendering of a `say: …` inline-code span: the phrase in the
 *  target language with its play button. */
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
