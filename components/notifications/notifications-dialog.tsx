"use client";

import { useEffect, useState } from "react";
import { nudgeTarget, type LoggedNotification, type ScheduledNudge } from "@/src/core";
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { QIcon } from "@/components/quiet/icon";
import {
	markNotificationsSeen,
	openNudge,
	readNotificationLog,
	readUpcomingReminders,
	subscribeToNotifications,
} from "./notification-store.ts";
import { nudgeIcon } from "./nudge-icon.ts";

function firedLabel(firedAt: number, now: Date): string {
	const fired = new Date(firedAt);
	const clock = `${String(fired.getHours()).padStart(2, "0")}:${String(fired.getMinutes()).padStart(2, "0")}`;
	if (fired.toDateString() === now.toDateString()) return clock;
	return `${fired.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${clock}`;
}

function useOpenLog(): LoggedNotification[] {
	const [log, setLog] = useState<LoggedNotification[]>(readNotificationLog);
	useEffect(() => subscribeToNotifications(() => setLog(readNotificationLog())), []);
	return log;
}

export function NotificationsDialog({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
	const log = useOpenLog();
	const upcoming = readUpcomingReminders(new Date());

	const newestFiredAt = log[0]?.firedAt;
	useEffect(() => {
		markNotificationsSeen();
	}, [newestFiredAt]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopPropagation();
			onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<Dialog open onClose={onClose}>
			<DialogPortal>
				<DialogOverlay data-testid="notifications-backdrop">
					<NotificationsBody log={log} upcoming={upcoming} onClose={onClose} onOpenSettings={onOpenSettings} />
				</DialogOverlay>
			</DialogPortal>
		</Dialog>
	);
}

export function NotificationsBody({
	log,
	upcoming,
	onClose,
	onOpenSettings,
}: {
	log: readonly LoggedNotification[];
	upcoming: readonly ScheduledNudge[];
	onClose: () => void;
	onOpenSettings: () => void;
}) {
	const now = new Date();
	return (
		<DialogContent
			showClose
			aria-labelledby="notifications-title"
			data-testid="notifications-dialog"
			className="max-h-[min(40rem,calc(100dvh-2rem))] max-w-md"
		>
			<h2 id="notifications-title" className="text-base font-semibold text-foreground">
				Notifications
			</h2>

			<div className="-mx-2 mt-4 flex min-h-0 flex-col gap-5 overflow-y-auto px-2">
				{upcoming.length > 0 && (
					<section data-testid="notifications-upcoming">
						<h3 className="text-xs font-semibold text-ink-3">Still to come today</h3>
						<ul className="mt-2 flex flex-col divide-y divide-border">
							{upcoming.map((nudge) => (
								<li key={nudge.id} className="flex items-center gap-3 py-2 text-sm">
									<span className="cap-center w-12 shrink-0 tabular-nums text-ink-3">{nudge.time}</span>
									<QIcon name={nudgeIcon(nudge)} className="text-ink-3" />
									<span className="cap-center min-w-0 text-foreground">{nudge.title}</span>
								</li>
							))}
						</ul>
					</section>
				)}

				<section data-testid="notifications-log">
					{upcoming.length > 0 && <h3 className="text-xs font-semibold text-ink-3">Earlier</h3>}
					{log.length === 0 ? (
						<p className="mt-2 text-sm leading-relaxed text-ink-3" data-testid="notifications-empty">
							No reminders have fired on this device yet. Each one is kept here after it shows.
						</p>
					) : (
						<ul className="mt-2 flex flex-col divide-y divide-border">
							{log.map((entry) => (
								<LogRow key={`${entry.firedAt}-${entry.nudge.id}`} entry={entry} now={now} onClose={onClose} />
							))}
						</ul>
					)}
				</section>
			</div>

			<div className="mt-5 flex justify-end">
				<Button
					type="button"
					variant="outline"
					size="sm"
					data-testid="notifications-settings"
					onClick={() => {
						onClose();
						onOpenSettings();
					}}
				>
					Reminder settings
				</Button>
			</div>
		</DialogContent>
	);
}

function LogRow({ entry, now, onClose }: { entry: LoggedNotification; now: Date; onClose: () => void }) {
	const { nudge } = entry;
	const body = (
		<>
			<span className="flex items-baseline justify-between gap-3">
				<span className="flex min-w-0 items-center gap-1.5">
					<QIcon name={nudgeIcon(nudge)} className="shrink-0 text-ink-3" />
					{nudge.languageId && <CountryFlag lang={nudge.languageId} className="h-3 w-[18px] shrink-0 rounded-[2px]" />}
					<span className="cap-center min-w-0 text-sm font-medium text-foreground">{nudge.title}</span>
				</span>
				<span className="shrink-0 text-xs tabular-nums text-ink-3">{firedLabel(entry.firedAt, now)}</span>
			</span>
			<span className="mt-1 block text-[13px] leading-relaxed text-ink-3">{nudge.message}</span>
		</>
	);
	if (!nudgeTarget(nudge)) return <li className="py-2.5">{body}</li>;
	return (
		<li>
			<button
				type="button"
				onClick={() => {
					onClose();
					openNudge(nudge);
				}}
				className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-well focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal"
			>
				{body}
			</button>
		</li>
	);
}
