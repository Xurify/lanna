/**
 * Server-side key manager behind GET/PUT/DELETE /api/keys.
 *
 * Env seam: consumers read process.env directly and the agent layer may not import
 * the store, so the store reflects itself into process.env. At boot every file var
 * unset in the real env is filled in, and each save/delete updates file and env together.
 * Keys take effect without a restart.
 *
 * Precedence: real env vars (incl. .env.local in dev) win over the file. Boot-time
 * real env vars are snapshotted once and never mutated. A PUT to one persists to the
 * file and the status reports shadowedByEnv.
 *
 * Unknown file vars are kept verbatim and shown as generic status rows.
 *
 * A disabled key (auth-disabled.json) keeps its value in the file but is taken out of
 * process.env, env-owned or not, so no consumer sees it until it is switched back on.
 *
 * LANNA_IGNORE_ENV_KEYS=1 hides every env key app-wide. Real env vars are deleted from the
 * process, because pi-ai reads provider keys from process.env on every request.
 * Only auth.json counts, and the fill-gap still reflects it so new keys apply mid-session.
 */

import {
	AUTH_KEYS,
	AUTH_PROVIDER_KEYS,
	AUTH_PROVIDER_ENV_VARS,
	type AuthKeyStatus,
	genericProviderKeyGuard,
	isKnownAuthKey,
	isPlainAuthSetting,
	isProviderEnvVar,
	maskKey,
	validateKeyShape,
} from "../core/auth-keys.ts";
import { authKeyDisabled, authKeySavedAt, authStore } from "../store/auth.ts";
import { isSubscriptionProvider } from "../agent/subscriptions.ts";
import { subscriptionSignedIn } from "../store/subscription-credentials.ts";

// Once-per-process boot record, anchored on globalThis so HMR re-imports
// do not re-snapshot fill-gapped vars as real env.
interface AuthBoot {
	/** Vars in the real env at first init: never touched. */
	realEnv: Set<string>;
	/** Vars we copied from the file into process.env: deletable. */
	fillGap: Set<string>;
	/** Real env values at first init, so a disabled env key can be switched back on. */
	realValues: Record<string, string>;
}
const BOOT_KEY = Symbol.for("lanna.authBoot");

function boot(): AuthBoot {
	const g = globalThis as Record<symbol, AuthBoot | undefined>;
	if (!g[BOOT_KEY]) g[BOOT_KEY] = { realEnv: new Set(), fillGap: new Set(), realValues: {} };
	return g[BOOT_KEY];
}

/** Writable key name: a curated key or a model-provider env var. */
export function isWritableAuthKey(id: string): boolean {
	return isKnownAuthKey(id) || isProviderEnvVar(id);
}

/** Provider dropdown rows, sorted by id for a stable payload. */
export function providerKeyList() {
	return [...AUTH_PROVIDER_KEYS].sort((a, b) => a.id.localeCompare(b.id));
}

/** Fresh-user switch: env keys are invisible app-wide. Read per call. */
export function envKeysIgnored(): boolean {
	return process.env.LANNA_IGNORE_ENV_KEYS === "1";
}

/**
 * Idempotent boot fill-gap. The first call snapshots which managed names are real env.
 * Later calls only fill vars still unset, so a var deleted through the API never comes back.
 */
export function initAuthEnv(): void {
	const record = boot();
	const fileVars = authStore.authVars();
	const managed = new Set<string>([
		...Object.keys(fileVars),
		...AUTH_KEYS.map((k) => k.id),
		// Provider env vars are managed too, so shadowing works as for curated keys.
		...AUTH_PROVIDER_KEYS.map((p) => p.envVar),
	]);
	if (envKeysIgnored()) {
		// Fresh-user switch: delete every managed env var on each call. realEnv stays
		// empty; the fill-gap below still reflects auth.json for mid-session keys.
		for (const name of managed) {
			delete process.env[name];
		}
	} else if (record.realEnv.size === 0 && record.fillGap.size === 0) {
		// First init in this process: what's already in the env is REAL env.
		for (const name of managed) {
			const value = process.env[name];
			if (value === undefined) continue;
			record.realEnv.add(name);
			record.realValues[name] = value;
		}
	}
	const disabled = authKeyDisabled.all();
	for (const [name, value] of Object.entries(fileVars)) {
		if (!isManagedName(name) || disabled.has(name)) continue;
		if (process.env[name] === undefined) {
			process.env[name] = value;
			record.fillGap.add(name);
		}
	}
	for (const name of disabled) {
		delete process.env[name];
		record.fillGap.delete(name);
	}
}

/** Managed: curated, provider, or held in the file. */
function isManagedName(name: string): boolean {
	return isWritableAuthKey(name) || name in authStore.authVars();
}

