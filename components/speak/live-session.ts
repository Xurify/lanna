"use client";

/**
 * The live call's browser side. One call, one engine: Phonic-1 over its
 * socket, or OpenAI's Realtime API over WebRTC. The microphone, the turns,
 * the pauses, the per-turn clips and the final report are the same for both;
 * src/speak/live-transports.ts holds what differs. The learner's own speech
 * is kept as WAV per turn and transcribed at the end through /api/stt, so the
 * report quotes what they really said, not what the voice model heard.
 */

import { encodeWav, transcribeClip } from "@/components/speak/recorder";
import { openTransport, type Transport } from "@/components/speak/live-transports";
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

export class LiveCall {
	readonly start: LiveStart;
	private cb: LiveCallbacks;
	private transport: Transport | null = null;
	private mic: AudioContext | null = null;
	private node: AudioWorkletNode | null = null;
	private stream: MediaStream | null = null;
	private carry: Int16Array | null = null;
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
	private t0 = Date.now();
	private startedAt = new Date().toISOString();

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
		this.transport = openTransport(this.start, this.stream!, {
			onLearnerStart: () => {
				this.stopPlayback();
				this.closeTutor();
				this.openLearnerTurn();
			},
			onLearnerEnd: () => this.closeLearner(),
			onLearnerText: (text) => this.attachLearnerText(text),
			onTutorStart: () => this.openTutorTurn(),
			onTutorText: (text) => this.appendTutor(text),
			onTutorEnd: () => this.closeTutor(),
			onTool: (name, params) => this.applyTool(name, params),
			onNotice: (text) => this.cb.onNotice(text),
			onClosed: () => {
				if (!this.finished && this.turns.length > 0) void this.finish("The call dropped.");
			},
			onConversation: (id) => {
				this.conversationId = id;
			},
		});
		await this.transport.start();
		this.cb.onPhase("live");
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
		if (!this.transport?.sendsPcm) return;
		const { chunks, carry } = pcmChunks(this.carry, frame, SEND_SAMPLES);
		this.carry = carry;
		for (const chunk of chunks) this.transport.sendPcm(chunk);
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
		this.openLearner.end = this.ms();
		this.openLearner = null;
		this.emit();
	}

	private attachLearnerText(text: string): void {
		const clean = text.replace(/\s+/g, " ").trim();
		if (!clean) return;
		let turn = this.openLearner;
		if (!turn) {
			for (let i = this.turns.length - 1; i >= 0; i--) {
				const last = this.turns[i]!;
				if (last.role === "learner" && !last.text.trim()) {
					turn = last;
					break;
				}
			}
		}
		if (!turn) {
			this.openLearnerTurn();
			turn = this.openLearner!;
		}
		turn.text = turn.text ? `${turn.text} ${clean}` : clean;
		turn.approximate = true;
		turn.end = Math.max(turn.end, this.ms());
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

	private stopPlayback(): void {
		this.transport?.stopPlayback();
	}

	private applyTool(name: string, p: Record<string, unknown>): void {
		const at = this.ms();
		const text = (key: string) => (typeof p[key] === "string" ? String(p[key]) : "");
		let event: LiveToolEvent | null = null;
		if (name === "prompt_repair")
			event = { tool: "prompt_repair", at, yours: text("yours"), hint: text("hint"), kind: text("kind") };
		else if (name === "vault_word_used") event = { tool: "vault_word_used", at, lemma: text("lemma") };
		else if (name === "new_chunk") event = { tool: "new_chunk", at, sk: text("sk"), en: text("en") };
		else if (name === "filler_used") event = { tool: "filler_used", at, lemma: text("lemma") };
		else if (name === "end_talk") event = { tool: "end_talk", at };
		if (!event) return;
		this.tools.push(event);
		this.cb.onTool(event);
		if (name === "end_talk") setTimeout(() => void this.finish("You ended the talk."), 600);
	}

	abort(): void {
		if (this.finished) return;
		this.finished = true;
		this.transport?.close();
		this.transport = null;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		void this.mic?.close().catch(() => undefined);
		this.mic = null;
	}

	async finish(reason: string): Promise<void> {
		if (this.finished) return;
		this.finished = true;
		this.cb.onPhase("ending");
		this.transport?.stopPlayback();
		this.closeTutor();
		this.closeLearner();
		await sleep(400);
		this.transport?.close();
		this.transport = null;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		void this.mic?.close().catch(() => undefined);
		this.mic = null;
		if (!this.turns.some((t) => t.role === "learner" && t.text.trim())) {
			this.cb.onPhase("ended");
			this.cb.onFinish(null, reason);
			return;
		}
		await this.relisten();
		this.approx = this.turns.some((t) => t.role === "learner" && t.approximate === true);
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
		if (local > 0) this.cb.onNotice("");
		else if (failed)
			this.cb.onNotice(
				"No speech-to-text key, so your lines are the voice engine's transcript: the counts are exact, the wording may be approximate.",
			);
		this.emit();
	}
}
