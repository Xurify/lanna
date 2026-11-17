import { ChatInputError, parseChatInput, type TurnInput } from "../../core/input-events.ts";
import type { AgentFactory } from "./agent.ts";
import { unknownChatResponse } from "./gates.ts";
import { runTurn } from "./run.ts";

interface TurnRequestBody {
	chatId?: unknown;
	input?: unknown;
}

function invalidJsonResponse(): Response {
	return Response.json({ error: "Invalid JSON body" }, { status: 400 });
}

export async function handleChatRequest(req: Request, buildAgent?: AgentFactory): Promise<Response> {
	let body: TurnRequestBody | null;
	try {
		body = (await req.json()) as TurnRequestBody | null;
	} catch {
		return invalidJsonResponse();
	}
	const chatId = typeof body?.chatId === "string" ? body.chatId : "";
	if (!chatId) return unknownChatResponse();
	let input: TurnInput;
	try {
		input = parseChatInput(body?.input);
	} catch (err) {
		if (err instanceof ChatInputError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}
	return runTurn(chatId, input, buildAgent);
}
