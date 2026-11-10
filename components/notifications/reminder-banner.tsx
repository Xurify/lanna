"use client";

import { useEffect, useState } from "react";
import { BellIcon, SparklesIcon, XIcon, ArrowRightIcon } from "lucide-react";
import type { ScheduledNudge } from "@/src/core";
import { CountryFlag } from "@/components/ui/country-flag";
import { switchLanguage } from "@/components/switch-language";
import { subscribeToBannerAlerts } from "./notification-dispatcher.ts";

export function ReminderBanner() {
	const [activeNudge, setActiveNudge] = useState<ScheduledNudge | null>(null);

	useEffect(() => {
		const unsubscribe = subscribeToBannerAlerts((nudge) => {
			setActiveNudge(nudge);
		});
		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!activeNudge) return;
		const timer = setTimeout(() => {
			setActiveNudge(null);
		}, 10000);
		return () => clearTimeout(timer);
	}, [activeNudge]);

	if (!activeNudge) return null;

	const isSmart = activeNudge.source === "smart_trend";
	const isUrgent = activeNudge.urgent;

	const handleAction = async () => {
		const nudge = activeNudge;
		setActiveNudge(null);
		const targetPath = `/#task-${encodeURIComponent(nudge.taskKind ?? "")}`;
		if (nudge.languageId) {
			try {
				await switchLanguage(nudge.languageId, nudge.languageName ?? nudge.languageId, targetPath);
			} catch {
				window.location.assign(targetPath);
			}
		} else {
			window.location.assign(targetPath);
		}
	};

	return (
		<aside
			role="status"
			aria-live="polite"
			className="fixed top-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-raise-hi animate-in slide-in-from-top-3 duration-200"
		>
			<div
				className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
					isUrgent
						? "bg-amber-500/10 text-amber-500"
						: isSmart
							? "bg-violet-500/10 text-violet-500"
							: "bg-primary/10 text-primary"
				}`}
			>
				{isSmart ? <SparklesIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5 min-w-0">
						{activeNudge.languageId && (
							<CountryFlag lang={activeNudge.languageId} className="h-3.5 w-3.5 shrink-0 rounded-sm" />
						)}
						<h3 className="text-sm font-medium text-foreground truncate">{activeNudge.title}</h3>
					</div>
					<button
						type="button"
						onClick={() => setActiveNudge(null)}
						className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
						aria-label="Dismiss notification"
					>
						<XIcon className="h-3.5 w-3.5" />
					</button>
				</div>
				<p className="mt-1 text-xs text-muted-foreground leading-relaxed">{activeNudge.message}</p>
				{activeNudge.taskTitle && (
					<div className="mt-2.5">
						<button
							type="button"
							onClick={() => void handleAction()}
							className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
						>
							<span>Start {activeNudge.taskTitle}</span>
							<ArrowRightIcon className="h-3 w-3" />
						</button>
					</div>
				)}
			</div>
		</aside>
	);
}
