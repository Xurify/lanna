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

export interface Recording {
	blob: Blob;
	mime: string;
	/** Length of the clip. */
	ms: number;
	/** When the voice first rose above the floor, from the start (ms), or null. */
	spokeAt: number | null;
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
			this.teardown();
			this.resolve?.({ blob, mime: blob.type, ms, spokeAt: this.spokeAt });
		};
		// The meter: an analyser on the same stream.
		try {
			this.ctx = new AudioContext();
			const src = this.ctx.createMediaStreamSource(this.stream);
			const analyser = this.ctx.createAnalyser();
			analyser.fftSize = 1024;
			src.connect(analyser);
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
		void this.ctx?.close().catch(() => undefined);
		this.ctx = null;
		this.rec = null;
	}
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
