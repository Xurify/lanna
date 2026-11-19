"use client";

import { useEffect, useRef, useState } from "react";

export function ReviewKnownRemoval({
	slug,
	lemma,
	at,
	profile,
	language,
	onDismiss,
}: {
	slug: string;
	lemma: string;
	at: string;
	profile: string;
	language?: string;
	onDismiss: () => void;
}) {
	const key = `lanna:known-removal:${profile}:${slug}`;
	const [dismissed, setDismissed] = useState(() => {
		try {
			return localStorage.getItem(key) === at;
		} catch {
			return false;
		}
	});
	const [saving, setSaving] = useState(false);
	const [restored, setRestored] = useState(false);
	const [error, setError] = useState(false);
	const dismissRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (restored) dismissRef.current?.focus();
	}, [restored]);
	const dismiss = () => {
		try {
			localStorage.setItem(key, at);
		} catch {}
		setDismissed(true);
		onDismiss();
	};
	const undo = async () => {
		if (saving) return;
		setSaving(true);
		setError(false);
		try {
			const res = await fetch("/api/words/known", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ slug, known: true }),
			});
			if (!res.ok || (await res.json()).known !== true) throw new Error("Could not restore mark");
			setRestored(true);
		} catch {
			setError(true);
		} finally {
			setSaving(false);
		}
	};
	if (dismissed) return null;
	return (
		<div
			className="mt-4 rounded-lg border border-edge bg-card px-4 py-3 text-[14px] text-foreground"
			data-testid="review-known-removal"
		>
			<p role="status">
				<span lang={language} className="font-semibold">
					{lemma}
				</span>
				{restored ? " is marked as known again." : " is no longer marked as known after 3 unassisted misses in a row."}
			</p>
			<div className="mt-2 flex flex-wrap gap-2">
				{!restored && (
					<button
						type="button"
						className="q-btn sec min-h-11"
						onClick={() => void undo()}
						onKeyDown={(event) => event.stopPropagation()}
						disabled={saving}
					>
						{saving ? "Restoring…" : "Undo"}
					</button>
				)}
				<button
					ref={dismissRef}
					type="button"
					className="q-btn ghost min-h-11"
					onClick={dismiss}
					onKeyDown={(event) => event.stopPropagation()}
					disabled={saving}
				>
					Dismiss
				</button>
			</div>
			{error && (
				<p role="alert" className="mt-2">
					Couldn&apos;t restore the known mark. Try Undo again.
				</p>
			)}
		</div>
	);
}
