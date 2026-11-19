"use client";
/**
 * Settings → Backup: the data folder against its copy. The copy is a folder on
 * this computer or the owner's private Cloudflare R2 bucket; the server does the
 * looking, the copying and the signing in (server/backup.ts); this asks it,
 * shows the answer, and starts one of them when asked.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CapLabel } from "@/components/ui/cap-label";
import {
	BACKUP_AREAS,
	backupOutcome,
	CLOUDFLARE_TOKEN_URL,
	formatBytes,
	timeAgo,
	type BackupArea,
	type BackupCounts,
	type BackupDestination,
	type BackupJob,
	type BackupState,
} from "@/src/core";
import { ProviderIcon } from "./provider-icons.tsx";
import { SettingsGroup, SettingsRow, SettingsSegmented } from "./controls.tsx";

type Action =
	| "check"
	| "upload"
	| "restore"
	| "connect"
	| "disconnect"
	| "save-token"
	| "use-folder"
	| "use-cloudflare";

/** The one key the bucket is read with when there is no wrangler login (Settings → API keys). */
const R2_TOKEN_KEY = "CLOUDFLARE_API_TOKEN";

const LOAD_FAILED = "Couldn’t read the backup status. Refresh to try again.";
const CHECK_FAILED = "Couldn’t read the copy. Try again in a moment.";
const SIGNING_IN = "Waiting for your browser…";
const TOKEN_FAILED = "Couldn’t save the token. Try again.";
const TOKEN_PLACEHOLDER = "Paste the R2 token…";
const FOLDER_FAILED = "Couldn’t use that folder. Try again.";
const NO_FOLDER_HINT =
	"A folder on this computer, copied by Lanna alone: nothing to sign in to and no account to make.";
const FOLDER_HINT =
	"A second drive, or a folder OneDrive or Google Drive already syncs, is safer than this disk alone.";

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

/** What the row says about the way in, so the control beside it needs no explaining. */
function whereHint(auth: BackupState["auth"]): string {
	if (auth === null)
		return "Your own private bucket. Sign in with Cloudflare, or paste an R2 token: Get a key opens Cloudflare's token page with the rights filled in.";
	if (auth.via === "env") return "Your own private bucket. The token comes from .env.local, so remove it there.";
	if (auth.via === "settings") return "Your own private bucket, reached with the R2 token saved under API keys.";
	return "Your own private bucket.";
}

