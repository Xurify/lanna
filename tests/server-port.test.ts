import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const { PREFERRED_PORT, choosePort } = require("../electron/server-port.cjs") as {
	PREFERRED_PORT: number;
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
