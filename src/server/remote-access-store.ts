/**
 * The remote-access file (E21): <data root>/access.json. It holds the switch,
 * at most one pairing code (salted digest, 5 minutes, 5 wrong tries) and the
 * paired devices (digests of their session tokens, 180 days, revocable).
 *
 * Every change runs one at a time and is written to a temporary file and then
 * renamed, so two requests cannot both spend the same wrong try. A file that
 * cannot be read means ON with no devices: phones are refused until
 * `npm run remote:off` writes the file back to off.
 */
import { randomBytes, randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import {
	DEVICE_COOKIE,
	DEVICE_SESSION_DAYS,
	PAIRING_CODE_DIGITS,
	PAIRING_CODE_MINUTES,
	PAIRING_MAX_FAILURES,
	hashSecret,
	readCookie,
	sameHash,
} from "./remote-access.ts";

type DeviceRecord = {
	id: string;
	name: string;
	createdAt: string;
	lastSeenAt: string;
	expiresAt: string;
	tokenHash: string;
	via?: "password";
};

type PairingRecord = { salt: string; codeHash: string; expiresAt: string; failures: number };

type AccessFile = {
	version: 1;
	enabled: boolean;
	enabledAt: string | null;
	pairing: PairingRecord | null;
	devices: DeviceRecord[];
};

type AccessStatus = {
	enabled: boolean;
	port: number;
	serveCommand: string;
	devices: { id: string; name: string; createdAt: string; lastSeenAt: string; current: boolean; via: "pairing" | "password" }[];
	pairing: { expiresAt: string } | null;
};

type RedeemResult =
	| { ok: true; token: string; device: DeviceRecord }
	| { ok: false; reason: "off" | "no-code" | "expired" }
	| { ok: false; reason: "wrong"; attemptsLeft: number };

/** The shared data root (next to settings.json), never the repo: a repo-side file would be committed by accident. */
const FILE = path.join(PATHS.base, "access.json");
/** A device's last-seen time moves at most this often: one write per quarter hour, not per request. */
const LAST_SEEN_EVERY_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

function emptyAccess(): AccessFile {
	return { version: 1, enabled: false, enabledAt: null, pairing: null, devices: [] };
}

function unreadableAccess(): AccessFile {
	return { ...emptyAccess(), enabled: true };
}

function isDevice(value: unknown): value is DeviceRecord {
	const d = value as Partial<DeviceRecord> | null;
	return Boolean(d && typeof d.id === "string" && typeof d.tokenHash === "string" && typeof d.expiresAt === "string" && (d.via === undefined || d.via === "password"));
}

function isPairing(value: unknown): value is PairingRecord {
	const p = value as Partial<PairingRecord> | null;
	return Boolean(p && typeof p.salt === "string" && typeof p.codeHash === "string" && typeof p.expiresAt === "string");
}

/** The file as it stands: missing means off, unreadable means on with no devices (fail closed). */
export function readAccess(): AccessFile {
	let text: string;
	try {
		text = fs.readFileSync(FILE, "utf8");
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "ENOENT" ? emptyAccess() : unreadableAccess();
	}
	try {
		const parsed = JSON.parse(text) as Partial<AccessFile>;
		if (typeof parsed?.enabled !== "boolean" || !Array.isArray(parsed.devices)) return unreadableAccess();
		return {
			version: 1,
			enabled: parsed.enabled,
			enabledAt: typeof parsed.enabledAt === "string" ? parsed.enabledAt : null,
			pairing: isPairing(parsed.pairing) ? parsed.pairing : null,
			devices: parsed.devices.filter(isDevice),
		};
	} catch {
		return unreadableAccess();
	}
}

function writeAccess(next: AccessFile): void {
	fs.mkdirSync(PATHS.base, { recursive: true });
	const tmp = `${FILE}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
	fs.renameSync(tmp, FILE);
}

/** One change at a time: the read, the check and the write happen as a unit. */
let turn: Promise<unknown> = Promise.resolve();
function exclusive<T>(work: () => T): Promise<T> {
	const run = turn.then(() => work());
	turn = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

function newToken(): string {
	return randomBytes(32).toString("base64url");
}

function newDevice(name: string, token: string, at: Date): DeviceRecord {
	const now = at.toISOString();
	return {
		id: `dev_${randomBytes(6).toString("hex")}`,
		name,
		createdAt: now,
		lastSeenAt: now,
		expiresAt: new Date(at.getTime() + DEVICE_SESSION_DAYS * DAY_MS).toISOString(),
		tokenHash: hashSecret(token),
	};
}

/** The live device a token belongs to, or null. Reads only. */
function findLiveDevice(access: AccessFile, token: string, at: Date): DeviceRecord | null {
	const tokenHash = hashSecret(token);
	const device = access.devices.find((d) => sameHash(d.tokenHash, tokenHash));
	if (!device || Date.parse(device.expiresAt) <= at.getTime()) return null;
	return device;
}

/** Turns remote access on. The window that asked is handed a session as "This computer", unless it already has one or is the desktop window. */
export function enableRemoteAccess(options: { issueThisComputer: boolean; at?: Date }): Promise<{ token: string | null; access: AccessFile }> {
	return exclusive(() => {
		const at = options.at ?? new Date();
		const current = readAccess();
		let next: AccessFile = current.enabled ? current : { ...current, enabled: true, enabledAt: at.toISOString(), pairing: null };
		let token: string | null = null;
		if (options.issueThisComputer) {
			token = newToken();
			next = { ...next, devices: [...next.devices, newDevice("This computer", token, at)] };
		}
		if (next !== current) writeAccess(next);
		return { token, access: next };
	});
}

/** Turns remote access off and signs every device out. Also the recovery path (npm run remote:off). */
export function disableRemoteAccess(): Promise<AccessFile> {
	return exclusive(() => {
		const next = emptyAccess();
		writeAccess(next);
		return next;
	});
}

/** One pairing code at a time: a new one replaces the old. Resolves to "off" while remote access is off. */
export function createPairingCode(at: Date = new Date()): Promise<{ code: string; expiresAt: string } | "off"> {
	return exclusive(() => {
		const access = readAccess();
		if (!access.enabled) return "off";
		const code = String(randomInt(0, 10 ** PAIRING_CODE_DIGITS)).padStart(PAIRING_CODE_DIGITS, "0");
		const salt = randomBytes(16).toString("hex");
		const expiresAt = new Date(at.getTime() + PAIRING_CODE_MINUTES * 60_000).toISOString();
		writeAccess({ ...access, pairing: { salt, codeHash: hashSecret(`${salt}:${code}`), expiresAt, failures: 0 } });
		return { code, expiresAt };
	});
}

/** Spends a try on the waiting code. The right code signs the new device in and retires the code. */
export function redeemPairingCode(input: { code: string; name: string; at?: Date }): Promise<RedeemResult> {
	return exclusive((): RedeemResult => {
		const at = input.at ?? new Date();
		const access = readAccess();
		if (!access.enabled) return { ok: false, reason: "off" };
		const pairing = access.pairing;
		if (!pairing) return { ok: false, reason: "no-code" };
		if (Date.parse(pairing.expiresAt) <= at.getTime()) {
			writeAccess({ ...access, pairing: null });
			return { ok: false, reason: "expired" };
		}
		if (!sameHash(hashSecret(`${pairing.salt}:${input.code}`), pairing.codeHash)) {
			const failures = pairing.failures + 1;
			const attemptsLeft = Math.max(0, PAIRING_MAX_FAILURES - failures);
			writeAccess({ ...access, pairing: attemptsLeft > 0 ? { ...pairing, failures } : null });
			return { ok: false, reason: "wrong", attemptsLeft };
		}
		const token = newToken();
		const device = newDevice(input.name, token, at);
		writeAccess({ ...access, pairing: null, devices: [...access.devices, device] });
		return { ok: true, token, device };
	});
}

/** The device a session cookie belongs to, or null. Refreshes its last-seen time now and then, and drops it once expired. */
export function resolveDevice(token: string, at: Date = new Date()): Promise<DeviceRecord | null> {
	return exclusive(() => {
		const access = readAccess();
		if (!access.enabled) return null;
		const device = findLiveDevice(access, token, at);
		const tokenHash = hashSecret(token);
		const expired = access.devices.find((d) => sameHash(d.tokenHash, tokenHash));
		if (!device) {
			if (expired) writeAccess({ ...access, devices: access.devices.filter((d) => d !== expired) });
			return null;
		}
		if (at.getTime() - Date.parse(device.lastSeenAt) < LAST_SEEN_EVERY_MS) return device;
		const seen = { ...device, lastSeenAt: at.toISOString() };
		writeAccess({ ...access, devices: access.devices.map((d) => (d.id === device.id ? seen : d)) });
		return seen;
	});
}

/** Signs a browser in after a right password (E86). Null while access is off, so a sign-in that raced a switch-off creates nothing. */
export function issueSession(name: string, at: Date = new Date()): Promise<{ token: string; device: DeviceRecord } | null> {
	return exclusive(() => {
		const access = readAccess();
		if (!access.enabled) return null;
		const token = newToken();
		const device: DeviceRecord = { ...newDevice(name, token, at), via: "password" };
		writeAccess({ ...access, devices: [...access.devices, device] });
		return { token, device };
	});
}

/** Signs every device out and keeps the switch as it is: what changing the password does. */
export function signEveryoneOut(): Promise<void> {
	return exclusive(() => {
		const access = readAccess();
		if (access.devices.length > 0 || access.pairing) writeAccess({ ...access, devices: [], pairing: null });
	});
}

/** Signs out the device a token belongs to. False when it names none. */
export function revokeToken(token: string): Promise<boolean> {
	return exclusive(() => {
		const access = readAccess();
		const tokenHash = hashSecret(token);
		const devices = access.devices.filter((d) => !sameHash(d.tokenHash, tokenHash));
		if (devices.length === access.devices.length) return false;
		writeAccess({ ...access, devices });
		return true;
	});
}

/** Signs one device out. False when no such device is paired. */
export function revokeDevice(id: string): Promise<boolean> {
	return exclusive(() => {
		const access = readAccess();
		const devices = access.devices.filter((d) => d.id !== id);
		if (devices.length === access.devices.length) return false;
		writeAccess({ ...access, devices });
		return true;
	});
}

/** The Settings → Devices view. Reads only. `current` marks the device that asked. */
export function accessStatus(headers: Headers, port: number, at: Date = new Date()): AccessStatus {
	const access = readAccess();
	const token = readCookie(headers, DEVICE_COOKIE);
	const me = token ? findLiveDevice(access, token, at) : null;
	const live = access.devices.filter((d) => Date.parse(d.expiresAt) > at.getTime());
	return {
		enabled: access.enabled,
		port,
		serveCommand: `tailscale serve --bg ${port}`,
		devices: live.map((d) => ({ id: d.id, name: d.name, createdAt: d.createdAt, lastSeenAt: d.lastSeenAt, current: d.id === me?.id, via: d.via ?? "pairing" })),
		pairing: access.pairing && Date.parse(access.pairing.expiresAt) > at.getTime() ? { expiresAt: access.pairing.expiresAt } : null,
	};
}

/** Whether a token names a live device. Reads only; the proxy uses resolveDevice, which also refreshes it. */
export function isPairedToken(token: string | null, at: Date = new Date()): boolean {
	if (!token) return false;
	const access = readAccess();
	return access.enabled && findLiveDevice(access, token, at) !== null;
}
