"use client";
/**
 * Two preferences stored on this device, not in the settings record: spoken
 * audio speed and lesson sounds. Each row writes straight to its store, so the
 * change applies on the next play.
 */

import { useState } from "react";
import { SPEEDS, setSpeed, useSpeed } from "@/components/speech";
import { setSoundOn, soundOn } from "@/components/lesson/sound";
import { SettingsRow, SettingsSegmented, Toggle } from "./controls.tsx";

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
