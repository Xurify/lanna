/**
 * REMOTE ACCESS STORE (E21): the file, the pairing code's tries and expiry,
 * device sessions, their revocation, and the fail-closed read. Runs under a
 * throwaway LANNA_DATA_DIR, set before any config-loading import (E6).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-remote-access-"));
process.env.LANNA_DATA_DIR = TMP_DATA;

const store = await import("../src/server/remote-access-store.ts");
const { DEVICE_COOKIE } = await import("../src/server/remote-access.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const FILE = path.join(TMP_DATA, "access.json");
const T0 = new Date("2026-11-01T12:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const text = () => fs.readFileSync(FILE, "utf8");

describe("remote access file", () => {
	it("is off when there is no file, and lives in the data folder, never the repo", () => {
		assert.equal(fs.existsSync(FILE), false);
		assert.equal(store.readAccess().enabled, false);
		assert.deepEqual(store.readAccess().devices, []);
	});

	it("refuses to make a pairing code while remote access is off", async () => {
		assert.equal(await store.createPairingCode(T0), "off");
	});

	it("turns on, hands the asking window a session, and keeps only a digest of it on disk", async () => {
		const { token } = await store.enableRemoteAccess({ issueThisComputer: true, at: T0 });
		assert.ok(token && token.length >= 40);
		assert.equal(text().includes(token!), false, "the raw token must never be written");
		const device = await store.resolveDevice(token!, at(1));
		assert.equal(device?.name, "This computer");
		assert.equal(await store.resolveDevice("not-a-token", at(1)), null);
	});

	it("reports the status, and marks nobody current when the request carries no cookie", () => {
		const status = store.accessStatus(new Headers(), 3010, T0);
		assert.equal(status.enabled, true);
		assert.equal(status.port, 3010);
		assert.equal(status.serveCommand, "tailscale serve --bg 3010");
		assert.equal(status.devices.length, 1);
		assert.deepEqual(
			status.devices.map((d) => d.current),
			[false],
		);
	});
});

describe("pairing codes", () => {
	it("pairs a phone with the right code, and retires the code", async () => {
		const made = await store.createPairingCode(at(10));
		assert.notEqual(made, "off");
		if (made === "off") return;
		assert.match(made.code, /^\d{6}$/);
		const result = await store.redeemPairingCode({ code: made.code, name: "iPhone", at: at(11) });
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.device.name, "iPhone");
		assert.equal(text().includes(result.token), false);
		assert.equal((await store.resolveDevice(result.token, at(11)))?.id, result.device.id);
		assert.deepEqual(await store.redeemPairingCode({ code: made.code, name: "again", at: at(11) }), {
			ok: false,
			reason: "no-code",
		});
	});

	it("spends five wrong tries, then the code is used up", async () => {
		const made = await store.createPairingCode(at(20));
		if (made === "off") throw new Error("expected a code");
		const wrong = made.code === "000000" ? "111111" : "000000";
		const left: number[] = [];
		for (let i = 0; i < 5; i++) {
			const result = await store.redeemPairingCode({ code: wrong, name: "x", at: at(21) });
			assert.equal(result.ok, false);
			if (!result.ok && result.reason === "wrong") left.push(result.attemptsLeft);
		}
		assert.deepEqual(left, [4, 3, 2, 1, 0]);
		assert.deepEqual(await store.redeemPairingCode({ code: made.code, name: "x", at: at(21) }), {
			ok: false,
			reason: "no-code",
		});
	});

	it("counts concurrent wrong guesses exactly, so parallel requests cannot exceed the limit", async () => {
		const made = await store.createPairingCode(at(30));
		if (made === "off") throw new Error("expected a code");
		const wrong = made.code === "000000" ? "111111" : "000000";
		const results = await Promise.all(
			Array.from({ length: 8 }, () => store.redeemPairingCode({ code: wrong, name: "x", at: at(31) })),
		);
		const wrongs = results.flatMap((r) => (!r.ok && r.reason === "wrong" ? [r.attemptsLeft] : []));
		const noCode = results.filter((r) => !r.ok && r.reason === "no-code").length;
		assert.deepEqual(wrongs.sort(), [0, 1, 2, 3, 4]);
		assert.equal(noCode, 3);
	});

	it("expires after five minutes, even with the right code", async () => {
		const made = await store.createPairingCode(at(40));
		if (made === "off") throw new Error("expected a code");
		assert.deepEqual(await store.redeemPairingCode({ code: made.code, name: "late", at: at(46) }), {
			ok: false,
			reason: "expired",
		});
	});
});

describe("device sessions", () => {
	it("refreshes last-used at most every quarter hour, and expires after 180 days", async () => {
		const { token } = await store.enableRemoteAccess({ issueThisComputer: true, at: at(100) });
		const first = await store.resolveDevice(token!, at(101));
		assert.equal(first?.lastSeenAt, at(100).toISOString());
		const later = await store.resolveDevice(token!, at(120));
		assert.equal(later?.lastSeenAt, at(120).toISOString());
		const expired = new Date(at(100).getTime() + 181 * 86_400_000);
		assert.equal(await store.resolveDevice(token!, expired), null);
		assert.equal(
			store.readAccess().devices.some((d) => d.id === first?.id),
			false,
			"an expired device is dropped",
		);
	});

	it("revokes one device, and says so when there is nothing to revoke", async () => {
		const made = await store.createPairingCode(at(200));
		if (made === "off") throw new Error("expected a code");
		const paired = await store.redeemPairingCode({ code: made.code, name: "Old iPad", at: at(201) });
		if (!paired.ok) throw new Error("expected a pairing");
		assert.equal(await store.revokeDevice(store.readAccess().devices.find((d) => d.name === "Old iPad")!.id), true);
		assert.equal(await store.resolveDevice(paired.token, at(202)), null);
		assert.equal(await store.revokeDevice("dev_missing"), false);
	});

	it("marks the device that asked as current, by its cookie", async () => {
		const made = await store.createPairingCode(at(300));
		if (made === "off") throw new Error("expected a code");
		const paired = await store.redeemPairingCode({ code: made.code, name: "Phone", at: at(301) });
		if (!paired.ok) throw new Error("expected a pairing");
		const headers = new Headers({ cookie: `${DEVICE_COOKIE}=${paired.token}` });
		const status = store.accessStatus(headers, 3010, at(302));
		assert.deepEqual(
			status.devices.filter((d) => d.current).map((d) => d.name),
			["Phone"],
		);
	});
});

describe("turning off and the fail-closed read", () => {
	it("turns off, signs every device out and drops the waiting code", async () => {
		await store.createPairingCode(at(400));
		const access = await store.disableRemoteAccess();
		assert.equal(access.enabled, false);
		assert.deepEqual(access.devices, []);
		assert.equal(store.readAccess().pairing, null);
		assert.equal(await store.createPairingCode(at(401)), "off");
	});

	it("reads an unreadable file as on with no devices, so nothing gets in", async () => {
		fs.writeFileSync(FILE, "{ this is not json");
		const access = store.readAccess();
		assert.equal(access.enabled, true);
		assert.deepEqual(access.devices, []);
		assert.equal(await store.resolveDevice("anything", at(500)), null);
		await store.disableRemoteAccess();
		assert.equal(store.readAccess().enabled, false, "turning it off repairs the file");
	});
});
