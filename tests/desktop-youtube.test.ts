/**
 * Watch → picks, desktop side (electron/youtube.cjs): the sign-in window may
 * reach Google's and YouTube's own hosts only, the renderer can ask for
 * three lists and nothing else, only from the app's own window, and only the
 * page text leaves the session.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const yt = require("../electron/youtube.cjs");

describe("YouTube sign-in window", () => {
	it("allows Google's and YouTube's hosts over https, nothing else", () => {
		for (const ok of ["https://accounts.google.com/ServiceLogin", "https://www.youtube.com/feed/history", "https://myaccount.google.co.uk/", "https://ssl.gstatic.com/x.js", "https://lh3.googleusercontent.com/a"]) assert.equal(yt.allowedUrl(ok), true, ok);
		for (const bad of ["http://accounts.google.com/", "https://evil.com/?q=google.com", "https://google.com.evil.io/", "https://youtube.com.attacker.net/", "javascript:alert(1)", "not a url"]) assert.equal(yt.allowedUrl(bad), false, bad);
	});

	it("answers the app's own window only, for the three lists and the five operations", async () => {
		const handlers = new Map<string, (event: unknown, command: unknown) => Promise<unknown>>();
		const ipcMain = { handle: (name: string, fn: (event: unknown, command: unknown) => Promise<unknown>) => handlers.set(name, fn) };
		const read: string[] = [];
		const youtube = {
			status: async () => ({ available: true, connected: true }),
			connect: async () => ({ available: true, connected: true }),
			read: async (list: string) => (read.push(list), { signedIn: true, html: "<html>" }),
			account: async () => ({ signedIn: true, text: ")]}'\n{}" }),
			disconnect: async () => ({ available: true, connected: false }),
		};
		const trusted = (event: { trusted?: boolean }) => event.trusted === true;
		yt.registerYouTubeIPC(ipcMain, { trusted, youtube, BrowserWindow: { fromWebContents: () => null } });
		const call = handlers.get("lh:youtube")!;
		await assert.rejects(call({ trusted: false, sender: {} }, { op: "status" }), /Untrusted/);
		assert.deepEqual(await call({ trusted: true, sender: {} }, { op: "read", list: "history" }), { signedIn: true, html: "<html>" });
		assert.deepEqual(await call({ trusted: true, sender: {} }, { op: "account" }), { signedIn: true, text: ")]}'\n{}" });
		await assert.rejects(call({ trusted: true, sender: {} }, { op: "read", list: "https://www.youtube.com/account" }), /Unsupported/);
		await assert.rejects(call({ trusted: true, sender: {} }, { op: "read", list: "constructor" }), /Unsupported/);
		await assert.rejects(call({ trusted: true, sender: {} }, { op: "cookies" }), /Unsupported/);
		assert.deepEqual(read, ["history"]);
	});
});
