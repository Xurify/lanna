"use client";

import { useEffect, useState, useRef } from "react";
import {
	DEFAULT_NOTIFICATION_SETTINGS,
	NOTIFICATION_SOUND_PRESETS,
	isValidTimeString,
	normalizeTimeString,
	type NotificationSettings,
	type NotificationSoundPreset,
	type StudyTrendInsights,
} from "@/src/core";
import { SettingsSection, SettingsGroup, SettingsRow, Toggle } from "./controls.tsx";
import {
	playReminderSound,
	saveCustomSound,
	getCustomSoundInfo,
	deleteCustomSound,
} from "../notifications/reminder-sound.ts";
import {
	requestDesktopNotificationPermission,
	getDesktopNotificationPermission,
	dispatchReminderAlert,
} from "../notifications/notification-dispatcher.ts";
import {
	SparklesIcon,
	Volume2Icon,
	PlusIcon,
	Trash2Icon,
	UploadIcon,
	SendIcon,
	CheckCircle2Icon,
	AlertCircleIcon,
} from "lucide-react";
import { ChoiceMenu } from "@/components/ui/choice-menu";

const SOUND_PRESET_LABELS: Record<NotificationSoundPreset, string> = {
	chime: "Melodic Chime",
	bell: "Desk Bell",
	harp: "Harp Arpeggio",
	gentle: "Gentle Pulse",
	subtle: "Subtle Tick",
	custom: "Custom Audio File",
	none: "Silent (Visual Only)",
};

