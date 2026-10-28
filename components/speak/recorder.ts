"use client";

/**
 * The microphone (LangHarness Speak, 2026-10-28): one recording at a
 * time, as the browser captures it (Opus in WebM where it can), with a
 * loudness meter for the screen and an optional stop-on-silence so a
 * line ends when the voice does. Nothing is streamed; the clip goes to
 * /api/stt whole, then to the scene with the line. The dictation
 * component (components/dictation.tsx) streams to Deepgram for the
 * composer; this is deliberately simpler — a line is a few seconds.
 */

import type { PronScore } from "@/src/core";

export interface Recording {
	blob: Blob;
	mime: string;
	/** Length of the clip. */
	ms: number;
	/** When the voice first rose above the floor, from the start (ms), or null. */
	spokeAt: number | null;
	/** The same take as 16 kHz mono PCM WAV, when asked for (pronunciation scoring). */
	wav?: Blob;
}

export interface RecorderOptions {
	/** 0..1 loudness, about 20 times a second. */
	onLevel?: (level: number) => void;
	/** Stop by itself this long after the voice goes quiet (after it was heard). */
	silenceMs?: number;
	/** Never run longer than this. */
	maxMs?: number;
	/** Called when the recorder stopped itself (silence or the cap). */
	onAutoStop?: () => void;
	/** Also capture raw samples and hand back a 16 kHz WAV (for Azure's scoring). */
	wav?: boolean;
}

const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

/** RMS below this is silence (about -36 dB). */
const FLOOR = 0.016;

export function micSupported(): boolean {
	return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function pickMime(): string {
	if (typeof MediaRecorder === "undefined") return "";
	return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export class Recorder {
	private stream: MediaStream | null = null;
	private rec: MediaRecorder | null = null;
	private ctx: AudioContext | null = null;
	private chunks: BlobPart[] = [];
	private startedAt = 0;
	private spokeAt: number | null = null;
	private lastLoud = 0;
	private timer: ReturnType<typeof setInterval> | null = null;
	private done: Promise<Recording> | null = null;
	private resolve: ((r: Recording) => void) | null = null;
	private mime = "";
	private pcm: Float32Array[] = [];
	private pcmRate = 0;
	private proc: ScriptProcessorNode | null = null;

	get running(): boolean {
		return this.rec?.state === "recording";
	}

	/** Ask for the microphone and start. Throws when refused. */
	async start(opts: RecorderOptions = {}): Promise<void> {
		if (this.rec) return;
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
		this.mime = pickMime();
		this.rec = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
		this.chunks = [];
		this.spokeAt = null;
		this.rec.ondataavailable = (e) => {
			if (e.data.size > 0) this.chunks.push(e.data);
		};
		this.done = new Promise<Recording>((res) => {
			this.resolve = res;
		});
		this.rec.onstop = () => {
			const blob = new Blob(this.chunks, { type: this.mime || "audio/webm" });
			const ms = Math.max(0, Date.now() - this.startedAt);
			const wav = opts.wav && this.pcm.length ? encodeWav(this.pcm, this.pcmRate, 16_000) : undefined;
			this.teardown();
			this.resolve?.({ blob, mime: blob.type, ms, spokeAt: this.spokeAt, ...(wav ? { wav } : {}) });
		};
		// The meter: an analyser on the same stream.
		try {
			this.ctx = new AudioContext();
			const src = this.ctx.createMediaStreamSource(this.stream);
			const analyser = this.ctx.createAnalyser();
			analyser.fftSize = 1024;
			src.connect(analyser);
			if (opts.wav) {
				// Raw samples for the WAV: a processor node (its output stays silent).
				this.pcm = [];
				this.pcmRate = this.ctx.sampleRate;
				this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
				this.proc.onaudioprocess = (e) => {
					this.pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
				};
				src.connect(this.proc);
				this.proc.connect(this.ctx.destination);
			}
			const buf = new Float32Array(analyser.fftSize);
			this.timer = setInterval(() => {
				analyser.getFloatTimeDomainData(buf);
				let sum = 0;
				for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
				const rms = Math.sqrt(sum / buf.length);
				const now = Date.now();
				if (rms > FLOOR) {
					this.spokeAt ??= now - this.startedAt;
					this.lastLoud = now;
				}
				opts.onLevel?.(Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-6) + 50) / 40)));
				if (opts.silenceMs && this.spokeAt !== null && now - this.lastLoud > opts.silenceMs && this.running) {
					this.rec?.stop();
					opts.onAutoStop?.();
				} else if (opts.maxMs && now - this.startedAt > opts.maxMs && this.running) {
					this.rec?.stop();
					opts.onAutoStop?.();
				}
			}, 50);
		} catch {
			// no meter — recording still works
		}
		this.startedAt = Date.now();
		this.lastLoud = this.startedAt;
		this.rec.start();
	}

	/** Stop and get the clip. */
	stop(): Promise<Recording> {
		const done = this.done;
		if (!this.rec || !done) return Promise.resolve({ blob: new Blob([]), mime: "", ms: 0, spokeAt: null });
		if (this.rec.state === "recording") this.rec.stop();
		return done;
	}

	/** Stop and throw the clip away. */
	cancel(): void {
		if (this.rec?.state === "recording") {
			this.rec.onstop = () => this.teardown();
			this.rec.stop();
		} else this.teardown();
	}

	private teardown(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		this.proc?.disconnect();
		this.proc = null;
		this.pcm = [];
		void this.ctx?.close().catch(() => undefined);
		this.ctx = null;
		this.rec = null;
	}
}

