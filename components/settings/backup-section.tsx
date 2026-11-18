"use client";
/**
 * Settings → Backup: the data folder against the owner's private Cloudflare R2
 * bucket. The server does the looking, the copying and the signing in
 * (server/backup.ts); this asks it, shows the answer, and starts one of them
 * when asked.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CapLabel } from "@/components/ui/cap-label";
import {
	BACKUP_AREAS,
	backupOutcome,
	formatBytes,
	timeAgo,
	type BackupArea,
	type BackupCounts,
	type BackupJob,
	type BackupState,
} from "@/src/core";
import { ProviderIcon } from "./provider-icons.tsx";
import { SettingsGroup, SettingsRow } from "./controls.tsx";

type Action = "check" | "upload" | "restore" | "connect" | "disconnect";

const LOAD_FAILED = "Couldn’t read the backup status. Refresh to try again.";
const CHECK_FAILED = "Couldn’t check the bucket. Try again in a moment.";
const SIGNING_IN = "Waiting for your browser…";

function fileCount(files: number): string {
	return files === 1 ? "1 file" : `${files.toLocaleString()} files`;
}

function sizeOf(counts: BackupCounts): string {
	return `${fileCount(counts.files)} · ${formatBytes(counts.bytes)}`;
}

function jobLine(job: BackupJob): string {
	const verb = job.action === "upload" ? "Uploading" : "Bringing back";
	const done = job.action === "upload" ? "Uploaded" : "Brought back";
	if (!job.finishedAt) return job.total === 0 ? `${verb}…` : `${verb} ${job.done} of ${job.total} files…`;
	if (job.failed > 0) return `${done} ${job.done} of ${job.total} files; ${job.failed} failed.`;
	return job.error ?? `${done} ${job.done} of ${job.total} files.`;
}

export function BackupSection() {
	const [state, setState] = useState<BackupState | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [busy, setBusy] = useState<Action | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const asked = useRef(false);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/backup", { cache: "no-store" });
			if (!res.ok) throw new Error(String(res.status));
			setState((await res.json()) as BackupState);
			setLoadFailed(false);
		} catch {
			setLoadFailed(true);
		}
	}, []);

	const act = useCallback(async (action: Action) => {
		setBusy(action);
		setNotice(null);
		try {
			const res = await fetch("/api/backup", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action }),
			});
			const body = (await res.json().catch(() => null)) as (BackupState & { message?: string }) | null;
			if (!res.ok || !body) setNotice(body?.message ?? CHECK_FAILED);
			else setState(body);
		} catch {
			setNotice(CHECK_FAILED);
		} finally {
			setBusy(null);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (asked.current || !state || state.last) return;
		asked.current = true;
		void act("check");
	}, [state, act]);

	const job = state?.job ?? null;
	const running = Boolean(job && !job.finishedAt);
	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => void load(), 1500);
		return () => clearInterval(timer);
	}, [running, load]);

	const auth = state?.auth ?? null;
	const check = state?.last ?? null;
	const outcome = backupOutcome(check);
	const unreachable = outcome === "unreachable";
	const working = busy !== null || running;
	const account = !state
		? "…"
		: !auth
			? "Not signed in"
			: auth.via === "env"
				? "Set by CLOUDFLARE_API_TOKEN"
				: (auth.account ?? "…");

	const status = (() => {
		if (job && (running || job.failed > 0 || job.error)) return jobLine(job);
		if (unreachable) return check?.error ?? CHECK_FAILED;
		if (!check) return "Checking the bucket…";
		if (outcome === "even") return "Everything on this computer is in the bucket.";
		return [
			check.toUpload.files > 0
				? `${fileCount(check.toUpload.files)} to upload (${formatBytes(check.toUpload.bytes)})`
				: null,
			check.toRestore.files > 0
				? `${fileCount(check.toRestore.files)} to bring back (${formatBytes(check.toRestore.bytes)})`
				: null,
		]
			.filter((line) => line !== null)
			.join(", ")
			.concat(".");
	})();

	const areaValue = (area: BackupArea | null): string => (area ? sizeOf(area.here) : "…");
	const areaElsewhere = (area: BackupArea | null): BackupCounts | null => {
		if (!area || unreachable) return null;
		return area.cloud.files === area.here.files && area.cloud.bytes === area.here.bytes ? null : area.cloud;
	};

	return (
		<>
			<SettingsGroup label="Where the copy goes" testid="backup-where">
				<SettingsRow label="Cloudflare R2" hint="Your own private bucket." testid="backup-row-bucket">
					<span className="flex items-center gap-2">
						<ProviderIcon provider="cloudflare" />
						<CapLabel className="font-mono text-xs text-foreground">{state?.bucket ?? "…"}</CapLabel>
					</span>
				</SettingsRow>
				<SettingsRow
					label="Cloudflare account"
					hint={
						auth?.via === "env" ? "From .env.local; Lanna cannot sign it out." : "Lanna signs in the way wrangler does."
					}
					testid="backup-row-account"
				>
					<span className="flex items-center gap-2.5">
						<span className="font-ui text-xs text-foreground" data-testid="backup-account">
							{busy === "connect" ? SIGNING_IN : account}
						</span>
						{state !== null && auth === null && (
							<Button
								type="button"
								size="xs"
								variant="outline"
								className="cursor-pointer disabled:cursor-not-allowed"
								disabled={working}
								aria-busy={busy === "connect"}
								onClick={() => void act("connect")}
								data-testid="backup-connect"
							>
								Sign in
							</Button>
						)}
						{auth?.via === "wrangler" && (
							<Button
								type="button"
								size="xs"
								variant="outline"
								className="cursor-pointer disabled:cursor-not-allowed"
								disabled={working}
								aria-busy={busy === "disconnect"}
								onClick={() => void act("disconnect")}
								data-testid="backup-disconnect"
							>
								Sign out
							</Button>
						)}
					</span>
				</SettingsRow>
			</SettingsGroup>
			<SettingsGroup
				label="What is in it"
				hint={check ? `${sizeOf(check.here)} on this computer` : "…"}
				testid="backup-areas"
			>
				<div className="flex flex-col gap-3 rounded-lg bg-well px-4 py-3.5" data-testid="backup-area-list">
					{BACKUP_AREAS.map(({ id, label }) => {
						const area = (check?.areas ?? []).find((a) => a.id === id) ?? null;
						const share = area && check && check.here.bytes > 0 ? area.here.bytes / check.here.bytes : 0;
						const percent = Math.round(share * 100);
						const elsewhere = areaElsewhere(area);
						return (
							<div
								key={id}
								className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[8.5rem_1fr_auto]"
							>
								<span className="font-ui text-[13px] text-ink-2">{label}</span>
								<span
									className="text-right font-ui text-xs tabular-nums text-foreground"
									data-testid={`backup-area-${id}`}
								>
									{areaValue(area)}
								</span>
								<span
									className="col-span-2 h-1.5 overflow-hidden rounded-full bg-line-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
									role="meter"
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={percent}
									aria-label={`${label}: ${percent}% of the copy`}
								>
									<span
										className="block h-full rounded-full bg-[var(--q-bar)]"
										style={{ width: `${share * 100}%` }}
										data-testid={`backup-area-bar-${id}`}
									/>
								</span>
								{elsewhere && (
									<span
										className="col-span-2 text-[11px] text-muted-foreground sm:col-span-3"
										data-testid={`backup-area-cloud-${id}`}
									>
										in the bucket: {sizeOf(elsewhere)}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</SettingsGroup>
			<SettingsGroup label="Status" testid="backup-status">
				<SettingsRow label="This computer" testid="backup-row-here">
					<span className="font-ui text-xs tabular-nums text-foreground" data-testid="backup-here">
						{check ? sizeOf(check.here) : "…"}
					</span>
				</SettingsRow>
				<SettingsRow label="In the bucket" testid="backup-row-cloud">
					<span className="font-ui text-xs tabular-nums text-foreground" data-testid="backup-cloud">
						{check && !unreachable ? sizeOf(check.cloud) : "…"}
					</span>
				</SettingsRow>
				<SettingsRow
					label="Last checked"
					hint="Lanna reads the bucket only here and in the commands below."
					testid="backup-row-checked"
				>
					<span className="font-ui text-xs text-foreground" data-testid="backup-checked">
						{check ? timeAgo(check.at) : "Not yet"}
					</span>
				</SettingsRow>
				<div className="flex flex-col gap-3 rounded-lg bg-well px-4 py-3" data-testid="backup-actions">
					<p
						role={unreachable && !job ? "alert" : "status"}
						className={
							unreachable && !job
								? "text-xs leading-relaxed text-destructive"
								: "text-xs leading-relaxed text-foreground"
						}
						data-testid="backup-inline-status"
					>
						{loadFailed ? LOAD_FAILED : status}
					</p>
					{notice && (
						<p role="alert" className="text-xs text-destructive" data-testid="backup-notice">
							{notice}
						</p>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							size="xs"
							variant="outline"
							className="cursor-pointer disabled:cursor-not-allowed"
							disabled={working}
							aria-busy={busy === "check"}
							onClick={() => void act("check")}
							data-testid="backup-check"
						>
							Check now
						</Button>
						{check !== null && check.toUpload.files > 0 && (
							<Button
								type="button"
								size="xs"
								className="cursor-pointer disabled:cursor-not-allowed"
								disabled={working}
								onClick={() => void act("upload")}
								data-testid="backup-upload"
							>
								Upload {fileCount(check.toUpload.files)}
							</Button>
						)}
						{check !== null && check.toRestore.files > 0 && (
							<Button
								type="button"
								size="xs"
								variant="outline"
								className="cursor-pointer disabled:cursor-not-allowed"
								disabled={working}
								onClick={() => void act("restore")}
								data-testid="backup-restore"
							>
								Bring back {fileCount(check.toRestore.files)}
							</Button>
						)}
					</div>
				</div>
			</SettingsGroup>
			<SettingsGroup label="What stays here" testid="backup-left-out">
				<p className="text-xs leading-relaxed text-muted-foreground" data-testid="backup-left-out-list">
					{(state?.leftOut ?? []).join("; ") || "…"}
				</p>
			</SettingsGroup>
		</>
	);
}