export function BackupSection() {
	const [state, setState] = useState<BackupState | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [busy, setBusy] = useState<Action | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [tokenOpen, setTokenOpen] = useState(false);
	const [token, setToken] = useState("");
	const [tokenError, setTokenError] = useState<string | null>(null);
	const [editingFolder, setEditingFolder] = useState(false);
	const [folderDraft, setFolderDraft] = useState("");
	const [folderError, setFolderError] = useState<string | null>(null);

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

	const act = useCallback(async (action: Action, payload: { folder?: string } = {}) => {
		setBusy(action);
		setNotice(null);
		setFolderError(null);
		try {
			const res = await fetch("/api/backup", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action, ...payload }),
			});
			const body = (await res.json().catch(() => null)) as (BackupState & { message?: string }) | null;
			if (!res.ok || !body) {
				const message = body?.message ?? CHECK_FAILED;
				// A folder that could not be used is answered at the field that named it.
				if (action === "use-folder") {
					setFolderError(message);
					setEditingFolder(true);
				} else setNotice(message);
				return;
			}
			setState(body);
			if (action === "use-folder") {
				setEditingFolder(false);
				setFolderDraft("");
			}
			if (action === "use-cloudflare") setEditingFolder(false);
		} catch {
			if (action === "use-folder") setFolderError(FOLDER_FAILED);
			else setNotice(CHECK_FAILED);
		} finally {
			setBusy(null);
		}
	}, []);

	/** Use the folder in the field: the server makes it when it is new, then checks it. */
	async function useFolder() {
		const chosen = folderField.trim();
		if (!chosen || busy) return;
		await act("use-folder", { folder: chosen });
	}

	/** Save the pasted token under API keys, then read the bucket with it — one step for a machine with no wrangler. */
	async function saveToken() {
		const value = token.trim();
		if (!value || busy) return;
		setBusy("save-token");
		setNotice(null);
		setTokenError(null);
		try {
			const res = await fetch(`/api/keys/${R2_TOKEN_KEY}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ value }),
			});
			const body = (await res.json().catch(() => null)) as { error?: string } | null;
			if (!res.ok) {
				setTokenError(body?.error ?? TOKEN_FAILED);
				return;
			}
			setToken("");
			setTokenOpen(false);
			await act("check");
		} catch {
			setTokenError(TOKEN_FAILED);
		} finally {
			setBusy(null);
		}
	}

	useEffect(() => {
		void load();
	}, [load]);

	/** Nothing on screen is a check of its own, so ask for one: whichever place is in use, and after a switch. */
	useEffect(() => {
		if (!state || state.last || busy !== null) return;
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
	const destination = state?.destination ?? "cloudflare";
	const folder = state?.folder ?? null;
	/** What to call the copy in a sentence, so the same words fit a bucket and a folder. */
	const noun = destination === "folder" ? "the folder" : "the bucket";
	const outcome = backupOutcome(check);
	const unreachable = outcome === "unreachable";
	const working = busy !== null || running;
	const account = !state
		? "…"
		: !auth
			? "Not signed in"
			: auth.via === "settings"
				? "Saved in Settings"
				: auth.via === "env"
					? "From .env.local"
					: (auth.account ?? "…");

	/** A destination already in use switches in one click. A folder with none chosen yet is offered
	 *  instead, so the path is on screen before anything is copied into it. */
	function choosePlace(next: BackupDestination) {
		if (working) return;
		setFolderError(null);
		if (next === "cloudflare") {
			setEditingFolder(false);
			if (destination !== "cloudflare") void act("use-cloudflare");
			return;
		}
		if (folder === null) {
			offerFolder();
			return;
		}
		if (destination !== "folder") void act("use-folder", { folder });
	}

	/** The folder in use, or the one Lanna offers, goes into the field waiting to be used. */
	function offerFolder() {
		setFolderDraft(folder ?? state?.suggestedFolder ?? "");
		setEditingFolder(true);
	}

	const status = (() => {
		if (job && (running || job.failed > 0 || job.error)) return jobLine(job);
		if (unreachable) return check?.error ?? CHECK_FAILED;
		if (!check) return `Checking ${noun}…`;
		if (outcome === "even") return `Everything on this computer is in ${noun}.`;
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
	/** What this part holds on the other side, when that says more than the total under Status: an empty copy is the headline's business, not each row's. */
	const areaElsewhere = (area: BackupArea | null): BackupCounts | null => {
		if (!area || unreachable || area.copy.files === 0) return null;
		return area.copy.files === area.here.files && area.copy.bytes === area.here.bytes ? null : area.copy;
	};
	/** What the folder field holds: the folder in use, the one Lanna offers, or what is being typed. */
	const folderField = editingFolder ? folderDraft : (folder ?? state?.suggestedFolder ?? "");
	/** Where the copy is going, and where it would go while a folder is being chosen. */
	const shownPlace = editingFolder ? "folder" : destination;

	return (
		<>
			<SettingsGroup label="Where the copy goes" testid="backup-where">
				<SettingsSegmented
					ariaLabel="Where the copy goes"
					testid="backup-place"
					value={shownPlace}
					onChange={choosePlace}
					options={[
						{ value: "cloudflare", label: "Cloudflare R2" },
						{ value: "folder", label: "A folder" },
					]}
				/>
				{shownPlace === "folder" && (
					<SettingsRow
						label="A folder on this computer"
						hint={folder === null ? NO_FOLDER_HINT : FOLDER_HINT}
						testid="backup-row-folder"
						stack
					>
						<span className="flex w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
							{folder !== null && !editingFolder && (
								<>
									<span className="min-w-0 break-all font-mono text-xs text-foreground" data-testid="backup-folder">
										{folder}
									</span>
									<Button
										type="button"
										size="xs"
										variant="outline"
										className="cursor-pointer disabled:cursor-not-allowed"
										disabled={working}
										onClick={offerFolder}
										data-testid="backup-folder-change"
									>
										Change
									</Button>
								</>
							)}
							{(editingFolder || folder === null) && (
								<>
									<input
										type="text"
										value={folderField}
										onChange={(e) => {
											setEditingFolder(true);
											setFolderDraft(e.target.value);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") void useFolder();
										}}
										placeholder="Type the folder to copy to…"
										aria-label="The folder to copy to"
										autoComplete="off"
										spellCheck={false}
										disabled={busy !== null}
										data-testid="backup-folder-input"
										className="h-8.5 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/80 px-2.5 font-mono text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
									/>
									<Button
										type="button"
										size="xs"
										disabled={working || !folderField.trim()}
										aria-busy={busy === "use-folder"}
										onClick={() => void useFolder()}
										data-testid="backup-folder-save"
									>
										Use this folder
									</Button>
								</>
							)}
						</span>
					</SettingsRow>
				)}
				{shownPlace === "cloudflare" && (
					<SettingsRow label="Cloudflare R2" hint={whereHint(auth)} testid="backup-row-bucket" stack={auth === null}>
						<span className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
							<ProviderIcon provider="cloudflare" />
							<CapLabel className="font-mono text-xs text-foreground">{state?.bucket ?? "…"}</CapLabel>
							<span className="text-muted-foreground">·</span>
							<span className="font-ui text-xs text-foreground" data-testid="backup-account">
								{busy === "connect" ? SIGNING_IN : account}
							</span>
							{state !== null && auth === null && (
								<>
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
									<a
										href={CLOUDFLARE_TOKEN_URL}
										target="_blank"
										rel="noreferrer"
										onClick={() => setTokenOpen(true)}
										className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
										data-testid="backup-get-key"
									>
										Get a key ↗
									</a>
								</>
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
							{auth?.via === "settings" && (
								<Button
									type="button"
									size="xs"
									variant="outline"
									className="cursor-pointer disabled:cursor-not-allowed"
									disabled={working}
									aria-busy={busy === "disconnect"}
									onClick={() => void act("disconnect")}
									data-testid="backup-forget"
								>
									Remove token
								</Button>
							)}
							{state !== null && auth === null && tokenOpen && (
								<span className="flex w-full flex-wrap items-center gap-2" data-testid="backup-token">
									<input
										type="password"
										value={token}
										onChange={(e) => setToken(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") void saveToken();
										}}
										placeholder={TOKEN_PLACEHOLDER}
										aria-label="Cloudflare R2 token"
										autoComplete="off"
										spellCheck={false}
										disabled={busy !== null}
										data-testid="backup-token-input"
										className="h-8.5 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/80 px-2.5 font-mono text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
									/>
									<Button
										type="button"
										size="xs"
										disabled={working || !token.trim()}
										aria-busy={busy === "save-token"}
										onClick={() => void saveToken()}
										data-testid="backup-token-save"
									>
										Connect
									</Button>
								</span>
							)}
						</span>
					</SettingsRow>
				)}
				{shownPlace === "cloudflare" && tokenError && (
					<p role="alert" className="px-1 text-xs text-miss" data-testid="backup-token-error">
						{tokenError}
					</p>
				)}
				{folderError && (
					<p role="alert" className="px-1 text-xs text-miss" data-testid="backup-folder-error">
						{folderError}
					</p>
				)}
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
										data-testid={`backup-area-copy-${id}`}
									>
										in {noun}: {sizeOf(elsewhere)}
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
				<SettingsRow label={destination === "folder" ? "In the folder" : "In the bucket"} testid="backup-row-copy">
					<span className="font-ui text-xs tabular-nums text-foreground" data-testid="backup-copy">
						{check && !unreachable ? sizeOf(check.copy) : "…"}
					</span>
				</SettingsRow>
				<SettingsRow
					label="Last checked"
					hint={`Lanna reads ${noun} only here and in the buttons below.`}
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
