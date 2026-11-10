/**
 * Notification Dispatcher (Browser & Electron OS notifications).
 *
 * Coordinates:
 * 1. Web Notification API & Electron desktop notifications.
 * 2. In-app banner event bus.
 * 3. Audio chime / custom sound triggering.
 */

import type { ScheduledNudge, NotificationSoundPreset } from "@/src/core";
import { playReminderSound } from "./reminder-sound.ts";

export type BannerAlertHandler = (nudge: ScheduledNudge) => void;

const bannerHandlers = new Set<BannerAlertHandler>();

export function subscribeToBannerAlerts(handler: BannerAlertHandler): () => void {
	bannerHandlers.add(handler);
	return () => bannerHandlers.delete(handler);
}

export function isDesktopNotificationSupported(): boolean {
	return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopNotificationPermission(): NotificationPermission | "unsupported" {
	if (!isDesktopNotificationSupported()) return "unsupported";
	return Notification.permission;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
	if (!isDesktopNotificationSupported()) return "denied";
	try {
		return await Notification.requestPermission();
	} catch {
		return "denied";
	}
}

export interface DispatchAlertOptions {
	nudge: ScheduledNudge;
	soundPreset?: NotificationSoundPreset;
	systemNotification?: boolean;
	inAppBanner?: boolean;
	onActionClick?: () => void;
}

export async function dispatchReminderAlert(options: DispatchAlertOptions): Promise<void> {
	const {
		nudge,
		soundPreset = "chime",
		systemNotification = true,
		inAppBanner = true,
		onActionClick,
	} = options;

	// 1. Play audio chime / custom sound
	try {
		await playReminderSound(soundPreset);
	} catch {
		// Audio failure should not stop visual notification
	}

	// 2. Dispatch In-App Banner if enabled
	if (inAppBanner) {
		for (const handler of bannerHandlers) {
			try {
				handler(nudge);
			} catch {
				// Prevent handler failure from breaking others
			}
		}
	}

	// 3. Dispatch System / Desktop Notification if enabled and permitted
	if (systemNotification && isDesktopNotificationSupported() && Notification.permission === "granted") {
		try {
			const notification = new Notification(nudge.title, {
				body: nudge.message,
				icon: "/favicon.ico",
				tag: nudge.id,
				silent: true, // Audio handled through our own audio engine
			});

			notification.onclick = () => {
				window.focus();
				notification.close();
				if (onActionClick) {
					onActionClick();
				} else if (nudge.taskKind === "experiment") {
					window.location.href = "/experiments/input-first/check";
				} else if (nudge.taskKind === "listen") {
					window.location.href = "/listen";
				} else if (nudge.taskKind) {
					window.location.href = `/#task-${encodeURIComponent(nudge.taskKind)}`;
				}
			};
		} catch {
			// Ignore desktop notification permission/creation errors
		}
	}
}

if (typeof window !== "undefined") {
	(window as unknown as { __lhDispatchReminderAlert?: typeof dispatchReminderAlert }).__lhDispatchReminderAlert = dispatchReminderAlert;
}
