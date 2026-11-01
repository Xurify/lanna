"use client";
/**
 * Device preferences stored on this device: spoken audio speed, lesson sounds,
 * and word lookup translation mode (Dictionary, Hybrid, or Google Translate).
 */

import { useEffect, useState } from "react";
import { SPEEDS, setSpeed, useSpeed } from "@/components/speech";
import { setSoundOn, soundOn } from "@/components/lesson/sound";
import { SettingsRow, SettingsSegmented, Toggle } from "./controls.tsx";

export type WordTranslationMode = "dictionary" | "hybrid" | "google";

const WORD_TRANSLATION_MODE_KEY = "lh:word-translation-mode";
const WORD_TRANSLATION_MODE_EVENT = "lh:word-translation-mode-change";

export function getWordTranslationMode(): WordTranslationMode {
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

export function setWordTranslationMode(mode: WordTranslationMode): void {
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

const WORD_MODE_OPTIONS: readonly { value: WordTranslationMode; label: string }[] = [
	{ value: "dictionary", label: "Dictionary" },
	{ value: "hybrid", label: "Hybrid" },
	{ value: "google", label: "Google Translate" },
];

export function WordLookupModeRow() {
	const [mode, setMode] = useWordTranslationMode();
	return (
		<SettingsRow
			label="Word lookup translation"
			hint="Hybrid combines Google Translate's surface translation with local lemma & grammar resolution. Dictionary uses only the offline lexicon; Google Translate shows direct surface translations."
			testid="row-word-lookup-mode"
		>
			<SettingsSegmented
				options={WORD_MODE_OPTIONS}
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
			hint="How fast spoken lessons and listening play. Saved on this device."
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
