"use client";

/**
 * The microphone (Speak, rewritten 2026-10-31): one recording
 * at a time, kept as 16 kHz mono PCM WAV — the one format every engine we
 * send a line to accepts (ElevenLabs, Deepgram, Azure's scoring). The
 * browser captures through the same AudioWorklet dictation uses
 * (public/worklets/pcm-capture.js), so there is no MediaRecorder and no
 * container to guess: no WebM, no MP4. The worklet also posts the RMS of
 * every render quantum, which is the loudness meter and the stop-on-
 * silence clock. Nothing is streamed; the clip goes to /api/stt whole,
 * then to the scene with the line.
 */

import type { PronScore } from "@/src/core";

interface Recording {
	/** 16 kHz mono 16-bit PCM WAV — the line, as recorded. */
	wav: Blob;
	/** Length of the clip, from its samples. */
	ms: number;
	/** When the voice first rose above the floor, from the start (ms), or null. */
	spokeAt: number | null;
}

interface RecorderOptions {
	/** 0..1 loudness, about 120 times a second (one per render quantum). */
	onLevel?: (level: number) => void;
	/** Stop by itself this long after the voice goes quiet (after it was heard). */
	silenceMs?: number;
	/** Never run longer than this. */
	maxMs?: number;
	/** Called when the recorder stopped itself (silence or the cap). */
	onAutoStop?: () => void;
}

/** The capture rate, mono. */
const RATE = 16_000;

/** RMS below this is silence (about -36 dB). */
const FLOOR = 0.016;

/** 0..1 loudness from RMS: -50 dB is 0, -10 dB is 1. */
const levelOf = (rms: number) => Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-6) + 50) / 40));

export function micSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof AudioContext !== "undefined" &&
		"audioWorklet" in AudioContext.prototype &&
		!!navigator.mediaDevices?.getUserMedia
	);
}

export class Recorder {
	private stream: MediaStream | null = null;
	private ctx: AudioContext | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private node: AudioWorkletNode | null = null;
	private frames: Int16Array[] = [];
	private startedAt = 0;
	private spokeAt: number | null = null;
	private lastLoud = 0;
	private done: Promise<Recording> | null = null;
	private resolve: ((r: Recording) => void) | null = null;
	private stopped = false;
	private flushed: (() => void) | null = null;
	private opts: RecorderOptions = {};

	get running(): boolean {
		return this.node !== null && !this.stopped;
	}

