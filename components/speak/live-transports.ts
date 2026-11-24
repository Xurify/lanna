"use client";

import type { LiveStart } from "@/src/core";
import { soundOn, subscribeSound, volume } from "@/components/lesson/sound";
import { stopSpeaking } from "@/components/speech";

export interface TransportCallbacks {
	onLearnerStart(): void;
	onLearnerEnd(): void;
	onLearnerText(text: string): void;
	onTutorStart(): void;
	onTutorText(text: string): void;
	onTutorEnd(): void;
	onTool(name: string, params: Record<string, unknown>): void;
	onNotice(text: string): void;
	onClosed(): void;
	onConversation(id: string): void;
}

export interface Transport {
	/** Phonic takes PCM frames on its socket; WebRTC carries the microphone as a media track. */
	readonly sendsPcm: boolean;
	start(): Promise<void>;
	sendPcm(chunk: Int16Array): void;
	stopPlayback(): void;
	close(): void;
}

export function openTransport(start: LiveStart, mic: MediaStream, cb: TransportCallbacks): Transport {
	return start.provider === "openai" ? new OpenAITransport(start, mic, cb) : new PhonicTransport(start, cb);
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

interface PhonicFrame {
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

class PhonicTransport implements Transport {
	readonly sendsPcm = true;
	private ws: WebSocket | null = null;
	private out: AudioContext | null = null;
	private gainNode: GainNode | null = null;
	private unsubscribeSound: (() => void) | null = null;
	private playing = new Set<AudioBufferSourceNode>();
	private playAt = 0;
	private ready = false;
	private queued: Int16Array[] = [];

	constructor(
		private call: Extract<LiveStart, { provider: "phonic" }>,
		private cb: TransportCallbacks,
	) {}

	start(): Promise<void> {
		stopSpeaking();
		return new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(this.call.url);
			this.ws = ws;
			const timer = setTimeout(() => reject(new Error("Phonic did not answer in 20 seconds.")), 20_000);
			ws.onopen = () => {
				clearTimeout(timer);
				// Phonic's config opens the conversation: the server answers
				// ready_to_start_conversation once it has it (docs.phonic.ai).
				this.send({ type: "config", ...this.call.config });
				resolve();
			};
			ws.onerror = () => {
				clearTimeout(timer);
				reject(new Error("The live socket could not be opened."));
			};
			ws.onclose = () => this.cb.onClosed();
			ws.onmessage = (event) => this.onMessage(String(event.data));
		});
	}

	private send(frame: Record<string, unknown>): void {
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
	}

	sendPcm(chunk: Int16Array): void {
		if (!this.ready) {
			if (this.queued.length < 50) this.queued.push(chunk);
			return;
		}
		this.send({ type: "audio_chunk", audio: toBase64(chunk) });
	}

	private onMessage(raw: string): void {
		let msg: PhonicFrame;
		try {
			msg = JSON.parse(raw) as PhonicFrame;
		} catch {
			return;
		}
		switch (msg.type) {
			case "ready_to_start_conversation":
				this.ready = true;
				for (const chunk of this.queued) this.send({ type: "audio_chunk", audio: toBase64(chunk) });
				this.queued = [];
				break;
			case "input_cancelled":
				this.cb.onLearnerEnd();
				break;
			case "warning":
				this.cb.onNotice(msg.message ?? msg.error?.message ?? "The live engine sent a warning.");
				break;
			case "assistant_chose_not_to_respond":
				this.cb.onTutorEnd();
				break;
			case "conversation_created":
				this.cb.onConversation(msg.conversation_id ?? msg.id ?? "");
				break;
			case "user_started_speaking":
				this.cb.onTutorEnd();
				this.cb.onLearnerStart();
				break;
			case "user_finished_speaking":
				this.cb.onLearnerEnd();
				break;
			case "input_text":
				this.cb.onLearnerText(msg.text ?? "");
				break;
			case "assistant_started_speaking":
				this.cb.onTutorStart();
				break;
			case "assistant_finished_speaking":
				this.cb.onTutorEnd();
				break;
			case "interrupted_response":
				this.stopPlayback();
				this.cb.onTutorEnd();
				break;
			case "audio_chunk":
				this.play(msg.audio);
				if (msg.text) this.cb.onTutorText(msg.text);
				break;
			case "tool_call":
				this.callTool(msg);
				break;
			case "error":
				this.cb.onNotice(msg.message ?? msg.error?.message ?? "The live engine reported an error.");
				break;
			default:
				break;
		}
	}

	private callTool(msg: PhonicFrame): void {
		this.cb.onTool(msg.tool_name ?? "", msg.parameters ?? {});
		this.send({ type: "tool_call_output", tool_call_id: msg.tool_call_id ?? "", output: "shown" });
	}

	private play(raw: string | undefined): void {
		if (!raw) return;
		if (!this.out) {
			const context = new AudioContext();
			const gain = context.createGain();
			const syncGain = () => {
				gain.gain.value = soundOn() ? volume() : 0;
			};
			syncGain();
			this.unsubscribeSound = subscribeSound(syncGain);
			gain.connect(context.destination);
			this.out = context;
			this.gainNode = gain;
		}
		const context = this.out;
		if (context.state === "suspended") void context.resume();
		const samples = toInt16(raw);
		if (!samples.length) return;
		const buffer = context.createBuffer(1, samples.length, 24_000);
		const channel = buffer.getChannelData(0);
		for (let i = 0; i < samples.length; i++) channel[i] = samples[i]! / 32_768;
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.gainNode ?? context.destination);
		const when = Math.max(context.currentTime + 0.02, this.playAt);
		source.start(when);
		this.playAt = when + buffer.duration;
		this.playing.add(source);
		source.onended = () => this.playing.delete(source);
	}

	stopPlayback(): void {
		for (const source of this.playing) {
			try {
				source.stop();
			} catch {}
		}
		this.playing.clear();
		this.playAt = 0;
	}

	close(): void {
		this.stopPlayback();
		this.unsubscribeSound?.();
		this.unsubscribeSound = null;
		this.gainNode = null;
		void this.out?.close().catch(() => undefined);
		this.out = null;
		if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
		this.ws = null;
	}
}

