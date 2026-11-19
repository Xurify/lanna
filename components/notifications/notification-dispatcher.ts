/**
 * Reminder alerts to the OS, the in-app banner bus and the sound engine.
 *
 * The desktop shell raises the OS notification itself
 * (electron/notifications-ipc.cjs): Chromium refuses the renderer's own
 * Notification API there, reporting Notification.permission as "denied" and
 * erroring in the constructor even though the shell grants the permission
 * (measured with Electron 45 on Windows).
 */

import type { ScheduledNudge, NotificationSoundPreset } from "@/src/core";
import { playReminderSound } from "./reminder-sound.ts";
import { openNudge, recordNotification } from "./notification-store.ts";

export type BannerAlertHandler = (nudge: ScheduledNudge) => void;

const bannerHandlers = new Set<BannerAlertHandler>();

export function subscribeToBannerAlerts(handler: BannerAlertHandler): () => void {
	bannerHandlers.add(handler);
	return () => bannerHandlers.delete(handler);
}

interface DesktopNotifications {
	notify: (payload: { id: string; title: string; body: string }) => Promise<boolean>;
	onOpen?: (cb: (id: string) => void) => () => void;
}

function desktopNotifications(): DesktopNotifications | null {
	if (typeof window === "undefined") return null;
	return window.lanna?.notifications ?? null;
}

function isDesktopNotificationSupported(): boolean {
	return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopNotificationPermission(): NotificationPermission | "unsupported" {
	if (desktopNotifications()) return "granted";
	if (!isDesktopNotificationSupported()) return "unsupported";
	return Notification.permission;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
	if (desktopNotifications()) return "granted";
	if (!isDesktopNotificationSupported()) return "denied";
	try {
		return await Notification.requestPermission();
	} catch {
		return "denied";
	}
}

const pendingDesktopNudges = new Map<string, ScheduledNudge>();
let desktopClicksBound = false;

function bindDesktopClicks(desktop: DesktopNotifications): void {
	if (desktopClicksBound || !desktop.onOpen) return;
	desktopClicksBound = true;
	desktop.onOpen((id) => {
		const nudge = pendingDesktopNudges.get(id);
		if (!nudge) return;
		pendingDesktopNudges.delete(id);
		openNudge(nudge);
	});
}

export interface DispatchAlertOptions {
	nudge: ScheduledNudge;
	soundPreset?: NotificationSoundPreset;
	systemNotification?: boolean;
	inAppBanner?: boolean;
	onActionClick?: () => void;
}

export async function dispatchReminderAlert(options: DispatchAlertOptions): Promise<void> {
	const { nudge, soundPreset = "chime", systemNotification = true, inAppBanner = true, onActionClick } = options;

	recordNotification(nudge);

	try {
		await playReminderSound(soundPreset);
	} catch {
		// A missing or undecodable sound must not stop the alert
	}

	if (inAppBanner) {
		for (const handler of bannerHandlers) {
			try {
				handler(nudge);
			} catch {
				// One banner's failure must not stop the others
			}
		}
	}

	if (!systemNotification) return;

	const desktop = desktopNotifications();
	if (desktop) {
		pendingDesktopNudges.set(nudge.id, nudge);
		bindDesktopClicks(desktop);
		await desktop.notify({ id: nudge.id, title: nudge.title, body: nudge.message });
		return;
	}

	if (isDesktopNotificationSupported() && Notification.permission === "granted") {
		try {
			const notification = new Notification(nudge.title, {
				body: nudge.message,
				icon: "/favicon.ico",
				tag: nudge.id,
				silent: true, // Audio comes from our own sound engine.
			});
			notification.onclick = () => {
				window.focus();
				notification.close();
				if (onActionClick) onActionClick();
				else openNudge(nudge);
			};
		} catch {
			// A refused notification leaves the in-app banner as the alert
		}
	}
}

if (typeof window !== "undefined") {
	(window as unknown as { __lhDispatchReminderAlert?: typeof dispatchReminderAlert }).__lhDispatchReminderAlert =
		dispatchReminderAlert;
}
