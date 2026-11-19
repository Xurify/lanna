/**
 * Reminder alerts → the OS, browser side: with no desktop bridge the permission
 * is read from (and asked of) the Web Notification API, and the alert is raised
 * through it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScheduledNudge } from "../src/core/index.ts";

const instances: FakeNotification[] = [];
const assigned: string[] = [];
let focused = 0;

class FakeNotification {
	static permission: NotificationPermission = "granted";
	static requestPermission = async (): Promise<NotificationPermission> => "granted";
	title: string;
	options: NotificationOptions | undefined;
	onclick: (() => void) | null = null;
	constructor(title: string, options?: NotificationOptions) {
		this.title = title;
		this.options = options;
		instances.push(this);
	}
	close(): void {}
}

Object.assign(globalThis, {
	Notification: FakeNotification,
	window: {
		Notification: FakeNotification,
		focus: () => focused++,
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

describe("the renderer in a browser", () => {
	it("reads and asks for the Web Notification permission", async () => {
		assert.equal(dispatcher.getDesktopNotificationPermission(), "granted");
		assert.equal(await dispatcher.requestDesktopNotificationPermission(), "granted");
	});

	it("raises the alert through the Web Notification API and opens its link when clicked", async () => {
		await dispatcher.dispatchReminderAlert({
			nudge,
			soundPreset: "none",
			systemNotification: true,
			inAppBanner: false,
		});
		assert.equal(instances.length, 1);
		assert.equal(instances[0]!.title, "Review due");
		instances[0]!.onclick!();
		assert.equal(focused, 1);
		assert.deepEqual(assigned, ["/review"]);
	});
});
