export type Fetch = typeof globalThis.fetch;

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

export async function bodyTextOr(response: Response, fallback: string): Promise<string> {
	return (await response.text()) || fallback;
}

export function errorMessageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
