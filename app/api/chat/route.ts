import { BODY_LIMITS, bodyTooLarge, handleChatRequest } from "@/src/server";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	return handleChatRequest(req);
}
