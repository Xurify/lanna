"use client";

/**
 * The live call's browser side (Phonic-1 speech-to-speech). The protocol is
 * Phonic's: the socket at wss://api.phonic.ai/v1/sts/ws carries JSON frames;
 * the server says ready_to_start_conversation, the client answers with one
 * config frame, then audio flows both ways as base64 16-bit PCM (input
 * pcm_16000, output pcm_24000). A chunk is at most 40 ms, so this sends
 * 20 ms. The learner's own speech is also kept as WAV per turn and
 * transcribed at the end through /api/stt, so the report quotes what they
 * really said, not what the voice model heard.
 */

import { encodeWav, transcribeClip } from "@/components/speak/recorder";
import { pcmChunks, type LiveCallInput, type LiveStart, type LiveToolEvent, type LiveTurn } from "@/src/core";

const RATE = 16_000;
const SEND_SAMPLES = 320;
const FLOOR = 0.016;
const levelOf = (rms: number) => Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-6) + 50) / 40));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LocalTurn = LiveTurn & { clip: Int16Array[] };

export type LivePhase = "connecting" | "live" | "ending" | "ended";

export interface LiveCallbacks {
	onPhase: (phase: LivePhase, note?: string) => void;
	onTurns: (turns: LiveTurn[]) => void;
	onTool: (event: LiveToolEvent) => void;
	onLevel: (level: number) => void;
	onNotice: (text: string) => void;
	onFinish: (input: LiveCallInput | null, reason: string) => void;
}

interface Frame {
	type?: string;
	audio?: string;
	text?: string;
	tool_call_id?: string;
	tool_name?: string;
	parameters?: Record<string, unknown>;
	message?: string;
	error?: { message?: string };
	conversation_id?: string;
	id?: string;
}

function toInt16(raw: string): Int16Array {
	const bin = atob(raw);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
}

function toBase64(samples: Int16Array): string {
	const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
	let out = "";
	for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(out);
}

export class LiveCall {
	readonly start: LiveStart;
	private cb: LiveCallbacks;
	private ws: WebSocket | null = null;
	private mic: AudioContext | null = null;
	private node: AudioWorkletNode | null = null;
	private stream: MediaStream | null = null;
	private out: AudioContext | null = null;
	private playing = new Set<AudioBufferSourceNode>();
	private playAt = 0;
	private carry: Int16Array | null = null;
	private streaming = false;
	private t0 = Date.now();
	private startedAt = new Date().toISOString();
	private turns: LocalTurn[] = [];
	private tools: LiveToolEvent[] = [];
	private pauses: number[] = [];
	private openLearner: LocalTurn | null = null;
	private openTutor: LocalTurn | null = null;
	private quietSince: number | null = null;
	private quietCounted = false;
	private conversationId: string | undefined;
	private approx = false;
	private finished = false;

	constructor(start: LiveStart, cb: LiveCallbacks) {
		this.start = start;
		this.cb = cb;
	}

	private ms(): number {
		return Date.now() - this.t0;
	}

	private visible(): LiveTurn[] {
		return this.turns.filter((t) => t.text.trim()).map(({ clip: _clip, ...turn }) => turn);
	}

	private emit(): void {
		this.cb.onTurns(this.visible());
	}

