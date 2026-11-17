import { ConnectionDrop } from "./sse";

export type FetchFn = typeof globalThis.fetch;

export function chatPath(chatId: string, suffix = ""): string {
	return `/api/chats/${encodeURIComponent(chatId)}${suffix}`;
}

export function jsonPost(body: unknown): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	};
}

export async function fetchAttach(
	fetchFn: FetchFn,
	url: string,
	signal: AbortSignal,
	recovering: boolean,
): Promise<Response> {
	const response = await fetchFn(url, { signal }).catch((error: unknown) => {
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

export async function bodyTextOr(response: Response, fallback: string): Promise<string> {
	return (await response.text()) || fallback;
}

export function errorMessageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
