/** The most a request body may hold, by what the route takes. */
export const BODY_LIMITS = {
	json: 256 * 1024,
	prompt: 512 * 1024,
	cheatsheet: 1024 * 1024,
	import: 4 * 1024 * 1024,
	recording: 12 * 1024 * 1024 + 256 * 1024,
} as const;

/**
 * A 413 when the request announces a body over `maxBytes`, else null. A body
 * sent without a length is bounded by Next's request buffer
 * (`experimental.proxyClientMaxBodySize` in next.config.ts) and by the
 * reverse proxy in front of a public deployment.
 */
export function bodyTooLarge(request: Request, maxBytes: number): Response | null {
	const announced = request.headers.get("content-length");
	if (announced === null) return null;
	const length = Number(announced);
	if (Number.isFinite(length) && length >= 0 && length <= maxBytes) return null;
	return Response.json(
		{
			error: "request too large",
			message: `This request is larger than the ${Math.round(maxBytes / 1024)} KB this route takes.`,
		},
		{ status: 413 },
	);
}
