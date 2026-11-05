"use client";

/**
 * Switching, removing and adding target languages, shared by the sidebar's
 * language menu and Settings → Learning, so both ask the same questions and
 * restart the same way (components/switch-language.ts).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CountryFlag } from "@/components/ui/country-flag";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { AddLanguageDialog } from "@/components/add-language-dialog";
import { switchLanguage } from "@/components/switch-language";

export interface ProfileEntry {
	id: string;
	tag: string;
	endonym: string;
	english: string;
	lexicon: boolean;
	seed: boolean;
	/** Its words and course are complete. */
	ready?: boolean;
	removable?: boolean;
}

export interface ProfileInfo {
	active: string;
	profiles: ProfileEntry[];
}

export function useLanguageActions({ profile, onChanged }: { profile: ProfileInfo | null; onChanged: (next?: ProfileInfo) => void }) {
	const [pending, setPending] = useState<ProfileEntry | null>(null);
	const [removing, setRemoving] = useState<ProfileEntry | null>(null);
	// The language the Add dialog opens on, or true for none.
	const [adding, setAdding] = useState<string | boolean>(false);
	const [note, setNote] = useState<string | null>(null);

	/** Pick a language: switching restarts the app, so it asks first. One
	 *  without its course opens Add a language on it instead, since running
	 *  it would show another language's lessons. */
	const choose = (id: string) => {
		if (!profile || id === profile.active) return;
		setNote(null);
		const entry = profile.profiles.find((p) => p.id === id);
		if (!entry) return;
		if (entry.ready === false) setAdding(entry.id);
		else setPending(entry);
	};

	const confirmSwitch = async () => {
		if (!pending) return;
		const { id, english } = pending;
		setPending(null);
		try {
			const { restartNote } = await switchLanguage(id, english);
			setNote(restartNote);
		} catch (err) {
			setNote(err instanceof Error ? err.message : `Could not switch to ${english}.`);
		}
		onChanged();
	};

	const dialogs = (
		<>
			{pending && profile && (
				<ConfirmDialog
					testid="profile-confirm"
					confirmTestid="profile-confirm-switch"
					title={`Switch to ${pending.english}?`}
					flag={pending.id}
					lead={`LangHarness restarts in ${pending.english}.`}
					body={
						<>Your {profile.profiles.find((p) => p.id === profile.active)?.english ?? "current"} progress stays as it is.</>
					}
					confirm="Switch and restart"
					onConfirm={() => void confirmSwitch()}
					onCancel={() => setPending(null)}
				/>
			)}
			{removing && (
				<RemoveDialog
					entry={removing}
					onCancel={() => setRemoving(null)}
					onRemoved={() => {
						setRemoving(null);
						onChanged();
					}}
				/>
			)}
			{adding && (
				<AddLanguageDialog
					initial={typeof adding === "string" ? adding : undefined}
					onClose={() => setAdding(false)}
					onStarted={() => {
						setAdding(false);
						onChanged();
					}}
				/>
			)}
		</>
	);

	return {
		choose,
		askRemove: (entry: ProfileEntry) => {
			setNote(null);
			setRemoving(entry);
		},
		openAdd: (id?: string) => setAdding(id ?? true),
		note,
		dialogs,
	};
}

function RemoveDialog({ entry, onCancel, onRemoved }: { entry: ProfileEntry; onCancel: () => void; onRemoved: () => void }) {
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const remove = async () => {
		setBusy(true);
		setError(null);
		const res = await fetch("/api/languages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "remove", id: entry.id }) }).catch(() => null);
		if (!res?.ok) {
			const body = (await res?.json().catch(() => null)) as { message?: string } | null;
			setError(body?.message ?? `Could not remove ${entry.english}.`);
			setBusy(false);
			return;
		}
		onRemoved();
	};
	return (
		<ConfirmDialog
			testid="profile-remove-confirm"
			confirmTestid="profile-remove-confirm-button"
			title={`Remove ${entry.english}?`}
			flag={entry.id}
			lead="It leaves your list of languages."
			body={`Any words downloaded for it are deleted. Your ${entry.english} progress stays: add ${entry.english} again and you pick up where you were.`}
			error={error}
			confirm="Remove"
			destructive
			busy={busy}
			onConfirm={() => void remove()}
			onCancel={onCancel}
		/>
	);
}

function ConfirmDialog({
	testid,
	confirmTestid,
	title,
	flag,
	lead,
	body,
	error,
	confirm,
	destructive,
	busy,
	onConfirm,
	onCancel,
}: {
	testid: string;
	confirmTestid: string;
	title: string;
	flag: string;
	lead: string;
	body: React.ReactNode;
	error?: string | null;
	confirm: string;
	destructive?: boolean;
	busy?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const dismiss = useBackdropDismiss(onCancel);
	const confirmRef = useRef<HTMLButtonElement>(null);
	const cancelRef = useRef(onCancel);
	cancelRef.current = onCancel;

	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		confirmRef.current?.focus();
		// Capture phase: the Settings dialog under this one closes on Escape too, and one Escape should close only this.
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			cancelRef.current();
		};
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("keydown", onKey, true);
			if (previous?.isConnected) previous.focus();
		};
	}, []);

	if (typeof document === "undefined") return null;
	return createPortal(
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100" {...dismiss}>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={`${testid}-title`}
				data-testid={testid}
				onClick={(e) => e.stopPropagation()}
				className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-5 shadow-raise-hi animate-in zoom-in-95 duration-150"
			>
				<div className="flex items-center gap-3">
					<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/40">
						<CountryFlag lang={flag} className="h-[20px] w-[30px] rounded-[4px]" />
					</div>
					<div className="min-w-0 flex-1">
						<h3 id={`${testid}-title`} className="text-sm font-semibold text-foreground">
							{title}
						</h3>
						<p className="text-xs text-muted-foreground">{lead}</p>
					</div>
				</div>
				<p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
				{error && (
					<p className="text-xs text-destructive" role="alert">
						{error}
					</p>
				)}
				<div className="flex items-center justify-end gap-2 pt-2">
					<button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
						Cancel
					</button>
					<button
						ref={confirmRef}
						type="button"
						data-testid={confirmTestid}
						disabled={busy}
						onClick={onConfirm}
						className={
							destructive
								? "rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-destructive/90 disabled:opacity-50 dark:bg-destructive/60"
								: "rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
						}
					>
						{confirm}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