interface OpenAIItem {
	type?: string;
}

interface OpenAIEvent {
	type?: string;
	delta?: string;
	transcript?: string;
	call_id?: string;
	name?: string;
	arguments?: string;
	message?: string;
	error?: { message?: string };
	session?: { id?: string };
	response?: { output?: OpenAIItem[] };
}

class OpenAITransport implements Transport {
	readonly sendsPcm = false;
	private pc: RTCPeerConnection | null = null;
	private dc: RTCDataChannel | null = null;
	private audio: HTMLAudioElement | null = null;
	private unsubscribeSound: (() => void) | null = null;
	private interrupted = false;
	private muteTimer: number | undefined;

	constructor(
		private call: Extract<LiveStart, { provider: "openai" }>,
		private mic: MediaStream,
		private cb: TransportCallbacks,
	) {}

	async start(): Promise<void> {
		stopSpeaking();
		const pc = new RTCPeerConnection();
		this.pc = pc;
		const audio = new Audio();
		audio.autoplay = true;
		this.audio = audio;
		const syncSound = () => {
			audio.volume = volume();
			audio.muted = this.interrupted || !soundOn();
		};
		syncSound();
		this.unsubscribeSound = subscribeSound(syncSound);
		pc.ontrack = (event) => {
			audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
			void audio.play().catch(() => this.cb.onNotice("The browser blocked the call's audio."));
		};
		for (const track of this.mic.getAudioTracks()) pc.addTrack(track, this.mic);
		const dc = pc.createDataChannel("oai-events");
		this.dc = dc;
		dc.onmessage = (event) => this.onEvent(String(event.data));
		pc.onconnectionstatechange = () => {
			if (pc.connectionState === "failed" || pc.connectionState === "disconnected") this.cb.onClosed();
		};
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		const res = await fetch(this.call.callUrl, {
			method: "POST",
			headers: { authorization: `Bearer ${this.call.token}`, "content-type": "application/sdp" },
			body: offer.sdp ?? "",
		});
		const answer = await res.text();
		if (!res.ok) throw new Error(`OpenAI refused the call (${res.status}): ${answer.slice(0, 200)}`);
		await pc.setRemoteDescription({ type: "answer", sdp: answer });
	}

	private send(frame: Record<string, unknown>): void {
		if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(frame));
	}

	sendPcm(): void {
		// the microphone is a WebRTC track, not PCM frames
	}

	private onEvent(raw: string): void {
		let event: OpenAIEvent;
		try {
			event = JSON.parse(raw) as OpenAIEvent;
		} catch {
			return;
		}
		switch (event.type) {
			case "session.created":
				if (event.session?.id) this.cb.onConversation(event.session.id);
				break;
			case "input_audio_buffer.speech_started":
				this.cb.onLearnerStart();
				break;
			case "input_audio_buffer.speech_stopped":
				this.cb.onLearnerEnd();
				break;
			case "conversation.item.input_audio_transcription.completed":
				if (event.transcript) this.cb.onLearnerText(event.transcript);
				break;
			case "response.created":
				this.unmute();
				this.cb.onTutorStart();
				break;
			case "response.output_audio_transcript.delta":
			case "response.audio_transcript.delta":
				if (event.delta) this.cb.onTutorText(event.delta);
				break;
			case "response.output_audio_transcript.done":
			case "response.audio_transcript.done":
				this.cb.onTutorEnd();
				break;
			case "response.function_call_arguments.done":
				this.callTool(event);
				break;
			case "response.done":
				this.cb.onTutorEnd();
				this.resumeAfterToolOnly(event);
				break;
			case "error":
				this.cb.onNotice(event.error?.message ?? event.message ?? "OpenAI reported an error.");
				break;
			default:
				break;
		}
	}

	private callTool(event: OpenAIEvent): void {
		const callId = event.call_id ?? "";
		let params: Record<string, unknown> = {};
		try {
			const parsed = JSON.parse(event.arguments ?? "{}") as unknown;
			if (parsed && typeof parsed === "object") params = parsed as Record<string, unknown>;
		} catch {
			params = {};
		}
		this.cb.onTool(event.name ?? "", params);
		this.send({
			type: "conversation.item.create",
			item: { type: "function_call_output", call_id: callId, output: "shown" },
		});
	}

	private resumeAfterToolOnly(event: OpenAIEvent): void {
		const output = event.response?.output ?? [];
		if (output.length === 0) return;
		if (!output.every((item) => item.type === "function_call")) return;
		this.send({ type: "response.create" });
	}

	private mute(): void {
		this.interrupted = true;
		if (!this.audio) return;
		this.audio.muted = true;
		window.clearTimeout(this.muteTimer);
		this.muteTimer = window.setTimeout(() => this.unmute(), 2000);
	}

	private unmute(): void {
		this.interrupted = false;
		window.clearTimeout(this.muteTimer);
		if (this.audio) this.audio.muted = !soundOn();
	}

	stopPlayback(): void {
		this.mute();
	}

	close(): void {
		window.clearTimeout(this.muteTimer);
		this.unsubscribeSound?.();
		this.unsubscribeSound = null;
		this.dc?.close();
		this.dc = null;
		this.pc?.close();
		this.pc = null;
		if (this.audio) {
			this.audio.pause();
			this.audio.srcObject = null;
		}
		this.audio = null;
	}
}
