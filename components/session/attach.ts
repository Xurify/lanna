import type { Fetch } from "./http";
import { ConnectionDrop } from "./sse";

export async function fetchAttach(
	fetchImplementation: Fetch,
	url: string,
	signal: AbortSignal,
	recovering: boolean,
): Promise<Response> {
	const response = await fetchImplementation(url, { signal }).catch((error: unknown) => {
		throw recovering && !signal.aborted ? new ConnectionDrop() : error;
	});
	if (recovering && !response.ok) {
		await response.body?.cancel().catch(() => {});
		throw new ConnectionDrop();
	}
	return response;
}

export async function readBodyText(response: Response, signal: AbortSignal, recovering: boolean): Promise<string> {
	try {
		return await response.text();
	} catch (error) {
		if (recovering && !signal.aborted) throw new ConnectionDrop();
		throw error;
	}
}
