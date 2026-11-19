"use client";
/**
 * Settings → Backup: the data folder against each place it is copied to. The
 * server does the looking, the copying and the signing in (server/backup.ts);
 * this asks it, shows the answer per place, and starts one run when asked.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	BACKUP_AREAS,
	formatBytes,
	timeAgo,
	type BackupCheck,
	type BackupCounts,
	type BackupJob,
	type BackupPlaceId,
	type BackupState,
} from "@/src/core";
import { SettingsGroup, SettingsRow } from "./controls.tsx";
import { PlaceRows } from "./backup-places.tsx";

type Action =
	| "check"
	| "upload"
	| "restore"
	| "connect"
	| "disconnect"
	| "save-token"
	| "use-folder"
	| "drop-folder"
	| "use-bucket"
	| "drop-bucket";

/** The one key the bucket is read with when there is no wrangler login (Settings → API keys). */
const R2_TOKEN_KEY = "CLOUDFLARE_API_TOKEN";

const LOAD_FAILED = "Couldn’t read the backup status. Refresh to try again.";
const CHECK_FAILED = "Couldn’t read the copies. Try again in a moment.";
const TOKEN_FAILED = "Couldn’t save the token. Try again.";
const FOLDER_FAILED = "Couldn’t use that folder. Try again.";
const NO_PLACES = "Nothing is copied yet. Copy to a folder, to the bucket, or to both.";

function fileCount(files: number): string {
	return files === 1 ? "1 file" : `${files.toLocaleString()} files`;
}

function sizeOf(counts: BackupCounts): string {
	return `${fileCount(counts.files)} · ${formatBytes(counts.bytes)}`;
}

function placeWord(place: BackupPlaceId): string {
	return place === "folder" ? "the folder" : "the bucket";
}

/** The places this computer copies to that are on, with the last look at each. */
function placesOf(state: BackupState): { id: BackupPlaceId; check: BackupCheck | null }[] {
	const places: { id: BackupPlaceId; check: BackupCheck | null }[] = [];
	if (state.folder !== null) places.push({ id: "folder", check: state.checks.folder });
	if (state.bucketOn) places.push({ id: "cloudflare", check: state.checks.cloudflare });
	return places;
}