export function NotificationsSection({
	settings: userSettings,
	onSave,
}: {
	settings?: NotificationSettings;
	onSave: (next: NotificationSettings) => void;
}) {
	const current: NotificationSettings = {
		...DEFAULT_NOTIFICATION_SETTINGS,
		...(userSettings ?? {}),
	};

	const [newTime, setNewTime] = useState("12:00");
	const [timeError, setTimeError] = useState<string | null>(null);
	const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
	const [customSound, setCustomSound] = useState<{ name: string | null; hasData: boolean }>({
		name: null,
		hasData: false,
	});
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [insights, setInsights] = useState<StudyTrendInsights | null>(null);
	const [testSent, setTestSent] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Load desktop permission & custom sound state
	useEffect(() => {
		setPermission(getDesktopNotificationPermission());
		setCustomSound(getCustomSoundInfo());

		// Fetch trend insights
		const tz = new Date().getTimezoneOffset();
		fetch(`/api/reminders/schedule?tz=${tz}`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.trends) setInsights(data.trends);
			})
			.catch(() => {});
	}, []);

	const update = (patch: Partial<NotificationSettings>) => {
		const next: NotificationSettings = { ...current, ...patch };
		onSave(next);
	};

	// Browsers show the permission prompt only while the answer is "default".
	// Once blocked, requestPermission() resolves "denied" without a prompt,
	// so a blocked site is re-read from the browser instead.
	const handleRequestPermission = async () => {
		const result = await requestDesktopNotificationPermission();
		setPermission(result);
		if (result === "granted") {
			update({ systemNotification: true });
		}
	};

	const handleRecheckPermission = () => {
		setPermission(getDesktopNotificationPermission());
	};

	const handleAddTime = () => {
		setTimeError(null);
		if (!isValidTimeString(newTime)) {
			setTimeError("Enter a valid time (HH:MM)");
			return;
		}
		const norm = normalizeTimeString(newTime);
		if (current.times.includes(norm)) {
			setTimeError("This time is already scheduled");
			return;
		}
		const nextTimes = [...current.times, norm].sort();
		update({ times: nextTimes });
	};

	const handleRemoveTime = (timeToRemove: string) => {
		update({ times: current.times.filter((t) => t !== timeToRemove) });
	};

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		setUploadError(null);
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const saved = await saveCustomSound(file);
			setCustomSound({ name: saved.name, hasData: true });
			update({ soundPreset: "custom", customSoundName: saved.name });
			await playReminderSound("custom");
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : "Failed to load audio file");
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleClearCustomSound = () => {
		deleteCustomSound();
		setCustomSound({ name: null, hasData: false });
		update({ soundPreset: "chime", customSoundName: "" });
	};

	const handleTestAlert = async () => {
		setTestSent(true);
		await dispatchReminderAlert({
			nudge: {
				id: "test-alert",
				time: normalizeTimeString(new Date().toTimeString().slice(0, 5)),
				source: "scheduled",
				taskKind: "blitz",
				taskTitle: "Spaced Blitz Review",
				title: "Daily Goal Alert (Test)",
				message: "15 minutes needed today. A quick session will keep your streak alive!",
			},
			soundPreset: current.soundPreset,
			systemNotification: current.systemNotification,
			inAppBanner: current.inAppBanner,
		});
		setTimeout(() => setTestSent(false), 3000);
	};

	return (
		<SettingsSection
			title="Notifications"
			hint="Nudge your daily practice, analyze focus patterns, and stay on track with your goals."
			testid="notifications-section"
		>
			<SettingsGroup label="General">
				<SettingsRow
					label="Daily goal reminders"
					stack={false}
					hint="Alert you throughout the day so you never fall behind on your learning goal."
				>
					<Toggle
						label="Daily goal reminders"
						checked={current.enabled}
						onChange={(enabled) => update({ enabled })}
						testid="toggle-reminders-enabled"
					/>
				</SettingsRow>
			</SettingsGroup>

			<SettingsGroup label="Where reminders appear">
				<SettingsRow
					label="Desktop notifications"
					stack={false}
					hint={
						permission === "granted" ? (
							<span className="inline-flex items-center gap-1 text-teal">
								<CheckCircle2Icon className="h-3.5 w-3.5" />
								<span className="cap-center">System notifications enabled</span>
							</span>
						) : permission === "denied" ? (
							<span className="inline-flex items-center gap-1 text-destructive">
								<AlertCircleIcon className="h-3.5 w-3.5" />
								<span>Blocked in browser site settings. Allow notifications for this site, then check again.</span>
							</span>
						) : (
							"Requires browser notification permission"
						)
					}
					dimmed={!current.enabled}
				>
					<div className="flex items-center gap-3">
						{permission === "default" && (
							<button
								type="button"
								onClick={handleRequestPermission}
								className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-well transition-colors"
							>
								Grant permission
							</button>
						)}
						{permission === "denied" && (
							<button
								type="button"
								onClick={handleRecheckPermission}
								className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-well transition-colors"
							>
								Check again
							</button>
						)}
						<Toggle
							label="Desktop notifications"
							checked={current.systemNotification && permission === "granted"}
							disabled={!current.enabled || permission !== "granted"}
							onChange={(systemNotification) => update({ systemNotification })}
							testid="toggle-system-notification"
						/>
					</div>
				</SettingsRow>

				<SettingsRow
					label="In-app banner alerts"
					stack={false}
					hint="Show floating notifications inside the app with quick activity shortcuts."
					dimmed={!current.enabled}
				>
					<Toggle
						label="In-app banner alerts"
						checked={current.inAppBanner}
						disabled={!current.enabled}
						onChange={(inAppBanner) => update({ inAppBanner })}
						testid="toggle-in-app-banner"
					/>
				</SettingsRow>
			</SettingsGroup>

			<SettingsGroup label="Smart scheduling">
				<SettingsRow
					label="Smart auto-nudges"
					stack={false}
					hint="Analyze your past session history to automatically alert you at your habitual study hours."
					dimmed={!current.enabled}
				>
					<Toggle
						label="Smart auto-nudges"
						checked={current.smartAutoNudge}
						disabled={!current.enabled}
						onChange={(smartAutoNudge) => update({ smartAutoNudge })}
						testid="toggle-smart-nudges"
					/>
				</SettingsRow>

				<SettingsRow
					label="Auto-schedule daily tasks"
					stack={false}
					hint="Intelligently pairs pending plan tasks to your focus windows (morning words, afternoon lessons, evening review)."
					dimmed={!current.enabled}
				>
					<Toggle
						label="Auto-schedule daily tasks"
						checked={current.autoScheduleTasks}
						disabled={!current.enabled}
						onChange={(autoScheduleTasks) => update({ autoScheduleTasks })}
						testid="toggle-auto-schedule-tasks"
					/>
				</SettingsRow>

				{insights && (
					<div className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground flex items-start gap-2.5">
						<SparklesIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
						<div>
							<strong className="font-semibold text-foreground">Habit Trends: </strong>
							{insights.summary}
							{insights.suggestedTimes.length > 0 && (
								<div className="mt-1 flex items-center gap-1.5 flex-wrap">
									<span>Optimal focus windows:</span>
									{insights.suggestedTimes.map((st) => (
										<span
											key={st}
											className="inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary"
										>
											{st}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				)}

				<SettingsRow
					label="AI personalized coaching"
					stack={false}
					hint="Generate context-rich motivational nudges tailored to your current streak and pending practice items."
					dimmed={!current.enabled}
				>
					<Toggle
						label="AI personalized coaching"
						checked={current.aiAssisted}
						disabled={!current.enabled}
						onChange={(aiAssisted) => update({ aiAssisted })}
						testid="toggle-ai-assisted"
					/>
				</SettingsRow>
			</SettingsGroup>

			<SettingsGroup
				label="Reminder times"
				hint="Specific times of day to alert you if your daily practice goal is incomplete."
			>
				<div className="flex flex-col gap-3 rounded-lg bg-well p-4">
					<div className="flex flex-wrap items-center gap-2">
						{current.times.map((t) => (
							<span
								key={t}
								className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-mono font-medium text-foreground shadow-sm"
							>
								<span>{t}</span>
								<button
									type="button"
									onClick={() => handleRemoveTime(t)}
									disabled={!current.enabled}
									className="rounded hover:text-destructive transition-colors disabled:opacity-50"
									aria-label={`Remove time ${t}`}
								>
									<Trash2Icon className="h-3 w-3" />
								</button>
							</span>
						))}
						{current.times.length === 0 && (
							<span className="text-xs text-muted-foreground italic">
								No custom times scheduled (smart auto-nudges will still schedule peaks)
							</span>
						)}
					</div>

					<div className="flex items-center gap-2 pt-2 border-t border-border/50">
						<input
							type="time"
							value={newTime}
							onChange={(e) => setNewTime(e.target.value)}
							disabled={!current.enabled}
							className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<button
							type="button"
							onClick={handleAddTime}
							disabled={!current.enabled}
							className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-well transition-colors disabled:opacity-50"
						>
							<PlusIcon className="h-3 w-3" />
							<span>Add Time</span>
						</button>
						{timeError && <span className="text-xs text-destructive">{timeError}</span>}
					</div>
				</div>
			</SettingsGroup>

			<SettingsGroup label="Sound">
				<SettingsRow
					label="Alert tone"
					hint="Select a built-in synthesized tone or upload your own audio."
					dimmed={!current.enabled}
				>
					<div className="flex items-center gap-2">
						<ChoiceMenu
							ariaLabel="Alert tone"
							value={current.soundPreset}
							disabled={!current.enabled}
							options={NOTIFICATION_SOUND_PRESETS.map((p) => ({ value: p, label: SOUND_PRESET_LABELS[p] }))}
							onChange={(next) => update({ soundPreset: next as NotificationSoundPreset })}
							compact
							className="w-56"
						/>

						<button
							type="button"
							onClick={() => playReminderSound(current.soundPreset)}
							disabled={!current.enabled || current.soundPreset === "none"}
							title="Test tone"
							className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground transition-colors hover:border-border disabled:opacity-50"
						>
							<Volume2Icon className="h-4 w-4" />
						</button>
					</div>
				</SettingsRow>

				{current.soundPreset === "custom" && (
					<div className="flex flex-col gap-2 rounded-lg bg-well p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0 flex-1">
								<span className="block font-ui text-xs font-medium text-foreground">Custom Sound File</span>
								<span className="block truncate text-xs text-muted-foreground">
									{customSound.hasData
										? `Current: ${customSound.name || "Custom sound active"}`
										: "No custom sound file uploaded yet"}
								</span>
							</div>

							<div className="flex items-center gap-2">
								<input
									ref={fileInputRef}
									type="file"
									accept="audio/*,.mp3,.wav,.ogg,.m4a"
									onChange={handleFileUpload}
									className="hidden"
								/>
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-well transition-colors"
								>
									<UploadIcon className="h-3 w-3" />
									<span>Choose File...</span>
								</button>
								{customSound.hasData && (
									<button
										type="button"
										onClick={handleClearCustomSound}
										className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
									>
										Clear
									</button>
								)}
							</div>
						</div>
						{uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
					</div>
				)}
			</SettingsGroup>

			<div className="pt-2">
				<button
					type="button"
					onClick={handleTestAlert}
					disabled={!current.enabled}
					className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-well shadow-sm transition-colors disabled:opacity-50"
				>
					{testSent ? <CheckCircle2Icon className="h-4 w-4 text-teal" /> : <SendIcon className="h-4 w-4" />}
					<span>{testSent ? "Test Alert Sent!" : "Send Test Reminder Alert"}</span>
				</button>
			</div>
		</SettingsSection>
	);
}
