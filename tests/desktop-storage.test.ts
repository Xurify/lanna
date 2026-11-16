/**
 * Settings → Storage, desktop side: the two handlers touch only Electron's HTTP
 * cache and only for the app's own window, and the preload forwards to exactly
 * those two channels.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const { registerStorageIPC } = require("../electron/storage-ipc.cjs");

type Handler = (event: unknown) => unknown;

function mainProcess(trusted = true) {
	const handlers = new Map<string, Handler>();
	const cleared: number[] = [];
	let cache = 4096;
	const session = {
		defaultSession: {
			getCacheSize: async () => cache,
			clearCache: async () => {
				cleared.push(cache);
				cache = 0;
			},
		},
	};
	registerStorageIPC(
		{ handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
		{ session, trusted: () => trusted },
	);
	return { handlers, cleared };
}

describe("registerStorageIPC", () => {
	it("reports the HTTP cache size, clears it, and answers with the size afterwards", async () => {
		const { handlers, cleared } = mainProcess();
		assert.equal(await handlers.get("lanna:storage:cache-size")!({}), 4096);
		assert.equal(await handlers.get("lanna:storage:clear-cache")!({}), 0);
		assert.deepEqual(cleared, [4096]);
	});

	it("refuses both channels for any sender but the app's own window, and clears nothing", async () => {
		const { handlers, cleared } = mainProcess(false);
		await assert.rejects(async () => handlers.get("lanna:storage:cache-size")!({}), /Untrusted desktop request/);
		await assert.rejects(async () => handlers.get("lanna:storage:clear-cache")!({}), /Untrusted desktop request/);
		assert.deepEqual(cleared, []);
	});
});

describe("preload storage bridge", () => {
	it("forwards cacheSize and clearCache to exactly the two storage channels", async () => {
		let bridge!: { storage: { cacheSize(): Promise<number>; clearCache(): Promise<number> } };
		const invoked: string[] = [];
		runInNewContext(readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8"), {
			process: { platform: "win32" },
			require: () => ({
				contextBridge: {
					exposeInMainWorld: (_: string, value: typeof bridge) => {
						bridge = value;
					},
				},
				ipcRenderer: {
					on() {},
					invoke: async (channel: string) => {
						invoked.push(channel);
						return 0;
					},
				},
			}),
		});
		await bridge.storage.cacheSize();
		await bridge.storage.clearCache();
		assert.deepEqual(invoked, ["lanna:storage:cache-size", "lanna:storage:clear-cache"]);
	});
});
