"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { Button } from "@/components/ui/button";
import { TRACES_COPY } from "@/components/delete-session-dialog";
import type { ChatDeleteMode, ChatListItem } from "@/src/core";

type Target = Pick<ChatListItem, "id" | "title">;

/**
 * Bulk session deletion: one confirmation for a selection of chats. Always
 * delete-nodes by default (what the sessions added to the skill map goes
 * with them; shared topics survive), preserve-graph when unticked. The file
 * of each, spend log included, goes to the trash like a single delete. Chats that cannot go yet
 * (a turn or background job is running) are reported and stay selected, so
 * Delete again retries just those.
 */
export function DeleteSessionsDialog({
	open,
	chats,
	onClose,
	onDeleted,
}: {
	open: boolean;
	/** The selected chats still on the list. */
	chats: Target[];
	onClose: () => void;
	/** Called with the ids that were deleted and the latest graph revision. */
	onDeleted: (ids: string[], graphRevision: number) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	// Throwaway chats are the usual bulk target, so what they added to the
	// skill map goes with them by default (shared topics survive either way).
	const [traces, setTraces] = useState(true);
	const backdropDismiss = useBackdropDismiss(() => {
		if (!busy) onClose();
	});

	useEffect(() => {
		if (!open) {
			setBusy(false);
			setFailure(null);
			setTraces(true);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !busy) {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, busy, onClose]);

	const run = async () => {
		if (busy || chats.length === 0) return;
		setBusy(true);
		setFailure(null);
		const mode: ChatDeleteMode = traces ? "delete-nodes" : "preserve-graph";
		const ok: string[] = [];
		let skipped = 0;
		let reason = "";
		let revision = 0;
		for (const c of chats) {
			try {
				const res = await fetch(`/api/chats/${c.id}?mode=${mode}`, { method: "DELETE" });
				const body = (await res.json().catch(() => ({}))) as { error?: string; graphRevision?: number };
				if (res.ok) {
					ok.push(c.id);
					revision = body.graphRevision ?? revision;
				} else {
					skipped++;
					reason = body.error ?? `Delete failed (${res.status})`;
				}
			} catch {
				skipped++;
				reason = "network error";
			}
		}
		if (ok.length > 0) onDeleted(ok, revision);
		setBusy(false);
		if (skipped === 0) onClose();
		else setFailure(`${skipped} could not be deleted: ${reason}`);
	};

	if (!open) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100" {...backdropDismiss}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Delete sessions"
				data-testid="delete-sessions-dialog"
				onClick={(e) => e.stopPropagation()}
				className="w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150"
			>
				<h2 className="text-sm font-semibold text-destructive">
					Delete {chats.length} {chats.length === 1 ? "session" : "sessions"}?
				</h2>
				<ul className="mt-2 max-h-40 overflow-y-auto font-mono text-xs text-foreground" data-testid="delete-sessions-list">
					{chats.map((c) => (
						<li key={c.id} className="truncate py-0.5">
							{c.title}
						</li>
					))}
				</ul>
				<p className="mt-3 text-sm text-muted-foreground">
					They leave your list and their background work stops. The files, with their spending record, are kept in the trash.
				</p>
				<label data-testid="delete-sessions-traces" className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 px-4 py-3">
					<input
						type="checkbox"
						data-testid="delete-sessions-traces-checkbox"
						checked={traces}
						onChange={(e) => setTraces(e.target.checked)}
						disabled={busy}
						className="mt-0.5 size-4 shrink-0 accent-primary"
					/>
					<span className="min-w-0">
						<span className="block text-sm text-foreground">{TRACES_COPY.title}</span>
						<span className="mt-1 block text-xs text-muted-foreground">{TRACES_COPY.body}</span>
					</span>
				</label>
				{failure && (
					<div role="alert" data-testid="delete-sessions-failure" className="mt-3 rounded-sm border border-border/60 px-3 py-2 text-xs text-foreground">
						{failure}. Press Delete to try the rest again.
					</div>
				)}
				<div className="mt-4 flex justify-end gap-2">
					<Button type="button" variant="ghost" size="sm" data-testid="delete-sessions-cancel" onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button type="button" variant="destructive" size="sm" data-testid="delete-sessions-confirm" onClick={() => void run()} disabled={busy || chats.length === 0}>
						{busy ? "Deleting…" : `Delete ${chats.length} ${chats.length === 1 ? "chat" : "chats"}`}
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
