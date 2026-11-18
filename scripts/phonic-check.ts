/**
 * Phase 0 check for live talk (Phonic-1). The run needs the owner's own key
 * in the environment:
 *
 *   PHONIC_API_KEY=... npx tsx scripts/phonic-check.ts
 *
 * It mints a session token, opens the speech-to-speech socket, waits for
 * ready_to_start_conversation, sends one config frame with the app's tools,
 * and prints the type of every frame for fifteen seconds (audio is counted,
 * never printed). Exit 1 on the first failure, so it can gate a release.
 *
 * Protocol: https://docs.phonic.ai — POST /v1/auth/session_token with a
 * bearer key returns { session_token }; the socket is
 * wss://api.phonic.ai/v1/sts/ws?session_token=…
 */

import { LIVE_TOOLS } from "../src/core/live.ts";

const TOKEN_URL = "https://api.phonic.ai/v1/auth/session_token";
const SOCKET = "wss://api.phonic.ai/v1/sts/ws";
const LISTEN_MS = 15_000;

function log(ok: boolean, line: string): void {
	console.log(`${ok ? "[ok]" : "[!!]"} ${line}`);
}

async function main(): Promise<void> {
	const key = process.env.PHONIC_API_KEY?.trim();
	if (!key) {
		log(false, "PHONIC_API_KEY is not set. Export it for this run only.");
		process.exit(1);
	}
	log(true, `key present (${key.length} characters)`);

	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
		body: JSON.stringify({ ttl_seconds: 300 }),
	});
	const raw = await res.text();
	if (!res.ok) {
		log(false, `token refused (${res.status}): ${raw.slice(0, 300)}`);
		process.exit(1);
	}
	let token = "";
	try {
		token = String((JSON.parse(raw) as { session_token?: unknown }).session_token ?? "");
	} catch {
		token = "";
	}
	if (!token) {
		log(false, `no session_token in: ${raw.slice(0, 300)}`);
		process.exit(1);
	}
	log(true, "session token minted");

	const ws = new WebSocket(`${SOCKET}?session_token=${encodeURIComponent(token)}`);
	const seen = new Map<string, number>();
	const started = Date.now();
	let ready = false;

	const finish = (code: number, line: string) => {
		log(code === 0, line);
		try {
			ws.close();
		} catch {
			// already closed
		}
		const types = [...seen.entries()].map(([type, n]) => `${type}×${n}`).join(", ") || "no frames";
		console.log(`frames: ${types}`);
		process.exit(code);
	};

	const timer = setTimeout(() => {
		if (!ready) finish(1, "no ready_to_start_conversation in 20 seconds");
		else finish(0, "listened for 15 seconds; socket stayed open");
	}, 20_000);
	void started;

	ws.onopen = () => {
		log(true, "socket open; sending config (the server's ready frame answers it)");
		ws.send(
			JSON.stringify({
				type: "config",
				system_prompt: "You are a Slovak conversation partner. Say one short greeting, then ask one easy question.",
				default_language: "sk",
				input_format: "pcm_16000",
				output_format: "pcm_24000",
				min_words_to_interrupt: 2,
				generate_welcome_message: true,
				tools: LIVE_TOOLS,
			}),
		);
		log(true, `config sent with ${LIVE_TOOLS.length} tools`);
	};

	ws.onerror = () => {
		clearTimeout(timer);
		finish(1, "socket error");
	};

	ws.onmessage = (event) => {
		let msg: { type?: string; message?: string };
		try {
			msg = JSON.parse(String(event.data)) as { type?: string; message?: string };
		} catch {
			return;
		}
		const type = msg.type ?? "unknown";
		seen.set(type, (seen.get(type) ?? 0) + 1);
		if (type === "audio_chunk" || type === "input_text") return;
		log(type !== "error", type === "error" ? `error frame: ${msg.message ?? ""}` : type);
		if (type === "ready_to_start_conversation" && !ready) {
			ready = true;
			clearTimeout(timer);
			setTimeout(() => finish(0, "listened for 15 seconds; socket stayed open"), LISTEN_MS);
		}
		if (type === "error") {
			clearTimeout(timer);
			finish(1, "the engine reported an error");
		}
	};
}

void main().catch((err: unknown) => {
	log(false, err instanceof Error ? err.message : String(err));
	process.exit(1);
});