	/** Ask for the microphone and start. Throws when refused. */
	async start(opts: RecorderOptions = {}): Promise<void> {
		if (this.node) return;
		this.opts = opts;
		this.frames = [];
		this.spokeAt = null;
		this.stopped = false;
		this.done = new Promise<Recording>((res) => {
			this.resolve = res;
		});
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
		});
		try {
			// A context at the capture rate: the worklet's frames arrive as
			// 16 kHz linear16, so nothing is resampled on the way in or out.
			const ctx = new AudioContext({ sampleRate: RATE });
			this.ctx = ctx;
			await ctx.audioWorklet.addModule("/worklets/pcm-capture.js");
			if (ctx.state === "suspended") await ctx.resume();
			const source = ctx.createMediaStreamSource(this.stream);
			this.source = source;
			const node = new AudioWorkletNode(ctx, "pcm-capture");
			this.node = node;
			node.port.onmessage = (e: MessageEvent) =>
				this.onMessage(e.data as { type?: string; rms?: number; buffer?: ArrayBuffer });
			source.connect(node);
			// Pull the graph. The worklet writes no output, so this is silence.
			node.connect(ctx.destination);
			this.startedAt = Date.now();
			this.lastLoud = this.startedAt;
		} catch (err) {
			this.teardown();
			throw err;
		}
	}

	/** Stop and get the clip. */
	async stop(): Promise<Recording> {
		const done = this.done;
		if (!done) return { wav: encodeWav([]), ms: 0, spokeAt: null };
		if (this.stopped) return done;
		this.stopped = true;
		// Cut the input, then take the tail the worklet has not posted yet.
		this.source?.disconnect();
		this.source = null;
		await this.flush();
		const rate = this.ctx?.sampleRate || RATE;
		const frames = this.frames;
		const samples = frames.reduce((n, f) => n + f.length, 0);
		const recording: Recording = {
			wav: encodeWav(frames, rate),
			ms: Math.round((samples / rate) * 1000),
			spokeAt: this.spokeAt,
		};
		this.teardown();
		this.done = null;
		this.resolve?.({ ...recording });
		this.resolve = null;
		return recording;
	}

	/** Stop and throw the clip away. */
	cancel(): void {
		if (!this.node) return;
		this.stopped = true;
		this.done = null;
		this.resolve = null;
		this.teardown();
	}

	private onMessage(m: { type?: string; rms?: number; buffer?: ArrayBuffer }): void {
		if (m.type === "audio" && m.buffer) {
			this.frames.push(new Int16Array(m.buffer));
			return;
		}
		if (m.type === "flushed") {
			this.flushed?.();
			return;
		}
		if (m.type !== "level") return;
		const rms = m.rms ?? 0;
		const now = Date.now();
		if (rms > FLOOR) {
			this.spokeAt ??= now - this.startedAt;
			this.lastLoud = now;
		}
		this.opts.onLevel?.(levelOf(rms));
		if (this.stopped) return;
		if (this.opts.silenceMs && this.spokeAt !== null && now - this.lastLoud > this.opts.silenceMs) this.autoStop();
		else if (this.opts.maxMs && now - this.startedAt > this.opts.maxMs) this.autoStop();
	}

	private autoStop(): void {
		const onAutoStop = this.opts.onAutoStop;
		void this.stop().catch(() => undefined);
		onAutoStop?.();
	}

	/** Ask the worklet for the partial frame it holds; wait for its answer. */
	private flush(): Promise<void> {
		const node = this.node;
		if (!node) return Promise.resolve();
		return new Promise<void>((res) => {
			// The worklet always answers; the timeout is a belt for a dead
			// audio thread, so a stop can never hang the screen.
			const timer = setTimeout(() => {
				this.flushed = null;
				res();
			}, 250);
			this.flushed = () => {
				clearTimeout(timer);
				this.flushed = null;
				res();
			};
			node.port.postMessage({ type: "flush" });
		});
	}

	private teardown(): void {
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		this.source?.disconnect();
		this.source = null;
		if (this.node) {
			this.node.port.onmessage = null;
			this.node.disconnect();
			this.node = null;
		}
		void this.ctx?.close().catch(() => undefined);
		this.ctx = null;
		this.frames = [];
	}
}

/** Mono 16-bit PCM frames → a WAV blob whose header names `rate`. */
export function encodeWav(frames: Int16Array[], rate = RATE): Blob {
	const length = frames.reduce((n, f) => n + f.length, 0);
	const out = new DataView(new ArrayBuffer(44 + length * 2));
	const str = (o: number, v: string) => {
		for (let i = 0; i < v.length; i++) out.setUint8(o + i, v.charCodeAt(i));
	};
	str(0, "RIFF");
	out.setUint32(4, 36 + length * 2, true);
	str(8, "WAVE");
	str(12, "fmt ");
	out.setUint32(16, 16, true);
	out.setUint16(20, 1, true); // PCM
	out.setUint16(22, 1, true); // mono
	out.setUint32(24, rate, true);
	out.setUint32(28, rate * 2, true); // bytes a second
	out.setUint16(32, 2, true); // bytes a sample
	out.setUint16(34, 16, true); // bits a sample
	str(36, "data");
	out.setUint32(40, length * 2, true);
	let at = 44;
	for (const f of frames) {
		for (let i = 0; i < f.length; i++) {
			out.setInt16(at, f[i]!, true);
			at += 2;
		}
	}
	return new Blob([out.buffer], { type: "audio/wav" });
}

/** Score a recording against the line it should be, through /api/pronounce.
 *  Null when nothing was heard; throws when no engine is set. */
export async function scoreClip(wav: Blob, reference: string, heard?: string): Promise<PronScore | null> {
	const form = new FormData();
	form.set("audio", wav, "line.wav");
	form.set("reference", reference);
	if (heard) form.set("heard", heard);
	const res = await fetch("/api/pronounce", { method: "POST", body: form });
	const data = (await res.json().catch(() => ({}))) as { score?: PronScore | null; message?: string };
	if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
	return data.score ?? null;
}

/** Send a recording to /api/stt. Returns "" for silence; throws when no
 *  engine is set or the engine refused. */
export async function transcribeClip(wav: Blob, lang?: string): Promise<string> {
	const form = new FormData();
	form.set("audio", wav, "line.wav");
	if (lang) form.set("lang", lang);
	const res = await fetch("/api/stt", { method: "POST", body: form });
	const data = (await res.json().catch(() => ({}))) as { text?: string; message?: string };
	if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
	return (data.text ?? "").trim();
}
