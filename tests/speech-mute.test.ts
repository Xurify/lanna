import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { setSoundOn } from "../components/lesson/sound.ts";
import { speak, stopSpeaking } from "../components/speech.tsx";

// The sound switch is one switch for every page: when it is off, nothing
// plays, a clip still loading is dropped, and a clip already playing stops.
// Browser audio is faked here; the real calls are fetch and HTMLAudioElement.

interface FakeAudio {
	src: string;
	playbackRate: number;
	paused: boolean;
	onended?: () => void;
	onerror?: () => void;
	play(): Promise<void>;
	pause(): void;
}

const store = new Map<string, string>();
const made: FakeAudio[] = [];
let voiceCalls = 0;
let holdVoice = false;
let releases: Array<() => void> = [];

Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
	},
});

class FakeAudioElement implements FakeAudio {
	src: string;
	playbackRate = 1;
	paused = false;
	onended?: () => void;
	onerror?: () => void;
	constructor(src: string) {
		this.src = src;
		made.push(this);
	}
	play(): Promise<void> {
		this.paused = false;
		return Promise.resolve();
	}
	pause(): void {
		this.paused = true;
	}
}
Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudioElement });
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};

globalThis.fetch = (async (input: string | URL | Request) => {
	const url = String(input);
	if (url.startsWith("/api/profile")) return new Response(JSON.stringify({ active: "slovak" }));
	voiceCalls++;
	if (holdVoice) await new Promise<void>((resolve) => releases.push(resolve));
	return new Response(new Blob(["mp3"]), { status: 200 });
}) as typeof fetch;

async function waitFor(check: () => boolean): Promise<void> {
	for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 0));
	assert.ok(check(), "condition never became true");
}

beforeEach(() => {
	store.clear();
	made.length = 0;
	voiceCalls = 0;
	holdVoice = false;
	releases = [];
});

test("muted: speak plays nothing and fetches no voice", async () => {
	setSoundOn(false);
	await speak("Ahoj");
	assert.equal(voiceCalls, 0);
	assert.equal(made.length, 0);
});

test("a clip still loading when the learner mutes never starts", async () => {
	setSoundOn(true);
	holdVoice = true;
	const pending = speak("Ahoj");
	await waitFor(() => releases.length === 1);
	setSoundOn(false);
	stopSpeaking();
	releases[0]!();
	await pending;
	assert.equal(made.length, 0);
});

test("stopping a clip mid-sentence silences it and settles the caller", async () => {
	setSoundOn(true);
	const pending = speak("Ahoj");
	await waitFor(() => made.length === 1);
	stopSpeaking();
	await pending;
	assert.equal(made[0]!.paused, true);
});

test("a newer sentence stops the one before it", async () => {
	setSoundOn(true);
	void speak("Ahoj");
	await waitFor(() => made.length === 1);
	void speak("Dobrý deň");
	await waitFor(() => made.length === 2);
	assert.equal(made[0]!.paused, true);
	assert.equal(made[1]!.paused, false);
});
