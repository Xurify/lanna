import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-web-login-"));
process.env.LH_DATA_DIR = TMP_DATA;

const login = await import("../src/server/web-login-store.ts");
const access = await import("../src/server/remote-access-store.ts");
const { LOGIN_LIMITS } = await import("../src/server/web-login-throttle.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const FILE = path.join(TMP_DATA, "web-login.json");
const T0 = new Date("2026-11-09T12:00:00Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const PASSWORD = "correct horse battery";
const SMALL = { N: 1024, r: 8, p: 1, keyLength: 32, saltBytes: 16 };
const attempt = (password: unknown, client = "203.0.113.1", seconds = 0) =>
	login.signInWithPassword({ password, client, deviceName: "iPhone", at: at(seconds) });

describe("setting the password", () => {
	it("is unset at first, and a missing file means nobody can sign in", async () => {
		assert.equal(login.webPasswordIsSet(), false);
		await access.enableRemoteAccess({ issueThisComputer: false, at: T0 });
		assert.deepEqual(await attempt(PASSWORD), { ok: false, reason: "no-password" });
	});

	it("refuses a password that is too short, and writes nothing", async () => {
		await assert.rejects(login.setWebPassword("short", { params: SMALL }), /at least 12/);
		assert.equal(fs.existsSync(FILE), false);
	});

	it("keeps a salted scrypt record in the data folder with owner-only permissions, never the password", async () => {
		const first = await login.setWebPassword(PASSWORD, { params: SMALL, at: T0 });
		assert.deepEqual(first, { firstTime: true });
		const text = fs.readFileSync(FILE, "utf8");
		assert.equal(text.includes(PASSWORD), false);
		const record = JSON.parse(text).password;
		assert.equal(record.algo, "scrypt");
		assert.equal(record.N, 1024);
		assert.equal(record.salt.length, 32);
		if (process.platform !== "win32") assert.equal(fs.statSync(FILE).mode & 0o777, 0o600);
		assert.equal(login.webPasswordIsSet(), true);
	});

	it("reads a damaged file as no password, so it fails closed", () => {
		const good = fs.readFileSync(FILE, "utf8");
		fs.writeFileSync(FILE, "{not json");
		assert.equal(login.webPasswordIsSet(), false);
		fs.writeFileSync(FILE, JSON.stringify({ version: 1, password: { ...JSON.parse(good).password, N: 7 } }));
		assert.equal(login.webPasswordIsSet(), false);
		fs.writeFileSync(FILE, good);
		assert.equal(login.webPasswordIsSet(), true);
	});
});

describe("signing in", () => {
	it("signs in with the right password: a device session that lasts 180 days and is named for the browser", async () => {
		const result = await attempt(PASSWORD, "203.0.113.1", 10);
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.deviceName, "iPhone");
		assert.ok(result.token.length >= 40);
		const device = await access.resolveDevice(result.token, at(20));
		assert.equal(device?.name, "iPhone");
		assert.equal(device?.via, "password");
		assert.equal(Date.parse(device!.expiresAt) - Date.parse(device!.createdAt), 180 * 86_400_000);
		assert.equal(
			fs.readFileSync(path.join(TMP_DATA, "access.json"), "utf8").includes(result.token),
			false,
			"only a digest is kept",
		);
		assert.equal(
			access.accessStatus(new Headers(), 3010, at(20)).devices.find((d) => d.id === device!.id)?.via,
			"password",
		);
	});

	it("says nothing about why a wrong password was wrong, and counts down the tries", async () => {
		const wrong = await attempt("not the password", "198.51.100.5", 100);
		assert.deepEqual(wrong, { ok: false, reason: "wrong", triesLeft: LOGIN_LIMITS.perAddressTries - 1 });
		assert.deepEqual(await attempt("", "198.51.100.5", 101), {
			ok: false,
			reason: "wrong",
			triesLeft: LOGIN_LIMITS.perAddressTries - 2,
		});
		assert.deepEqual(await attempt(42, "198.51.100.5", 102), { ok: false, reason: "invalid" });
		assert.deepEqual(await attempt(undefined, "198.51.100.5", 102), { ok: false, reason: "invalid" });
	});

	it("does not count right sign-ins against the limit", async () => {
		for (let i = 0; i < LOGIN_LIMITS.perAddressTries * 2; i++) {
			const result = await attempt(PASSWORD, "192.0.2.50", 200 + i * 20);
			assert.equal(result.ok, true, `sign-in ${i + 1}`);
		}
	});

	it("locks an address after five wrong tries in a minute, and then refuses even the right password", async () => {
		const client = "198.51.100.77";
		for (let i = 0; i < LOGIN_LIMITS.perAddressTries; i++)
			assert.equal((await attempt("nope nope nope", client, 1000 + i)).ok, false);
		const locked = await attempt(PASSWORD, client, 1006);
		assert.equal(locked.ok, false);
		assert.deepEqual(locked, { ok: false, reason: "locked", scope: "address", retryAfterSec: 900 });
		assert.equal((await attempt(PASSWORD, "198.51.100.78", 1006)).ok, true, "another address is not locked");
		assert.equal((await attempt(PASSWORD, client, 1006 + 899)).ok, false, "still locked a second before the end");
		assert.equal((await attempt(PASSWORD, client, 1006 + 901)).ok, true, "free once the lock is over");
	});

	it("counts guesses made at the same moment, so eight parallel tries cannot beat the limit of five", async () => {
		const client = "198.51.100.99";
		const results = await Promise.all(Array.from({ length: 8 }, () => attempt("parallel guess", client, 5000)));
		assert.equal(results.filter((r) => !r.ok && r.reason === "wrong").length, LOGIN_LIMITS.perAddressTries);
		assert.equal(results.filter((r) => !r.ok && r.reason === "locked").length, 8 - LOGIN_LIMITS.perAddressTries);
	});

	it("keeps the count across a restart, because it lives in the file", async () => {
		const client = "198.51.100.120";
		for (let i = 0; i < 3; i++) await attempt("restart guess", client, 8000 + i);
		const onDisk = JSON.parse(fs.readFileSync(FILE, "utf8"));
		assert.equal(onDisk.throttle.addresses[client].attempts.length, 3);
	});
});

describe("a changed password and the switch", () => {
	it("signs every device out when the password changes, and the old password stops working", async () => {
		const before = await attempt(PASSWORD, "203.0.113.200", 9000);
		assert.equal(before.ok, true);
		assert.ok(access.readAccess().devices.length > 0);
		const changed = await login.setWebPassword("a different long passphrase", { params: SMALL, at: at(9001) });
		assert.deepEqual(changed, { firstTime: false });
		assert.equal(access.readAccess().devices.length, 0);
		assert.equal(access.readAccess().enabled, true, "the switch stays as it was");
		if (before.ok) assert.equal(await access.resolveDevice(before.token, at(9002)), null);
		assert.equal((await attempt(PASSWORD, "203.0.113.201", 9003)).ok, false);
		assert.equal((await attempt("a different long passphrase", "203.0.113.202", 9004)).ok, true);
	});

	it("clears the locks when the password is set again, because the owner has just proved they hold the server", async () => {
		const client = "198.51.100.150";
		for (let i = 0; i < 6; i++) await attempt("lock me out", client, 9500 + i);
		assert.equal((await attempt("a different long passphrase", client, 9510)).ok, false, "locked");
		await login.setWebPassword("a third long passphrase", { params: SMALL, at: at(9511) });
		assert.equal((await attempt("a third long passphrase", client, 9512)).ok, true);
	});

	it("does not create a session while web access is off", async () => {
		await access.disableRemoteAccess();
		assert.deepEqual(await attempt("a third long passphrase", "203.0.113.210", 9600), { ok: false, reason: "off" });
		assert.equal(access.readAccess().devices.length, 0);
	});

	it("ends a session when its token is revoked, and only that one", async () => {
		await access.enableRemoteAccess({ issueThisComputer: false, at: at(9700) });
		const a = await attempt("a third long passphrase", "203.0.113.220", 9701);
		const b = await attempt("a third long passphrase", "203.0.113.221", 9702);
		assert.ok(a.ok && b.ok);
		if (!a.ok || !b.ok) return;
		assert.equal(await access.revokeToken(a.token), true);
		assert.equal(await access.revokeToken(a.token), false);
		assert.equal(await access.resolveDevice(a.token, at(9703)), null);
		assert.notEqual(await access.resolveDevice(b.token, at(9703)), null);
	});
});
