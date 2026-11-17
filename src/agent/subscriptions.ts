import type { AuthEvent, AuthPrompt, CredentialStore, Models, Provider } from "@earendil-works/pi-ai";
import { githubCopilotProvider } from "@earendil-works/pi-ai/providers/github-copilot";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import type { SubscriptionId, SubscriptionLogin, SubscriptionStatus } from "../core/contracts/subscriptions.ts";
import { SUBSCRIPTIONS } from "../core/contracts/subscriptions.ts";

const NATIVE: Record<SubscriptionId, () => Provider> = {
	chatgpt: openaiProvider,
	"github-copilot-subscription": githubCopilotProvider,
	"xai-subscription": xaiProvider,
};

function subscriptionProvider(id: SubscriptionId, name: string): Provider {
	const base = NATIVE[id]();
	const oauth = base.auth.oauth;
	if (!oauth) throw new Error(`${base.id} has no subscription sign-in`);
	const relabel = <T extends { provider: string }>(model: T): T => ({ ...model, provider: id });
	return {
		id,
		name,
		baseUrl: base.baseUrl,
		headers: base.headers,
		auth: { oauth },
		getModels: () => base.getModels().map(relabel),
		...(base.getAllModels ? { getAllModels: () => base.getAllModels!().map(relabel) } : {}),
		...(base.refreshModels ? { refreshModels: (context) => base.refreshModels!(context) } : {}),
		...(base.filterModels
			? { filterModels: (models, credential) => base.filterModels!(models, credential).map(relabel) }
			: {}),
		...(base.filterAllModels
			? { filterAllModels: (models, credential) => base.filterAllModels!(models, credential).map(relabel) }
			: {}),
		stream: (model, context, options) => base.stream(model, context, options),
		streamSimple: (model, context, options) => base.streamSimple(model, context, options),
	};
}

export function subscriptionProviders(): Provider[] {
	return SUBSCRIPTIONS.map(({ id, label }) => subscriptionProvider(id, label));
}

export function isSubscriptionProvider(provider: string): provider is SubscriptionId {
	return SUBSCRIPTIONS.some((s) => s.id === provider);
}

// OpenAI's access token carries the account's email in its profile claim; Copilot and Grok tokens name no account.
function accountOf(access: unknown): string | undefined {
	if (typeof access !== "string") return undefined;
	const payload = access.split(".")[1];
	if (!payload) return undefined;
	try {
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as Record<string, unknown>;
		const profile = claims["https://api.openai.com/profile"] as { email?: unknown } | undefined;
		return typeof profile?.email === "string" ? profile.email : undefined;
	} catch {
		return undefined;
	}
}

interface PendingLogin {
	view: SubscriptionLogin;
	abort: AbortController;
	answer?: { resolve: (value: string) => void; reject: (error: Error) => void };
	error?: string;
}

export interface SubscriptionLogins {
	status(): Promise<SubscriptionStatus[]>;
	start(id: SubscriptionId): void;
	respond(id: SubscriptionId, value: string): boolean;
	cancel(id: SubscriptionId): void;
	signOut(id: SubscriptionId): Promise<void>;
}

export function subscriptionLogins(
	models: Models,
	credentials: CredentialStore,
	deviceId: () => string,
	onChange: () => void = () => {},
): SubscriptionLogins {
	const pending = new Map<SubscriptionId, PendingLogin>();
	const failures = new Map<SubscriptionId, string>();

	function update(id: SubscriptionId, patch: Partial<SubscriptionLogin>): void {
		const login = pending.get(id);
		if (!login) return;
		login.view = Object.fromEntries(
			Object.entries({ ...login.view, ...patch }).filter(([, value]) => value !== undefined),
		) as SubscriptionLogin;
		onChange();
	}

	function notify(id: SubscriptionId, event: AuthEvent): void {
		if (event.type === "auth_url") update(id, { url: event.url, message: event.instructions });
		else if (event.type === "device_code")
			update(id, { url: event.verificationUri, userCode: event.userCode, message: undefined });
		else update(id, { message: event.message });
	}

	function ask(id: SubscriptionId, prompt: AuthPrompt): Promise<string> {
		const login = pending.get(id);
		if (!login) return Promise.reject(new Error("Sign-in was cancelled."));
		return new Promise<string>((resolve, reject) => {
			login.answer = { resolve, reject };
			update(id, {
				prompt: {
					type: prompt.type,
					message: prompt.message,
					...("placeholder" in prompt && prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
					...(prompt.type === "select" ? { options: prompt.options.map((o) => ({ id: o.id, label: o.label })) } : {}),
				},
			});
		});
	}

	function cancel(id: SubscriptionId): void {
		const login = pending.get(id);
		if (!login) return;
		login.answer?.reject(new Error("Sign-in was cancelled."));
		login.abort.abort();
	}

	return {
		async status() {
			const stored = new Map((await credentials.list()).map((info) => [info.providerId, info]));
			return Promise.all(
				SUBSCRIPTIONS.map(async ({ id, label }): Promise<SubscriptionStatus> => {
					const connected = stored.get(id)?.type === "oauth";
					const credential = connected ? await credentials.read(id) : undefined;
					const account = credential?.type === "oauth" ? accountOf(credential.access) : undefined;
					const login = pending.get(id)?.view;
					const error = failures.get(id);
					return {
						id,
						label,
						connected,
						...(account ? { account } : {}),
						...(login ? { login } : {}),
						...(error ? { error } : {}),
					};
				}),
			);
		},
		start(id) {
			if (pending.has(id)) return;
			failures.delete(id);
			const abort = new AbortController();
			pending.set(id, { view: {}, abort });
			onChange();
			const interaction = {
				signal: abort.signal,
				notify: (event: AuthEvent) => notify(id, event),
				prompt: (prompt: AuthPrompt) => ask(id, prompt),
			};
			models
				.login(id, "oauth", interaction, { agentName: "Lanna", getDeviceId: deviceId })
				.catch((error: unknown) => {
					if (!abort.signal.aborted) failures.set(id, error instanceof Error ? error.message : String(error));
				})
				.finally(() => {
					pending.delete(id);
					onChange();
				});
		},
		respond(id, value) {
			const login = pending.get(id);
			if (!login?.answer) return false;
			const { resolve } = login.answer;
			login.answer = undefined;
			update(id, { prompt: undefined });
			resolve(value);
			return true;
		},
		cancel,
		async signOut(id) {
			cancel(id);
			failures.delete(id);
			await models.logout(id);
			onChange();
		},
	};
}
