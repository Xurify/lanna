import { piModels, useSubscriptionCredentials } from "../agent/models.ts";
import { isSubscriptionProvider, subscriptionLogins } from "../agent/subscriptions.ts";
import { emit } from "../core/events.ts";
import { fileSubscriptionCredentials } from "../store/subscription-credentials.ts";

const credentials = fileSubscriptionCredentials();
useSubscriptionCredentials(credentials);

const logins = subscriptionLogins(
	piModels(),
	credentials,
	() => credentials.deviceId(),
	() => emit("subscriptions-changed", {}),
);

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function error(message: string, status: number): Response {
	return Response.json({ error: message }, { status, headers: HEADERS });
}

function fromLannasPage(request: Request): boolean {
	return request.headers.get("x-lanna-subscriptions") === "1" && request.headers.get("sec-fetch-site") !== "cross-site";
}

type Command =
	| { op: "start"; provider: string }
	| { op: "respond"; provider: string; value: string }
	| { op: "cancel"; provider: string }
	| { op: "sign-out"; provider: string };

function command(body: unknown): Command | undefined {
	if (!body || typeof body !== "object") return undefined;
	const { op, provider, value } = body as Record<string, unknown>;
	if (typeof provider !== "string") return undefined;
	if (op === "respond") return typeof value === "string" ? { op, provider, value } : undefined;
	if (op === "start" || op === "cancel" || op === "sign-out") return { op, provider };
	return undefined;
}

export async function subscriptionsResponse(request: Request): Promise<Response> {
	if (process.env.LANNA_PUBLIC_HOST?.trim())
		return error(
			"Subscription sign-ins are off when Lanna is served at a public address. Add an API key in Settings → API keys instead.",
			403,
		);
	if (!fromLannasPage(request)) return error("Subscription sign-ins only work from Lanna's own page.", 403);
	if (request.method === "GET") return Response.json(await logins.status(), { headers: HEADERS });
	if (request.method !== "POST") return error("Unsupported method.", 405);

	const input = command(await request.json().catch(() => undefined));
	if (!input || !isSubscriptionProvider(input.provider)) return error("Unknown command.", 400);
	if (input.op === "start") logins.start(input.provider);
	else if (input.op === "cancel") logins.cancel(input.provider);
	else if (input.op === "sign-out") await logins.signOut(input.provider);
	else if (!logins.respond(input.provider, input.value)) return error("Nothing is waiting for an answer.", 409);
	return Response.json(await logins.status(), { headers: HEADERS });
}
