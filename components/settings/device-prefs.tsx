"use client";
/**
 * Device preferences stored on this device: spoken audio speed, volume, lesson sounds,
 * and word lookup translation mode (Dictionary, Hybrid, or Translator).
 */

import { useEffect, useState, type ReactNode } from "react";
import { SPEEDS, setSpeed, useSpeed } from "@/components/speech";
import { setSoundOn, setVolume, sfx, soundOn } from "@/components/lesson/sound";
import { useSound } from "@/components/sound-control";
import { Slider } from "@/components/ui/slider";
import { useSettingsSaved } from "@/components/settings-signal";
import type { AuthKeyStatus } from "@/src/core";
import { SettingsRow, SettingsSegmented, Toggle } from "./controls.tsx";
import { ProviderIcon } from "./provider-icons.tsx";

export type WordTranslationMode = "dictionary" | "hybrid" | "google";

const WORD_TRANSLATION_MODE_KEY = "lanna:word-translation-mode";
const WORD_TRANSLATION_MODE_EVENT = "lanna:word-translation-mode-change";

function getWordTranslationMode(): WordTranslationMode {
	if (typeof window === "undefined") return "hybrid";
	try {
		const raw = localStorage.getItem(WORD_TRANSLATION_MODE_KEY);
		if (raw === "dictionary" || raw === "hybrid" || raw === "google") {
			return raw;
		}
	} catch {
		// ignore
	}
	return "hybrid";
}

function setWordTranslationMode(mode: WordTranslationMode): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(WORD_TRANSLATION_MODE_KEY, mode);
		window.dispatchEvent(new CustomEvent(WORD_TRANSLATION_MODE_EVENT, { detail: mode }));
	} catch {
		// ignore
	}
}

export function useWordTranslationMode(): [WordTranslationMode, (next: WordTranslationMode) => void] {
	const [mode, setMode] = useState<WordTranslationMode>("hybrid");

	useEffect(() => {
		setMode(getWordTranslationMode());
		const onUpdate = () => setMode(getWordTranslationMode());
		window.addEventListener(WORD_TRANSLATION_MODE_EVENT, onUpdate);
		window.addEventListener("storage", onUpdate);
		return () => {
			window.removeEventListener(WORD_TRANSLATION_MODE_EVENT, onUpdate);
			window.removeEventListener("storage", onUpdate);
		};
	}, []);

	const update = (next: WordTranslationMode) => {
		setMode(next);
		setWordTranslationMode(next);
	};

	return [mode, update];
}

/** Whether lookups go to DeepL: its key is stored and switched on. Re-read whenever a key is saved, deleted or switched. */
function useDeeplActive(): boolean {
	const [active, setActive] = useState(false);
	const load = () =>
		fetch("/api/keys")
			.then((r) => r.json())
			.then((body: { keys?: AuthKeyStatus[] }) =>
				setActive(Boolean(body.keys?.some((k) => k.id === "DEEPL_API_KEY" && k.present && !k.disabled))),
			)
			.catch(() => setActive(false));
	useEffect(() => {
		void load();
	}, []);
	useSettingsSaved((section) => {
		if (section === "keys") void load();
	});
	return active;
}

export function WordLookupModeRow() {
	const [mode, setMode] = useWordTranslationMode();
	const deepl = useDeeplActive();
	const options: readonly { value: WordTranslationMode; label: string; icon?: ReactNode }[] = [
		{ value: "dictionary", label: "Dictionary" },
		{ value: "hybrid", label: "Hybrid" },
		{
			value: "google",
			label: "Translator",
			icon: <ProviderIcon provider={deepl ? "deepl" : "googletranslate"} className="size-3.5" />,
		},
	];
	return (
		<SettingsRow
			label="Word lookup translation"
			hint="Dictionary: the app's own word list, works offline. Hybrid: a translator's translation, plus the base form and grammar from the dictionary. Translator: its translation only. The translator is DeepL when its key is set in API keys, otherwise Google Translate."
			testid="row-word-lookup-mode"
		>
			<SettingsSegmented
				options={options}
				value={mode}
				onChange={setMode}
				ariaLabel="Word lookup translation mode"
				testid="word-lookup-mode"
			/>
		</SettingsRow>
	);
}

export function PlaybackSpeedRow() {
	const speed = useSpeed();
	return (
		<SettingsRow
			label="Playback speed"
			hint="How fast spoken lessons, listening and the tutor's examples play. Saved on this device."
			testid="row-playback-speed"
		>
			<SettingsSegmented
				options={SPEEDS.map((s): { value: number; label: string } => ({ value: s, label: `${s}×` }))}
				value={speed}
				onChange={setSpeed}
				ariaLabel="Playback speed"
				testid="playback-speed"
			/>
		</SettingsRow>
	);
}

export function VolumeRow() {
	const { level } = useSound();
	return (
		<SettingsRow
			label="Volume"
			hint="Spoken audio and lesson sounds, on top of your system volume. Saved on this device."
			testid="row-volume"
		>
			<div className="flex w-56 shrink-0 items-center gap-3">
				<Slider
					value={level}
					onChange={setVolume}
					onCommit={() => sfx.tap()}
					label="Volume"
					className="flex-1"
					testid="volume"
				/>
				<span className="w-9 text-right font-ui text-xs font-semibold tabular-nums text-muted-foreground">
					{Math.round(level * 100)}%
				</span>
			</div>
		</SettingsRow>
	);
}

export function LessonSoundsRow() {
	const [on, setOn] = useState(() => soundOn());
	return (
		<SettingsRow
			label="Lesson sounds"
			hint="A chime for a right answer, a soft low note for a miss. Saved on this device."
			testid="row-lesson-sounds"
		>
			<Toggle
				checked={on}
				label="Lesson sounds"
				testid="toggle-lesson-sounds"
				onChange={(next) => {
					setSoundOn(next);
					setOn(next);
				}}
			/>
		</SettingsRow>
	);
}
