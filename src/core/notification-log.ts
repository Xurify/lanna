import type { ScheduledNudge } from "./reminders.ts";

export const NOTIFICATION_LOG_LIMIT = 50;

export interface LoggedNotification {
	nudge: ScheduledNudge;
	firedAt: number;
}

export function appendNotification(
	log: readonly LoggedNotification[],
	nudge: ScheduledNudge,
	firedAt: number,
): LoggedNotification[] {
	return [{ nudge, firedAt }, ...log].slice(0, NOTIFICATION_LOG_LIMIT);
}

export function unreadNotifications(log: readonly LoggedNotification[], seenAt: number): number {
	return log.filter((entry) => entry.firedAt > seenAt).length;
}

export function upcomingNudges(schedule: readonly ScheduledNudge[], now: Date): ScheduledNudge[] {
	const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	return schedule.filter((nudge) => nudge.time > clock);
}

export function parseNotificationLog(raw: string | null): LoggedNotification[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is LoggedNotification =>
				typeof entry === "object" &&
				entry !== null &&
				typeof (entry as LoggedNotification).firedAt === "number" &&
				typeof (entry as LoggedNotification).nudge?.title === "string" &&
				typeof (entry as LoggedNotification).nudge?.message === "string",
		);
	} catch {
		return [];
	}
}

export function nudgeTarget(nudge: Pick<ScheduledNudge, "href" | "taskKind">): string | null {
	if (nudge.href) return nudge.href;
	if (!nudge.taskKind) return null;
	return nudge.taskKind === "listen" ? "/listen" : `/#task-${encodeURIComponent(nudge.taskKind)}`;
}
