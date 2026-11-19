"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { shouldTriggerNudge, type ScheduledNudge, type NotificationSettings } from "@/src/core";
import { dispatchReminderAlert } from "./notification-dispatcher.ts";
import { publishReminderSchedule } from "./notification-store.ts";
import { ReminderBanner } from "./reminder-banner.tsx";

interface ScheduleData {
	settings: NotificationSettings;
	schedule: ScheduledNudge[];
	todayMinutes: number;
	dailyGoal: number;
}

function getTodayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

function getFiredSlotKeys(): string[] {
	if (typeof window === "undefined") return [];
	try {
		const key = `lanna:fired-nudges-${getTodayKey()}`;
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}

function recordFiredSlot(slotKey: string): void {
	if (typeof window === "undefined") return;
	try {
		const storageKey = `lanna:fired-nudges-${getTodayKey()}`;
		const current = getFiredSlotKeys();
		if (!current.includes(slotKey)) {
			current.push(slotKey);
			localStorage.setItem(storageKey, JSON.stringify(current));
		}
	} catch {
		// Ignore storage errors
	}
}

export function ReminderScheduler() {
	const [data, setData] = useState<ScheduleData | null>(null);
	const dataRef = useRef<ScheduleData | null>(null);
	dataRef.current = data;

	const refreshSchedule = useCallback(async () => {
		try {
			const tz = new Date().getTimezoneOffset();
			const res = await fetch(`/api/reminders/schedule?tz=${tz}`, {
				cache: "no-store",
			});
			if (res.ok) {
				const json = (await res.json()) as ScheduleData;
				publishReminderSchedule(json.schedule);
				setData(json);
			}
		} catch {
			// Network/offline resilience
		}
	}, []);

	// Initial fetch & visibility-change refresh
	useEffect(() => {
		refreshSchedule();

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				refreshSchedule();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		// Refresh schedule every 15 minutes
		const interval = setInterval(refreshSchedule, 15 * 60 * 1000);

		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
			clearInterval(interval);
		};
	}, [refreshSchedule]);

	// Evaluation tick every 30 seconds
	useEffect(() => {
		const timer = setInterval(() => {
			const current = dataRef.current;
			if (!current || !current.settings.enabled) return;

			const firedKeys = getFiredSlotKeys();
			const nudge = shouldTriggerNudge({
				nudges: current.schedule,
				firedKeys,
				now: new Date(),
				dailyGoal: current.dailyGoal,
				todayMinutes: current.todayMinutes,
			});

			if (nudge) {
				const slotKey = `${nudge.id}-${nudge.time}`;
				recordFiredSlot(slotKey);
				recordFiredSlot(nudge.time);

				dispatchReminderAlert({
					nudge,
					soundPreset: current.settings.soundPreset,
					systemNotification: current.settings.systemNotification,
					inAppBanner: current.settings.inAppBanner,
				});
			}
		}, 30000);

		return () => clearInterval(timer);
	}, []);

	return <ReminderBanner />;
}
