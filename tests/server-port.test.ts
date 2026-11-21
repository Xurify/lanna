import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const { PREFERRED_PORT, usablePort, readPreferredPort, choosePort } = require("../electron/server-port.cjs") as {
	PREFERRED_PORT: number;
	usablePort: (value: unknown) => boolean;
	readPreferredPort: (file: string) => number | null;
	choosePort: (options: {
		canBind: (port: number) => Promise<boolean>;
		remember: (port: number) => void;
		fallback: () => Promise<number>;
		preferred?: number;
		remembered?: number | null;
		attempts?: number;
		waitMs?: number;
		sleep?: () => Promise<void>;
	}) => Promise<number>;
};

const noSleep = () => Promise.resolve();

describe("the preferred server port", () => {
	it("is 31551", () => {
		assert.equal(PREFERRED_PORT, 31551);
	});

	it("is used whenever it is free", async () => {
		const remembered: number[] = [];
		const port = await choosePort({
			canBind: async () => true,
			remember: (chosen) => remembered.push(chosen),
			fallback: async () => 1,
			sleep: noSleep,
		});
		assert.equal(port, PREFERRED_PORT);
		assert.deepEqual(remembered, [PREFERRED_PORT]);
	});

	it("waits out a port another process is still releasing", async () => {
		let tries = 0;
		const port = await choosePort({
			canBind: async () => ++tries > 2,
			remember: () => {},
			fallback: async () => 1,
			sleep: noSleep,
		});
		assert.equal(port, PREFERRED_PORT);
		assert.equal(tries, 3);
	});

	it("keeps the port it used last time when the preferred one is taken", async () => {
		const port = await choosePort({
			canBind: async (candidate) => candidate === 3010,
			remember: () => {},
			fallback: async () => 1,
			remembered: 3010,
			sleep: noSleep,
		});
		assert.equal(port, 3010);
	});

	it("takes a preferred port the user saved", async () => {
		const port = await choosePort({
			canBind: async (candidate) => candidate === 4100,
			remember: () => {},
			fallback: async () => 1,
			preferred: 4100,
			remembered: PREFERRED_PORT,
			sleep: noSleep,
		});
		assert.equal(port, 4100);
	});

	it("falls back to the factory port when the saved one is unusable", async () => {
		const port = await choosePort({
			canBind: async (candidate) => candidate === PREFERRED_PORT,
			remember: () => {},
			fallback: async () => 1,
			sleep: noSleep,
		});
		assert.equal(port, PREFERRED_PORT);
	});

	it("asks the kernel when neither port is available", async () => {
		const remembered: number[] = [];
		const port = await choosePort({
			canBind: async () => false,
			remember: (chosen) => remembered.push(chosen),
			fallback: async () => 49152,
			remembered: 3010,
			attempts: 2,
			sleep: noSleep,
		});
		assert.equal(port, 49152);
		assert.deepEqual(remembered, [49152]);
	});
});

describe("the port saved in Settings → Devices", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-port-"));
	const write = (body: unknown) => {
		const file = path.join(dir, `${Math.random().toString(36).slice(2)}.json`);
		fs.writeFileSync(file, JSON.stringify(body));
		return file;
	};

	it("is read from settings.json", () => {
		assert.equal(readPreferredPort(write({ devices: { preferredPort: 4100 } })), 4100);
	});

	it("is ignored when the shell could not use it", () => {
		assert.equal(readPreferredPort(write({ devices: { preferredPort: 1455 } })), null);
		assert.equal(readPreferredPort(write({ devices: { preferredPort: 80 } })), null);
	});

	it("leaves the factory port when there is nothing saved", () => {
		assert.equal(readPreferredPort(path.join(dir, "absent.json")), null);
		assert.equal(readPreferredPort(write({ devices: null })), null);
		assert.equal(readPreferredPort(write("nonsense")), null);
		assert.equal(readPreferredPort(write({ general: { autoUpdate: true } })), null);
	});

	it("uses the same rule the settings section enforces", () => {
		assert.equal(usablePort(1024), true);
		assert.equal(usablePort(65535), true);
		assert.equal(usablePort(1023), false);
		assert.equal(usablePort(3010.5), false);
		assert.equal(usablePort("4100"), false);
	});
});
