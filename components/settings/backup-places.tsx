"use client";
/**
 * The places the copy goes to, one row each (Settings → Backup): a folder on
 * this computer and/or the private bucket. Each row carries its own state and
 * its own one action, so a place that is behind never reads as the other being
 * up to date, and nothing here picks between them.
 */

import { FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CapLabel } from "@/components/ui/cap-label";
import {
	CLOUDFLARE_TOKEN_URL,
	backupOutcome,
	formatBytes,
	type BackupAuth,
	type BackupCheck,
	type BackupPlaceId,
} from "@/src/core";
import { SettingsGroup } from "./controls.tsx";
import { ProviderIcon } from "./provider-icons.tsx";

const NO_FOLDER_HINT =
	"A folder on this computer, copied by Lanna alone: nothing to sign in to and no account to make.";
const FOLDER_HINT =
	"A second drive, or a folder OneDrive or Google Drive already syncs, is safer than this disk alone.";
const COPIES_HINT =
	"One, the other or both. Each is read and filled on its own, so a place that is behind never reads as the other being up to date.";
const TOKEN_PLACEHOLDER = "Paste the R2 token…";
const SIGNING_IN = "Waiting for your browser…";
const BUCKET_OFF = "Your own private bucket, off for now: nothing is read or written there.";

export interface PlaceRowsProps {
	/** The folder this computer copies to as well; null = it does not copy to a folder. */
	folder: string | null;
	suggestedFolder: string;
	bucket: string;
	bucketOn: boolean;
	auth: BackupAuth | null;
	folderCheck: BackupCheck | null;
	bucketCheck: BackupCheck | null;
	stateReady: boolean;
	working: boolean;
	busy: string | null;
	editingFolder: boolean;
	folderField: string;
	folderError: string | null;
	tokenOpen: boolean;
	token: string;
	tokenError: string | null;
	onStartFolder: () => void;
	onCancelFolder: () => void;
	onDraft: (value: string) => void;
	onUseFolder: () => void;
	onDropFolder: () => void;
	onBucket: (on: boolean) => void;
	onConnect: () => void;
	onDisconnect: () => void;
	onGetKey: () => void;
	onSaveToken: () => void;
	onToken: (value: string) => void;
	onCopy: (action: "upload" | "restore", place: BackupPlaceId) => void;
}

function fileCount(files: number): string {
	return files === 1 ? "1 file" : `${files.toLocaleString()} files`;
}

function sizeOf(check: BackupCheck): string {
	return `${fileCount(check.copy.files)} · ${formatBytes(check.copy.bytes)}`;
}

/** What one look at one place found, in the words the row says it in. */
function placeState(check: BackupCheck | null, looking: string): string {
	if (check === null) return looking;
	if (check.error) return check.error;
	switch (backupOutcome(check)) {
		case "waiting": {
			const parts: string[] = [];
			if (check.toUpload.files > 0)
				parts.push(`${fileCount(check.toUpload.files)} to upload (${formatBytes(check.toUpload.bytes)})`);
			if (check.toRestore.files > 0)
				parts.push(`${fileCount(check.toRestore.files)} to bring back (${formatBytes(check.toRestore.bytes)})`);
			return `${sizeOf(check)} · ${parts.join(", ")}`;
		}
		default:
			return `${sizeOf(check)} · in step`;
	}
}

function PlaceActions({
	place,
	check,
	working,
	onCopy,
}: {
	place: BackupPlaceId;
	check: BackupCheck | null;
	working: boolean;
	onCopy: PlaceRowsProps["onCopy"];
}) {
	if (check === null || check.error) return null;
	if (check.toUpload.files === 0 && check.toRestore.files === 0) return null;
	return (
		<span className="flex flex-wrap items-center gap-2">
			{check.toUpload.files > 0 && (
				<Button
					type="button"
					size="xs"
					className="cursor-pointer disabled:cursor-not-allowed"
					disabled={working}
					onClick={() => onCopy("upload", place)}
					data-testid={`backup-upload-${place}`}
				>
					Upload {fileCount(check.toUpload.files)}
				</Button>
			)}
			{check.toRestore.files > 0 && (
				<Button
					type="button"
					size="xs"
					variant="outline"
					className="cursor-pointer disabled:cursor-not-allowed"
					disabled={working}
					onClick={() => onCopy("restore", place)}
					data-testid={`backup-restore-${place}`}
				>
					Bring back {fileCount(check.toRestore.files)}
				</Button>
			)}
		</span>
	);
}

