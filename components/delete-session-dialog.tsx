"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { Button } from "@/components/ui/button";
import type { ChatListItem } from "@/src/core";

/**
 * Session deletion (wave 6 chunk A; owner flow rework 2026-09-24) — THE
 * destructive-confirmation surface, portaled z-50 like the setup dialog,
 * now in the node dialog's shape (the two must read as one design):
 *
 *   - red title "Delete session?" in the abort-turn look (owner, 2026-10-13
 *     polish: text-sm font-semibold JetBrains Mono via the UI default —
 *     the serif display title is gone), the session name below it in
 *     JetBrains Mono at normal text-sm size (was sized-up text-lg), no
 *     code-block chrome;
 *   - a bottom row Cancel + destructive-red Delete, exactly the node
 *     dialog's pair.
 *
 * Retryable failures render honestly with a Try-again: 409 turn_in_flight /
 * jobs_running ("wait for running work") clears on its own — the server's error line is
 * already written for the user; we show it verbatim. Try-again is just
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
			<DeleteSessionBody
				chat={chat}
				busy={busy}
				failure={failure}
				onClose={onClose}
				onRun={() => void run()}
			/>
		</div>,
		document.body,
	);
}

/** The dialog's pure body — exported for SSR pins (the settings-dialog /
 *  node-dialog body pattern). The wrapper owns state + effects + portal. */
export function DeleteSessionBody({
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
			aria-label="Delete chat"
			data-testid="delete-session-dialog"
			onClick={(e) => e.stopPropagation()}
			className="w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150"
		>
			<h2 className="text-sm font-semibold text-destructive">Delete chat?</h2>
			{/* The session name below the title in JetBrains Mono (owner,
			    2026-09-24): no code-block chrome — the font already says
			    code. Owner, 2026-10-13 polish: normal text-sm size (was
			    sized-up text-lg), still white. Same shape as the node
			    dialog. */}
			<div className="mt-1.5">
				<code data-testid="session-name-code" className="font-mono text-sm text-foreground">
					{chat.title}
				</code>
			</div>
			<p className="mt-2 text-sm text-muted-foreground">
				The chat leaves your list and any background work in it stops. The chat is kept in the trash, so opening its link again lets you put it back.
			</p>
			{failure && (
				<div
					role="alert"
					data-testid="delete-failure"
					className="mt-3 rounded-sm border border-border/60 px-3 py-2 text-xs"
				>
					<span className="text-foreground">{failure.error}</span>
					<button
						type="button"
						data-testid="delete-retry"
						onClick={onRun}
						disabled={busy}
						className="ml-3 text-xs text-foreground underline-offset-2 hover:underline disabled:opacity-40"
					>
						Try again
					</button>
				</div>
			)}
			{/* The node dialog's exact bottom row: quiet Cancel, destructive
			    red Delete (border + text, fill on hover — the app's
			    established destructive pair). */}
			<div className="mt-4 flex justify-end gap-2">
				<Button type="button" variant="ghost" size="sm" data-testid="delete-cancel" onClick={onClose} disabled={busy}>
					Cancel
				</Button>
				<Button type="button" variant="destructive" size="sm" data-testid="delete-confirm" onClick={onRun} disabled={busy}>
					{busy ? "Deleting…" : "Delete"}
				</Button>
			</div>
		</div>
	);
}