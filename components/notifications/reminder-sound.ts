/**
 * Notification Audio Engine.
 *
 * Provides:
 * 1. WebAudio synthesized presets (chime, bell, harp, gentle, subtle).
 * 2. Local custom sound loading, caching, and playback (supporting mp3, wav, ogg, etc.).
 * 3. Shares the lesson sound switch and master volume (lh-sound, lh-volume).
 */

import type { NotificationSoundPreset } from "@/src/core";
import { soundOn, volume as appVolume } from "@/components/lesson/sound";

const CUSTOM_SOUND_KEY = "lh:custom-reminder-sound-data";
const CUSTOM_SOUND_NAME_KEY = "lh:custom-reminder-sound-name";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === "undefined") return null;
	const Context =
		window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	if (!Context) return null;
	if (!audioCtx || audioCtx.state === "closed") {
		audioCtx = new Context();
	}
	if (audioCtx.state === "suspended") {
		audioCtx.resume().catch(() => {});
	}
	return audioCtx;
}

/**
 * Saves a user-uploaded audio file to local storage as base64.
 * Enforces file size limits (<= 2.5 MB) to avoid quota issues.
 */
export async function saveCustomSound(file: File): Promise<{ name: string; size: number }> {
	if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
		throw new Error("File must be an audio format (MP3, WAV, OGG, M4A, etc.)");
	}

	const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
	if (file.size > MAX_BYTES) {
		throw new Error("Custom audio file must be under 2.5 MB");
	}

	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const result = reader.result as string;
				localStorage.setItem(CUSTOM_SOUND_KEY, result);
				localStorage.setItem(CUSTOM_SOUND_NAME_KEY, file.name);
				resolve({ name: file.name, size: file.size });
			} catch {
				reject(new Error("Could not store audio file in browser storage: quota exceeded"));
			}
		};
		reader.onerror = () => reject(new Error("Failed to read audio file"));
		reader.readAsDataURL(file);
	});
}

export function getCustomSoundInfo(): { name: string | null; hasData: boolean } {
	if (typeof window === "undefined") return { name: null, hasData: false };
	try {
		const name = localStorage.getItem(CUSTOM_SOUND_NAME_KEY);
		const data = localStorage.getItem(CUSTOM_SOUND_KEY);
		return { name, hasData: Boolean(data) };
	} catch {
		return { name: null, hasData: false };
	}
}

export function deleteCustomSound(): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.removeItem(CUSTOM_SOUND_KEY);
		localStorage.removeItem(CUSTOM_SOUND_NAME_KEY);
	} catch {
		// Ignore
	}
}

/**
 * Plays a WebAudio note with smooth attack and exponential release.
 */
function playSynthNote(
	ctx: AudioContext,
	freq: number,
	startTime: number,
	duration: number,
	gainLevel: number,
	type: OscillatorType = "sine",
) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();

	osc.type = type;
	osc.frequency.setValueAtTime(freq, startTime);

	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.start(startTime);
	osc.stop(startTime + duration);
}

/**
 * Plays the chosen reminder sound preset or custom uploaded audio.
 */
export async function playReminderSound(preset: NotificationSoundPreset): Promise<void> {
	if (!soundOn() || preset === "none") return;

	const level = appVolume();
	if (level <= 0.001) return;

	// 1. Custom uploaded sound
	if (preset === "custom") {
		try {
			const dataUrl = localStorage.getItem(CUSTOM_SOUND_KEY);
			if (dataUrl) {
				const audio = new Audio(dataUrl);
				audio.volume = level;
				await audio.play();
				return;
			}
		} catch {
			// Fallback to chime if custom playback fails
		}
	}

	// 2. Synthesized presets via Web Audio API
	const ctx = getAudioContext();
	if (!ctx) return;

	const now = ctx.currentTime;
	const masterGain = level * 0.4;

	switch (preset) {
		case "chime": {
			// Ascending melodic triad: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz)
			playSynthNote(ctx, 523.25, now, 0.45, masterGain * 0.7, "triangle");
			playSynthNote(ctx, 659.25, now + 0.12, 0.45, masterGain * 0.8, "triangle");
			playSynthNote(ctx, 783.99, now + 0.24, 0.75, masterGain * 0.9, "sine");
			break;
		}

		case "bell": {
			// Resonant desk bell: A5 (880Hz) + harmonics with long ringing decay
			playSynthNote(ctx, 880, now, 1.2, masterGain, "sine");
			playSynthNote(ctx, 1760, now, 0.8, masterGain * 0.4, "sine");
			playSynthNote(ctx, 2640, now, 0.5, masterGain * 0.2, "sine");
			break;
		}

		case "harp": {
			// Arpeggiated harp sequence: C5, G5, C6, E6
			playSynthNote(ctx, 523.25, now, 0.5, masterGain * 0.6, "triangle");
			playSynthNote(ctx, 783.99, now + 0.08, 0.5, masterGain * 0.7, "triangle");
			playSynthNote(ctx, 1046.5, now + 0.16, 0.6, masterGain * 0.8, "sine");
			playSynthNote(ctx, 1318.51, now + 0.24, 0.8, masterGain * 0.7, "sine");
			break;
		}

		case "gentle": {
			// Warm soft double chime (marimba style)
			playSynthNote(ctx, 440, now, 0.4, masterGain * 0.7, "sine");
			playSynthNote(ctx, 554.37, now + 0.15, 0.6, masterGain * 0.8, "sine");
			break;
		}

		case "subtle": {
			// Quiet dual click blip
			playSynthNote(ctx, 900, now, 0.08, masterGain * 0.5, "sine");
			playSynthNote(ctx, 1200, now + 0.07, 0.1, masterGain * 0.5, "sine");
			break;
		}

		default: {
			// Default to chime
			playSynthNote(ctx, 523.25, now, 0.45, masterGain * 0.7, "triangle");
			playSynthNote(ctx, 659.25, now + 0.12, 0.45, masterGain * 0.8, "triangle");
			playSynthNote(ctx, 783.99, now + 0.24, 0.75, masterGain * 0.9, "sine");
			break;
		}
	}
}
