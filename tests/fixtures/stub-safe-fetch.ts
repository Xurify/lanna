import { Readable } from "node:stream";

import { safeFetchSeams } from "../../src/agent/safe-fetch.ts";

const PUBLIC_ADDRESS = "93.184.216.34";

/** Answers every guarded fetch from `answer` with no DNS and no socket; returns the undo. */
export function stubSafeFetch(answer: typeof fetch): () => void {
	const before = { ...safeFetchSeams };
	safeFetchSeams.resolve = async () => [PUBLIC_ADDRESS];
	safeFetchSeams.transport = async (request) => {
		const response = await answer(request.url.href, { method: request.method, headers: request.headers });
		return {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
			body: response.body ? Readable.fromWeb(response.body as never) : null,
		};
	};
	return () => Object.assign(safeFetchSeams, before);
}
