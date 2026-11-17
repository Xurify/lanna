import type { WireEvent } from "./wire";

export const STREAM_DROPPED = "The connection dropped before the turn completed.";

export class ConnectionDrop extends Error {
	constructor() {
		super(STREAM_DROPPED);
		this.name = "ConnectionDrop";
	}
}

export type TurnFrame = WireEvent | { type: "turn-settled" };

const DATA_PREFIX = "data: ";
const DONE_PAYLOAD = "[DONE]";

// Frames are separated by a blank line (WHATWG Server-Sent Events).
export async function* turnFrames(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<TurnFrame, boolean> {
	const decoder = new TextDecoder();
	let buffered = "";
	for (;;) {
		const chunk = await readChunk(reader);
		if (chunk.done) return false;
		buffered += decoder.decode(chunk.value, { stream: true });
		for (;;) {
			const end = buffered.indexOf("\n\n");
			if (end === -1) break;
			const frame = buffered.slice(0, end);
			buffered = buffered.slice(end + 2);
			const payload = payloadOf(frame);
			if (payload === undefined) continue;
			if (payload === DONE_PAYLOAD) return true;
			yield JSON.parse(payload) as TurnFrame;
		}
	}
}

async function readChunk(
	reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
	try {
		return await reader.read();
	} catch {
		throw new ConnectionDrop();
	}
}

function payloadOf(frame: string): string | undefined {
	const line = frame.split("\n").find((candidate) => candidate.startsWith(DATA_PREFIX));
	return line?.slice(DATA_PREFIX.length);
}
