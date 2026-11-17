"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { Button } from "@/components/ui/button";
import type { ChatListItem } from "@/src/core";

/**
 * Confirms sending one chat to the trash. A 409 (a turn or background job is
 * still running) keeps the dialog open with the server's own line and a
 * Try again.
 */
export function DeleteSessionDialog({
	chat,
	onClose,
	onDeleted,
}: {
	/** The session up for deletion; null = closed. */
	chat: Pick<ChatListItem, "id" | "title"> | null;
	onClose: () => void;
	/** Success path — the sidebar owns navigation + list patching. */
	onDeleted: (id: string) => void;
}) {
	const [busy, setBusy] = useState(false);
	const backdropDismiss = useBackdropDismiss(() => {
		if (!busy) onClose();
	});
	const [failure, setFailure] = useState<{ code: string; error: string } | null>(null);

	// Fresh state per session: closing resets, opening a new chat starts clean.
	useEffect(() => {
		if (!chat) {
			setBusy(false);
			setFailure(null);
		}
	}, [chat]);

	// Esc closes (claimed — a menu/dialog Esc must not also abort a turn).
	useEffect(() => {
		if (!chat) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// THE ONE-ESC LAW (keyboard round 2026-10-06): claim at the
				// document level — a window-level stopPropagation cannot stop
				// the earlier-registered global window listener.
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [chat, onClose]);

	const run = async () => {
		if (!chat || busy) return;
		setBusy(true);
		setFailure(null);
		try {
			const res = await fetch(`/api/chats/${chat.id}`, { method: "DELETE" });
			const body = (await res.json()) as { ok?: boolean; error?: string; code?: string };
			if (!res.ok) {
				// 409 (turn/jobs running) is retryable — keep the dialog open, show the server's line.
				setFailure({ code: body.code ?? "error", error: body.error ?? `Delete failed (${res.status})` });
				setBusy(false);
				return;
			}
			onDeleted(chat.id);
		} catch {
			setFailure({ code: "network", error: "Delete failed — network error. Try again." });
			setBusy(false);
		}
	};

	if (!chat) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100"
			{...backdropDismiss}
		>
			<DeleteSessionBody chat={chat} busy={busy} failure={failure} onClose={onClose} onRun={() => void run()} />
		</div>,
		document.body,
	);
}

/** The dialog's pure body — exported for SSR pins (the settings-dialog /
 *  node-dialog body pattern). The wrapper owns state + effects + portal. */
function DeleteSessionBody({
	chat,
	busy,
	failure,
	onClose,
	onRun,
}: {
	chat: Pick<ChatListItem, "id" | "title">;
	busy: boolean;
	failure: { code: string; error: string } | null;
	onClose: () => void;
	onRun: () => void;
}) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-session-title"
			data-testid="delete-session-dialog"
			onClick={(e) => e.stopPropagation()}
			className="w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150"
		>
			<h2 id="delete-session-title" className="text-base font-semibold text-foreground">
				Delete this chat?
			</h2>
			<p
				data-testid="session-name-code"
				className="mt-3 line-clamp-3 rounded-lg bg-well px-3.5 py-2.5 font-mono text-sm break-words text-foreground"
			>
				{chat.title}
			</p>
			<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
				It leaves your list and any background work in it stops. It stays in the trash: open its link again to put it
				back.
			</p>
			{failure && (
				<div
					role="alert"
					data-testid="delete-failure"
					className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-miss-soft px-3.5 py-2.5 text-sm text-foreground"
				>
					<span className="min-w-0">{failure.error}</span>
					<Button type="button" variant="outline" size="xs" data-testid="delete-retry" onClick={onRun} disabled={busy}>
						Try again
					</Button>
				</div>
			)}
			<div className="mt-6 flex flex-wrap justify-end gap-3">
				<Button type="button" variant="outline" size="sm" data-testid="delete-cancel" onClick={onClose} disabled={busy}>
					Cancel
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					data-testid="delete-confirm"
					onClick={onRun}
					disabled={busy}
				>
					<Trash2 aria-hidden />
					{busy ? "Deleting…" : "Delete chat"}
				</Button>
			</div>
		</div>
	);
}
