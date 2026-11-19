/**
 * Reminder alerts → the OS. The shell raises the notification in the main
 * process for the app's own window only and reports a click back
 * (electron/notifications-ipc.cjs); the preload forwards to exactly those two
 * channels; and the renderer reads the desktop shell as already permitted,
 * because Chromium refuses its own Notification API there (it reports
 * Notification.permission as "denied" — measured with Electron 45 on Windows).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import type { ScheduledNudge } from "../src/core/index.ts";

const require = createRequire(import.meta.url);
const { registerNotificationsIPC } = require("../electron/notifications-ipc.cjs");

type Handler = (event: unknown, payload: unknown) => unknown;
type Payload = { id: string; title: string; body: string };

class FakeNotification {
	static supported = true;
	static shown: FakeNotification[] = [];
	static isSupported(): boolean {
		return FakeNotification.supported;
	}
	options: Record<string, unknown>;
	click: (() => void) | null = null;
	constructor(options: Record<string, unknown>) {
		this.options = options;
		FakeNotification.shown.push(this);
	}
	on(event: string, cb: () => void): this {
		if (event === "click") this.click = cb;
		return this;
	}
	show(): void {}
}

function mainProcess({ trusted = true, supported = true } = {}) {
	FakeNotification.supported = supported;
	FakeNotification.shown = [];
	const handlers = new Map<string, Handler>();
	const sends: Array<[string, unknown]> = [];
	const windowActions: string[] = [];
	const win = {
		isMinimized: () => true,
		restore: () => windowActions.push("restore"),
		show: () => windowActions.push("show"),
		focus: () => windowActions.push("focus"),
	};
	const sender = { send: (channel: string, id: unknown) => sends.push([channel, id]) };
	registerNotificationsIPC(
		{ handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
		{ trusted: () => trusted, BrowserWindow: { fromWebContents: () => win }, Notification: FakeNotification },
	);
	return { handlers, sends, windowActions, call: handlers.get("lanna:notify")!, sender };
}

describe("registerNotificationsIPC", () => {
	it("raises the OS notification with the alert's title and body, and reports a click back", async () => {
		const { call, sender, sends, windowActions } = mainProcess();
		assert.equal(await call({ sender }, { id: "n1", title: "Review due", body: "12 cards are due." }), true);
		const shown = FakeNotification.shown;
		assert.deepEqual(shown[0]!.options, { title: "Review due", body: "12 cards are due.", silent: true });
		shown[0]!.click!();
		assert.deepEqual(windowActions, ["restore", "show", "focus"]);
		assert.deepEqual(sends, [["lanna:notification-open", "n1"]]);
	});

	it("refuses any sender but the app's own window, and raises nothing", async () => {
		const { call, sender } = mainProcess({ trusted: false });
		assert.throws(() => call({ sender }, { id: "n1", title: "t", body: "b" }), /Untrusted desktop request/);
		assert.equal(FakeNotification.shown.length, 0);
	});

	it("reports false and raises nothing when the OS cannot show a notification", async () => {
		const { call, sender } = mainProcess({ supported: false });
		assert.equal(await call({ sender }, { id: "n1", title: "t", body: "b" }), false);
		assert.equal(FakeNotification.shown.length, 0);
	});
});

describe("preload notifications bridge", () => {
	it("forwards notify and onOpen to exactly the notify and click channels", async () => {
		let bridge!: {
			notifications: { notify(payload: Payload): Promise<boolean>; onOpen(cb: (id: string) => void): () => void };
		};
		const invoked: string[] = [];
		const heard: string[] = [];
		runInNewContext(readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8"), {
			process: { platform: "win32" },
			require: () => ({
				contextBridge: {
					exposeInMainWorld: (_: string, value: typeof bridge) => {
						bridge = value;
					},
				},
				ipcRenderer: {
					on: (channel: string) => heard.push(channel),
					invoke: async (channel: string) => {
						invoked.push(channel);
						return true;
					},
					removeListener: () => {},
				},
			}),
		});
		await bridge.notifications.notify({ id: "n1", title: "t", body: "b" });
		bridge.notifications.onOpen(() => {});
		assert.deepEqual(invoked, ["lanna:notify"]);
		assert.ok(heard.includes("lanna:notification-open"));
	});
});

const sentPayloads: Payload[] = [];
const assigned: string[] = [];
let openClick: ((id: string) => void) | null = null;
Object.assign(globalThis, {
	window: {
		lanna: {
			notifications: {
				notify: async (payload: Payload) => {
					sentPayloads.push(payload);
					return true;
				},
				onOpen: (cb: (id: string) => void) => {
					openClick = cb;
					return () => {};
				},
			},
		},
		location: { assign: (href: string) => assigned.push(href) },
	},
});

const dispatcher = await import("../components/notifications/notification-dispatcher.ts");

const nudge: ScheduledNudge = {
	id: "n1",
	time: "20:30",
	source: "scheduled",
	href: "/review",
	title: "Review due",
	message: "12 cards are due.",
};

describe("the renderer in the desktop shell", () => {
	it("reads the notification permission as granted without asking Chromium", async () => {
		assert.equal(dispatcher.getDesktopNotificationPermission(), "granted");
		assert.equal(await dispatcher.requestDesktopNotificationPermission(), "granted");
	});

	it("raises the alert through the bridge and opens its link when the notification is clicked", async () => {
		await dispatcher.dispatchReminderAlert({
			nudge,
			soundPreset: "none",
			systemNotification: true,
			inAppBanner: false,
		});
		assert.deepEqual(sentPayloads, [{ id: "n1", title: "Review due", body: "12 cards are due." }]);
		assert.ok(openClick);
		openClick!("n1");
		assert.deepEqual(assigned, ["/review"]);
	});
});