	async begin(): Promise<void> {
		this.cb.onPhase("connecting");
		this.t0 = Date.now();
		this.startedAt = new Date().toISOString();
		await this.openMic();
		await new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(this.start.url);
			this.ws = ws;
			const timer = setTimeout(() => reject(new Error("Phonic did not answer in 20 seconds.")), 20_000);
			ws.onopen = () => {
				clearTimeout(timer);
				// Phonic's config opens the conversation: the server answers
				// ready_to_start_conversation once it has it (docs.phonic.ai).
				this.send({ type: "config", ...this.start.config });
				resolve();
			};
			ws.onerror = () => {
				clearTimeout(timer);
				reject(new Error("The live socket could not be opened."));
			};
			ws.onclose = () => {
				if (!this.finished && this.turns.length > 0) void this.finish("The call dropped.");
			};
			ws.onmessage = (e) => this.onMessage(String(e.data));
		});
	}

	private send(frame: Record<string, unknown>): void {
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
	}

	private async openMic(): Promise<void> {
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
		});
		const ctx = new AudioContext({ sampleRate: RATE });
		this.mic = ctx;
		await ctx.audioWorklet.addModule("/worklets/pcm-capture.js");
		if (ctx.state === "suspended") await ctx.resume();
		const source = ctx.createMediaStreamSource(this.stream);
		const node = new AudioWorkletNode(ctx, "pcm-capture");
		this.node = node;
		node.port.onmessage = (e: MessageEvent) => {
			const m = e.data as { type?: string; rms?: number; buffer?: ArrayBuffer };
			if (m.type === "audio" && m.buffer) this.onSamples(new Int16Array(m.buffer));
			else if (m.type === "level") this.onLevel(m.rms ?? 0);
		};
		source.connect(node);
		node.connect(ctx.destination);
	}

	private onSamples(frame: Int16Array): void {
		if (this.openLearner) this.openLearner.clip.push(frame);
		if (!this.streaming) return;
		const { chunks, carry } = pcmChunks(this.carry, frame, SEND_SAMPLES);
		this.carry = carry;
		for (const chunk of chunks) this.send({ type: "audio_chunk", audio: toBase64(chunk) });
	}

	private onLevel(rms: number): void {
		const level = levelOf(rms);
		this.cb.onLevel(level);
		if (!this.openLearner) {
			this.quietSince = null;
			return;
		}
		const now = Date.now();
		if (rms > FLOOR) {
			if (this.quietSince !== null && !this.quietCounted && now - this.quietSince >= 1000)
				this.pauses.push(now - this.quietSince);
			this.quietSince = null;
			this.quietCounted = false;
		} else {
			this.quietSince ??= now;
			if (now - this.quietSince >= 1000) this.quietCounted = true;
		}
	}

	private onMessage(raw: string): void {
		let msg: Frame;
		try {
			msg = JSON.parse(raw) as Frame;
		} catch {
			return;
		}
		switch (msg.type) {
			case "ready_to_start_conversation":
				this.streaming = true;
				break;
			case "input_cancelled":
				this.closeLearner();
				break;
			case "warning":
				this.cb.onNotice(msg.message ?? msg.error?.message ?? "The live engine sent a warning.");
				break;
			case "assistant_chose_not_to_respond":
				this.closeTutor();
				break;
			case "conversation_created":
				this.conversationId = msg.conversation_id ?? msg.id;
				this.cb.onPhase("live");
				break;
			case "user_started_speaking":
				this.stopPlayback();
				this.closeTutor();
				this.openLearnerTurn();
				break;
			case "user_finished_speaking":
				this.closeLearner();
				break;
			case "input_text":
				this.attachLearnerText(msg.text ?? "");
				break;
			case "assistant_started_speaking":
				this.openTutorTurn();
				break;
			case "assistant_finished_speaking":
				this.closeTutor();
				break;
			case "interrupted_response":
				this.stopPlayback();
				this.closeTutor();
				break;
			case "audio_chunk":
				this.play(msg.audio);
				if (msg.text) this.appendTutor(msg.text);
				break;
			case "tool_call":
				this.onToolCall(msg);
				break;
			case "assistant_ended_conversation":
				void this.finish("The tutor ended the talk.");
				break;
			case "error":
				this.cb.onNotice(msg.message ?? msg.error?.message ?? "The live engine reported an error.");
				break;
			default:
				break;
		}
	}

	private openLearnerTurn(): void {
		const at = this.ms();
		const turn: LocalTurn = { role: "learner", text: "", start: at, end: at, clip: [] };
		this.turns.push(turn);
		this.openLearner = turn;
	}

	private closeLearner(): void {
		if (!this.openLearner) return;
		if (this.quietSince !== null && this.quietCounted) this.pauses.push(this.ms() - this.quietSince);
		this.quietSince = null;
		this.quietCounted = false;
		this.openLearner.end = this.ms();
		this.openLearner = null;
		this.emit();
	}

	private attachLearnerText(text: string): void {
		const clean = text.replace(/\s+/g, " ").trim();
		if (!clean) return;
		const target =
			this.openLearner ?? [...this.turns].reverse().find((t) => t.role === "learner" && !t.text.trim()) ?? null;
		if (!target) return;
		target.text = target.text ? `${target.text} ${clean}` : clean;
		target.approximate = true;
		this.emit();
	}

	private openTutorTurn(): void {
		const at = this.ms();
		const turn: LocalTurn = { role: "tutor", text: "", start: at, end: at, clip: [] };
		this.turns.push(turn);
		this.openTutor = turn;
	}

	private closeTutor(): void {
		if (!this.openTutor) return;
		this.openTutor.end = this.ms();
		this.openTutor = null;
		this.emit();
	}

	private appendTutor(text: string): void {
		const clean = text.replace(/\s+/g, " ").trim();
		if (!clean) return;
		if (!this.openTutor) this.openTutorTurn();
		const turn = this.openTutor!;
		turn.text = turn.text ? `${turn.text} ${clean}` : clean;
		turn.end = this.ms();
		this.emit();
	}

	private play(raw: string | undefined): void {
		if (!raw) return;
		this.out ??= new AudioContext();
		const ctx = this.out;
		if (ctx.state === "suspended") void ctx.resume();
		const samples = toInt16(raw);
		if (!samples.length) return;
		const buffer = ctx.createBuffer(1, samples.length, 24_000);
		const channel = buffer.getChannelData(0);
		for (let i = 0; i < samples.length; i++) channel[i] = samples[i]! / 32_768;
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(ctx.destination);
		const when = Math.max(ctx.currentTime + 0.02, this.playAt);
		source.start(when);
		this.playAt = when + buffer.duration;
		this.playing.add(source);
		source.onended = () => this.playing.delete(source);
	}

	private stopPlayback(): void {
		for (const source of this.playing) {
			try {
				source.stop();
			} catch {
				// already stopped
			}
		}
		this.playing.clear();
		this.playAt = 0;
	}

	private onToolCall(msg: Frame): void {
		const name = msg.tool_name ?? "";
		const p = msg.parameters ?? {};
		const at = this.ms();
		const text = (key: string) => (typeof p[key] === "string" ? String(p[key]) : "");
		let event: LiveToolEvent | null = null;
		if (name === "prompt_repair")
			event = { tool: "prompt_repair", at, yours: text("yours"), hint: text("hint"), kind: text("kind") };
		else if (name === "vault_word_used") event = { tool: "vault_word_used", at, lemma: text("lemma") };
		else if (name === "new_chunk") event = { tool: "new_chunk", at, sk: text("sk"), en: text("en") };
		else if (name === "filler_used") event = { tool: "filler_used", at, lemma: text("lemma") };
		else if (name === "end_talk") event = { tool: "end_talk", at };
		if (event) {
			this.tools.push(event);
			this.cb.onTool(event);
		}
		this.send({ type: "tool_call_output", tool_call_id: msg.tool_call_id ?? "", output: "shown" });
		if (name === "end_talk") setTimeout(() => void this.finish("You ended the talk."), 600);
	}

	abort(): void {
		if (this.finished) return;
		this.finished = true;
		this.stopPlayback();
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		void this.mic?.close().catch(() => undefined);
		this.mic = null;
		if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
		this.ws = null;
	}

	async finish(reason: string): Promise<void> {
		if (this.finished) return;
		this.finished = true;
		this.cb.onPhase("ending");
		this.stopPlayback();
		this.closeTutor();
		this.closeLearner();
		await sleep(400);
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		void this.mic?.close().catch(() => undefined);
		this.mic = null;
		if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
		this.ws = null;
		if (!this.turns.some((t) => t.role === "learner" && t.text.trim())) {
			this.cb.onPhase("ended");
			this.cb.onFinish(null, reason);
			return;
		}
		await this.relisten();
		const endedAt = new Date().toISOString();
		const input: LiveCallInput = {
			kind: this.start.kind,
			ref: this.start.ref,
			title: this.start.title,
			turns: this.visible(),
			pausesMs: this.pauses,
			approximate: this.approx,
			startedAt: this.startedAt,
			endedAt,
			tools: this.tools,
			...(this.conversationId ? { conversationId: this.conversationId } : {}),
		};
		this.cb.onPhase("ended");
		this.cb.onFinish(input, reason);
	}

	private async relisten(): Promise<void> {
		const spoken = this.turns.filter((t) => t.role === "learner" && t.clip.length > 0).slice(0, 12);
		if (!spoken.length) return;
		this.cb.onNotice("Listening back to what you said…");
		let local = 0;
		let failed = false;
		for (const turn of spoken) {
			try {
				const wav = encodeWav(turn.clip);
				const text = await transcribeClip(wav);
				if (text) {
					turn.text = text;
					delete turn.approximate;
					local++;
				}
			} catch {
				failed = true;
			}
		}
		this.approx = this.turns.some((t) => t.role === "learner" && t.approximate === true);
		void local;
		if (local > 0) this.cb.onNotice("");
		else if (failed)
			this.cb.onNotice(
				"No speech-to-text key, so your lines are Phonic's transcript: the counts are exact, the wording may be approximate.",
			);
		this.emit();
	}
}
