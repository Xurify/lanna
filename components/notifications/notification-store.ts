"use client";

import { useEffect, useState } from "react";
import {
	appendNotification,
	nudgeTarget,
	parseNotificationLog,
	unreadNotifications,
	upcomingNudges,
	type LoggedNotification,
	type ScheduledNudge,
} from "@/src/core";
import { switchLanguage } from "@/components/switch-language";

const LOG_KEY = "lanna:notification-log";
const SEEN_KEY = "lanna:notifications-seen-at";

const listeners = new Set<() => void>();

function readLog(): LoggedNotification[] {
	try {
		return parseNotificationLog(localStorage.getItem(LOG_KEY));
	} catch {
		return [];
	}
}

function readSeenAt(): number {
	try {
		return Number(localStorage.getItem(SEEN_KEY)) || 0;
	} catch {
		return 0;
	}
}

function announce(): void {
	for (const listener of listeners) listener();
}

export function recordNotification(nudge: ScheduledNudge): void {
	try {
		localStorage.setItem(LOG_KEY, JSON.stringify(appendNotification(readLog(), nudge, Date.now())));
	} catch {
		return;
	}
	announce();
}

export function markNotificationsSeen(): void {
	try {
		localStorage.setItem(SEEN_KEY, String(Date.now()));
	} catch {
		return;
	}
	announce();
}

let reminderSchedule: readonly ScheduledNudge[] = [];

export function publishReminderSchedule(schedule: readonly ScheduledNudge[]): void {
	reminderSchedule = schedule;
}

export function readUpcomingReminders(now: Date): ScheduledNudge[] {
	return upcomingNudges(reminderSchedule, now);
}

export function readNotificationLog(): LoggedNotification[] {
	return readLog();
}

export function subscribeToNotifications(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useNotificationLog(): { log: LoggedNotification[]; unread: number } {
	const [state, setState] = useState<{ log: LoggedNotification[]; unread: number }>({ log: [], unread: 0 });

	useEffect(() => {
		const sync = () => {
			const log = readLog();
			setState({ log, unread: unreadNotifications(log, readSeenAt()) });
		};
		sync();
		listeners.add(sync);
		window.addEventListener("storage", sync);
		return () => {
			listeners.delete(sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	return state;
}

export function openNudge(nudge: ScheduledNudge): void {
	const target = nudgeTarget(nudge);
	if (!target) return;
	if (nudge.languageId) {
		switchLanguage(nudge.languageId, nudge.languageName ?? nudge.languageId, target).catch(() =>
			window.location.assign(target),
		);
		return;
	}
	window.location.assign(target);
}