export function PlaceRows({ p }: { p: PlaceRowsProps }) {
	const account = !p.stateReady
		? "…"
		: !p.auth
			? "Not signed in"
			: p.auth.via === "settings"
				? "Saved in Settings"
				: p.auth.via === "env"
					? "From .env.local"
					: (p.auth.account ?? "…");
	const folderRow = (
		<div className="flex flex-col gap-2.5 rounded-lg bg-well px-4 py-3" data-testid="backup-place-folder">
			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
				<FolderIcon className="size-4 shrink-0 text-ink-2" aria-hidden />
				{p.folder === null || p.editingFolder ? (
					<span className="font-ui text-sm font-medium text-foreground">A folder on this computer</span>
				) : (
					<span className="min-w-0 break-all font-mono text-xs text-foreground" data-testid="backup-folder">
						{p.folder}
					</span>
				)}
				{p.folder === null && !p.editingFolder && (
					<Button
						type="button"
						size="xs"
						variant="outline"
						className="cursor-pointer disabled:cursor-not-allowed"
						disabled={p.working}
						onClick={p.onStartFolder}
						data-testid="backup-folder-add"
					>
						Copy to a folder
					</Button>
				)}
				{p.folder !== null && !p.editingFolder && (
					<span className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							size="xs"
							variant="outline"
							className="cursor-pointer disabled:cursor-not-allowed"
							disabled={p.working}
							onClick={p.onStartFolder}
							data-testid="backup-folder-change"
						>
							Change
						</Button>
						<Button
							type="button"
							size="xs"
							variant="ghost"
							className="cursor-pointer disabled:cursor-not-allowed"
							disabled={p.working}
							onClick={p.onDropFolder}
							data-testid="backup-folder-drop"
						>
							Stop copying to the folder
						</Button>
					</span>
				)}
			</div>
			{p.folder === null && !p.editingFolder && (
				<p className="text-xs leading-relaxed text-muted-foreground">{NO_FOLDER_HINT}</p>
			)}
			{p.editingFolder && (
				<span className="flex w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
					<input
						type="text"
						value={p.folderField}
						onChange={(e) => p.onDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") p.onUseFolder();
						}}
						placeholder="Type the folder to copy to…"
						aria-label="The folder to copy to"
						autoComplete="off"
						spellCheck={false}
						disabled={p.busy !== null}
						data-testid="backup-folder-input"
						className="h-8.5 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/80 px-2.5 font-mono text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
					/>
					<Button
						type="button"
						size="xs"
						disabled={p.working || !p.folderField.trim()}
						aria-busy={p.busy === "use-folder"}
						onClick={p.onUseFolder}
						data-testid="backup-folder-save"
					>
						Use this folder
					</Button>
					<Button
						type="button"
						size="xs"
						variant="ghost"
						className="cursor-pointer disabled:cursor-not-allowed"
						disabled={p.working}
						onClick={p.onCancelFolder}
						data-testid="backup-folder-cancel"
					>
						Cancel
					</Button>
					<p className="text-xs leading-relaxed text-muted-foreground">{FOLDER_HINT}</p>
				</span>
			)}
			{p.folder !== null && !p.editingFolder && (
				<>
					<p className="text-xs leading-relaxed text-foreground" data-testid="backup-folder-state">
						{placeState(p.folderCheck, "Looking in the folder…")}
					</p>
					<PlaceActions place="folder" check={p.folderCheck} working={p.working} onCopy={p.onCopy} />
					<p className="text-xs leading-relaxed text-muted-foreground">{FOLDER_HINT}</p>
				</>
			)}
			{p.folderError && (
				<p role="alert" className="text-xs text-miss" data-testid="backup-folder-error">
					{p.folderError}
				</p>
			)}
		</div>
	);
	const bucketRow = (
		<div className="flex flex-col gap-2.5 rounded-lg bg-well px-4 py-3" data-testid="backup-place-bucket">
			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
				<ProviderIcon provider="cloudflare" />
				<CapLabel className="font-mono text-xs text-foreground">{p.bucket}</CapLabel>
				<span className="text-muted-foreground">·</span>
				<span className="font-ui text-xs text-foreground" data-testid="backup-account">
					{p.bucketOn ? (p.busy === "connect" ? SIGNING_IN : account) : "Off"}
				</span>
				{!p.bucketOn && (
					<Button
						type="button"
						size="xs"
						variant="outline"
						className="cursor-pointer disabled:cursor-not-allowed"
						disabled={p.working}
						onClick={() => p.onBucket(true)}
						data-testid="backup-bucket-add"
					>
						Copy to the bucket
					</Button>
				)}
				{p.bucketOn && p.stateReady && p.auth === null && (
					<>
						<Button
							type="button"
							size="xs"
							variant="outline"
							className="cursor-pointer disabled:cursor-not-allowed"
							disabled={p.working}
							aria-busy={p.busy === "connect"}
							onClick={p.onConnect}
							data-testid="backup-connect"
						>
							Sign in
						</Button>
						<a
							href={CLOUDFLARE_TOKEN_URL}
							target="_blank"
							rel="noreferrer"
							onClick={p.onGetKey}
							className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
							data-testid="backup-get-key"
						>
							Get a key ↗
						</a>
					</>
				)}
				{p.bucketOn && p.auth?.via === "wrangler" && (
					<Button
						type="button"
						size="xs"
						variant="outline"
						className="cursor-pointer disabled:cursor-not-allowed"
						disabled={p.working}
						aria-busy={p.busy === "disconnect"}
						onClick={p.onDisconnect}
						data-testid="backup-disconnect"
					>
						Sign out
					</Button>
				)}
				{p.bucketOn && p.auth?.via === "settings" && (
					<Button
						type="button"
						size="xs"
						variant="outline"
						className="cursor-pointer disabled:cursor-not-allowed"
						disabled={p.working}
						aria-busy={p.busy === "disconnect"}
						onClick={p.onDisconnect}
						data-testid="backup-forget"
					>
						Remove token
					</Button>
				)}
				{p.bucketOn && (
					<Button
						type="button"
						size="xs"
						variant="ghost"
						className="cursor-pointer disabled:cursor-not-allowed"
						disabled={p.working}
						onClick={() => p.onBucket(false)}
						data-testid="backup-bucket-drop"
					>
						Stop copying to the bucket
					</Button>
				)}
			</div>
			{!p.bucketOn && <p className="text-xs leading-relaxed text-muted-foreground">{BUCKET_OFF}</p>}
			{p.bucketOn && (
				<>
					<p className="text-xs leading-relaxed text-muted-foreground">
						{p.auth === null && p.stateReady
							? "Your own private bucket. Sign in with Cloudflare, or paste an R2 token: Get a key opens Cloudflare's token page with the rights filled in."
							: p.auth?.via === "env"
								? "Your own private bucket. The token comes from .env.local, so remove it there."
								: p.auth?.via === "settings"
									? "Your own private bucket, reached with the R2 token saved under API keys."
									: "Your own private bucket."}
					</p>
					<p className="font-ui text-xs leading-relaxed text-foreground" data-testid="backup-bucket-state">
						{placeState(p.bucketCheck, "Reading the bucket…")}
					</p>
					<PlaceActions place="cloudflare" check={p.bucketCheck} working={p.working} onCopy={p.onCopy} />
				</>
			)}
			{p.bucketOn && p.stateReady && p.auth === null && p.tokenOpen && (
				<span className="flex w-full flex-wrap items-center gap-2" data-testid="backup-token">
					<input
						type="password"
						value={p.token}
						onChange={(e) => p.onToken(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") p.onSaveToken();
						}}
						placeholder={TOKEN_PLACEHOLDER}
						aria-label="Cloudflare R2 token"
						autoComplete="off"
						spellCheck={false}
						disabled={p.busy !== null}
						data-testid="backup-token-input"
						className="h-8.5 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/80 px-2.5 font-mono text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
					/>
					<Button
						type="button"
						size="xs"
						disabled={p.working || !p.token.trim()}
						aria-busy={p.busy === "save-token"}
						onClick={p.onSaveToken}
						data-testid="backup-token-save"
					>
						Connect
					</Button>
				</span>
			)}
			{p.tokenError && (
				<p role="alert" className="text-xs text-miss" data-testid="backup-token-error">
					{p.tokenError}
				</p>
			)}
		</div>
	);
	return (
		<SettingsGroup label="Where the copies go" hint={COPIES_HINT} testid="backup-where">
			{folderRow}
			{bucketRow}
		</SettingsGroup>
	);
}
