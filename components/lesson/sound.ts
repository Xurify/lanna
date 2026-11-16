"use client";

/**
 * Lesson sounds (redesign): a chime for a right answer, a soft
 * low blip for a miss, a rising run for a combo step and a short fanfare
 * at the end. Synthesized with WebAudio — no audio files to ship — and
 * quiet by design. Mutable per browser (lh-sound = "0"); lh-volume scales
 * these and the spoken audio together.
 */

const KEY = "lh-sound";
const VOLUME_KEY = "lh-volume";
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** For useSyncExternalStore: a change to the sound switch or the volume, from any page or control. */
export function subscribeSound(cb: () => void): () => void {
	listeners.add(cb);
	return () => void listeners.delete(cb);
}
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
	try {
		return localStorage.getItem(KEY) !== "0";
	} catch {
		return true;
	}
}

export function setSoundOn(on: boolean): void {
	try {
		localStorage.setItem(KEY, on ? "1" : "0");
	} catch {
		// not remembered
	}
	changed();
}

/** 0 to 1, on top of the system volume. A missing or broken value reads as full. */
export function volume(): number {
	try {
		const raw = localStorage.getItem(VOLUME_KEY);
		const v = raw === null ? 1 : Number(raw);
		return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
	} catch {
		return 1;
	}
}

export function setVolume(v: number): void {
	const clamped = Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
	try {
		localStorage.setItem(VOLUME_KEY, String(clamped));
	} catch {
		// not remembered
	}
	changed();
}

/** Create the audio context ahead of the first answer. Building it inside the first tap cost that
 *  tap about 30 ms; it starts suspended and the first sound resumes it. Only once the page has had
 *  a gesture, because an earlier one only earns a console warning. */
export function warmSound(): void {
	if (typeof window === "undefined" || ctx || !soundOn() || !navigator.userActivation?.hasBeenActive) return;
	try {
		ctx = new AudioContext();
	} catch {
		// no sound
	}
}

function audio(): AudioContext | null {
	if (typeof window === "undefined" || !soundOn()) return null;
	try {
		ctx ??= new AudioContext();
		if (ctx.state === "suspended") void ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.08) {
	const level = volume();
	const a = level > 0 ? audio() : null;
	if (!a) return;
	const t = a.currentTime + start;
	const osc = a.createOscillator();
	const g = a.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain * level, t + 0.012);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(a.destination);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

export const sfx = {
	right(combo = 1) {
		// Each combo step lifts the chime a little (capped at an octave).
		const lift = Math.pow(2, Math.min(combo - 1, 12) / 12);
		tone(659 * lift, 0, 0.16, "triangle");
		tone(988 * lift, 0.07, 0.22, "triangle");
	},
	almost() {
		tone(587, 0, 0.14, "triangle", 0.06);
		tone(740, 0.08, 0.18, "triangle", 0.05);
	},
	wrong() {
		tone(196, 0, 0.18, "sine", 0.07);
		tone(165, 0.1, 0.24, "sine", 0.06);
	},
	tap() {
		tone(880, 0, 0.05, "sine", 0.03);
	},
	done() {
		[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, "triangle", 0.07));
	},
	tick() {
		tone(1200, 0, 0.03, "square", 0.015);
	},
};
