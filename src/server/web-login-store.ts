/**
 * The web sign-in file (E75): <data root>/web-login.json holds the owner's
 * password record (scrypt) and the throttle state for wrong tries. A missing
 * or unreadable file means no password is set, so nobody can sign in.
 *
 * A try is counted under one lock before the slow hash runs and is given back
 * only when the password was right, so eight guesses made at once still count
 * as eight. The hash itself runs outside the lock.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { issueSession, readAccess, signEveryoneOut } from "./remote-access-store.ts";
import { emptyThrottle, readThrottle, refundAttempt, reserveAttempt, type ThrottleState } from "./web-login-throttle.ts";
import { SCRYPT_DEFAULT, hashPassword, isPasswordRecord, passwordProblem, verifyPassword, type PasswordRecord, type ScryptParams } from "./web-password.ts";

type LoginFile = { version: 1; password: PasswordRecord | null; throttle: ThrottleState };

export type SignInResult =
	| { ok: true; token: string; deviceName: string }
	| { ok: false; reason: "wrong"; triesLeft: number }
	| { ok: false; reason: "locked"; scope: "address" | "global"; retryAfterSec: number }
	| { ok: false; reason: "no-password" | "off" | "invalid" };

const FILE = path.join(PATHS.base, "web-login.json");

function emptyLogin(): LoginFile {
	return { version: 1, password: null, throttle: emptyThrottle() };
}

export function readLogin(): LoginFile {
	try {
		const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<LoginFile>;
		return { version: 1, password: isPasswordRecord(parsed.password) ? parsed.password : null, throttle: readThrottle(parsed.throttle) };
	} catch {
		return emptyLogin();
	}
}

function writeLogin(next: LoginFile): void {
	fs.mkdirSync(PATHS.base, { recursive: true });
	const tmp = `${FILE}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
	fs.renameSync(tmp, FILE);
}

let turn: Promise<unknown> = Promise.resolve();
function exclusive<T>(work: () => T): Promise<T> {
	const run = turn.then(() => work());
	turn = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

export function webPasswordIsSet(): boolean {
	return readLogin().password !== null;
}

/**
 * Sets or changes the password, clears the throttle, and signs every device out
 * (a changed password must end the sessions the old one opened). Resolves to
 * whether this is the first password.
 */
export async function setWebPassword(password: string, options: { params?: ScryptParams; at?: Date } = {}): Promise<{ firstTime: boolean }> {
	const problem = passwordProblem(password);
	if (problem) throw new Error(problem);
	const record = await hashPassword(password, options.params ?? SCRYPT_DEFAULT, options.at);
	const firstTime = await exclusive(() => {
		const before = readLogin();
		writeLogin({ version: 1, password: record, throttle: emptyThrottle() });
		return before.password === null;
	});
	await signEveryoneOut();
	return { firstTime };
}

export async function signInWithPassword(input: { password: unknown; client: string; deviceName: string; at?: Date }): Promise<SignInResult> {
	const at = input.at ?? new Date();
	const now = at.getTime();
	if (typeof input.password !== "string") return { ok: false, reason: "invalid" };
	if (!readAccess().enabled) return { ok: false, reason: "off" };
	if (!readLogin().password) return { ok: false, reason: "no-password" };

	const reserved = await exclusive(() => {
		const file = readLogin();
		const reservation = reserveAttempt(file.throttle, input.client, now);
		writeLogin({ ...file, throttle: reservation.state });
		return { reservation, record: file.password };
	});
	if (!reserved.reservation.allowed) {
		return { ok: false, reason: "locked", scope: reserved.reservation.scope, retryAfterSec: Math.ceil(reserved.reservation.retryAfterMs / 1000) };
	}
	const record = reserved.record;
	if (!record) return { ok: false, reason: "no-password" };
	const triesLeft = reserved.reservation.triesLeft;

	if (!(await verifyPassword(input.password, record))) return { ok: false, reason: "wrong", triesLeft };

	const unchanged = await exclusive(() => {
		const file = readLogin();
		if (file.password?.salt !== record.salt || file.password.hash !== record.hash) return false;
		writeLogin({ ...file, throttle: refundAttempt(file.throttle, input.client, now) });
		return true;
	});
	if (!unchanged) return { ok: false, reason: "wrong", triesLeft };

	const session = await issueSession(input.deviceName, at);
	if (!session) return { ok: false, reason: "off" };
	return { ok: true, token: session.token, deviceName: session.device.name };
}
