import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthInteraction, Credential, Models } from "@earendil-works/pi-ai";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-subscriptions-"));
process.env.LANNA_AUTH_FILE = path.join(TMP, "auth.json");
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { fileSubscriptionCredentials, subscriptionSignedIn } = await import("../src/store/subscription-credentials.ts");
const { subscriptionLogins, subscriptionProviders } = await import("../src/agent/subscriptions.ts");

const oauth = (access: string): Credential => ({ type: "oauth", access, refresh: "r", expires: Date.now() + 60_000 });

function scratchFile(): string {
	return path.join(fs.mkdtempSync(path.join(TMP, "store-")), "subscriptions.json");
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** A pi Models stand-in whose login is scripted by the test. */
function fakeModels(login: (id: string, interaction: AuthInteraction) => Promise<Credential>) {
	const store = fileSubscriptionCredentials(scratchFile());
	const loggedOut: string[] = [];
	const models = {
		login: async (id: string, _type: string, interaction: AuthInteraction) => {
			const credential = await login(id, interaction);
			await store.modify(id, async () => credential);
			return credential;
		},
		logout: async (id: string) => {
			loggedOut.push(id);
			await store.delete(id);
		},
	} as unknown as Models;
	return { models, store, loggedOut };
}

describe("subscription credential file", () => {
	it("keeps one credential per provider and forgets it on delete", async () => {
		const file = scratchFile();
		const store = fileSubscriptionCredentials(file);
		await store.modify("chatgpt", async () => oauth("a1"));
		await store.modify("xai-subscription", async () => oauth("x1"));
		assert.deepEqual(
			(await store.list()).map((c) => c.providerId),
			["chatgpt", "xai-subscription"],
		);
		assert.equal(subscriptionSignedIn("chatgpt", file), true);
		await store.delete("chatgpt");
		assert.equal(await store.read("chatgpt"), undefined);
		assert.equal(subscriptionSignedIn("chatgpt", file), false);
	});

	it("serializes writes so a refresh and a sign-in never overwrite each other", async () => {
		const store = fileSubscriptionCredentials(scratchFile());
		const seen: (string | undefined)[] = [];
		await Promise.all(
			["a", "b", "c"].map((access) =>
				store.modify("chatgpt", async (current) => {
					seen.push(current?.type === "oauth" ? current.access : undefined);
					return oauth(access);
				}),
			),
		);
		assert.deepEqual(seen, [undefined, "a", "b"]);
	});

	it("keeps the device id across reads, and reads a broken file as empty", async () => {
		const file = scratchFile();
		const store = fileSubscriptionCredentials(file);
		const id = store.deviceId();
		assert.match(id, /^[0-9a-f-]{36}$/);
		assert.equal(fileSubscriptionCredentials(file).deviceId(), id);
		fs.writeFileSync(file, "{ not json");
		assert.deepEqual(await fileSubscriptionCredentials(file).list(), []);
	});

	it("writes the file for its owner only", { skip: process.platform === "win32" }, async () => {
		const file = scratchFile();
		await fileSubscriptionCredentials(file).modify("chatgpt", async () => oauth("a"));
		assert.equal(fs.statSync(file).mode & 0o777, 0o600);
	});
});

describe("subscription providers", () => {
	it("sign in only with the plan, under Lanna's own id, beside the API-key provider", () => {
		const providers = subscriptionProviders();
		assert.deepEqual(
			providers.map((p) => p.id),
			["chatgpt", "github-copilot-subscription", "xai-subscription"],
		);
		for (const provider of providers) {
			assert.ok(provider.auth.oauth, `${provider.id} signs in with OAuth`);
			assert.equal(provider.auth.apiKey, undefined, `${provider.id} never falls back to an API key`);
			assert.ok(provider.getModels().length > 0);
			assert.ok(provider.getModels().every((m) => m.provider === provider.id));
		}
	});
});

describe("sign-in flow", () => {
	it("shows the device code and link, then the account, and never a token", async () => {
		let finish!: () => void;
		const { models, store } = fakeModels(async (_id, interaction) => {
			interaction.notify({
				type: "device_code",
				userCode: "ABCD-1234",
				verificationUri: "https://example.invalid/device",
			});
			await new Promise<void>((resolve) => (finish = resolve));
			return oauth("secret-access-token");
		});
		const logins = subscriptionLogins(models, store, () => "device");
		logins.start("github-copilot-subscription");
		await tick();
		const during = (await logins.status()).find((s) => s.id === "github-copilot-subscription")!;
		assert.deepEqual(during.login, { userCode: "ABCD-1234", url: "https://example.invalid/device" });
		assert.equal(during.connected, false);
		finish();
		await tick();
		await tick();
		const done = await logins.status();
		assert.equal(done.find((s) => s.id === "github-copilot-subscription")?.connected, true);
		assert.equal(done.find((s) => s.id === "github-copilot-subscription")?.login, undefined);
		assert.ok(!JSON.stringify(done).includes("secret-access-token"));
	});

	it("names the ChatGPT account from its token", async () => {
		const claims = Buffer.from(JSON.stringify({ "https://api.openai.com/profile": { email: "me@example.invalid" } }));
		const token = `h.${claims.toString("base64url")}.s`;
		const { models, store } = fakeModels(async () => oauth(token));
		const logins = subscriptionLogins(models, store, () => "device");
		logins.start("chatgpt");
		await tick();
		await tick();
		const chatgpt = (await logins.status()).find((s) => s.id === "chatgpt")!;
		assert.equal(chatgpt.account, "me@example.invalid");
		assert.ok(!JSON.stringify(chatgpt).includes(token));
	});

	it("passes a pasted code back to the provider", async () => {
		const { models, store } = fakeModels(async (_id, interaction) => {
			const code = await interaction.prompt({ type: "manual_code", message: "Paste the code from the page" });
			assert.equal(code, "pasted-code");
			return oauth("t");
		});
		const logins = subscriptionLogins(models, store, () => "device");
		logins.start("chatgpt");
		await tick();
		const asking = (await logins.status()).find((s) => s.id === "chatgpt")!;
		assert.equal(asking.login?.prompt?.type, "manual_code");
		assert.equal(logins.respond("chatgpt", "pasted-code"), true);
		await tick();
		await tick();
		assert.equal((await logins.status()).find((s) => s.id === "chatgpt")?.connected, true);
		assert.equal(logins.respond("chatgpt", "again"), false);
	});

	it("cancel ends the sign-in without an error; a failure is shown", async () => {
		const { models, store } = fakeModels(async (id, interaction) => {
			if (id === "xai-subscription") throw new Error("The code expired.");
			await interaction.prompt({ type: "text", message: "Waiting" });
			return oauth("t");
		});
		const logins = subscriptionLogins(models, store, () => "device");
		logins.start("chatgpt");
		logins.start("xai-subscription");
		await tick();
		logins.cancel("chatgpt");
		await tick();
		await tick();
		const after = await logins.status();
		const chatgpt = after.find((s) => s.id === "chatgpt")!;
		assert.equal(chatgpt.login, undefined);
		assert.equal(chatgpt.error, undefined);
		assert.equal(after.find((s) => s.id === "xai-subscription")?.error, "The code expired.");
	});

	it("sign out forgets the credential", async () => {
		const { models, store, loggedOut } = fakeModels(async () => oauth("t"));
		const logins = subscriptionLogins(models, store, () => "device");
		logins.start("chatgpt");
		await tick();
		await tick();
		await logins.signOut("chatgpt");
		assert.deepEqual(loggedOut, ["chatgpt"]);
		assert.equal((await logins.status()).find((s) => s.id === "chatgpt")?.connected, false);
	});
});

describe("/api/subscriptions", () => {
	const request = (headers: Record<string, string>, init: RequestInit = {}) =>
		new Request("http://localhost:3010/api/subscriptions", { ...init, headers });
	const own = { "x-lanna-subscriptions": "1", "sec-fetch-site": "same-origin" };

	it("answers Lanna's own page and refuses a request without its header or from another site", async () => {
		const { subscriptionsResponse } = await import("../src/server/subscriptions.ts");
		assert.equal((await subscriptionsResponse(request(own))).status, 200);
		assert.equal((await subscriptionsResponse(request({}))).status, 403);
		assert.equal((await subscriptionsResponse(request({ ...own, "sec-fetch-site": "cross-site" }))).status, 403);
	});

	it("refuses unknown commands and providers", async () => {
		const { subscriptionsResponse } = await import("../src/server/subscriptions.ts");
		const post = (body: unknown) =>
			subscriptionsResponse(
				request({ ...own, "content-type": "application/json" }, { method: "POST", body: JSON.stringify(body) }),
			);
		assert.equal((await post({ op: "lease", provider: "chatgpt" })).status, 400);
		assert.equal((await post({ op: "start", provider: "openai" })).status, 400);
		assert.equal((await post({ op: "respond", provider: "chatgpt", value: "x" })).status, 409);
	});

	it("is off at a public address", async () => {
		const { subscriptionsResponse } = await import("../src/server/subscriptions.ts");
		process.env.LANNA_PUBLIC_HOST = "lanna.example.invalid";
		try {
			assert.equal((await subscriptionsResponse(request(own))).status, 403);
		} finally {
			delete process.env.LANNA_PUBLIC_HOST;
		}
	});
});