/** Pure status projection, exported for tests. `realEnv` is the boot snapshot. */
export function resolveKeyStatuses(
	fileVars: Record<string, string>,
	env: Record<string, string | undefined>,
	realEnv: ReadonlySet<string>,
	/** Present model-provider vars get rows; absent ones do not. Curated keys always get rows. */
	providerEnvVars: ReadonlySet<string> = new Set(),
	/** Save times by var name (src/store/auth.ts authKeySavedAt). */
	savedAt: Readonly<Record<string, string>> = {},
	/** Switched-off keys: out of env, so their value comes from the file or the boot snapshot. */
	disabled: ReadonlySet<string> = new Set(),
	realValues: Readonly<Record<string, string>> = {},
): AuthKeyStatus[] {
	const ids = new Set<string>([...AUTH_KEYS.map((k) => k.id), ...Object.keys(fileVars)]);
	for (const envVar of providerEnvVars) {
		const held = env[envVar] !== undefined || fileVars[envVar] !== undefined;
		if (held || (disabled.has(envVar) && realValues[envVar] !== undefined)) ids.add(envVar);
	}
	const rows: AuthKeyStatus[] = [];
	for (const id of ids) {
		const envValue = env[id];
		const fileValue = fileVars[id];
		const isRealEnv = realEnv.has(id);
		// Env wins. After fill-gap, file values live in env, so realEnv tells a real env var from a reflection.
		const isDisabled = disabled.has(id);
		const live =
			envValue !== undefined ? envValue : isDisabled && isRealEnv ? (realValues[id] ?? fileValue) : fileValue;
		const source = isRealEnv ? "env" : live !== undefined ? "file" : "none";
		rows.push({
			id,
			info: AUTH_KEYS.find((k) => k.id === id) ?? null,
			present: live !== undefined,
			masked: live !== undefined ? `${maskKey(live)} (${live.trim().length} chars)` : null,
			source,
			shadowedByEnv: isRealEnv && !isDisabled && fileValue !== undefined && envValue !== fileValue,
			disabled: isDisabled && live !== undefined,
			savedAt: source === "file" ? (savedAt[id] ?? null) : null,
			// Plain settings carry their value to the page; secrets never do.
			...(isPlainAuthSetting(id) && live !== undefined ? { value: live.trim() } : {}),
		});
	}
	return rows;
}

/** The GET view: every curated key (present or not) + unknown file vars. */
export function keyStatuses(): AuthKeyStatus[] {
	return resolveKeyStatuses(
		authStore.authVars(),
		process.env,
		boot().realEnv,
		AUTH_PROVIDER_ENV_VARS,
		authKeySavedAt.all(),
		authKeyDisabled.all(),
		boot().realValues,
	);
}

/** Live value for one var, env first. The canonical read for consumers outside the server barrel. */
export function keyValue(id: string): string | undefined {
	// Fresh-user switch: only the file counts. Guards env keys reintroduced after boot.
	if (authKeyDisabled.has(id)) return undefined;
	if (envKeysIgnored()) return authStore.authVars()[id];
	return process.env[id] ?? authStore.authVars()[id];
}

const MIN_SECRET_LENGTH = 8;

/** Text with every key this server holds taken out, for a provider's error body that is passed on to the page. */
export function redactSecrets(text: string): string {
	const ids = new Set<string>([
		...AUTH_KEYS.map((key) => key.id),
		...AUTH_PROVIDER_ENV_VARS,
		...Object.keys(authStore.authVars()),
	]);
	let out = text;
	for (const id of ids) {
		const value = keyValue(id)?.trim();
		if (value && value.length >= MIN_SECRET_LENGTH && !isPlainAuthSetting(id))
			out = out.split(value).join("[key hidden]");
	}
	return out;
}

/**
 * Would this provider's key be present at request time? Uses the same env-first lookup as pi-ai,
 * so an env-shadowed key counts. Providers with no key entry are present by definition.
 */
export function providerKeyPresent(provider: string): boolean {
	if (isSubscriptionProvider(provider)) return subscriptionSignedIn(provider);
	const info = AUTH_PROVIDER_KEYS.find((p) => p.id === provider);
	return info ? keyValue(info.envVar) !== undefined : true;
}

/** Save one key (PUT): shape gate, file write, then env reflection. Real env vars are not overwritten. */
export function saveKey(id: string, value: string): { ok: true; status: AuthKeyStatus } | { ok: false; error: string } {
	const shape = isProviderEnvVar(id) ? genericProviderKeyGuard(id, value) : validateKeyShape(id, value);
	if (!shape.ok) return { ok: false, error: shape.error };
	const trimmed = value.trim();
	if (authKeyDisabled.has(id)) setKeyEnabled(id, true);
	authStore.setAuthVar(id, trimmed);
	authKeySavedAt.set(id, new Date().toISOString());
	const record = boot();
	if (!record.realEnv.has(id)) {
		process.env[id] = trimmed;
		record.fillGap.add(id);
	}
	// The var was just stored, so its status row exists.
	return { ok: true, status: keyStatuses().find((s) => s.id === id)! };
}

/** Delete one key (DELETE): always removed from the file, and from env only when we set it. */
export function deleteKey(id: string): AuthKeyStatus {
	if (authKeyDisabled.has(id)) setKeyEnabled(id, true);
	authStore.deleteAuthVar(id);
	authKeySavedAt.delete(id);
	const record = boot();
	if (record.fillGap.has(id) && !record.realEnv.has(id)) {
		delete process.env[id];
		record.fillGap.delete(id);
	}
	return keyStatuses().find((s) => s.id === id)!;
}

/** Switch a stored key off or on (PATCH) without deleting it. Off takes it out of process.env,
 *  env-owned or not; on puts back the real env value, else the file's. */
export function setKeyEnabled(id: string, enabled: boolean): AuthKeyStatus | undefined {
	const record = boot();
	authKeyDisabled.set(id, !enabled);
	if (!enabled) {
		delete process.env[id];
		record.fillGap.delete(id);
	} else if (record.realEnv.has(id) && record.realValues[id] !== undefined && !envKeysIgnored()) {
		process.env[id] = record.realValues[id];
	} else {
		const fileValue = authStore.authVars()[id];
		if (fileValue !== undefined) {
			process.env[id] = fileValue;
			record.fillGap.add(id);
		}
	}
	return keyStatuses().find((s) => s.id === id);
}

// Reflect the file into env at first import (idempotent).
initAuthEnv();
