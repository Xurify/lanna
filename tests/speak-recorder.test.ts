/**
 * THE RECORDING'S FORMAT (Speak, 2026-10-31): a spoken line is 16 kHz mono
 * 16-bit PCM WAV, and its file name follows the clip's real type. Before
 * this, the browser could keep MP4 and every upload was called
 * `line.webm`; these tests pin the WAV header a decoder reads and the one
 * extension mapping the client and the server share.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { audioExt } from "../src/core/audio.ts";
import { encodeWav } from "../components/speak/recorder.ts";

test("audioExt: the name follows the clip's type, never a fixed webm", () => {
	assert.equal(audioExt("audio/wav"), "wav");
	assert.equal(audioExt("audio/wav;codecs=1"), "wav");
	assert.equal(audioExt("audio/x-wav"), "wav");
	assert.equal(audioExt("audio/ogg;codecs=opus"), "ogg");
	assert.equal(audioExt("audio/webm;codecs=opus"), "webm");
	assert.equal(audioExt("audio/mp4"), "m4a");
	assert.equal(audioExt("audio/x-m4a"), "m4a");
	// An empty or unknown type keeps the historical fallback.
	assert.equal(audioExt(""), "webm");
	assert.equal(audioExt("application/octet-stream"), "webm");
});

test("encodeWav: a mono 16 kHz 16-bit header, and every sample intact", async () => {
	const frames = [new Int16Array([0, 1, -1, 32767, -32768]), new Int16Array([100, -100])];
	const blob = encodeWav(frames, 16_000);
	const bytes = new DataView(await blob.arrayBuffer());
	const str = (at: number, n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(bytes.getUint8(at + i))).join("");

	assert.equal(blob.type, "audio/wav");
	assert.equal(blob.size, 44 + 7 * 2);
	assert.equal(str(0, 4), "RIFF");
	assert.equal(bytes.getUint32(4, true), 36 + 7 * 2);
	assert.equal(str(8, 4), "WAVE");
	assert.equal(str(12, 4), "fmt ");
	assert.equal(bytes.getUint16(20, true), 1); // PCM
	assert.equal(bytes.getUint16(22, true), 1); // mono
	assert.equal(bytes.getUint32(24, true), 16_000);
	assert.equal(bytes.getUint32(28, true), 32_000); // bytes a second
	assert.equal(bytes.getUint16(32, true), 2); // bytes a sample
	assert.equal(bytes.getUint16(34, true), 16); // bits a sample
	assert.equal(str(36, 4), "data");
	assert.equal(bytes.getUint32(40, true), 7 * 2);
	assert.deepEqual([...new Int16Array(bytes.buffer, 44, 7)], [0, 1, -1, 32767, -32768, 100, -100]);
});

test("encodeWav: an empty recording is still a readable WAV, not a broken clip", async () => {
	const blob = encodeWav([]);
	const bytes = new DataView(await blob.arrayBuffer());
	assert.equal(blob.size, 44);
	assert.equal(bytes.getUint32(40, true), 0);
});