function jobLine(job: BackupJob): string {
	const going = job.action === "upload" ? `to ${placeWord(job.place)}` : `from ${placeWord(job.place)}`;
	if (!job.finishedAt)
		return job.total === 0 ? `Copying ${going}…` : `${job.done} of ${job.total} files copied ${going}…`;
	if (job.failed > 0) return `${job.done} of ${job.total} files copied ${going}; ${job.failed} failed.`;
	return job.error ?? `${job.done} of ${job.total} files copied ${going}.`;
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

	const act = useCallback(async (action: Action, payload: { folder?: string; place?: BackupPlaceId } = {}) => {
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
		} catch {
			if (action === "use-folder") setFolderError(FOLDER_FAILED);
			else setNotice(CHECK_FAILED);
		} finally {
			setBusy(null);
		}
	}, []);

	/** The folder in the field joins the copies: the server makes it when it is new. */
	async function useFolder() {
		const chosen = folderDraft.trim();
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
			if (!res.ok) {
				setTokenError(TOKEN_FAILED);
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

	/** Nothing on screen is a look of its own, so ask for one: this computer before any place is on,
	 *  and a place that just joined. */
	useEffect(() => {
		if (!state || busy !== null) return;
		if (!state.here || placesOf(state).some(({ check }) => check === null)) void act("check");
	}, [state, act]);

	const folder = state?.folder ?? null;
	const bucketOn = state?.bucketOn ?? false;
	const auth = state?.auth ?? null;
	const job = state?.job ?? null;
	const running = Boolean(job && !job.finishedAt);
	/** A run happens on the server, so the page asks again while one is going. */
	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => void load(), 1500);
		return () => clearInterval(timer);
	}, [running, load]);
	const working = busy !== null || running;
	const here = state?.here ?? null;
	const folderCheck = state?.checks.folder ?? null;
	const bucketCheck = state?.checks.cloudflare ?? null;
	const places = state ? placesOf(state) : [];
	const checkedAt =
		[here?.at, folderCheck?.at, bucketCheck?.at]
			.filter((at): at is string => Boolean(at))
			.sort()
			.at(-1) ?? null;
	const everyPlaceFailed = places.length > 0 && places.every(({ check }) => check?.error) && !job;

	const status = (() => {
		if (job && (running || job.failed > 0 || job.error)) return jobLine(job);
		if (!state) return "Looking at each copy…";
		if (places.length === 0) return NO_PLACES;
		if (places.some(({ check }) => check === null)) return "Looking at each copy…";
		const readable = places.filter(({ check }) => !check?.error);
		if (readable.length === 0) return places[0]!.check!.error ?? CHECK_FAILED;
		const upload = readable.reduce((sum, { check }) => sum + check!.toUpload.files, 0);
		const restore = readable.reduce((sum, { check }) => sum + check!.toRestore.files, 0);
		if (upload === 0 && restore === 0)
			return places.length === 1
				? `Everything on this computer is in ${placeWord(places[0]!.id)}.`
				: "Everything on this computer is in each copy.";
		const parts: string[] = [];
		if (upload > 0) parts.push(`${fileCount(upload)} to upload`);
		if (restore > 0) parts.push(`${fileCount(restore)} to bring back`);
		return `${parts.join(", ")}.`;
	})();

	return (
		<>
			<PlaceRows
				p={{
					folder,
					suggestedFolder: state?.suggestedFolder ?? "",
					bucket: state?.bucket ?? "lanna",
					bucketOn,
					auth,
					folderCheck,
					bucketCheck,
					stateReady: state !== null,
					working,
					busy,
					editingFolder,
					folderField: folderDraft,
					folderError,
					tokenOpen,
					token,
					tokenError,
					onStartFolder: () => {
						setFolderDraft(folder ?? state?.suggestedFolder ?? "");
						setEditingFolder(true);
					},
					onCancelFolder: () => {
						setEditingFolder(false);
						setFolderError(null);
					},
					onDraft: setFolderDraft,
					onUseFolder: () => void useFolder(),
					onDropFolder: () => void act("drop-folder"),
					onBucket: (on) => void act(on ? "use-bucket" : "drop-bucket"),
					onConnect: () => void act("connect"),
					onDisconnect: () => void act("disconnect"),
					onGetKey: () => setTokenOpen(true),
					onSaveToken: () => void saveToken(),
					onToken: setToken,
					onCopy: (action, place) => void act(action, { place }),
				}}
			/>
			<SettingsGroup
				label="What is in it"
				hint={here ? `${sizeOf(here.counts)} on this computer` : "…"}
				testid="backup-areas"
			>
				<div className="flex flex-col gap-3 rounded-lg bg-well px-4 py-3.5" data-testid="backup-area-list">
					{BACKUP_AREAS.map(({ id, label }) => {
						const area = here?.areas.find((a) => a.id === id) ?? null;
						const share = area && here && here.counts.bytes > 0 ? area.here.bytes / here.counts.bytes : 0;
						const percent = Math.round(share * 100);
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
									{area ? sizeOf(area.here) : "…"}
								</span>
								<span
									className="col-span-2 h-1.5 overflow-hidden rounded-full bg-line-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
									role="meter"
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={percent}
									aria-label={`${label}: ${percent}% of the backup`}
								>
									<span
										className="block h-full rounded-full bg-[var(--q-bar)]"
										style={{ width: `${share * 100}%` }}
										data-testid={`backup-area-bar-${id}`}
									/>
								</span>
							</div>
						);
					})}
				</div>
			</SettingsGroup>
			<SettingsGroup label="Status" testid="backup-status">
				<SettingsRow label="This computer" testid="backup-row-here">
					<span className="font-ui text-xs tabular-nums text-foreground" data-testid="backup-here">
						{here ? sizeOf(here.counts) : "…"}
					</span>
				</SettingsRow>
				<SettingsRow
					label="Last checked"
					hint="Lanna reads each copy only here and in the rows above."
					testid="backup-row-checked"
				>
					<span className="font-ui text-xs text-foreground" data-testid="backup-checked">
						{checkedAt ? timeAgo(checkedAt) : "Not yet"}
					</span>
				</SettingsRow>
				<div className="flex flex-col gap-3 rounded-lg bg-well px-4 py-3" data-testid="backup-actions">
					<p
						role={everyPlaceFailed ? "alert" : "status"}
						className={
							everyPlaceFailed ? "text-xs leading-relaxed text-destructive" : "text-xs leading-relaxed text-foreground"
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
