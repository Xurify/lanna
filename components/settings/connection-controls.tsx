"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { Button } from "@/components/ui/button";

import { ProviderIcon } from "./provider-icons.tsx";

export function ConnectionRow({ label, action, disabled, onAction, children, testid, actionTestid, card }: { label: string; action: string; disabled: boolean; onAction: () => void; children?: React.ReactNode; testid?: string; actionTestid?: string; card?: boolean }) {
	return (
		<div
			className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-accent/15 px-3.5 py-2.5 transition-colors hover:border-border/80 hover:bg-accent/30"
			data-testid={testid}
		>
			<span className="flex items-center gap-2.5 font-ui text-xs font-semibold text-foreground">
				<ProviderIcon provider={label} />
				{label}
			</span>
			{children}
			<Button
				type="button"
				size="xs"
				variant={action === "Connect" ? "outline" : "ghost"}
				className={`ml-auto cursor-pointer disabled:cursor-not-allowed ${
					action === "Connect" ? "rounded-lg font-medium" : "text-muted-foreground hover:text-foreground"
				}`}
				data-testid={actionTestid}
				disabled={disabled}
				onClick={onAction}
			>
				{action}
			</Button>
		</div>
	);
}

export function ConnectionFooter({ leading, children, testid }: { leading?: React.ReactNode; children: React.ReactNode; testid?: string }) {
	return <div className="mt-4 flex flex-wrap items-center justify-between gap-3" data-testid={testid}>
		{leading}
		<div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
	</div>;
}

export function ConnectionDialog({ children, onClose, busy, label, testid, backdropTestid }: { children: React.ReactNode; onClose: () => void; busy: boolean; label: string; testid: string; backdropTestid: string }) {
	const ref = useRef<HTMLDivElement>(null), closeRef = useRef(onClose);
	closeRef.current = onClose;
	const backdropDismiss = useBackdropDismiss(() => { if (!busy) onClose(); });
	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		const focusable = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])') ?? [])];
		focusable()[0]?.focus();
		const key = (event: KeyboardEvent) => {
			if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
			else if (event.key === "Tab") {
				const items = focusable(), first = items[0], last = items.at(-1);
				if (!first) { event.preventDefault(); return; }
				if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
				else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
			}
		};
		document.addEventListener("keydown", key, true);
		return () => { document.removeEventListener("keydown", key, true); if (previous?.isConnected) previous.focus(); };
	}, []);
	return createPortal(
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100"
			data-testid={backdropTestid}
			{...backdropDismiss}
		>
			<div
				ref={ref}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				aria-busy={busy}
				data-testid={testid}
				onClick={(event) => event.stopPropagation()}
				className="mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}
