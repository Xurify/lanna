import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";
import { AUTH_FILE } from "../../config.ts";

interface SubscriptionFile {
	version: 1;
	deviceId: string;
	credentials: Record<string, Credential>;
}

export const SUBSCRIPTIONS_FILE = path.join(path.dirname(AUTH_FILE), "subscriptions.json");

function isCredential(value: unknown): value is Credential {
	if (!value || typeof value !== "object") return false;
	const type = (value as { type?: unknown }).type;
	if (type === "api_key") return true;
	if (type !== "oauth") return false;
	const { access, refresh, expires } = value as Record<string, unknown>;
	return typeof access === "string" && typeof refresh === "string" && typeof expires === "number";
}

function read(file: string): SubscriptionFile {
	try {
		const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<SubscriptionFile>;
		const credentials = Object.fromEntries(
			Object.entries(raw.credentials ?? {}).filter(([, credential]) => isCredential(credential)),
		);
		return {
			version: 1,
			deviceId: typeof raw.deviceId === "string" && raw.deviceId ? raw.deviceId : randomUUID(),
			credentials,
		};
	} catch {
		return { version: 1, deviceId: randomUUID(), credentials: {} };
	}
}

function write(file: string, data: SubscriptionFile): void {
	const dir = path.dirname(file);
	fs.mkdirSync(dir, { recursive: true });
	const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}`);
	fs.writeFileSync(tmp, `${JSON.stringify(data, null, "\t")}\n`, { mode: 0o600 });
	fs.chmodSync(tmp, 0o600);
	fs.renameSync(tmp, file);
}

export interface SubscriptionCredentialStore extends CredentialStore {
	deviceId(): string;
}

export function fileSubscriptionCredentials(file = SUBSCRIPTIONS_FILE): SubscriptionCredentialStore {
	const queues = new Map<string, Promise<unknown>>();

	function serialized<T>(providerId: string, work: () => Promise<T>): Promise<T> {
		const previous = queues.get(providerId) ?? Promise.resolve();
		const next = previous.then(work, work);
		queues.set(
			providerId,
			next.catch(() => undefined),
		);
		return next;
	}

	return {
		deviceId() {
			const data = read(file);
			if (!fs.existsSync(file)) write(file, data);
			return data.deviceId;
		},
		async read(providerId) {
			return read(file).credentials[providerId];
		},
		async list() {
			return Object.entries(read(file).credentials).map(([providerId, credential]): CredentialInfo => ({
				providerId,
				type: credential.type,
			}));
		},
		modify(providerId, fn) {
			return serialized(providerId, async () => {
				const next = await fn(read(file).credentials[providerId]);
				if (next === undefined) return read(file).credentials[providerId];
				const data = read(file);
				data.credentials[providerId] = next;
				write(file, data);
				return next;
			});
		},
		delete(providerId) {
			return serialized(providerId, async () => {
				const data = read(file);
				if (!(providerId in data.credentials)) return;
				delete data.credentials[providerId];
				write(file, data);
			});
		},
	};
}

export function subscriptionSignedIn(providerId: string, file = SUBSCRIPTIONS_FILE): boolean {
	return read(file).credentials[providerId]?.type === "oauth";
}

export function subscriptionCredential(providerId: string, file = SUBSCRIPTIONS_FILE): Credential | undefined {
	return read(file).credentials[providerId];
}
