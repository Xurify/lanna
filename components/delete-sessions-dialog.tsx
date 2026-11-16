"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { Button } from "@/components/ui/button";
import type { ChatListItem } from "@/src/core";

type Target = Pick<ChatListItem, "id" | "title">;

/**
 * Bulk session deletion: one confirmation for a selection of chats. Each
 * chat goes to the trash, spend log included, like a single delete. Chats
 * that cannot go yet (a turn or background job is running) are reported and
 * stay selected, so Delete again retries just those.
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
	/** Called with the ids that were deleted. */
	onDeleted: (ids: string[]) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const backdropDismiss = useBackdropDismiss(() => {
		if (!busy) onClose();
	});

	useEffect(() => {
		if (!open) {
			setBusy(false);
			setFailure(null);
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
		const ok: string[] = [];
		let skipped = 0;
		let reason = "";
		for (const c of chats) {
			try {
				const res = await fetch(`/api/chats/${c.id}`, { method: "DELETE" });
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				if (res.ok) {
					ok.push(c.id);
				} else {
					skipped++;
					reason = body.error ?? `Delete failed (${res.status})`;
				}
			} catch {
				skipped++;
				reason = "network error";
			}
		}
		if (ok.length > 0) onDeleted(ok);
		setBusy(false);
		if (skipped === 0) onClose();
		else setFailure(`${skipped} could not be deleted: ${reason}`);
	};

	if (!open) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100"
			{...backdropDismiss}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Delete chats"
				data-testid="delete-sessions-dialog"
				onClick={(e) => e.stopPropagation()}
				className="w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150"
			>
				<h2 className="text-sm font-semibold text-destructive">
					Delete {chats.length} {chats.length === 1 ? "chat" : "chats"}?
				</h2>
				<ul
					className="mt-2 max-h-40 overflow-y-auto font-mono text-xs text-foreground"
					data-testid="delete-sessions-list"
				>
					{chats.map((c) => (
						<li key={c.id} className="truncate py-0.5">
							{c.title}
						</li>
					))}
				</ul>
				<p className="mt-3 text-sm text-muted-foreground">
					They leave your list and any background work in them stops. They are kept in the trash, with their spending
					record.
				</p>
				{failure && (
					<div
						role="alert"
						data-testid="delete-sessions-failure"
						className="mt-3 rounded-sm border border-border/60 px-3 py-2 text-xs text-foreground"
					>
						{failure}. Press Delete to try the rest again.
					</div>
				)}
				<div className="mt-4 flex justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						data-testid="delete-sessions-cancel"
						onClick={onClose}
						disabled={busy}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						data-testid="delete-sessions-confirm"
						onClick={() => void run()}
						disabled={busy || chats.length === 0}
					>
						{busy ? "Deleting…" : `Delete ${chats.length} ${chats.length === 1 ? "chat" : "chats"}`}
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