/** Mono float samples → 16-bit PCM WAV at `outRate` (linear resampling). */
export function encodeWav(chunks: Float32Array[], inRate: number, outRate: number): Blob {
	let total = 0;
	for (const c of chunks) total += c.length;
	const all = new Float32Array(total);
	let at = 0;
	for (const c of chunks) {
		all.set(c, at);
		at += c.length;
	}
	const ratio = inRate / outRate;
	const n = Math.floor(all.length / ratio);
	const out = new DataView(new ArrayBuffer(44 + n * 2));
	const str = (o: number, v: string) => {
		for (let i = 0; i < v.length; i++) out.setUint8(o + i, v.charCodeAt(i));
	};
	str(0, "RIFF");
	out.setUint32(4, 36 + n * 2, true);
	str(8, "WAVE");
	str(12, "fmt ");
	out.setUint32(16, 16, true);
	out.setUint16(20, 1, true);
	out.setUint16(22, 1, true);
	out.setUint32(24, outRate, true);
	out.setUint32(28, outRate * 2, true);
	out.setUint16(32, 2, true);
	out.setUint16(34, 16, true);
	str(36, "data");
	out.setUint32(40, n * 2, true);
	for (let i = 0; i < n; i++) {
		const pos = i * ratio;
		const k = Math.floor(pos);
		const frac = pos - k;
		const a = all[k] ?? 0;
		const b = all[k + 1] ?? a;
		const v = Math.max(-1, Math.min(1, a + (b - a) * frac));
		out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
	}
	return new Blob([out.buffer], { type: "audio/wav" });
}

/** Score a clip against the line it should be, through /api/pronounce.
 *  Sends the WAV when there is one (Azure wants PCM), else the clip.
 *  Null when nothing was heard; throws when no engine is set. */
export async function scoreClip(clip: { blob: Blob; wav?: Blob }, reference: string, heard?: string): Promise<PronScore | null> {
	const form = new FormData();
	const audio = clip.wav ?? clip.blob;
	form.set("audio", audio, clip.wav ? "line.wav" : "line.webm");
	form.set("reference", reference);
	if (heard) form.set("heard", heard);
	const res = await fetch("/api/pronounce", { method: "POST", body: form });
	const data = (await res.json().catch(() => ({}))) as { score?: PronScore | null; message?: string };
	if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
	return data.score ?? null;
}

/** Send a clip to /api/stt. Returns "" for silence; throws when no engine
 *  is set or the engine refused. */
export async function transcribeClip(blob: Blob): Promise<string> {
	const form = new FormData();
	form.set("audio", blob, "line.webm");
	const res = await fetch("/api/stt", { method: "POST", body: form });
	const data = (await res.json().catch(() => ({}))) as { text?: string; message?: string };
	if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
	return (data.text ?? "").trim();
}
